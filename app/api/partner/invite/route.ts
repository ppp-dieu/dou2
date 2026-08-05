import { apiErrorResponse, getVerifiedUser } from "@/lib/server/line-user";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    const { data, error } = await supabase.rpc(
      "issue_couple_invite_for_user",
      { actor_user_id: userId },
    );

    if (error) {
      console.error("Failed to issue couple invite", error);
      return Response.json({ error: error.message }, { status: 400 });
    }

    const result = Array.isArray(data) ? data[0] : data;

    return Response.json({
      couple: {
        id: result.couple_id,
        member_a_id: userId,
        member_b_id: null,
        status: "pending",
        invite_code: result.code,
        invite_code_expires_at: result.expires_at,
        connected_at: null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
