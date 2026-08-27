import {
  ApiError,
  apiErrorResponse,
  getVerifiedUser,
} from "@/lib/server/line-user";

export async function GET(
  request: Request,
  context: { params: Promise<{ consultationId: string }> },
) {
  try {
    const { consultationId } = await context.params;
    const { supabase, userId } = await getVerifiedUser(request);
    const { data: consultation, error: consultationError } = await supabase
      .from("consultations")
      .select("id")
      .eq("id", consultationId)
      .eq("respondent_user_id", userId)
      .maybeSingle();

    if (consultationError) {
      console.error(
        "Failed to verify respondent consultation",
        consultationError,
      );
      throw new ApiError("相談情報を確認できませんでした", 500);
    }

    if (!consultation) {
      throw new ApiError("対象の相談が見つかりません", 404);
    }

    const { data: result, error: resultError } = await supabase
      .from("consultation_results")
      .select("event, feelings, wish")
      .eq("consultation_id", consultation.id)
      .eq("role", "consultant")
      .maybeSingle();

    if (resultError) {
      console.error("Failed to load consultant result", resultError);
      throw new ApiError("相談内容を取得できませんでした", 500);
    }

    if (!result) {
      throw new ApiError("相談内容がまだ確定していません", 404);
    }

    return Response.json({ result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
