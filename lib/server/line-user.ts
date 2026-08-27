import "server-only";

import {
  DEVELOPMENT_ACCESS_TOKEN,
  DEVELOPMENT_USER_HEADER,
  LOCAL_DEVELOPMENT_HOSTNAMES,
} from "@/lib/dev-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type LineTokenVerification = { client_id?: string; expires_in?: number };
type LineProfile = { userId?: string };

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError("LINEでログインしてください", 401);
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new ApiError("LINEでログインしてください", 401);
  return token;
}

export function isLocalDevelopmentRequest(
  request: Request,
  accessToken = getBearerToken(request),
) {
  if (
    process.env.NODE_ENV !== "development" ||
    accessToken !== DEVELOPMENT_ACCESS_TOKEN
  ) {
    return false;
  }

  return LOCAL_DEVELOPMENT_HOSTNAMES.some(
    (hostname) => hostname === new URL(request.url).hostname,
  );
}

export async function getVerifiedUser(request: Request) {
  const accessToken = getBearerToken(request);
  const isDevelopmentRequest = isLocalDevelopmentRequest(request, accessToken);
  const supabase = createSupabaseAdminClient();

  if (isDevelopmentRequest) {
    const developmentUserId = request.headers
      .get(DEVELOPMENT_USER_HEADER)
      ?.trim();

    if (!developmentUserId) {
      throw new ApiError("開発用テストユーザーを選択してください", 400);
    }

    const { data: developmentUser, error: developmentUserError } =
      await supabase
        .from("users")
        .select("id, display_name")
        .eq("id", developmentUserId)
        .maybeSingle();

    if (developmentUserError) {
      console.error("Failed to load development user", developmentUserError);
      throw new ApiError("開発用テストユーザーを取得できませんでした", 500);
    }

    if (!developmentUser) {
      throw new ApiError("開発用テストユーザーが見つかりません", 404);
    }

    return {
      supabase,
      userId: developmentUser.id as string,
      displayName: developmentUser.display_name as string | null,
    };
  }

  const channelId = process.env.LINE_CHANNEL_ID;
  if (!channelId) throw new Error("LINE_CHANNEL_ID is not configured");

  const verificationResponse = await fetch(
    `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`,
    { cache: "no-store" },
  );

  if (!verificationResponse.ok) {
    throw new ApiError("LINEのログイン情報が無効です", 401);
  }

  const verification =
    (await verificationResponse.json()) as LineTokenVerification;

  if (
    verification.client_id !== channelId ||
    !verification.expires_in ||
    verification.expires_in <= 0
  ) {
    throw new ApiError("LINEのログイン情報が無効です", 401);
  }

  const profileResponse = await fetch("https://api.line.me/v2/profile", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileResponse.ok) {
    throw new ApiError("LINEプロフィールを確認できませんでした", 401);
  }

  const profile = (await profileResponse.json()) as LineProfile;
  if (!profile.userId) {
    throw new ApiError("LINEユーザーを確認できませんでした", 401);
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, display_name")
    .eq("line_user_id", profile.userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load verified user", error);
    throw new ApiError("ユーザー情報を取得できませんでした", 500);
  }

  if (!user) throw new ApiError("ユーザー登録を完了してください", 404);
  return {
    supabase,
    userId: user.id as string,
    displayName: user.display_name as string | null,
  };
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("Partner API error", error);
  return Response.json(
    { error: "処理に失敗しました。時間をおいて再度お試しください" },
    { status: 500 },
  );
}
