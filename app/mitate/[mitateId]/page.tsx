"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getApiAuthHeaders, initializeLiff } from "@/lib/liff";
import MitateCard from "../components/MitateCard";
import type { Mitate } from "../types";
import LoadingScreen from "@/app/components/LoadingScreen";

export default function MitateDetailPage() {
  const { mitateId } = useParams<{ mitateId: string }>();

  const [mitates, setMitates] = useState<Mitate[]>([]);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const targetMitate = data.find(
          (mitate) => mitate.id === mitateId,
        );

        if (!targetMitate) {
          throw new Error("対象のミタテが見つかりません");
        }

        setMitates(data);
        setOpenIds(new Set([targetMitate.id]));
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

    void loadMitates();

    return () => {
      cancelled = true;
    };
  }, [mitateId]);

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
          ミタテ
        </h1>
      </div>

      <section className="row-start-3 row-end-21 overflow-y-auto pb-6 pt-2">
        <div className="mx-auto flex w-full max-w-md flex-col gap-3">

          {error && (
            <p
              role="alert"
              className="text-center text-[13px] text-[#1B3230]"
            >
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
    </main>
  );
}