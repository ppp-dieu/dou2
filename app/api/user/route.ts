import {
  ApiError,
  apiErrorResponse,
  getVerifiedUser,
} from "@/lib/server/line-user";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    const { data: user, error } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to load user display name", error);
      throw new ApiError("ユーザー情報を取得できませんでした", 500);
    }

    if (!user) {
      throw new ApiError("ユーザーが見つかりません", 404);
    }

    return Response.json({ display_name: user.display_name });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
