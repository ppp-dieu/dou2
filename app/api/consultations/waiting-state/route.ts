import {
  ApiError,
  apiErrorResponse,
  getVerifiedUser,
} from "@/lib/server/line-user";

type WaitingState =
  | "none"
  | "waiting_response"
  | "generating_mitate"
  | "completed";

function noneResponse() {
  return Response.json({
    consultationId: null,
    state: "none" satisfies WaitingState,
  });
}

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    const { data: consultation, error: consultationError } = await supabase
      .from("consultations")
      .select(
        "id, couple_id, consultant_user_id, respondent_user_id, started_at",
      )
      .eq("status", "in_progress")
      .or(
        `consultant_user_id.eq.${userId},respondent_user_id.eq.${userId}`,
      )
      .order("started_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (consultationError) {
      console.error("Failed to load waiting-state consultation", consultationError);
      throw new ApiError("相談の待機状態を取得できませんでした", 500);
    }

    if (
      !consultation ||
      !consultation.couple_id ||
      !consultation.respondent_user_id
    ) {
      return noneResponse();
    }

    const { data: couple, error: coupleError } = await supabase
      .from("couples")
      .select("id")
      .eq("id", consultation.couple_id)
      .or(`member_a_id.eq.${userId},member_b_id.eq.${userId}`)
      .maybeSingle();

    if (coupleError) {
      console.error("Failed to verify waiting-state couple", coupleError);
      throw new ApiError("相談の待機状態を取得できませんでした", 500);
    }

    if (!couple) {
      return noneResponse();
    }

    const [resultsResponse, mitateResponse] = await Promise.all([
      supabase
        .from("consultation_results")
        .select("role")
        .eq("consultation_id", consultation.id)
        .in("role", ["consultant", "respondent"]),
      supabase
        .from("mitates")
        .select("id")
        .eq("consultation_id", consultation.id)
        .maybeSingle(),
    ]);

    if (resultsResponse.error) {
      console.error(
        "Failed to load consultation results for waiting state",
        resultsResponse.error,
      );
      throw new ApiError("相談の待機状態を取得できませんでした", 500);
    }

    if (mitateResponse.error) {
      console.error("Failed to load mitate for waiting state", mitateResponse.error);
      throw new ApiError("相談の待機状態を取得できませんでした", 500);
    }

    if (mitateResponse.data) {
      return Response.json({
        consultationId: consultation.id,
        state: "completed" satisfies WaitingState,
        mitateId: mitateResponse.data.id,
      });
    }

    const resultRoles = new Set(
      (resultsResponse.data ?? []).map((result) => result.role),
    );
    const hasConsultantResult = resultRoles.has("consultant");
    const hasRespondentResult = resultRoles.has("respondent");

    if (hasConsultantResult && hasRespondentResult) {
      return Response.json({
        consultationId: consultation.id,
        state: "generating_mitate" satisfies WaitingState,
      });
    }

    if (hasConsultantResult) {
      return Response.json({
        consultationId: consultation.id,
        state: "waiting_response" satisfies WaitingState,
      });
    }

    return noneResponse();
  } catch (error) {
    return apiErrorResponse(error);
  }
}
