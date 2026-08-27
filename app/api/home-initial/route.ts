import {
  getConsultationStateData,
  getPartnerData,
  getRespondentConsultationData,
} from "@/lib/server/home-data";
import { apiErrorResponse, getVerifiedUser } from "@/lib/server/line-user";

export async function GET(request: Request) {
  try {
    const { supabase, userId, displayName } = await getVerifiedUser(request);
    const partner = await getPartnerData(supabase, userId);
    const respondentConsultation = await getRespondentConsultationData(
      supabase,
      userId,
    );

    // Preserve HomeInitial's respondent-first redirect priority and query scope.
    const consultationState =
      respondentConsultation.status === "pending"
        ? null
        : await getConsultationStateData(supabase, userId);

    return Response.json({
      user: { display_name: displayName },
      partner,
      respondentConsultation,
      consultationState,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
