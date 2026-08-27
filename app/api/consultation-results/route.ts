import {
  ApiError,
  apiErrorResponse,
  getVerifiedUser,
} from "@/lib/server/line-user";

type ConsultationResultBody = {
  consultationId?: unknown;
  event?: unknown;
  feelings?: unknown;
  wish?: unknown;
};

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isNonBlankString)
  );
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    const body = (await request.json().catch(() => null)) as
      | ConsultationResultBody
      | null;

    if (
      !body ||
      !isNonBlankString(body.consultationId) ||
      !isNonBlankString(body.event) ||
      !isNonEmptyStringArray(body.feelings) ||
      !isNonBlankString(body.wish)
    ) {
      throw new ApiError("整理結果の内容が正しくありません", 400);
    }

    const consultationId = body.consultationId.trim();
    const event = body.event.trim();
    const feelings = body.feelings.map((feeling) => feeling.trim());
    const wish = body.wish.trim();

    const { data: consultation, error: consultationError } = await supabase
      .from("consultations")
      .select("id, consultant_user_id, respondent_user_id")
      .eq("id", consultationId)
      .maybeSingle();

    if (consultationError) {
      console.error("Failed to verify consultation user", consultationError);
      throw new ApiError("相談情報を確認できませんでした", 500);
    }

    if (!consultation) {
      throw new ApiError("対象の相談が見つかりません", 404);
    }

    let role: "consultant" | "respondent";

    if (consultation.consultant_user_id === userId) {
      role = "consultant";
    } else if (consultation.respondent_user_id === userId) {
      role = "respondent";
    } else {
      throw new ApiError("対象の相談が見つかりません", 404);
    }

    const { data: consultationAnswers, error: answersError } = await supabase
      .from("consultation_answers")
      .select("id")
      .eq("consultation_id", consultation.id)
      .eq("role", role)
      .maybeSingle();

    if (answersError) {
      console.error("Failed to verify consultation answers", answersError);
      throw new ApiError("相談回答を確認できませんでした", 500);
    }

    if (!consultationAnswers) {
      throw new ApiError("相談回答が保存されていません", 409);
    }

    const { error: insertError } = await supabase
      .from("consultation_results")
      .insert({
        consultation_id: consultation.id,
        role,
        event,
        feelings,
        wish,
      });

    if (insertError?.code === "23505") {
      throw new ApiError("この相談の整理結果はすでに保存されています", 409);
    }

    if (insertError) {
      console.error("Failed to save consultation result", insertError);
      throw new ApiError("整理結果を保存できませんでした", 500);
    }

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
