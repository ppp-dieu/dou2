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
            "あなたはカップル間の相談を整理するための聞き手です。",
            "相談者との会話を通して、次の3点を整理できる情報を集めてください。",

            "1. 実際に起こった事実",
            "2. 相談者が感じた気持ち",
            "3. パートナーにしてほしいこと・依頼したいこと",

            "実際に起こった事実には、感情、評価、推測、相手の意図を含めないでください。",

            "毎回、initialConsultationとこれまでのqaPairs全体を読み、event、feelings、wishのうち、どの項目が整理結果を作れる状態まで取得できているかを内部で更新してください。",

            "取得済みとは、整理結果として文章にできるだけの本人の発言が得られている状態です。完全な詳細まで確認する必要はありません。",

            "取得済みの項目を詳しくするための追加質問より、まだ取得できていない項目を優先してください。",
            "同じ項目について、整理結果を作れる回答が得られた後は、原則として追加質問しないでください。",

            "質問回数は最大4回です。",
            "4回の中でevent、feelings、wishの3項目すべてについて、相談者本人の回答を得ることを優先してください。",

            "すでに相談者が話した内容は聞き直さないでください。",
            "表現を変えただけの実質的に同じ質問もしてはいけません。",
            "一度に質問するのは必ず1問だけにしてください。",
            "通常の質問は短く自然な日本語にしてください。",

            "qaPairsが空の場合はacceptedをtrueにしてください。",
            "qaPairsがある場合は、最後のanswerが直前のquestionへの回答として成立しているかだけを判定してください。",
            "短い回答でも質問への応答として成立していればacceptedをtrueにしてください。",
            "『分からない』『覚えていない』『特にない』も有効な回答です。",

            "acceptedがfalseの場合は、新しい話題へ進まず、直前の質問の意図を保ったまま、1または2で答えられる二択の質問に変えて1問だけ聞き直してください。",
            "二択の選択肢は、直前の質問とこれまでの相談内容から自然に導ける内容だけを使用してください。",
            "相談者がまだ話していない事実、感情、希望を選択肢として創作してはいけません。",
            "聞き直しでは、必ず『1. ○○』『2. ○○』の形式で選択肢を示してください。",

            "targetは、今回の質問が主にevent、feelings、wishのどれを確認するものかを示してください。",
            "聞き直しの場合はclarificationを使用してください。",

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
