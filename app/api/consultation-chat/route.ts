import {
  ApiError,
  apiErrorResponse,
  getVerifiedUser,
} from "@/lib/server/line-user";

type Target = "event" | "feelings" | "wish" | "clarification";

type QaPair = {
  question: string;
  answer: string;
};

type ConsultationChatResult = {
  initialConsultationAccepted: boolean;
  accepted: boolean;
  target: Target;
  question: string;
  collected: {
    event: boolean;
    feelings: boolean;
    wish: boolean;
  };
  shouldFinish: boolean;
};

const MAX_QA_PAIRS = 6;
const MAX_TEXT_LENGTH = 4_000;


const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    accepted: { type: "boolean" },
    target: {
      type: "string",
      enum: ["event", "feelings", "wish", "clarification"],
    },
    question: { type: "string" },
    collected: {
      type: "object",
      additionalProperties: false,
      properties: {
        event: { type: "boolean" },
        feelings: { type: "boolean" },
        wish: { type: "boolean" },
        initialConsultationAccepted: { type: "boolean" },
      },
      required: [
        "initialConsultationAccepted",
        "accepted",
        "target",
        "question",
        "collected",
        "shouldFinish",
      ],
    },
    shouldFinish: { type: "boolean" },
  },
  required: [
    "accepted",
    "target",
    "question",
    "collected",
    "shouldFinish",
  ],
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

function isConsultationChatResult(
  value: unknown,
): value is ConsultationChatResult {
  if (typeof value !== "object" || value === null) return false;

  const result = value as Record<string, unknown>;
  const collected = result.collected;

  return (
    typeof result.accepted === "boolean" &&
    ["event", "feelings", "wish", "clarification"].includes(
      result.target as string,
    ) &&
    typeof result.question === "string" &&
    typeof result.shouldFinish === "boolean" &&
    typeof result.initialConsultationAccepted === "boolean" &&
    typeof collected === "object" &&
    collected !== null &&
    typeof (collected as Record<string, unknown>).event === "boolean" &&
    typeof (collected as Record<string, unknown>).feelings === "boolean" &&
    typeof (collected as Record<string, unknown>).wish === "boolean" &&
    (result.shouldFinish
      ? result.question.length === 0
      : result.question.trim().length > 0)
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

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    const body = (await request.json().catch(() => null)) as {
      consultationId?: unknown;
      initialConsultation?: unknown;
      qaPairs?: unknown;
      currentQuestionCount?: unknown;
    } | null;

    if (
      !body ||
      typeof body.consultationId !== "string" ||
      body.consultationId.trim().length === 0 ||
      typeof body.initialConsultation !== "string" ||
      body.initialConsultation.trim().length === 0 ||
      body.initialConsultation.length > MAX_TEXT_LENGTH ||
      !Array.isArray(body.qaPairs) ||
      body.qaPairs.length > MAX_QA_PAIRS ||
      !body.qaPairs.every(isQaPair) ||
      !Number.isInteger(body.currentQuestionCount) ||
      (body.currentQuestionCount as number) < 0 ||
      body.currentQuestionCount !== body.qaPairs.length
    ) {
      throw new ApiError("相談チャットの内容が正しくありません", 400);
    }

    const { data: consultation, error: consultationError } = await supabase
      .from("consultations")
      .select("id")
      .eq("id", body.consultationId)
      .eq("consultant_user_id", userId)
      .maybeSingle();

    if (consultationError) {
      console.error("Failed to verify consultation", consultationError);
      throw new ApiError("相談情報を確認できませんでした", 500);
    }

    if (!consultation) {
      throw new ApiError("対象の相談が見つかりません", 404);
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

    const openAiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          store: false,


          instructions: [
            "あなたは、カップル間の悩みについて、相談者自身もまだ明確に認識していない価値観・前提・判断基準・違和感の源泉を、対話から特定していく聞き手です。",

            "最終的には、相談者の話を次の3点として整理できる状態を目指してください。",
            "1. 実際に起こったこと",
            "2. 相談者の気持ちと、その気持ちにつながっている本質的な引っかかり",
            "3. パートナーにしてほしいこと、または二人の関係がどうなってほしいか",

            "【最重要方針】",
            "相談者の最初の説明や理由を、本当の原因だと決めつけてはいけません。",
            "initialConsultationとこれまでのqaPairs全体を毎回読み、相談者についての仮説を更新してください。",
            "新しい回答が以前の仮説と矛盾する場合は、以前の仮説より新しい回答を優先してください。",
            "相談者から否定・訂正・例外が示された内容は保存せず、その情報を使って仮説を修正してください。",

            "会話では、表面的な出来事そのものよりも、相談者が『何なら納得できるのか』『どの条件なら判断が変わるのか』『何があると嫌ではなくなるのか』を重視してください。",
            "相談者の発言に現れる例外、条件の違い、判断の変化、発言同士の差分から、繰り返し現れる価値基準を探してください。",

            "たとえば、相談者がある行動を嫌だと言っていても、その行動自体が嫌なのか、頻度、タイミング、一方的であること、扱いの差、期待とのズレなど別の条件が問題なのかを区別してください。",
            "ただし、相談者本人が話していない価値観や感情を事実として断定してはいけません。",

            "【内部で毎回更新する内容】",
            "毎ターン、質問を作る前に内部で次を整理してください。",
            "・現在の表面上の悩み",
            "・相談者が明示した理由",
            "・その理由に当てはまらない例外",
            "・相談者の判断が変わる条件",
            "・繰り返し現れている判断基準や価値観",
            "・相談者が強く違和感を持つ構造",
            "・相談者が望んでいる状態",
            "・現在もっとも有力な本質的な引っかかりの仮説",
            "・その仮説を変える可能性が最も高い未確認事項",

            "内部整理の内容をそのまま相談者へ列挙してはいけません。自然な会話として質問してください。",

            "【質問をする基準】",
            "質問するのは、その回答によって現在の仮説、相談者の判断基準、または最終的な整理結果が実際に変わる可能性がある場合だけです。",
            "すでに相談者の発言から十分に推測できることを確認のためだけに質問してはいけません。",
            "すでに話した事実を、表現を変えて聞き直してはいけません。",
            "整理結果を書くためだけの形式的な情報収集をしてはいけません。",

            "『なぜですか？』『どうしてですか？』と直接理由を尋ね続けることは避けてください。",
            "代わりに、相談者がすでに話した内容の差分や例外を使って質問してください。",

            "たとえば、Aでは嫌だがBなら嫌ではないという情報がある場合は、『AとBの何が違うのか』が分かる質問を優先してください。",
            "ある条件では納得でき、別の条件では納得できない場合は、その境界線を特定する質問を優先してください。",

            "相談者自身に、自分の気持ちや価値観を分析させる質問は避けてください。",
            "『なぜそう感じると思いますか』『何を大切にしていると思いますか』のような自己分析を求める質問は原則として使用しないでください。",
            "具体的な場面、行動、条件、比較について尋ね、その回答からAI側で構造を推測してください。",

            "【質問対象】",
            "質問の中心は常に相談者本人です。",
            "パートナーの気持ち、考え、性格、意図を推測させる質問をしてはいけません。",
            "『相手はどう思っていると思いますか』『相手はなぜそうしたと思いますか』のような質問は禁止です。",
            "パートナーについて尋ねる場合は、相談者が実際に見聞きした具体的な行動や発言を確認する場合だけにしてください。",

            "【価値観の扱い】",
            "相談者の価値観を無条件に正しいものとして扱ってはいけません。",
            "相談者とパートナーで異なる前提や価値基準が存在する可能性を残してください。",
            "相談者側の期待、前提、判断基準が問題を大きくしている可能性も除外してはいけません。",
            "ただし、相談者を批判したり、どちらが正しいかを判断したりすることが目的ではありません。",
            "目的は、相談者がどのような条件で納得し、どのような構造に違和感を持つのかを正確に特定することです。",

            "【event・feelings・wish】",
            "eventには、実際に起こった行動・発言・状況のみを使用し、感情、評価、推測、相手の意図を含めないでください。",
            "feelingsは感情名を集めるだけではなく、その感情が何に反応して生じているのかまで理解することを重視してください。",
            "wishは『○○してほしい』という直接的な要求だけでなく、『どういう状態なら納得できるか』も含めて捉えてください。",

            "event、feelings、wishを順番に1項目ずつ聞く必要はありません。",
            "1つの回答から複数の項目を推測できる場合は、それらを取得済みとして扱ってください。",
            "取得済みの情報を確認するためだけの質問はしないでください。",

            "【質問回数】",
            "質問回数は最大4回です。",
            "4回すべてを必ず使う必要はありません。",
            "質問数を使い切ることより、本質的な引っかかりを特定することを優先してください。",
            "各質問では、現在もっとも不確かな一点だけを確認してください。",
            "一度に質問するのは必ず1問だけにしてください。",
            "通常の質問は短く、自然な日本語にしてください。",

            "【回答判定】",
            "qaPairsが空の場合はacceptedをtrueにしてください。",
            "qaPairsがある場合は、最後のanswerが直前のquestionへの回答として成立しているかだけを判定してください。",
            "短い回答でも質問への応答として成立していればacceptedをtrueにしてください。",
            "『分からない』『覚えていない』『特にない』『どちらでもない』も有効な回答としてacceptedをtrueにしてください。",
            "【初回相談内容の判定】",
            "initialConsultationAcceptedは、initialConsultationからAIが相談の会話を始められる最低限の材料があるかを判定してください。",
            "判定は厳しくしすぎないでください。",
            "パートナーとの出来事、行動、関係上の困りごと、違和感、希望の対象のいずれかが少しでも読み取れる場合はtrueにしてください。",
            "文章が短いこと、気持ちや理由が書かれていないことだけを理由にfalseにしてはいけません。",
            "たとえば『LINEの返事が遅い』『最近会話が減った』『喧嘩した』『もっと会いたい』はtrueです。",
            "『相談したい』『つらい』『どうしよう』『助けて』のように、何について相談したいのか全く特定できない場合だけfalseにしてください。",

            "acceptedがfalseの場合のみ、新しい論点へ進まず、直前の質問の意図を保ったまま聞き直してください。",
            "聞き直す場合も、すでに相談者が話している内容を選択肢として再確認するだけの質問にはしないでください。",

            "二択で聞き直す必要がある場合は、これまでの相談内容から自然に導ける内容だけを使用してください。",
            "相談者がまだ話していない事実、感情、理由、価値観、希望を選択肢として創作してはいけません。",
            "二択の場合は、必ず『1. ○○』『2. ○○』の形式で示してください。",

            "【出力】",
            "targetは、今回の質問によって主に更新しようとしている内容に応じてevent、feelings、wishのいずれかを指定してください。",
            "ただし、質問そのものはtargetを埋めるためではなく、現在の仮説を更新するために選んでください。",
            "聞き直しの場合はtargetにclarificationを使用してください。",

            "questionは必ず空でない日本語の質問1つだけにしてください。",
            "shouldFinishは常にfalseにしてください。"
          ].join("\n"),

          input: JSON.stringify({
            initialConsultation: body.initialConsultation.trim(),
            qaPairs,
            currentQuestionCount: body.currentQuestionCount,
          }),

          reasoning: {
            effort: "low",
          },

          text: {
            format: {
              type: "json_schema",
              name: "consultation_chat_result",
              strict: true,
              schema: responseSchema,
            },
          },
        }),
        cache: "no-store",
      },
    );

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      const requestId = openAiResponse.headers.get("x-request-id");

      console.error("OpenAI consultation chat request failed", {
        status: openAiResponse.status,
        requestId,
        errorText,
      });

      throw new ApiError("相談AIから回答を取得できませんでした", 502);
    }

    const openAiResult = (await openAiResponse.json()) as unknown;
    const outputText = getOutputText(openAiResult);

    if (!outputText) {
      console.error("OpenAI consultation chat response had no output text");
      throw new ApiError("相談AIから回答を取得できませんでした", 502);
    }

    let result: unknown;

    try {
      result = JSON.parse(outputText);
    } catch {
      console.error("OpenAI consultation chat response was not valid JSON");
      throw new ApiError("相談AIから回答を取得できませんでした", 502);
    }

    if (!isConsultationChatResult(result)) {
      console.error("OpenAI consultation chat response did not match schema");
      throw new ApiError("相談AIから回答を取得できませんでした", 502);
    }

    return Response.json(result);

  } catch (error) {
    return apiErrorResponse(error);
  }
}
