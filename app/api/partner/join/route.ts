import {
  ApiError,
  apiErrorResponse,
  getVerifiedUser,
} from "@/lib/server/line-user";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      code?: unknown;
    } | null;
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!code || code.length > 32) {
      throw new ApiError("正しい連携コードを入力してください", 400);
    }

    const { supabase, userId } = await getVerifiedUser(request);
    const { data, error } = await supabase.rpc(
      "join_couple_with_code_for_user",
      {
        actor_user_id: userId,
        input_code: code,
      },
    );

    if (error) {
      console.error("Failed to join couple", error);
      return Response.json({ error: error.message }, { status: 400 });
    }

    const result = Array.isArray(data) ? data[0] : data;

    return Response.json({
      coupleId: result.couple_id,
      connectedAt: result.connected_time,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
