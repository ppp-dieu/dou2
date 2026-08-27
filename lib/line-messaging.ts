import "server-only";

const LINE_PUSH_MESSAGE_URL = "https://api.line.me/v2/bot/message/push";

export async function sendLinePushMessage(to: string, text: string) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!channelAccessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  }

  const response = await fetch(LINE_PUSH_MESSAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const requestId = response.headers.get("x-line-request-id");
    throw new Error(
      `LINE push message failed (status: ${response.status}, requestId: ${requestId ?? "unknown"})`,
    );
  }
}
