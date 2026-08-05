import { apiErrorResponse, getVerifiedUser } from "@/lib/server/line-user";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    const { data, error } = await supabase
      .from("couples")
      .select(
        "id, member_a_id, member_b_id, status, invite_code, invite_code_expires_at, connected_at",
      )
      .in("status", ["pending", "connected"])
      .or(`member_a_id.eq.${userId},member_b_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to load couple", error);
      throw new Error("Failed to load couple");
    }

    return Response.json({ couple: data ?? null });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
