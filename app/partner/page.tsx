"use client";

import { useCallback, useEffect, useState } from "react";
import { initializeLiff, liff } from "@/lib/liff";

type Couple = {
  id: string;
  member_a_id: string;
  member_b_id: string | null;
  status: "pending" | "connected";
  invite_code: string | null;
  invite_code_expires_at: string | null;
  connected_at: string | null;
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
  const [couple, setCouple] = useState<Couple | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [action, setAction] = useState<"invite" | "join" | "end" | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);

  const loadCouple = useCallback(async () => {
    try {
      setMessage(null);
      const data = await partnerRequest<{ couple: Couple | null }>(
        "/api/partner",
      );
      setCouple(data.couple);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "読み込みに失敗しました");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    partnerRequest<{ couple: Couple | null }>("/api/partner")
      .then((data) => {
        if (!cancelled) setCouple(data.couple);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMessage(
            error instanceof Error ? error.message : "読み込みに失敗しました",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const issueInvite = async () => {
    try {
      setAction("invite");
      setMessage(null);
      const data = await partnerRequest<{ couple: Couple }>(
        "/api/partner/invite",
        { method: "POST" },
      );
      setCouple(data.couple);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "発行に失敗しました");
    } finally {
      setAction(null);
    }
  };

  const copyCode = async () => {
    if (!couple?.invite_code) return;

    await navigator.clipboard.writeText(couple.invite_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const shareCode = async () => {
    if (!couple?.invite_code) return;

    const text = `dou2の連携コードは ${couple.invite_code} です。`;

    if (navigator.share) {
      await navigator.share({ text });
      return;
    }

    await navigator.clipboard.writeText(text);
    setMessage("共有内容をコピーしました");
  };

  const joinCouple = async () => {
    try {
      setAction("join");
      setMessage(null);
      await partnerRequest("/api/partner/join", {
        method: "POST",
        body: JSON.stringify({ code: codeInput }),
      });
      setCodeInput("");
      await loadCouple();
      setMessage("パートナーと連携しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "連携に失敗しました");
    } finally {
      setAction(null);
    }
  };

  const endRelationship = async () => {
    if (!window.confirm("パートナーとの連携を終了しますか？")) return;

    try {
      setAction("end");
      setMessage(null);
      await partnerRequest("/api/partner/end", { method: "POST" });
      setCouple(null);
      setMessage("連携を終了しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "終了に失敗しました");
    } finally {
      setAction(null);
    }
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] px-6 py-12">
      <h1 className="text-center text-[18px] text-[#1B3230]">
        パートナー連携
      </h1>

      <div className="mt-12 space-y-10">
          {couple?.status === "connected" ? (
            <section className="rounded-[24px] bg-white px-5 py-8 text-center shadow-[0_5px_10px_rgba(47,89,85,0.12)]">
              <p className="text-[18px] font-medium text-[#2F5955]">
                パートナーと連携中です
              </p>
              <button
                type="button"
                disabled={action !== null}
                onClick={endRelationship}
                className="mt-6 h-12 w-full rounded-full border border-red-300 text-[16px] text-red-500 disabled:opacity-50"
              >
                {action === "end" ? "処理中..." : "連携を終了する"}
              </button>
            </section>
          ) : couple?.status === "pending" && couple.invite_code ? (
            <section>
              <p className="mb-1 text-[13px] font-medium text-[#2F5955]">
                このコードをパートナーに共有してください
              </p>
              <div className="rounded-[24px] bg-white px-5 py-5 shadow-[0_5px_10px_rgba(47,89,85,0.12)]">
                <p className="text-center text-[24px] font-bold tracking-[0.08em] text-[#2F5955]">
                  {couple.invite_code}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={copyCode}
                    className="h-12 rounded-[10px] border border-[#8FD4D0] bg-white text-[16px] font-medium text-[#49B8B1]"
                  >
                    {copied ? "コピーしました" : "コピー"}
                  </button>
                  <button
                    type="button"
                    onClick={shareCode}
                    className="h-12 rounded-[10px] border border-[#8FD4D0] bg-white text-[16px] font-medium text-[#49B8B1]"
                  >
                    共有
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-[24px] bg-white px-5 py-6 shadow-[0_5px_10px_rgba(47,89,85,0.12)]">
              <p className="text-center text-[14px] text-[#2F5955]">
                連携コードを発行してパートナーに共有できます
              </p>
              <button
                type="button"
                disabled={action !== null}
                onClick={issueInvite}
                className="mt-4 h-12 w-full rounded-full bg-[#49B8B1] text-[18px] font-medium text-white disabled:opacity-50"
              >
                {action === "invite" ? "発行中..." : "連携コードを発行"}
              </button>
            </section>
          )}

          {!couple && (
            <section>
              <p className="mb-1 text-[13px] font-medium text-[#2F5955]">
                受け取ったコードを入力する
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
                  className="h-14 w-full rounded-[10px] border border-[#8FD4D0] bg-white px-4 text-[18px] text-[#1B3230] outline-none placeholder:text-gray-300"
                />
                <button
                  type="button"
                  disabled={action !== null || !codeInput.trim()}
                  onClick={joinCouple}
                  className="mt-4 h-12 w-full rounded-full bg-[#49B8B1] text-[18px] font-medium text-white disabled:opacity-50"
                >
                  {action === "join" ? "連携中..." : "連携する"}
                </button>
              </div>
            </section>
          )}
      </div>

      {message && (
        <p className="mt-6 text-center text-[14px] text-[#2F5955]" role="status">
          {message}
        </p>
      )}
    </main>
  );
}
