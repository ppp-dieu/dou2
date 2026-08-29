import "server-only";

const LINE_PUSH_MESSAGE_URL = "https://api.line.me/v2/bot/message/push";

export function createMitateFlexContents(mitateUrl: string) {
  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "24px",
      spacing: "24px",
      contents: [
        {
          type: "text",
          text: "ミタテが作成されました！",
          size: "md",
          color: "#333333",
          wrap: true,
        },
        {
          type: "button",
          style: "primary",
          height: "xl",
          weight: "bold",
          color: "#49B8B1",
          action: {
            type: "uri",
            label: "ミタテを見る",
            uri: mitateUrl,
          },
        },
      ],
    },
  } as const;
}

export async function sendLinePushMessage(to: string, mitateUrl: string) {
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
      messages: [
        {
          type: "flex",
          altText: "ミタテが完成しました",
          contents: createMitateFlexContents(mitateUrl),

        },
      ],
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
