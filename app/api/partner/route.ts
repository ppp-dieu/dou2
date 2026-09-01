import { apiErrorResponse, getVerifiedUser } from "@/lib/server/line-user";
import { getPartnerData } from "@/lib/server/home-data";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    return Response.json(await getPartnerData(supabase, userId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    const { data, error } = await supabase.rpc(
      "end_couple_relationship_for_user",
      { actor_user_id: userId },
    );

    if (error) {
      console.error("Failed to unlink partner", error);
      return Response.json({ error: error.message }, { status: 400 });
    }

    const result = Array.isArray(data) ? data[0] : data;

    return Response.json({
      coupleId: result.couple_id,
      endedAt: result.ended_time,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
