import liff from "@line/liff";

let initialized = false;

export async function initializeLiff() {
  if (initialized) return;

  await liff.init({
    liffId: process.env.NEXT_PUBLIC_LIFF_ID!,
  });

  initialized = true;
}

export { liff };
export async function getLiffProfile() {
  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }

  return await liff.getProfile();
}