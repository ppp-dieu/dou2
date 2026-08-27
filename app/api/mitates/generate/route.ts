import {
  ApiError,
  apiErrorResponse,
  getVerifiedUser,
} from "@/lib/server/line-user";
import { sendLinePushMessage } from "@/lib/line-messaging";

type ConsultationResultRole = "consultant" | "respondent";

type ConsultationResultRow = {
  role: ConsultationResultRole;
  event: string;
  feelings: string[];
  wish: string;
};

type MitateState = {
  label: string;
  description: string;
};

type MitateSuggestion = {
  label: "A" | "B" | "C";
  title: string;
  description: string;
};

type GeneratedMitate = {
  title: string;
  eventSummary: string;
  consultantStates: [MitateState, MitateState, MitateState];
  respondentStates: [MitateState, MitateState, MitateState];
  suggestions: [MitateSuggestion, MitateSuggestion, MitateSuggestion];
};

const MAX_OUTPUT_TEXT_LENGTH = 2_000;

const stateSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string" },
    description: { type: "string" },
  },
  required: ["label", "description"],
} as const;

const suggestionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string", enum: ["A", "B", "C"] },
    title: { type: "string" },
    description: { type: "string" },
  },
  required: ["label", "title", "description"],
} as const;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    eventSummary: { type: "string" },
    consultantStates: {
      type: "array",
      items: stateSchema,
      minItems: 3,
      maxItems: 3,
    },
    respondentStates: {
      type: "array",
      items: stateSchema,
      minItems: 3,
      maxItems: 3,
    },
    suggestions: {
      type: "array",
      items: suggestionSchema,
      minItems: 3,
      maxItems: 3,
    },
  },
  required: [
    "title",
    "eventSummary",
    "consultantStates",
    "respondentStates",
    "suggestions",
  ],
} as const;

function isNonBlankText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_OUTPUT_TEXT_LENGTH
  );
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    actualKeys.every((key) => keys.includes(key))
  );
}

function isMitateState(value: unknown): value is MitateState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const state = value as Record<string, unknown>;
  return (
    hasOnlyKeys(state, ["label", "description"]) &&
    isNonBlankText(state.label) &&
    isNonBlankText(state.description)
  );
}

function isMitateSuggestion(value: unknown): value is MitateSuggestion {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const suggestion = value as Record<string, unknown>;
  return (
    hasOnlyKeys(suggestion, ["label", "title", "description"]) &&
    (suggestion.label === "A" ||
      suggestion.label === "B" ||
      suggestion.label === "C") &&
    isNonBlankText(suggestion.title) &&
    isNonBlankText(suggestion.description)
  );
}

function isGeneratedMitate(value: unknown): value is GeneratedMitate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const result = value as Record<string, unknown>;
  return (
    hasOnlyKeys(result, [
      "title",
      "eventSummary",
      "consultantStates",
      "respondentStates",
      "suggestions",
    ]) &&
    isNonBlankText(result.title) &&
    isNonBlankText(result.eventSummary) &&
    Array.isArray(result.consultantStates) &&
    result.consultantStates.length === 3 &&
    result.consultantStates.every(isMitateState) &&
    Array.isArray(result.respondentStates) &&
    result.respondentStates.length === 3 &&
    result.respondentStates.every(isMitateState) &&
    Array.isArray(result.suggestions) &&
    result.suggestions.length === 3 &&
    result.suggestions.every(isMitateSuggestion) &&
    result.suggestions[0].label === "A" &&
    result.suggestions[1].label === "B" &&
    result.suggestions[2].label === "C"
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

function normalizeGeneratedMitate(result: GeneratedMitate): GeneratedMitate {
  return {
    title: result.title.trim(),
    eventSummary: result.eventSummary.trim(),
    consultantStates: result.consultantStates.map((state) => ({
      label: state.label.trim(),
      description: state.description.trim(),
    })) as GeneratedMitate["consultantStates"],
    respondentStates: result.respondentStates.map((state) => ({
      label: state.label.trim(),
      description: state.description.trim(),
    })) as GeneratedMitate["respondentStates"],
    suggestions: result.suggestions.map((suggestion) => ({
      label: suggestion.label,
      title: suggestion.title.trim(),
      description: suggestion.description.trim(),
    })) as GeneratedMitate["suggestions"],
  };
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
      .select("id, couple_id, consultant_user_id, respondent_user_id")
      .eq("id", consultationId)
      .maybeSingle();

    if (consultationError) {
      console.error("Failed to verify mitate consultation", consultationError);
      throw new ApiError("相談情報を確認できませんでした", 500);
    }

    if (!consultation) {
      throw new ApiError("対象の相談が見つかりません", 404);
    }

    if (!consultation.couple_id || !consultation.respondent_user_id) {
      throw new ApiError("パートナーとの相談がまだ完了していません", 409);
    }

    const { data: couple, error: coupleError } = await supabase
      .from("couples")
      .select("id, member_a_id, member_b_id")
      .eq("id", consultation.couple_id)
      .or(`member_a_id.eq.${userId},member_b_id.eq.${userId}`)
      .maybeSingle();

    if (coupleError) {
      console.error("Failed to verify mitate couple", coupleError);
      throw new ApiError("パートナー情報を確認できませんでした", 500);
    }

    if (!couple) {
      throw new ApiError("対象の相談が見つかりません", 404);
    }

    const coupleMemberIds = new Set([couple.member_a_id, couple.member_b_id]);
    if (
      !coupleMemberIds.has(consultation.consultant_user_id) ||
      !coupleMemberIds.has(consultation.respondent_user_id)
    ) {
      console.error("Consultation users do not match the consultation couple", {
        consultationId: consultation.id,
        coupleId: couple.id,
      });
      throw new ApiError("相談情報を確認できませんでした", 409);
    }

    const { data: existingMitate, error: existingMitateError } = await supabase
      .from("mitates")
      .select("id")
      .eq("consultation_id", consultation.id)
      .maybeSingle();

    if (existingMitateError) {
      console.error("Failed to check existing mitate", existingMitateError);
      throw new ApiError("ミタテ情報を確認できませんでした", 500);
    }

    if (existingMitate) {
      return Response.json({ mitateId: existingMitate.id, created: false });
    }

    const { data: resultData, error: resultsError } = await supabase
      .from("consultation_results")
      .select("role, event, feelings, wish")
      .eq("consultation_id", consultation.id)
      .in("role", ["consultant", "respondent"]);

    if (resultsError) {
      console.error("Failed to load consultation results for mitate", resultsError);
      throw new ApiError("整理結果を取得できませんでした", 500);
    }

    const results = (resultData ?? []) as ConsultationResultRow[];
    const consultantResult = results.find(
      (result) => result.role === "consultant",
    );
    const respondentResult = results.find(
      (result) => result.role === "respondent",
    );

    if (results.length !== 2 || !consultantResult || !respondentResult) {
      throw new ApiError("二人の整理結果がまだそろっていません", 409);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not configured");
      throw new ApiError("ミタテAIを利用できません", 503);
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
          "あなたは、カップル二人の対話を中立に整理する日本語の編集者です。診断者、裁判官、仲裁者ではありません。",
          "入力には、同じ相談について相談者と回答者が最終確認した整理結果だけが含まれます。この入力だけを根拠にミタテを作成してください。",
          "入力にない出来事、感情、意図、原因、希望を補完してはいけません。",
          "相談者と回答者の記述は、それぞれ本人から見た認識です。どちらかを客観的事実や正解として扱わず、食い違いがあっても一方に寄せて断定しないでください。",

          "次の3点を整理してください。",

          "1. 実際に起こった事実",
          "2. 相談者の望みと回答者の望みのズレ",
          "3. そのズレを踏まえたアドバイス",

          "実際に起こった事実には、感情、評価、推測、相手の意図を含めないでください。",
          "二人の記述に共通する内容と、見え方が異なる内容を区別して整理してください。",

          "望みのズレでは、相談者と回答者がそれぞれ相手に何を望んでいるかを整理し、一致している点と食い違っている点を中立に示してください。",

          "アドバイスは必ず3件作成してください。",
          "各アドバイスのlabelは、順番にA、B、Cとしてください。",
          "各アドバイスにはtitleとdescriptionを付けてください。",
          "A、B、Cは、二人が対話を続けるための小さく具体的な選択肢として、それぞれ異なる方向性で提示してください。",
          "アドバイスは強制ではなく提案として表現してください。",

          "相手の心理や意図の推測、人格評価、心理・医学的診断、善悪・責任の判定、説教、脅し、関係改善の強制は禁止です。",
          "『本当は』『〜すべき』など、入力を超えて断定する表現は禁止です。",
          "出力する全項目は空文字にせず、自然で読みやすい日本語にしてください。"
        ].join("\n"),

        input: JSON.stringify({
          consultationId: consultation.id,
          consultant: {
            event: consultantResult.event,
            feelings: consultantResult.feelings,
            wish: consultantResult.wish,
          },
          respondent: {
            event: respondentResult.event,
            feelings: respondentResult.feelings,
            wish: respondentResult.wish,
          },
        }),
        text: {
          format: {
            type: "json_schema",
            name: "mitate",
            strict: true,
            schema: responseSchema,
          },
        },
      }),
      cache: "no-store",
    });

    if (!openAiResponse.ok) {
      const requestId = openAiResponse.headers.get("x-request-id");
      console.error("OpenAI mitate request failed", {
        status: openAiResponse.status,
        requestId,
      });
      throw new ApiError("ミタテを生成できませんでした", 502);
    }

    const openAiResult = (await openAiResponse.json()) as unknown;
    const outputText = getOutputText(openAiResult);
    if (!outputText) {
      console.error("OpenAI mitate response had no output text");
      throw new ApiError("ミタテを生成できませんでした", 502);
    }

    let parsedResult: unknown;
    try {
      parsedResult = JSON.parse(outputText);
    } catch {
      console.error("OpenAI mitate response was not valid JSON");
      throw new ApiError("ミタテを生成できませんでした", 502);
    }

    if (!isGeneratedMitate(parsedResult)) {
      console.error("OpenAI mitate response did not match validation");
      throw new ApiError("ミタテを生成できませんでした", 502);
    }

    const mitate = normalizeGeneratedMitate(parsedResult);
    const { data: insertedMitate, error: insertError } = await supabase
      .from("mitates")
      .insert({
        couple_id: couple.id,
        consultation_id: consultation.id,
        title: mitate.title,
        event_summary: mitate.eventSummary,
        consultant_states: mitate.consultantStates,
        respondent_states: mitate.respondentStates,
        suggestions: mitate.suggestions,
      })
      .select("id")
      .single();

    if (insertError?.code === "23505") {
      const { data: concurrentMitate, error: concurrentMitateError } =
        await supabase
          .from("mitates")
          .select("id")
          .eq("consultation_id", consultation.id)
          .maybeSingle();

      if (concurrentMitateError || !concurrentMitate) {
        console.error("Failed to recover concurrent mitate insert", {
          insertError,
          concurrentMitateError,
        });
        throw new ApiError("ミタテを保存できませんでした", 500);
      }

      return Response.json({
        mitateId: concurrentMitate.id,
        created: false,
      });
    }

    if (insertError) {
      console.error("Failed to save mitate", insertError);
      throw new ApiError("ミタテを保存できませんでした", 500);
    }

    try {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
      if (!liffId) {
        throw new Error("NEXT_PUBLIC_LIFF_ID is not configured");
      }

      const { data: notificationUsers, error: notificationUsersError } =
        await supabase
          .from("users")
          .select("line_user_id")
          .in("id", [
            consultation.consultant_user_id,
            consultation.respondent_user_id,
          ]);

      if (notificationUsersError) {
        throw new Error("Failed to load LINE notification recipients", {
          cause: notificationUsersError,
        });
      }

      const lineUserIds = [
        ...new Set(
          (notificationUsers ?? [])
            .map((user) => user.line_user_id?.trim())
            .filter((lineUserId): lineUserId is string => Boolean(lineUserId)),
        ),
      ];
      const mitateUrl = `https://miniapp.line.me/${liffId}/mitate/${insertedMitate.id}`;
      const notificationResults = await Promise.allSettled(
        lineUserIds.map((lineUserId) =>
          sendLinePushMessage(lineUserId, mitateUrl),
        ),
      );

      notificationResults.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error("Failed to send mitate LINE notification", {
            mitateId: insertedMitate.id,
            lineUserId: lineUserIds[index],
            error: result.reason,
          });
        }
      });
    } catch (notificationError) {
      console.error("Failed to prepare mitate LINE notifications", {
        mitateId: insertedMitate.id,
        error: notificationError,
      });
    }

    return Response.json(
      { mitateId: insertedMitate.id, created: true },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
