import { getRespondentConsultationData } from "@/lib/server/home-data";
import { apiErrorResponse, getVerifiedUser } from "@/lib/server/line-user";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    return Response.json(
      await getRespondentConsultationData(supabase, userId),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
