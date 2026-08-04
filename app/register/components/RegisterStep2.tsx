"use client";
import StepIndicator from "./StepIndicator";
type RegisterStep2Props = {
  relationship: string;
  onRelationshipChange: (relationship: string) => void;
  livingStatus: string;
  onLivingStatusChange: (livingStatus: string) => void;
  onBack: () => void;
  onComplete: () => void;
};
export default function RegisterStep2({
  relationship,
  onRelationshipChange,
  livingStatus,
  onLivingStatusChange,
  onBack,
  onComplete,
}: RegisterStep2Props) {

  const isFormValid =
  relationship !== "" && livingStatus !== "";
  return (
    <main className="flex h-dvh flex-col">
      {/* Header */}
<header className="h-[18dvh] px-6">
  <div className="relative mx-auto flex h-full w-full max-w-sm items-end justify-center">
    <button
      type="button"
      onClick={onBack}
      aria-label="前の画面に戻る"
      className="absolute left-0 top-4 flex size-11 items-center justify-center text-[#49B8B1] transition-opacity active:opacity-60"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        aria-hidden="true"
      >
        <path
          d="M15 18L9 12L15 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>

    <StepIndicator currentStep={2} />
  </div>
</header>
      {/* Title */}
      <section className="flex h-[16dvh] items-end justify-center px-6">
        <h1 className="text-center text-base font-medium text-[#1B3230]">
          パートナーについて教えてください
        </h1>
      </section>

      {/* Content */}
      <section className="flex-1 px-8 pt-[6dvh]">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="relationship"
              className="text-sm text-[#1B3230]"
            >
              関係性
            </label>

            <select
              id="relationship"
              name="relationship"
              value={relationship}
              onChange={(event) => onRelationshipChange(event.target.value)}
              className="mx-auto block h-10 w-full max-w-sm rounded-md border border-[#6B7776] bg-white px-4 text-base text-[#1B3230] outline-none focus:border-[#49B8B1]"
            >
              <option value="" disabled>
                選択してください
              </option>
              <option value="dating">恋人</option>
              <option value="married">夫婦</option>
              <option value="other">その他</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="livingStatus"
              className="text-sm text-[#1B3230]"
            >
              暮らし方
            </label>
            <select
              id="livingStatus"
              name="livingStatus"
              value={livingStatus}
              onChange={(event) => onLivingStatusChange(event.target.value)}
              className="mx-auto block h-10 w-full max-w-sm rounded-md border border-[#6B7776] bg-white px-4 text-base text-[#1B3230] outline-none focus:border-[#49B8B1]"
            >
              <option value="" disabled>
                選択してください
              </option>
              <option value="together">同居している</option>
              <option value="partly-together">半同棲している</option>
              <option value="separate-nearby">別々に暮らしている</option>
              <option value="long-distance">遠距離</option>
            </select>
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer className="flex h-[22dvh] shrink-0 items-start px-8">
        <button
          type="button"
          onClick={onComplete}
          disabled={!isFormValid}
          className="mx-auto block h-12 w-full max-w-sm rounded-full bg-[#49B8B1] text-base font-medium text-white transition-opacity active:opacity-80 disabled:opacity-40 disabled:active:opacity-40"
        >
          登録
        </button>
      </footer>
    </main>
  );
}