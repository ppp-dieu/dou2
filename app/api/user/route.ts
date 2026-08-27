import { apiErrorResponse, getVerifiedUser } from "@/lib/server/line-user";

export async function GET(request: Request) {
  try {
    const { displayName } = await getVerifiedUser(request);

    return Response.json({ display_name: displayName });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
