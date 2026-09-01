"use client";

import LoadingScreen from "@/app/components/LoadingScreen";
import { useEffect, useState } from "react";
import { getApiAuthHeaders, initializeLiff } from "@/lib/liff";
import MitateCard from "./components/MitateCard";
import type { Mitate } from "./types";

export default function MitatePage() {
  const [mitates, setMitates] = useState<Mitate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;

    const loadMitates = async () => {
      try {
        await initializeLiff();

        const authHeaders = getApiAuthHeaders();

        if (!authHeaders) {
          throw new Error("LINEのログイン情報を取得できませんでした");
        }

        const response = await fetch("/api/mitates", {
          cache: "no-store",
          headers: authHeaders,
        });

        if (!response.ok) {
          throw new Error("ミタテを読み込めませんでした");
        }

        const data = (await response.json()) as Mitate[];

        if (cancelled) return;

        setMitates(data);
        setOpenIds(new Set(data[0] ? [data[0].id] : []));
      } catch (loadError) {
        console.error("ミタテの読み込みに失敗しました", loadError);

        if (!cancelled) {
          setError("ミタテを読み込めませんでした");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadMitates();


    return () => {
      cancelled = true;
    };
  }, []);

  const toggleMitate = (id: string) => {
    setOpenIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <main className="grid h-dvh grid-rows-20 bg-[#E7FBFB] px-4">
      <div className="row-start-2 flex items-center justify-center">
        <h1 className="text-[18px] font-bold text-[#49B8B1]">
          ミタテ一覧
        </h1>
      </div>
      {mitates.length === 0 ? (
        <div className="row-start-3 row-end-8 flex items-center justify-center px-6">
          <div className="text-center">
            <h2 className="text-[14px] font-medium text-[#1B3230]">
              まだミタテはありません
            </h2>

            <p className="mt-2 text-[14px] leading-relaxed text-[#2F5955]">
              パートナーとの相談が完了すると、
              <br />
              ここにミタテが表示されます。
            </p>
          </div>
        </div>
      ) : (
        <section className="row-start-3 row-end-21 overflow-y-auto pb-6 pt-2">
          <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            {error && (
              <p className="text-center text-[13px] text-[#1B3230]">
                {error}
              </p>
            )}

            {mitates.map((mitate) => (
              <MitateCard
                key={mitate.id}
                mitate={mitate}
                isOpen={openIds.has(mitate.id)}
                onToggle={() => toggleMitate(mitate.id)}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
