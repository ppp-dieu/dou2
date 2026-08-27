export const DEVELOPMENT_ACCESS_TOKEN = "local-development-token";
export const DEVELOPMENT_USER_HEADER = "x-dou2-dev-user-id";

export const LOCAL_DEVELOPMENT_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "192.168.3.154",
] as const;

const DEVELOPMENT_USER_STORAGE_KEY = "dou2-development-user";

export type DevelopmentUser = {
  id: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
};

export function isLocalDevelopmentBrowser() {
  return (
    process.env.NODE_ENV === "development" &&
    typeof window !== "undefined" &&
    LOCAL_DEVELOPMENT_HOSTNAMES.some(
      (hostname) => hostname === window.location.hostname,
    )
  );
}

export function getSelectedDevelopmentUser(): DevelopmentUser | null {
  if (!isLocalDevelopmentBrowser()) {
    return null;
  }

  const storedUser = window.localStorage.getItem(DEVELOPMENT_USER_STORAGE_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    const user = JSON.parse(storedUser) as Partial<DevelopmentUser>;

    if (
      typeof user.id !== "string" ||
      typeof user.lineUserId !== "string" ||
      (typeof user.displayName !== "string" && user.displayName !== null) ||
      (typeof user.pictureUrl !== "string" && user.pictureUrl !== null)
    ) {
      return null;
    }

    return user as DevelopmentUser;
  } catch {
    return null;
  }
}

export function setSelectedDevelopmentUser(user: DevelopmentUser) {
  if (!isLocalDevelopmentBrowser()) {
    return;
  }

  window.localStorage.setItem(
    DEVELOPMENT_USER_STORAGE_KEY,
    JSON.stringify(user),
  );
}

export function getDevelopmentAuthHeaders(): Record<string, string> {
  if (!isLocalDevelopmentBrowser()) {
    return {};
  }

  const user = getSelectedDevelopmentUser();

  return {
    Authorization: `Bearer ${DEVELOPMENT_ACCESS_TOKEN}`,
    ...(user ? { [DEVELOPMENT_USER_HEADER]: user.id } : {}),
  };
}
