import "server-only";

const LINE_PUSH_MESSAGE_URL = "https://api.line.me/v2/bot/message/push";

type LineFlexMessage = {
  type: "flex";
  altText: string;
  contents: object;
};

type LineNotificationType =
  | "consultation"
  | "consultation_reminder"
  | "mitate";

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
          height: "md",
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

export function createConsultationFlexContents() {
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
          text: "パートナーから相談が届いています。",
          size: "md",
          color: "#333333",
          wrap: true,
        },
        {
          type: "button",
          style: "primary",
          height: "md",
          color: "#49B8B1",
          action: {
            type: "uri",
            label: "回答する",
            uri: "https://miniapp.line.me/2010712048-qtDtawdD",
          },
        },
      ],
    },
  } as const;
}

export async function sendLineFlexMessage(
  to: string,
  message: LineFlexMessage,
  notificationType: LineNotificationType,
) {
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
      messages: [message],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const requestId = response.headers.get("x-line-request-id");
    const responseBody = await response.text().catch(() => "<unreadable>");
    console.error("LINE push message failed", {
      notificationType,
      status: response.status,
      responseBody,
      requestId,
    });
    throw new Error(
      `LINE push message failed (status: ${response.status}, requestId: ${requestId ?? "unknown"})`,
    );
  }
}

export async function sendLinePushMessage(to: string, mitateUrl: string) {
  await sendLineFlexMessage(
    to,
    {
      type: "flex",
      altText: "ミタテが完成しました",
      contents: createMitateFlexContents(mitateUrl),
    },
    "mitate",
  );
}

export async function sendConsultationLinePushMessage(to: string) {
  await sendLineFlexMessage(
    to,
    {
      type: "flex",
      altText: "パートナーから相談が届いています。",
      contents: createConsultationFlexContents(),
    },
    "consultation",
  );
}

export async function sendConsultationReminderLinePushMessage(to: string) {
  await sendLineFlexMessage(
    to,
    {
      type: "flex",
      altText:
        "回答していないパートナーからの相談があります。あなたの気持ちを教えてください。",
      contents: {
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
              text: "メッセージが届いています",
              size: "md",
              color: "#333333",
              wrap: true,
            },
            {
              type: "button",
              style: "primary",
              height: "md",
              color: "#49B8B1",
              action: {
                type: "uri",
                label: "回答する",
                uri: "https://miniapp.line.me/2010712048-qtDtawdD",
              },
            },
          ],
        },
      },
    },
    "consultation_reminder",
  );
}
