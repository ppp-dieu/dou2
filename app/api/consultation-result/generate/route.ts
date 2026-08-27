import {
  ApiError,
  apiErrorResponse,
  getVerifiedUser,
} from "@/lib/server/line-user";

type QaPair = {
  question: string;
  answer: string;
};

type ConsultationResultCandidates = {
  events: [string, string, string];
  feelings: [[string], [string], [string]];
  wishes: [string, string, string];
};

const QA_PAIR_COUNT = 4;
const CANDIDATE_COUNT = 3;
const MAX_TEXT_LENGTH = 4_000;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    events: {
      type: "array",
      items: { type: "string" },
      minItems: CANDIDATE_COUNT,
      maxItems: CANDIDATE_COUNT,
    },
    feelings: {
      type: "array",
      items: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 1,
      },
      minItems: CANDIDATE_COUNT,
      maxItems: CANDIDATE_COUNT,
    },
    wishes: {
      type: "array",
      items: { type: "string" },
      minItems: CANDIDATE_COUNT,
      maxItems: CANDIDATE_COUNT,
    },
  },
  required: ["events", "feelings", "wishes"],
} as const;

function isNonBlankText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_TEXT_LENGTH
  );
}

function isValidEvent(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= 40 &&
    value.trim().length <= 55
  );
}

function isValidFeeling(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = value.trim().match(/^([^：]{1,4})：(.+)$/);
  if (!match) return false;

  const body = match[2].trim();

  return body.length >= 20 && body.length <= 30;
}

function isValidWish(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= 28 &&
    value.trim().length <= 38
  );
}

function isQaPair(value: unknown): value is QaPair {
  if (typeof value !== "object" || value === null) return false;

  const pair = value as Record<string, unknown>;
  return isNonBlankText(pair.question) && isNonBlankText(pair.answer);
}

function isDraftConsultationResultCandidates(
  value: unknown,
): value is ConsultationResultCandidates {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const result = value as Record<string, unknown>;

  return (
    Array.isArray(result.events) &&
    result.events.length === 3 &&
    result.events.every(isNonBlankText) &&
    Array.isArray(result.feelings) &&
    result.feelings.length === 3 &&
    result.feelings.every(
      (candidate) =>
        Array.isArray(candidate) &&
        candidate.length === 1 &&
        candidate.every(isNonBlankText),
    ) &&
    Array.isArray(result.wishes) &&
    result.wishes.length === 3 &&
    result.wishes.every(isNonBlankText)
  );
}

function isConsultationResultCandidates(
  value: unknown,
): value is ConsultationResultCandidates {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const result = value as Record<string, unknown>;

  return (
    Object.keys(result).length === 3 &&
    Array.isArray(result.events) &&
    result.events.length === 3 &&
    result.events.every(isValidEvent) &&
    Array.isArray(result.feelings) &&
    result.feelings.length === 3 &&
    result.feelings.every(
      (candidate) =>
        Array.isArray(candidate) &&
        candidate.length === 1 &&
        candidate.every(isValidFeeling),
    ) &&
    Array.isArray(result.wishes) &&
    result.wishes.length === 3 &&
    result.wishes.every(isValidWish)
  );
}

function getValidationIssues(
  result: ConsultationResultCandidates,
): string[] {
  const issues: string[] = [];

  result.events.forEach((value, index) => {
    const length = value.trim().length;

    if (length < 40 || length > 55) {
      issues.push(
        `events[${index}] は${length}文字です。40〜55文字にしてください。`,
      );
    }
  });

  result.feelings.forEach((candidate, candidateIndex) => {
    candidate.forEach((value, feelingIndex) => {
      const match = value.trim().match(/^([^：]{1,4})：(.+)$/);

      if (!match) {
        issues.push(
          `feelings[${candidateIndex}][${feelingIndex}] は「感情名：本文」形式ではありません。`,
        );
        return;
      }

      const emotionName = match[1];
      const body = match[2].trim();

      if (emotionName.length < 1 || emotionName.length > 4) {
        issues.push(
          `feelings[${candidateIndex}][${feelingIndex}] の感情名は${emotionName.length}文字です。1〜4文字にしてください。`,
        );
      }

      if (body.length < 20 || body.length > 30) {
        issues.push(
          `feelings[${candidateIndex}][${feelingIndex}] の本文は${body.length}文字です。20〜30文字にしてください。`,
        );
      }
    });
  });

  result.wishes.forEach((value, index) => {
    const length = value.trim().length;

    if (length < 28 || length > 38) {
      issues.push(
        `wishes[${index}] は${length}文字です。28〜38文字にしてください。`,
      );
    }
  });

  return issues;
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
    } | null;

    if (!body || !isNonBlankText(body.consultationId)) {
      throw new ApiError("相談情報が正しくありません", 400);
    }

    const consultationId = body.consultationId.trim();
    const { data: consultation, error: consultationError } = await supabase
      .from("consultations")
      .select("id, consultant_user_id, respondent_user_id")
      .eq("id", consultationId)
      .maybeSingle();

    if (consultationError) {
      console.error("Failed to verify result candidate consultation", consultationError);
      throw new ApiError("相談情報を確認できませんでした", 500);
    }

    if (!consultation) {
      throw new ApiError("対象の相談が見つかりません", 404);
    }

    const role =
      consultation.consultant_user_id === userId
        ? "consultant"
        : consultation.respondent_user_id === userId
          ? "respondent"
          : null;

    if (!role) {
      throw new ApiError("対象の相談が見つかりません", 404);
    }

    const { data: consultationAnswers, error: answersError } = await supabase
      .from("consultation_answers")
      .select("qa_pairs")
      .eq("consultation_id", consultation.id)
      .eq("role", role)
      .maybeSingle();

    if (answersError) {
      console.error("Failed to load result candidate answers", answersError);
      throw new ApiError("相談回答を取得できませんでした", 500);
    }

    if (!consultationAnswers) {
      throw new ApiError("相談回答が保存されていません", 409);
    }

    const storedQaPairs: unknown = consultationAnswers.qa_pairs;
    if (
      !Array.isArray(storedQaPairs) ||
      storedQaPairs.length !== QA_PAIR_COUNT ||
      !storedQaPairs.every(isQaPair)
    ) {
      console.error("Stored consultation answers are incomplete or invalid", {
        consultationId: consultation.id,
        role,
      });
      throw new ApiError("相談回答が4件そろっていません", 409);
    }

    const qaPairs = storedQaPairs.map(({ question, answer }) => ({
      question: question.trim(),
      answer: answer.trim(),
    }));

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not configured");
      throw new ApiError("整理結果AIを利用できません", 503);
    }

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-terra",
        store: false,
        reasoning: { effort: "low" },
        instructions: [
          role === "respondent"
            ? "あなたは、回答者本人が伝えたい内容を選びやすくするための日本語の編集者です。カウンセラー、診断者、仲裁者、アドバイザーではありません。"
            : "あなたは、相談者本人が伝えたい内容を選びやすくするための日本語の編集者です。カウンセラー、診断者、仲裁者、アドバイザーではありません。",
          role === "respondent"
            ? "入力された回答者本人の4組の質問と回答だけを根拠に、回答者から見た起こったこと(events)、回答者本人の気持ち(feelings)、回答者がこれから望むこと(wishes)を、それぞれ3候補ずつ作成してください。相談者の整理結果やDBに存在しない情報を補完・混在させないでください。"
            : "入力された4組の質問と回答だけを根拠に、起こったこと(events)、相談者本人の気持ち(feelings)、これからの望み(wishes)を、それぞれ3候補ずつ作成してください。DBに存在しない情報を補完しないでください。",
          "3候補は意味を維持しつつ、焦点または表現の粒度を変えてください。単なる語尾変更や同義語への置換にせず、候補ごとに別の事実、感情、希望を創作しないでください。",
          "まず入力された4組のQ&Aから、文字数を気にせず内容を整理してください。その整理内容をもとに、最終出力だけを以下の文字数・形式へ整えてください。途中の整理内容は出力せず、最終結果だけを返してください。",
          "eventsは3候補作成してください。事実を変えず、感情・推測・評価・解決策を追加しないでください。最終出力は各40文字以上55文字以内にしてください。",
          role === "respondent"
            ? "feelingsは3候補作成し、各候補にはこの相談で最も中心となる気持ちを1つだけ含めてください。複数の感情を無理に抽出しないでください。候補ごとに別の感情を創作する必要はなく、同じ中心的な気持ちについて焦点や表現を変えて構いません。回答者本人の発言、または回答者が会話の中で明確に肯定した内容だけを根拠にしてください。最終出力は必ず「感情名：本文」とし、感情名は1〜4文字、本文は20文字以上30文字以内にしてください。"
            : "feelingsは3候補作成し、各候補にはこの相談で最も中心となる気持ちを1つだけ含めてください。複数の感情を無理に抽出しないでください。候補ごとに別の感情を創作する必要はなく、同じ中心的な気持ちについて焦点や表現を変えて構いません。相談者本人の発言、または相談者が会話の中で明確に肯定した内容だけを根拠にしてください。最終出力は必ず「感情名：本文」とし、感情名は1〜4文字、本文は20文字以上30文字以内にしてください。",
          role === "respondent"
            ? "wishesは3候補作成してください。回答者本人が話した希望だけを使用し、新しい解決策や希望を追加しないでください。最終出力は各28文字以上38文字以内にしてください。"
            : "wishesは3候補作成してください。相談者本人が話した希望だけを使用し、新しい解決策や希望を追加しないでください。最終出力は各28文字以上38文字以内にしてください。",
          "相手の心理・意図の推測、善悪や責任の判断、人格評価、心理・医学的診断、本当はという断定、解決策の追加、説教、追加質問、関係改善を当然とする表現、強制や『〜すべき』という指導は禁止です。",
          role === "respondent"
            ? "各候補は空文字にせず、回答者本人の視点で自然かつ簡潔な日本語の文章にしてください。どちらが正しいか、どちらが悪いかという評価を入れてはいけません。"
            : "各候補は空文字にせず、相談者本人の視点で自然かつ簡潔な日本語の文章にしてください。",
        ].join("\n"),
        input: JSON.stringify({ qaPairs }),
        text: {
          format: {
            type: "json_schema",
            name: "consultation_result_candidates",
            strict: true,
            schema: responseSchema,
          },
        },
      }),
      cache: "no-store",
    });

    if (!openAiResponse.ok) {
      const requestId = openAiResponse.headers.get("x-request-id");
      console.error("OpenAI result candidate request failed", {
        status: openAiResponse.status,
        requestId,
      });
      throw new ApiError("整理結果候補を生成できませんでした", 502);
    }

    const openAiResult = (await openAiResponse.json()) as unknown;
    const outputText = getOutputText(openAiResult);
    if (!outputText) {
      console.error("OpenAI result candidate response had no output text");
      throw new ApiError("整理結果候補を生成できませんでした", 502);
    }

    let result: unknown;
    try {
      result = JSON.parse(outputText);
    } catch {
      console.error("OpenAI result candidate response was not valid JSON");
      throw new ApiError("整理結果候補を生成できませんでした", 502);
    }

    if (!isDraftConsultationResultCandidates(result)) {
      console.error("OpenAI result candidate response did not match validation", result);
      throw new ApiError("整理結果候補を生成できませんでした", 502);
    }

    let finalResult = result;

    for (let attempt = 0; attempt < 1; attempt += 1) {
      if (isConsultationResultCandidates(finalResult)) {
        break;
      }

      if (!isDraftConsultationResultCandidates(finalResult)) {
        console.error(
          "OpenAI formatted result had invalid structure",
          finalResult,
        );
        throw new ApiError("整理結果候補を整形できませんでした", 502);
      }

      const validationIssues = getValidationIssues(finalResult);

      console.warn("Retrying result formatting", {
        attempt: attempt + 1,
        validationIssues,
      });

      const retryResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-5.6-terra",
            store: false,
            reasoning: { effort: "low" },
            instructions: [
              "あなたは日本語文章の文字数調整だけを行う編集者です。",
              "入力には現在の整理結果と、修正が必要な箇所が渡されます。",
              "指摘されていない候補は一文字も変更しないでください。",
              "指摘された候補だけを修正してください。",
              "元の意味、事実、感情、希望を変更してはいけません。",
              "新しい情報を追加してはいけません。",
              "eventsは40〜55文字。",
              "feelingsは「感情名：本文」形式。感情名1〜4文字、本文20〜30文字。",
              "wishesは28〜38文字。",
              "修正後は必ず文字数を確認してから出力してください。",
            ].join("\n"),
            input: JSON.stringify({
              candidates: finalResult,
              validationIssues,
            }),
            text: {
              format: {
                type: "json_schema",
                name: "repaired_consultation_result_candidates",
                strict: true,
                schema: responseSchema,
              },
            },
          }),
          cache: "no-store",
        },
      );

      if (!retryResponse.ok) {
        const requestId = retryResponse.headers.get("x-request-id");

        console.error("OpenAI result repair request failed", {
          status: retryResponse.status,
          requestId,
        });

        throw new ApiError("整理結果候補を整形できませんでした", 502);
      }

      const retryJson = (await retryResponse.json()) as unknown;
      const retryOutputText = getOutputText(retryJson);

      if (!retryOutputText) {
        throw new ApiError("整理結果候補を整形できませんでした", 502);
      }

      let retryResult: unknown;

      try {
        retryResult = JSON.parse(retryOutputText);
      } catch {
        throw new ApiError("整理結果候補を整形できませんでした", 502);
      }

      if (!isDraftConsultationResultCandidates(retryResult)) {
        throw new ApiError("整理結果候補を整形できませんでした", 502);
      }

      finalResult = retryResult;
    }

    if (!isDraftConsultationResultCandidates(finalResult)) {
      console.error(
        "Final consultation result had invalid structure",
        finalResult,
      );

      throw new ApiError("整理結果候補を生成できませんでした", 502);
    }

    return Response.json({
      events: finalResult.events.map((candidate) => candidate.trim()),
      feelings: finalResult.feelings.map((candidate) =>
        candidate.map((feeling) => feeling.trim()),
      ),
      wishes: finalResult.wishes.map((candidate) => candidate.trim()),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
