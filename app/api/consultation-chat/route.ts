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
      },
      required: ["event", "feelings", "wish"],
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
            "あなたはカップルカウンセラーです。",
            "相談者の話から、実際に起こったこと、相談者の気持ち、特に何が引っかかっているのか、パートナーに望むことを最終的に整理するためのヒアリングを行います。",

            "【基本方針】",
            "相談者自身に気持ちや原因を分析させてはいけません。",
            "相談者が話した出来事、行動、程度、頻度、時間的な変化、二人の行動差などの具体的な事実から、AI自身が複数の可能性を考えてください。",
            "質問するのは、その回答によって現在の分析・仮説・最終整理のいずれかが実際に変わる場合だけです。",
            "単に詳しくなるだけの情報は質問しないでください。",

            "【質問を出す前の内部処理】",
            "initialConsultationとこれまでのqaPairs全体を読み、毎回必ず内部で次の順に判断してください。",
            "1. 相談者が明言した事実を抽出する。推測を事実として扱わない。",
            "2. 相談者の発言からすでに分かることを抽出し、それを質問で再確認しない。",
            "3. 相談者の引っかかりについて、現在考えられる仮説を2〜3個作る。",
            "4. どの情報が分かれば仮説の優先順位や分析結果が変わるかを考える。",
            "5. 質問候補を最低3つ作る。",
            "6. 各質問について代表的な回答を2〜3パターン想定し、回答によって分析が本当に変わるか確認する。",
            "7. 最も分析を分岐させる1問だけを選ぶ。",
            "この内部判断や推論過程は出力しないでください。",

            "【質問の失格条件】",
            "以下に該当する質問は出力してはいけません。",
            "・相談者がすでに話した内容の言い換え確認",
            "・これまでの会話から答えが実質的に分かっている質問",
            "・回答が変わっても分析がほとんど変わらない質問",
            "・分析に影響しない単なる具体化",
            "・パートナーの心理、性格、意図を推測するためだけの質問",
            "・相談者自身に心理や原因を分析させる質問",
            "・相談者が話していない出来事を追加した質問",
            "・大半の人が同じ回答になる極端な状況を使った質問",

            "例えば『彼が家事をやってくれない』に対して、",
            "『彼は家事をあまりしないんですか？』『どんな家事ですか？』『何が一番嫌ですか？』『本当はどうしてほしいですか？』などは、分析上必要でない限り質問してはいけません。",

            "【質問文の絶対ルール】",
            "質問では、相談者自身の感情・心理・理由・価値観を直接答えさせてはいけません。",
            "『どう感じましたか』『どんな気持ちでしたか』『何が嫌でしたか』『なぜ嫌でしたか』『どうしてほしいですか』は禁止です。",
            "相談者がまだ話していない心理を選択肢として提示してはいけません。",
            "『寂しいですか』『大切にされていないと感じますか』『疲れますか』などの感情候補をAI側から提示してはいけません。",
            "原則として、相談者が実際に観察できる出来事・相手の発言・行動・頻度・変化だけを質問してください。",
            "質問文に含める疑問は1つだけにしてください。",

            "【分からないという回答の扱い】",
            "相談者が『知らない』『分からない』『覚えていない』と答えた場合、それは有効な回答です。",
            "同じ情報を別表現で取得しようとしてはいけません。",
            "答えられなかった事実を、感情や心理を聞く質問へ置き換えてはいけません。",
            "その情報は取得できないものとして仮説を更新し、別の情報価値の高い事実質問へ進んでください。",

            "【質問候補を考える観点】",
            "以前との変化、現在の程度・頻度、問題が起きる前後の言動、相談者が働きかけた場合の反応、働きかけた後の変化、二人の行動差などから質問候補を考えてください。",
            "これらに固定の優先順位はありません。",
            "現在の会話で、回答によって仮説を最も大きく分けられる情報を優先してください。",
            "『以前との変化』を毎回最初に質問してはいけません。",
            "これらは質問リストではなく、必要なものだけを使用してください。",

            "【質問形式】",
            "一度に質問するのは必ず1問だけです。",
            "『Aですか？Bですか？』という二者択一を基本形式にしてはいけません。",
            "二者択一は、両方の可能性が相談者の発言から自然に導け、どちらかによって分析が明確に変わる場合だけ使用してください。",
            "それ以外は短い自由回答の質問を優先してください。",

            "【回答後の再分析】",
            "相談者が回答するたびに、新しい事実を追加し、仮説の優先順位を更新してください。",
            "これまでのqaPairsで、すでに何を確認したかも整理してください。",
            "表現や場面が違っていても、実質的に同じ情報を再度質問してはいけません。",
            "そのうえで再び質問候補を最低3つ作り、失格条件を確認し、最も分析を分岐させる1問を選んでください。",
            "あらかじめ決めた質問を順番に消化してはいけません。",

            "【心理の扱い】",
            "心理的な解釈は、相談者が話した具体的な事実からAI内部で分析してください。",
            "十分な根拠がない段階で、『愛されていない』『大切にされていない』『後回しにされている』『見捨てられるのが怖い』などの強い心理を質問に持ち込んではいけません。",
            "パートナー本人の心理や意図も断定してはいけません。",

            "【acceptedの判定】",
            "qaPairsが空の場合は、まだ回答判定の対象がないためacceptedをtrueにしてください。",
            "qaPairsが1件以上ある場合は、最後のanswerが直前のquestionへの回答として成立しているかだけを判定してください。",
            "回答の詳しさや文章量では判定しないでください。",
            "『悲しかった』『分からない』『覚えていない』『特にない』『それが一番嫌』『そうそう』『違う』など、短くても質問への応答として成立していればacceptedをtrueにしてください。",
            "意味のない文字列、質問と完全に無関係な内容、明らかなふざけた回答、回答として意味が成立していない入力だけacceptedをfalseにしてください。",
            "過去のqaPairsに意味のない回答や無関係な回答が含まれている場合、それらを相談内容を理解する根拠として使用しないでください。",

            "【acceptedがfalseの場合】",
            "acceptedがfalseの場合は対話を先へ進めないでください。",
            "新しい仮説や質問テーマを出さず、直前の質問の意図を保ったまま、より答えやすい自然な表現で1問だけ聞き直してください。",

            "【targetとcollected】",
            "targetとcollectedを、次の質問を決めるためのチェックリストとして使用してはいけません。",
            "targetは、今回の質問が主にevent、feelings、wishのどの理解に役立つかを示してください。",
            "明確に分類できない確認や聞き直しではclarificationを使用してください。",
            "collectedは、相談者自身の発言によってevent、feelings、wishの整理結果を作る根拠がある程度得られているかを示してください。",
            "AI内部の推測だけを根拠にcollectedをtrueにしてはいけません。",
            "collectedがfalseだからという理由だけで、その項目を次に質問してはいけません。",

            "【最終チェック】",
            "questionを出力する直前に、次を確認してください。",
            "・すでに言ったことの聞き直しではないか",
            "・過去の質問と表現が違うだけで、実質的に同じ情報を聞いていないか",
            "・答えがすでに分かっていないか",
            "・回答によって分析が実際に変わるか",
            "・単に詳しく知りたいだけではないか",
            "・相談者に自己分析させていないか",
            "・パートナー分析へ逸れていないか",
            "・相談者が話していない出来事を追加していないか",
            "・他にもっと分析を分岐させる質問がないか",
            "問題があれば別の質問を選んでください。",

            "【終了判定】",
            "このAPIでは対話回数の終了管理を行いません。",
            "shouldFinishは常にfalseにしてください。",
            "questionは必ず空ではない文字列にしてください。",
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
