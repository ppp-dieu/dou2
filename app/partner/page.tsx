"use client";

import { useEffect, useState } from "react";
import { initializeLiff, liff } from "@/lib/liff";

type InviteResponse = {
  couple: {
    invite_code: string | null;
  };
};

async function partnerRequest<T>(path: string, init?: RequestInit) {
  await initializeLiff();

  if (!liff.isLoggedIn()) {
    liff.login();
    throw new Error("LINEログインへ移動します");
  }

  const accessToken = liff.getAccessToken();

  if (!accessToken) {
    throw new Error("LINEのログイン情報を取得できませんでした");
  }

  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });
  const body = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? "処理に失敗しました");
  }

  return body;
}

export default function PartnerPage() {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    partnerRequest<InviteResponse>("/api/partner/invite", { method: "POST" })
      .then((data) => {
        if (!cancelled) setInviteCode(data.couple.invite_code);
      })
      .catch((error: unknown) => {
        console.error("Failed to load invite code", error);
        if (!cancelled) setCodeError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = async () => {
    if (!inviteCode) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteCode);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = inviteCode;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("コードのコピーに失敗しました", error);
    }
  };

  const handleShare = async () => {
    if (!inviteCode) return;

    const text = `dou2の連携コードは ${inviteCode} です。`;

    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("コードの共有に失敗しました", error);
    }
  };

  const handleJoin = async () => {
    if (!codeInput.trim()) return;

    try {
      setJoining(true);
      setJoinMessage(null);
      await partnerRequest("/api/partner/join", {
        method: "POST",
        body: JSON.stringify({ code: codeInput }),
      });
      setCodeInput("");
      setJoinMessage("連携しました");
    } catch (error) {
      setJoinMessage(
        error instanceof Error ? error.message : "連携に失敗しました",
      );
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="mx-auto grid h-dvh w-full max-w-[430px] grid-rows-20 px-6">
      <section className="row-start-2 row-end-5 flex flex-col items-center justify-center">
        <h1 className="text-[18px] text-[#1B3230]">パートナー連携</h1>
      </section>

      <section className="row-start-5 row-end-11 flex flex-col justify-center">
        <p className="mb-1 text-[13px] font-medium text-[#2F5955]">
          コードを共有する
        </p>

        <div className="rounded-[24px] bg-white px-5 py-5 shadow-[0_5px_10px_rgba(47,89,85,0.12)]">
          <p className="text-center text-[24px] font-bold tracking-[0.08em] text-[#2F5955]">
            {inviteCode ?? "---- ----"}
          </p>

          {codeError && (
            <p className="mt-2 text-center text-[12px] text-red-500">
              コードを取得できませんでした
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4">
            <button
              type="button"
              disabled={!inviteCode}
              onClick={handleCopy}
              className="h-12 rounded-[10px] border border-[#8FD4D0] bg-white text-[16px] font-medium text-[#49B8B1] disabled:opacity-40"
            >
              {copied ? "コピーしました" : "コピー"}
            </button>

            <button
              type="button"
              disabled={!inviteCode}
              onClick={handleShare}
              className="h-12 rounded-[10px] border border-[#8FD4D0] bg-white text-[16px] font-medium text-[#49B8B1] disabled:opacity-40"
            >
              共有
            </button>
          </div>
        </div>
      </section>

      <section className="row-start-13 row-end-17 flex flex-col justify-center">
        <p className="mb-1 text-[13px] font-medium text-[#2F5955]">
          コードを入力する
        </p>

        <div className="rounded-[24px] bg-white px-5 py-5 shadow-[0_10px_10px_rgba(47,89,85,0.12)]">
          <input
            id="invite_code"
            type="text"
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
            maxLength={32}
            autoCapitalize="characters"
            placeholder="コードを入力"
            className="h-14 w-full rounded-[10px] border border-[#8FD4D0] bg-white px-4 text-[18px] text-[#1B3230] outline-none placeholder:text-[18px] placeholder:text-gray-300"
          />

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              disabled={joining || !codeInput.trim()}
              onClick={handleJoin}
              className="h-12 w-[280px] rounded-full bg-[#49B8B1] text-[18px] font-medium text-white disabled:opacity-40"
            >
              {joining ? "連携中..." : "連携する"}
            </button>
          </div>

          {joinMessage && (
            <p className="mt-3 text-center text-[13px] text-[#2F5955]" role="status">
              {joinMessage}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
