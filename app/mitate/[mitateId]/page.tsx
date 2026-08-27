"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getApiAuthHeaders, initializeLiff } from "@/lib/liff";
import MitateCard from "../components/MitateCard";
import type { Mitate } from "../types";

type ErrorResponse = {
  error?: string;
};

export default function MitateDetailPage() {
  const { mitateId } = useParams<{ mitateId: string }>();
  const [mitate, setMitate] = useState<Mitate | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadMitate = async () => {
      try {
        await initializeLiff();

        const authHeaders = getApiAuthHeaders();

        if (!authHeaders) {
          throw new Error("LINEのログイン情報を取得できませんでした");
        }

        const response = await fetch(
          `/api/mitates/${encodeURIComponent(mitateId)}`,
          {
            cache: "no-store",
            headers: authHeaders,
          },
        );
        const data = (await response.json().catch(() => null)) as unknown;

        if (!response.ok) {
          const errorData = data as ErrorResponse | null;
          throw new Error(
            errorData?.error
              ? errorData.error
              : "ミタテを読み込めませんでした",
          );
        }

        if (!data || typeof data !== "object") {
          throw new Error("ミタテを読み込めませんでした");
        }

        if (!cancelled) {
          setMitate(data as Mitate);
        }
      } catch (loadError) {
        console.error("ミタテの読み込みに失敗しました", loadError);

        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "ミタテを読み込めませんでした",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadMitate();

    return () => {
      cancelled = true;
    };
  }, [mitateId]);

  return (
    <main className="grid h-dvh grid-rows-20 bg-[#E7FBFB] px-4">
      <div className="row-start-2 flex items-center justify-center">
        <h1 className="text-[18px] font-bold text-[#49B8B1]">
          ミタテ
        </h1>
      </div>

      <section className="row-start-3 row-end-21 overflow-y-auto pb-6 pt-2">
        <div className="mx-auto w-full max-w-md">
          {isLoading && (
            <p className="text-center text-[13px] text-[#7A8C8A]">
              読み込み中...
            </p>
          )}

          {error && (
            <p role="alert" className="text-center text-[13px] text-[#1B3230]">
              {error}
            </p>
          )}

          {mitate && (
            <MitateCard
              mitate={mitate}
              isOpen={isOpen}
              onToggle={() => setIsOpen((current) => !current)}
            />
          )}
        </div>
      </section>
    </main>
  );
}
