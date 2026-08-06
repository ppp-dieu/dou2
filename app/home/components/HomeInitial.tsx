"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initializeLiff, liff } from "@/lib/liff";


export default function HomeInitial() {
  const router = useRouter();
  const [consultation, setConsultation] = useState("");
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const placeholders = [
    "例：会話が減って寂しい",
    "例：些細なことでケンカをしてしまう",
    "例：家事を分担したのにやってくれない",
    "例：もっとたくさん連絡をしてほしい！",
  ];

  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isPlaceholderVisible, setIsPlaceholderVisible] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loadPartnerStatus = async () => {
      try {
        await initializeLiff();

        if (!liff.isLoggedIn()) {
          if (!cancelled) setIsAlertVisible(true);
          return;
        }

        const accessToken = liff.getAccessToken();

        if (!accessToken) {
          if (!cancelled) setIsAlertVisible(true);
          return;
        }
        const userResponse = await fetch("/api/user", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!userResponse.ok) {
          throw new Error("Failed to load user");
        }

        const userData = (await userResponse.json()) as {
          display_name: string;
        };

        if (!cancelled) {
          setDisplayName(userData.display_name);
        }

        const response = await fetch("/api/partner", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to load partner status");
        }

        const data = (await response.json()) as {
          couple: {
            status: string;
          } | null;
        };

        if (cancelled || data.couple?.status === "connected") {
          return;
        }

        timer = setTimeout(() => {
          setIsAlertVisible(true);
        }, 500);
      } catch (error) {
        console.error("Failed to load partner status", error);

        // 状態を確認できない場合は、従来どおり案内を表示する
        if (!cancelled) {
          setIsAlertVisible(true);
        }
      }
    };

    void loadPartnerStatus();

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const interval = setInterval(() => {
      setIsPlaceholderVisible(false);

      timeout = setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
        setIsPlaceholderVisible(true);
      }, 1000);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [placeholders.length]);

  return (
    <main className="grid h-dvh grid-rows-[repeat(20,minmax(0,1fr))] px-6">
      {/* 2〜3段目：パートナー未連携アラート */}
      <section className="row-start-2 row-end-4 flex items-center justify-center">
        <div className="h-full w-full max-w-sm">
          <button
            type="button"
            onClick={() => router.push("/partner")}
            style={{
              transform: isAlertVisible
                ? "translateY(0)"
                : "translateY(-100%)",
              opacity: isAlertVisible ? 1 : 0,
              transition: "transform 700ms ease-out, opacity 700ms ease-out",
              willChange: "transform, opacity",
            }}
            className="flex h-full w-full items-center justify-between rounded-[8px] border-[2px] border-[#F3C95F] bg-[#FFF8E7] px-6 text-left shadow-md"
          >
            <span className="text-[14px] font-medium text-[#1B3230]">
              パートナー連携を完了させましょう
            </span>

            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-[#1B3230]"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </section>
      {/* 5段目：あいさつ */}
      <section className="row-start-5 flex items-center justify-center">
        <h1 className="text-[18px] font-medium text-[#1B3230]">
          {displayName ? `${displayName}さん、こんにちは` : "こんにちは"}
        </h1>
      </section>

      {/* 7段目：説明文 */}
      <section className="row-start-7 flex items-center justify-center text-center">
        <p>相談したいことを入力してください</p>
      </section>

      {/* 8〜15段目：入力エリア */}
      <section className="row-start-8 row-end-16 min-h-0">
        <div className="mx-auto grid h-full min-h-0 w-full max-w-sm grid-rows-[minmax(0,1fr)_auto]">
          <div className="relative min-h-0">
            {consultation.length === 0 && (
              <p
                className={`pointer-events-none absolute left-4 top-4 z-10 text-[16px] font-light text-gray-400 transition-opacity duration-1000 ${isPlaceholderVisible ? "opacity-100" : "opacity-0"
                  }`}
              >
                {placeholders[placeholderIndex]}
              </p>
            )}

            <textarea
              value={consultation}
              onChange={(event) => setConsultation(event.target.value)}
              maxLength={200}
              className="block h-full min-h-0 w-full resize-none rounded-[15px] border border-[#D9E3E2] bg-white px-4 py-4 text-[16px] leading-relaxed text-[#1B3230] outline-none focus:border-[#49B8B1]"
            />
          </div>

          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-[12px] text-red-500">
              パートナーとの出来事や、困っていることをもう少し具体的に入力してください
            </p>

            <p className="shrink-0 text-[12px] text-[#7A8C89]">
              {consultation.length} / 200
            </p>
          </div>
        </div>
      </section>

      {/* 17段目：相談するボタン */}
      <section className="row-start-17 flex items-center justify-center">
        <button
          type="button"
          disabled={consultation.trim().length === 0}
          className="mx-auto block h-12 w-full max-w-sm rounded-full bg-[#49B8B1] text-base font-medium text-white transition-opacity active:opacity-80 disabled:opacity-40 disabled:active:opacity-40"
        >
          相談する
        </button>
      </section>

      {/* 18〜20段目：下部ナビゲーション領域 */}
      <section className="row-start-18 row-end-21">
        {/* 後ほど下部ナビゲーションを配置 */}
      </section>
    </main>
  );
}
