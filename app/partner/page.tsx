"use client";

import LoadingScreen from "../components/LoadingScreen";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiAuthHeaders, initializeLiff } from "@/lib/liff";

type PartnerResponse = {
  couple: {
    status: "pending" | "connected";
  } | null;
};

type InviteResponse = {
  couple: {
    invite_code: string | null;
  };
};

async function partnerRequest<T>(path: string, init?: RequestInit) {
  await initializeLiff();

  const authHeaders = getApiAuthHeaders();

  if (!authHeaders) {
    throw new Error("LINEのログイン情報を取得できませんでした");
  }

  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
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
  const router = useRouter();
  const [partnerState, setPartnerState] = useState<
    "checking" | "unlinked" | "connected"
  >("checking");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkMessage, setUnlinkMessage] = useState<string | null>(null);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPartner = async () => {
      try {
        const partner = await partnerRequest<PartnerResponse>("/api/partner");

        if (cancelled) return;

        if (partner.couple?.status === "connected") {
          setPartnerState("connected");
          return;
        }

        try {
          const invite = await partnerRequest<InviteResponse>(
            "/api/partner/invite",
            { method: "POST" },
          );

          if (!cancelled) {
            setInviteCode(invite.couple.invite_code);
            setPartnerState("unlinked");

          }
        } catch (error) {
          console.error("Failed to load invite code", error);

          if (!cancelled) {
            setCodeError(true);
            setPartnerState("unlinked");
          }
        }
      } catch (error) {
        console.error("Failed to load partner status", error);
        if (cancelled) return;

        setPartnerState("unlinked");
        setCodeError(true);
      }
    };

    void loadPartner();

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

  const handleUnlink = async () => {
    try {
      setUnlinking(true);
      setUnlinkMessage(null);

      await partnerRequest("/api/partner", {
        method: "DELETE",
      });

      setShowUnlinkModal(false);
      setPartnerState("unlinked");

      const invite = await partnerRequest<InviteResponse>(
        "/api/partner/invite",
        { method: "POST" },
      );

      setInviteCode(invite.couple.invite_code);
    } catch (error) {
      console.error("Failed to unlink partner", error);

      setUnlinkMessage(
        error instanceof Error ? error.message : "連携解除に失敗しました",
      );
    } finally {
      setUnlinking(false);
    }
  };

  if (partnerState === "checking") {
    return <LoadingScreen />;
  }

  if (partnerState === "connected") {
    return (
      <main className="mx-auto grid h-dvh w-full max-w-[430px] grid-rows-20 px-6">


        <h2 className="row-start-6 row-end-8 text-center text-[18px] leading-relaxed text-[#1B3230]">
          パートナー連携が
          <br />
          完了しています
        </h2>

        <section className="row-start-14 row-end-19 flex flex-col justify-center gap-3">
          <button
            type="button"
            onClick={() => setShowUnlinkModal(true)}
            className="h-12 w-full rounded-full bg-[#F7937D] text-[18px] font-medium text-white"
          >
            連携解除する
          </button>

          <button
            type="button"
            onClick={() => router.push("/home")}
            className="h-12 w-full rounded-full border border-[#49B8B1] bg-white text-[18px] font-medium text-[#49B8B1] active:opacity-80"
          >
            ホームへ戻る
          </button>
        </section>

        {showUnlinkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
            <div className="w-full max-w-[360px] rounded-[20px] bg-white px-6 py-7 shadow-lg">
              <h3 className="text-center text-[18px] font-medium text-[#1B3230]">
                パートナー連携を解除しますか？
              </h3>

              <p className="mt-3 text-center text-[14px] leading-relaxed text-[#2F5955]">
                これまでのミタテが削除されます。
              </p>

              <div className="mt-7 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={unlinking}
                  className="h-12 w-full rounded-full bg-[#F7937D] text-[16px] font-medium text-white disabled:opacity-40"
                >
                  {unlinking ? "解除中..." : "連携解除する"}
                </button>

                {unlinkMessage && (
                  <p className="text-center text-[13px] text-red-500">
                    {unlinkMessage}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setShowUnlinkModal(false)}
                  disabled={unlinking}
                  className="h-12 w-full rounded-full border border-[#49B8B1] bg-white text-[16px] font-medium text-[#49B8B1] disabled:opacity-40"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto grid h-dvh w-full max-w-[430px] grid-rows-20 px-6">
      <section className="row-start-2 row-end-4 flex flex-col items-center justify-center">
        <h1 className="text-[18px] text-[#1B3230]">パートナー連携</h1>
      </section>

      <section className="row-start-4 row-end-11 flex flex-col justify-center">
        <p className="mb-1 text-[13px] font-medium text-[#2F5955]">
          コードを共有する
        </p>

        <div className="rounded-[20px] bg-white px-5 py-5 shadow-[0_5px_10px_rgba(47,89,85,0.12)]">
          <p
            className={`flex h-8 items-center justify-center text-center font-bold tracking-[0.08em] ${codeError ? "text-[12px] text-red-500" : "text-[24px] text-[#2F5955]"
              }`}
            role="status"
          >
            {codeError ? "コードを取得できませんでした" : (inviteCode ?? "---- ----")}
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
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

      <section className="row-start-13 row-end-16 flex flex-col justify-center">
        <p className="mb-1 text-[13px] font-medium text-[#2F5955]">
          コードを入力する
        </p>

        <div className="rounded-[20px] bg-white px-5 py-5 shadow-[0_10px_10px_rgba(47,89,85,0.12)]">
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

          <div className="mt-4 mb-8 flex justify-center">
            <button
              type="button"
              disabled={joining || !codeInput.trim()}
              onClick={handleJoin}
              className="h-12 w-[280px] rounded-full bg-[#49B8B1] text-[18px] font-medium text-white disabled:opacity-40"
            >
              <span aria-live="polite">
                {joining ? "連携中..." : (joinMessage ?? "連携する")}
              </span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
