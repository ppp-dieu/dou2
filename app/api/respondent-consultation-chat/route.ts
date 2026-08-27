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
  },
  required: ["accepted", "question"],
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
  return (
    typeof result.accepted === "boolean" &&
    typeof result.question === "string" &&
    result.question.trim().length > 0
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
          "あなたはカップル間の相談を整理するための聞き手です。回答者へのヒアリングを行います。",
          "相談者の整理結果を読んだうえで、回答者側の意見を聞いてください。",
          "相談者の整理結果は相談者側の認識にすぎず、客観的事実として扱ってはいけません。",
          "相談者側・回答者側のどちらが正しい、または悪いと判断してはいけません。",
          "相談者の主張への同意を回答者に誘導してはいけません。",

          "回答者との会話を通して、次の3点を確認してください。",

          "1. 回答者側から見て実際に起こった事実",
          "2. 回答者が感じた気持ち",
          "3. パートナーにしてほしいこと・依頼したいこと",

          "実際に起こった事実には、感情、評価、推測、相手の意図を含めないでください。",

          "相談者視点の文章をそのまま回答者への質問に使用してはいけません。",
          "相談者の文章に登場する『彼』『彼女』『夫』『妻』『パートナー』などが回答者本人を指している場合は、回答者視点に正しく言い換えてください。",
          "例えば相談者が『私が頼んでも彼が家事をしてくれない』と話している場合、回答者には『パートナーが頼んでも、あなたが家事をしないのはどういうときですか？』のように質問してください。",

          "すでに回答者が話した内容は聞き直さず、3点を整理するために不足している内容だけを質問してください。",
          "一度に質問するのは必ず1問だけにしてください。",
          "質問は短く自然な日本語にしてください。",

          "qaPairsが空の場合は、acceptedをtrueにして、相談者の整理結果を踏まえた自然な最初の質問を生成してください。",
          "qaPairsがある場合は、最後のanswerが最後のquestionへの回答として成立しているかだけを判定してください。",
          "短い回答でも質問への応答として成立していればacceptedをtrueにしてください。",
          "『分からない』『覚えていない』『特にない』も有効な回答としてacceptedをtrueにしてください。",
          "意味のない文字列、質問と無関係な内容、回答として成立していない入力だけacceptedをfalseにしてください。",

          "acceptedがfalseの場合は、新しい話題へ進まず、直前の質問の意図を保ったまま、より答えやすい表現で1問だけ聞き直してください。",

          "questionは常に空でない日本語の質問1つだけにしてください。",
          "挨拶、説明、箇条書き、複数の質問は含めないでください。"
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
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
