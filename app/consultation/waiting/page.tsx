"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getApiAuthHeaders } from "@/lib/liff";

export default function ConsultationWaitingPage() {
  const router = useRouter();
  const [waitingState, setWaitingState] = useState<
    "loading" | "waiting_response" | "generating_mitate" | "completed" | "none"
  >("loading");
  const hasRequestedMitateRef = useRef(false);

  useEffect(() => {
    const loadWaitingState = async () => {
      const authHeaders = getApiAuthHeaders();

      if (!authHeaders) {
        throw new Error("LINEのログイン情報を確認できませんでした");
      }

      const response = await fetch("/api/consultations/waiting-state", {
        headers: {
          ...authHeaders,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorData = await response.text();

        console.error("waiting-state error", {
          status: response.status,
          body: errorData,
        });

        throw new Error("待機状態を取得できませんでした");
      }

      const data = await response.json();

      setWaitingState(data.state);

      if (data.state === "completed") {
        router.replace("/home");
        return;
      }

      if (
        data.state === "generating_mitate" &&
        data.consultationId &&
        !hasRequestedMitateRef.current
      ) {
        hasRequestedMitateRef.current = true;

        const authHeaders = getApiAuthHeaders();

        if (!authHeaders) {
          throw new Error("LINEのログイン情報を確認できませんでした");
        }

        const generateResponse = await fetch("/api/mitates/generate", {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            consultationId: data.consultationId,
          }),
        });

        if (!generateResponse.ok) {
          hasRequestedMitateRef.current = false;
          throw new Error("ミタテを生成できませんでした");
        }
      }
    };

    void loadWaitingState();

    const intervalId = setInterval(() => {
      void loadWaitingState();
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [router]);
  const isGeneratingMitate = waitingState === "generating_mitate";
  if (waitingState === "loading") {
    return null;
  }
  return (
    <main className="grid h-dvh grid-rows-20 px-8">
      {/* 相談送信完了 */}
      <div className="row-start-5 flex items-center justify-center">
        <p className="text-center text-[18px] font-medium text-[#1B3230]">
          {isGeneratingMitate
            ? "ふたりの話がそろいました"
            : "相談を送信しました"}
        </p>
      </div>

      {/* イラスト */}
      <div className="row-start-8 row-end-11 flex items-center justify-center">
        <div className="waiting-character">
          <Image
            src="/image/dou_face.svg"
            alt="パートナーの回答を待っているdou"
            width={120}
            height={120}
            priority
          />
        </div>
      </div>

      {/* 待機メッセージ */}
      <div className="row-start-13 row-end-15 flex items-start justify-center">
        <p className="text-center text-[16px] leading-[1.45] text-[#1B3230]">
          {isGeneratingMitate ? (
            <>
              douが
              <br />
              ふたりの話から
              <br />
              ミタテを作っています…
            </>
          ) : (
            <>
              douが
              <br />
              パートナーから
              <br />
              話を聞いています…
            </>
          )}
        </p>
      </div>

      <style>{`
        @keyframes waiting-float {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-12px);
          }
        }

        .waiting-character {
          animation: waiting-float 2s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}
