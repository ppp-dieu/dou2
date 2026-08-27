import liff from "@line/liff";
import {
  DEVELOPMENT_ACCESS_TOKEN,
  getDevelopmentAuthHeaders,
  getSelectedDevelopmentUser,
  isLocalDevelopmentBrowser,
} from "@/lib/dev-auth";

let initialized = false;

const developmentProfile = {
  userId: "local-development-user",
  displayName: "開発用ユーザー",
  pictureUrl: "",
};

export async function initializeLiff() {
  if (isLocalDevelopmentBrowser()) return;
  if (initialized) return;

  await liff.init({
    liffId: process.env.NEXT_PUBLIC_LIFF_ID!,
  });

  initialized = true;
}

export { liff };
export async function getLiffProfile() {
  if (isLocalDevelopmentBrowser()) {
    const selectedUser = getSelectedDevelopmentUser();

    if (selectedUser) {
      return {
        userId: selectedUser.lineUserId,
        displayName: selectedUser.displayName ?? "開発用ユーザー",
        pictureUrl: selectedUser.pictureUrl ?? "",
      };
    }

    return developmentProfile;
  }

  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }

  return await liff.getProfile();
}

export function getLiffAccessToken() {
  if (isLocalDevelopmentBrowser()) {
    return DEVELOPMENT_ACCESS_TOKEN;
  }

  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }

  return liff.getAccessToken();
}

export function getApiAuthHeaders(): Record<string, string> | null {
  const accessToken = getLiffAccessToken();

  if (!accessToken) {
    return null;
  }

  if (isLocalDevelopmentBrowser()) {
    return getDevelopmentAuthHeaders();
  }

  return { Authorization: `Bearer ${accessToken}` };
}
