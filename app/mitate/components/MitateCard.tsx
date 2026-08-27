"use client";

import { useRef } from "react";
import { toBlob } from "html-to-image";
import type { Mitate } from "../types";

type MitateCardProps = {
  mitate: Mitate;
  isOpen: boolean;
  onToggle: () => void;
};

export default function MitateCard({
  mitate,
  isOpen,
  onToggle,
}: MitateCardProps) {
  const cardRef = useRef<HTMLElement>(null);

  const handleSaveMitate = async () => {
    if (!cardRef.current) return;

    try {
      const blob = await toBlob(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#FFFFFF",
        filter: (node) => {
          if (
            node instanceof HTMLElement &&
            node.dataset.exportIgnore === "true"
          ) {
            return false;
          }

          return true;
        },
      });

      if (!blob) return;

      const file = new File([blob], `mitate-${mitate.id}.png`, {
        type: "image/png",
      });

      if (
        navigator.share &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: "ミタテ",
        });

        return;
      }

      alert("この端末では画像共有に対応していません。");
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.error("ミタテの共有に失敗しました", error);
    }
  };

  return (
    <article
      ref={cardRef}
      className="rounded-[15px] bg-white px-5 py-4 shadow-sm"
    >
      {/* 日付・タイトル・開閉 */}
      <div className="grid grid-cols-[65px_1fr_24px] items-center">
        <p className="text-[10px] text-[#7A8C8A]">
          {mitate.displayDate}
        </p>

        <h2 className="truncate text-[14px] font-bold text-[#1B3230]">
          {mitate.title}
        </h2>

        <button
          type="button"
          aria-label={isOpen ? "ミタテを閉じる" : "ミタテを開く"}
          onClick={onToggle}
          data-export-ignore="true"
          className="text-[20px] leading-none text-[#49B8B1]"
        >
          {isOpen ? "−" : "＋"}
        </button>
      </div>

      {isOpen && (
        <>
          {/* 起こったこと */}
          <div className="mt-2 border-t border-dashed border-[#9EDDD9] pt-3">
            <h3 className="text-[13px] font-bold text-[#49B8B1]">
              起こったこと
            </h3>

            <p className="mt-1 text-[12px] leading-[1.3] text-[#1B3230]">
              {mitate.eventSummary}
            </p>
          </div>

          {/* 相談者・回答者 */}
          <div className="mt-4 grid grid-cols-2 gap-1">
            {/* 相談者 */}
            <div className="rounded-[8px] border border-[#D8EFED] bg-[#F7FCFC] px-2 py-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 shrink-0 rounded-full bg-[#49B8B1]" />

                <p className="truncate text-[12px] font-bold text-[#49B8B1]">
                  {mitate.consultant.name}
                </p>
              </div>

              <ul className="mt-2 space-y-1 text-[12px] leading-[1.5] text-[#1B3230]">
                {mitate.consultant.states.map((state, index) => (
                  <li key={`${mitate.id}-consultant-${index}`}>
                    <span className="font-bold">
                      {state.label}：
                    </span>
                    {state.description}
                  </li>
                ))}
              </ul>
            </div>

            {/* 回答者 */}
            <div className="rounded-[8px] border border-[#F7E1DD] bg-[#FFF9F7] px-2 py-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 shrink-0 rounded-full bg-[#F7937D]" />

                <p className="truncate text-[12px] font-bold text-[#F7937D]">
                  {mitate.respondent.name}
                </p>
              </div>

              <ul className="mt-2 space-y-1 text-[12px] leading-[1.5] text-[#1B3230]">
                {mitate.respondent.states.map((state, index) => (
                  <li key={`${mitate.id}-respondent-${index}`}>
                    <span className="font-bold">
                      {state.label}：
                    </span>
                    {state.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* dou2のミタテ */}
          <div className="mt-3">
            <h3 className="text-[13px] font-bold text-[#49B8B1]">
              dou2のミタテ
            </h3>

            <div className="mt-1 space-y-2">
              {mitate.suggestions.map((suggestion) => (
                <div
                  key={`${mitate.id}-${suggestion.label}`}
                  className={`flex items-center gap-2 ${
                    suggestion.label === "B"
                      ? "border-y border-dashed border-[#9EDDD9] py-1"
                      : ""
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#49B8B1] text-[14px] font-bold text-white">
                    {suggestion.label}
                  </div>

                  <div className="flex-1">
                    <p className="text-[12px] font-bold text-[#1B3230]">
                      {suggestion.title}
                    </p>

                    <p className="text-[12px] leading-[1.3] text-[#1B3230]">
                      {suggestion.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 保存 */}
          <button
            type="button"
            onClick={handleSaveMitate}
            data-export-ignore="true"
            className="mt-4 w-full rounded-full bg-[#49B8B1] py-2.5 text-[15px] font-medium text-white active:opacity-80"
          >
            保存する
          </button>
        </>
      )}
    </article>
  );
}
