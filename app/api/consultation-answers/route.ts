import {
  ApiError,
  apiErrorResponse,
  getVerifiedUser,
} from "@/lib/server/line-user";

type QaPair = {
  question: string;
  answer: string;
};

function isQaPair(value: unknown): value is QaPair {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const pair = value as Record<string, unknown>;

  return (
    typeof pair.question === "string" &&
    pair.question.trim().length > 0 &&
    typeof pair.answer === "string" &&
    pair.answer.trim().length > 0
  );
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    const body = (await request.json().catch(() => null)) as {
      consultationId?: unknown;
      qaPairs?: unknown;
    } | null;

    if (
      !body ||
      typeof body.consultationId !== "string" ||
      !Array.isArray(body.qaPairs) ||
      body.qaPairs.length !== 4 ||
      !body.qaPairs.every(isQaPair)
    ) {
      throw new ApiError("相談回答の内容が正しくありません", 400);
    }

    const qaPairs = body.qaPairs.map(({ question, answer }) => ({
      question: question.trim(),
      answer: answer.trim(),
    }));

    const { data: consultation, error: consultationError } = await supabase
      .from("consultations")
      .select("id, consultant_user_id, respondent_user_id")
      .eq("id", body.consultationId)
      .maybeSingle();

    if (consultationError) {
      console.error("Failed to verify consultation participant", consultationError);
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

    const { error: upsertError } = await supabase
      .from("consultation_answers")
      .upsert(
        {
          consultation_id: consultation.id,
          role,
          qa_pairs: qaPairs,
        },
        { onConflict: "consultation_id,role" },
      );

    if (upsertError) {
      console.error("Failed to save consultation answers", upsertError);
      throw new ApiError("相談回答を保存できませんでした", 500);
    }

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
