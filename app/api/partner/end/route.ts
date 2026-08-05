import { apiErrorResponse, getVerifiedUser } from "@/lib/server/line-user";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    const { data, error } = await supabase.rpc(
      "end_couple_relationship_for_user",
      { actor_user_id: userId },
    );

    if (error) {
      console.error("Failed to end couple relationship", error);
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
