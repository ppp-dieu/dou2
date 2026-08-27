import {
  ApiError,
  apiErrorResponse,
  getVerifiedUser,
} from "@/lib/server/line-user";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    const { data: couple, error: coupleError } = await supabase
      .from("couples")
      .select("id, member_a_id, member_b_id")
      .eq("status", "connected")
      .or(`member_a_id.eq.${userId},member_b_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (coupleError) {
      console.error("Failed to load connected couple", coupleError);
      throw new ApiError("パートナー情報を取得できませんでした", 500);
    }

    const respondentUserId = couple
      ? couple.member_a_id === userId
        ? couple.member_b_id
        : couple.member_a_id
      : null;

    const { data: consultation, error: insertError } = await supabase
      .from("consultations")
      .insert({
        couple_id: couple?.id ?? null,
        consultant_user_id: userId,
        respondent_user_id: respondentUserId,
        status: "in_progress",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to create consultation", insertError);
      throw new ApiError("相談を開始できませんでした", 500);
    }

    return Response.json(
      { consultationId: consultation.id },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
