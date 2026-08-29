import {
  ApiError,
  apiErrorResponse,
  getVerifiedUser,
} from "@/lib/server/line-user";

type QaPair = {
  question: string;
  answer: string;
};

type RespondentChatResult = {
  accepted: boolean;
  question: string;
  debug: {
    known: string[];
    missing: string[];
    reason: string;
  };
};

const MAX_VALID_ANSWERS = 4;
const MAX_ATTEMPTS = 6;
const MAX_TEXT_LENGTH = 4_000;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    accepted: { type: "boolean" },
    question: { type: "string" },
    debug: {
      type: "object",
      additionalProperties: false,
      properties: {
        known: {
          type: "array",
          items: { type: "string" },
        },
        missing: {
          type: "array",
          items: { type: "string" },
        },
        reason: { type: "string" },
      },
      required: ["known", "missing", "reason"],
    },
  },
  required: ["accepted", "question", "debug"],
} as const;

function isQaPair(value: unknown): value is QaPair {
  if (typeof value !== "object" || value === null) return false;

  const pair = value as Record<string, unknown>;
  return (
    typeof pair.question === "string" &&
    pair.question.trim().length > 0 &&
    pair.question.length <= MAX_TEXT_LENGTH &&
    typeof pair.answer === "string" &&
    pair.answer.trim().length > 0 &&
    pair.answer.length <= MAX_TEXT_LENGTH
  );
}

function getOutputText(response: unknown) {
  if (typeof response !== "object" || response === null) return null;

  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "output_text" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
    }
  }

  return null;
}

function isRespondentChatResult(value: unknown): value is RespondentChatResult {
  if (typeof value !== "object" || value === null) return false;

  const result = value as Record<string, unknown>;

  if (
    typeof result.accepted !== "boolean" ||
    typeof result.question !== "string" ||
    result.question.trim().length === 0 ||
    typeof result.debug !== "object" ||
    result.debug === null
  ) {
    return false;
  }

  const debug = result.debug as Record<string, unknown>;

  return (
    Array.isArray(debug.known) &&
    debug.known.every((item) => typeof item === "string") &&
    Array.isArray(debug.missing) &&
    debug.missing.every((item) => typeof item === "string") &&
    typeof debug.reason === "string"
  );
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    const body = (await request.json().catch(() => null)) as {
      consultationId?: unknown;
      qaPairs?: unknown;
      currentQuestionCount?: unknown;
    } | null;

    if (
      !body ||
      typeof body.consultationId !== "string" ||
      body.consultationId.trim().length === 0 ||
      !Array.isArray(body.qaPairs) ||
      body.qaPairs.length > MAX_VALID_ANSWERS ||
      !body.qaPairs.every(isQaPair) ||
      !Number.isInteger(body.currentQuestionCount) ||
      (body.currentQuestionCount as number) < 0 ||
      (body.currentQuestionCount as number) > MAX_ATTEMPTS ||
      body.qaPairs.length > (body.currentQuestionCount as number)
    ) {
      throw new ApiError("回答者チャットの内容が正しくありません", 400);
    }

    const { data: consultation, error: consultationError } = await supabase
      .from("consultations")
      .select("id")
      .eq("id", body.consultationId)
      .eq("respondent_user_id", userId)
      .maybeSingle();

    if (consultationError) {
      console.error("Failed to verify respondent consultation", consultationError);
      throw new ApiError("相談情報を確認できませんでした", 500);
    }
    if (!consultation) {
      throw new ApiError("対象の相談が見つかりません", 404);
    }

    const { data: consultantResult, error: resultError } = await supabase
      .from("consultation_results")
      .select("event, feelings, wish")
      .eq("consultation_id", consultation.id)
      .eq("role", "consultant")
      .maybeSingle();

    if (resultError) {
      console.error("Failed to load consultant result for respondent chat", resultError);
      throw new ApiError("相談内容を取得できませんでした", 500);
    }
    if (!consultantResult) {
      throw new ApiError("相談内容がまだ確定していません", 404);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not configured");
      throw new ApiError("相談AIを利用できません", 503);
    }

    const qaPairs = body.qaPairs.map(({ question, answer }) => ({
      question: question.trim(),
      answer: answer.trim(),
    }));

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        store: false,


        instructions: [
          "あなたは、カップル間の悩みについて、回答者自身もまだ明確に認識していない価値観・前提・判断基準・違和感の源泉を、対話から特定していく聞き手です。",

          "相談者の整理結果を参考情報として読み、回答者との会話を通して、最終的に次の3点を整理できる状態を目指してください。",
          "1. 回答者側から見て実際に起こったこと",
          "2. 回答者の気持ちと、その気持ちにつながっている本質的な引っかかり",
          "3. パートナーにしてほしいこと、または二人の関係がどうなってほしいか",

          "【相談者の整理結果の扱い】",
          "相談者の整理結果は、相談者側から見た認識であり、客観的事実として扱ってはいけません。",
          "相談者の整理結果を正しい前提として、回答者に説明や弁明を求めてはいけません。",
          "相談者側と回答者側のどちらが正しい、悪い、妥当であるかを判断してはいけません。",
          "相談者の主張に同意するよう回答者を誘導してはいけません。",
          "回答者の役割は相談者の主張に反論することではありません。回答者自身が何を見て、どう受け止め、どのような基準で判断していたのかを整理してください。",

          "【最重要方針】",
          "回答者が最初に話した説明や理由を、本当の原因だと決めつけてはいけません。",
          "相談者の整理結果とこれまでのqaPairs全体を毎回読み、回答者についての仮説を更新してください。",
          "新しい回答が以前の仮説と矛盾する場合は、以前の仮説より新しい回答を優先してください。",
          "回答者から否定・訂正・例外が示された内容は固定せず、その情報を使って仮説を修正してください。",

          "回答者が表面的に説明した理由だけでなく、『何なら納得できるのか』『どの条件なら判断が変わるのか』『何が違えば嫌ではないのか』を重視してください。",
          "回答者の発言に現れる例外、条件の違い、判断の変化、発言同士の差分から、繰り返し現れる判断基準や価値観を探してください。",

          "たとえば、ある行動をしなかった理由を回答者が説明していても、その理由だけを保存して終わらず、頻度、タイミング、役割分担、一方的であること、負担感、期待とのズレなど、別の条件によって判断が変わる可能性を検討してください。",
          "ただし、回答者本人が話していない価値観や感情を事実として断定してはいけません。",

          "【内部で毎回更新する内容】",
          "毎ターン、質問を作る前に内部で次を整理してください。",
          "・現在の表面上の論点",
          "・回答者が明示した理由",
          "・その理由に当てはまらない例外",
          "・回答者の判断が変わる条件",
          "・繰り返し現れている判断基準や価値観",
          "・回答者が強く違和感を持つ構造",
          "・回答者が望んでいる状態",
          "・相談者の認識と回答者の認識で一致している点",
          "・相談者の認識と回答者の認識で異なっている点",
          "・現在もっとも有力な本質的な引っかかりの仮説",
          "・その仮説を変える可能性が最も高い未確認事項",

          "内部整理の内容をそのまま回答者へ列挙してはいけません。自然な会話として質問してください。",

          "【質問をする基準】",
          "質問するのは、その回答によって現在の仮説、回答者の判断基準、相談者との認識差、または最終的な整理結果が実際に変わる可能性がある場合だけです。",
          "すでに回答者の発言から十分に推測できることを確認のためだけに質問してはいけません。",
          "すでに回答者が話した事実を、表現を変えて聞き直してはいけません。",
          "相談者の整理結果に書かれている内容を、そのまま回答者へ確認するだけの質問をしてはいけません。",
          "整理結果を書くためだけの形式的な情報収集をしてはいけません。",

          "『なぜですか？』『どうしてですか？』と直接理由を尋ね続けることは避けてください。",
          "代わりに、回答者がすでに話した内容の差分、例外、条件の違いを使って質問してください。",

          "たとえば、Aの場合は納得できるがBの場合は納得できないという情報がある場合は、『AとBの何が違うのか』が分かる質問を優先してください。",
          "ある条件では行動でき、別の条件では行動しない場合は、その判断の境界線を特定する質問を優先してください。",

          "回答者自身に、自分の気持ちや価値観を分析させる質問は避けてください。",
          "『なぜそう感じると思いますか』『何を大切にしていると思いますか』のような自己分析を求める質問は原則として使用しないでください。",
          "具体的な場面、行動、条件、比較について尋ね、その回答からAI側で構造を推測してください。",

          "【質問対象】",
          "質問の中心は常に回答者本人です。",
          "相談者の気持ち、考え、性格、意図を回答者に推測させる質問をしてはいけません。",
          "『パートナーはなぜそう言ったと思いますか』『パートナーはどう感じていたと思いますか』のような質問は禁止です。",
          "相談者について尋ねる場合は、回答者が実際に見聞きした具体的な行動や発言を確認する場合だけにしてください。",

          "【相談者視点の変換】",
          "相談者視点の文章を、そのまま回答者への質問に使用してはいけません。",
          "相談者の文章に登場する『彼』『彼女』『夫』『妻』『パートナー』などが回答者本人を指している場合は、回答者視点に正しく変換してください。",
          "ただし、相談者の評価や解釈まで引き継いではいけません。",
          "例えば相談者が『私が頼んでも彼が家事をしてくれない』と話している場合でも、『なぜ家事をしてくれないのですか』とは聞かず、回答者が実際に取った行動や判断条件を確認してください。",

          "【価値観の扱い】",
          "回答者の価値観を無条件に正しいものとして扱ってはいけません。",
          "相談者と回答者で異なる前提や価値基準が存在する可能性を残してください。",
          "回答者側の期待、前提、判断基準が問題を大きくしている可能性も除外してはいけません。",
          "ただし、回答者を批判したり、どちらが正しいかを判断したりすることが目的ではありません。",
          "目的は、回答者がどのような条件で納得し、どのような構造に違和感を持ち、何を基準に行動しているのかを正確に特定することです。",

          "【event・feelings・wish】",
          "eventには、回答者本人が実際に見聞きした行動・発言・状況のみを使用し、感情、評価、推測、相手の意図を含めないでください。",
          "feelingsは感情名を集めるだけではなく、その感情が何に反応して生じているのかまで理解することを重視してください。",
          "wishは『○○してほしい』という直接的な要求だけでなく、『どういう状態なら納得できるか』『どういう関係なら負担や違和感が減るか』も含めて捉えてください。",

          "event、feelings、wishを順番に1項目ずつ聞く必要はありません。",
          "1つの回答から複数の項目を推測できる場合は、それらを取得済みとして扱ってください。",
          "取得済みの情報を確認するためだけの質問はしないでください。",

          "【質問回数】",
          "質問回数は最大4回です。",
          "4回すべてを必ず使う必要はありません。",
          "質問数を使い切ることより、回答者側の本質的な引っかかりと判断基準を特定することを優先してください。",
          "各質問では、現在もっとも不確かな一点だけを確認してください。",
          "一度に質問するのは必ず1問だけにしてください。",
          "通常の質問は短く、自然な日本語にしてください。",

          "【回答判定】",
          "qaPairsが空の場合はacceptedをtrueにしてください。",
          "qaPairsがある場合は、最後のanswerが直前のquestionへの回答として成立しているかだけを判定してください。",
          "短い回答でも質問への応答として成立していればacceptedをtrueにしてください。",
          "『分からない』『覚えていない』『特にない』『どちらでもない』も有効な回答としてacceptedをtrueにしてください。",

          "acceptedがfalseの場合のみ、新しい論点へ進まず、直前の質問の意図を保ったまま、より答えやすい表現で1問だけ聞き直してください。",
          "聞き直す場合も、すでに回答者が話している内容を確認するだけの質問にはしないでください。",

          "二択で聞き直す必要がある場合は、直前の質問、相談者の整理結果、これまでの回答者の発言から自然に導ける内容だけを使用してください。",
          "回答者がまだ話していない事実、感情、理由、価値観、希望を選択肢として創作してはいけません。",
          "二択の場合は、必ず『1. ○○』『2. ○○』の形式で示してください。",

          "【出力】",
          "targetは、今回の質問によって主に更新しようとしている内容に応じてevent、feelings、wishのいずれかを指定してください。",
          "ただし、質問そのものはtargetを埋めるためではなく、現在の仮説を更新するために選んでください。",
          "聞き直しの場合はtargetにclarificationを使用してください。",

          "開発確認用として、今回の質問を選んだ判断結果をdebugに出力してください。",
          "debug.knownには、相談者の整理結果と回答者のこれまでの回答から、今回の質問判断に関係する既知情報だけを簡潔に入れてください。",
          "debug.missingには、現在の仮説を更新するために不足している情報だけを簡潔に入れてください。",
          "debug.reasonには、knownとmissingを踏まえて、なぜ今回この質問を選んだのかという判断結果だけを簡潔に説明してください。",
          "詳細な推論過程はdebugに出力しないでください。",

          "questionは必ず空でない日本語の質問1つだけにしてください。",
          "shouldFinishは常にfalseにしてください。"
        ].join("\n"),



        input: JSON.stringify({
          consultantPerspective: {
            event: consultantResult.event,
            feelings: consultantResult.feelings,
            wish: consultantResult.wish,
          },
          qaPairs,
          currentQuestionCount: body.currentQuestionCount,
        }),
        reasoning: { effort: "low" },
        text: {
          format: {
            type: "json_schema",
            name: "respondent_consultation_chat_result",
            strict: true,
            schema: responseSchema,
          },
        },
      }),
      cache: "no-store",
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      const requestId = openAiResponse.headers.get("x-request-id");
      console.error("OpenAI respondent consultation chat request failed", {
        status: openAiResponse.status,
        requestId,
        errorText,
      });
      throw new ApiError("相談AIから回答を取得できませんでした", 502);
    }

    const openAiResult = (await openAiResponse.json()) as unknown;
    const outputText = getOutputText(openAiResult);
    if (!outputText) {
      console.error("OpenAI respondent consultation chat response had no output text");
      throw new ApiError("相談AIから回答を取得できませんでした", 502);
    }

    let result: unknown;
    try {
      result = JSON.parse(outputText);
    } catch {
      console.error("OpenAI respondent consultation chat response was not valid JSON");
      throw new ApiError("相談AIから回答を取得できませんでした", 502);
    }

    if (!isRespondentChatResult(result)) {
      console.error("OpenAI respondent consultation chat response did not match schema");
      throw new ApiError("相談AIから回答を取得できませんでした", 502);
    }

    return Response.json({
      accepted: result.accepted,
      question: result.question.trim(),
      debug: {
        known: result.debug.known,
        missing: result.debug.missing,
        reason: result.debug.reason.trim(),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
