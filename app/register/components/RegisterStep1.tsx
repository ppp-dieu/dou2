"use client";
import StepIndicator from "./StepIndicator";
const nameSegmenter = new Intl.Segmenter("ja", {
  granularity: "grapheme",
});

function limitName(value: string) {
  return Array.from(
    nameSegmenter.segment(value),
    ({ segment }) => segment,
  )
    .slice(0, 10)
    .join("");
}
type RegisterStep1Props = {
  name: string;
  onNameChange: (name: string) => void;
  onNext: () => void;
};


export default function RegisterStep1({
  name,
  onNameChange,
  onNext,
}: RegisterStep1Props) {
  const isNameValid = name.trim().length > 0;
  return (
    <main className="flex h-dvh flex-col">
      {/* Header */}
<div className="flex h-[18dvh] items-end justify-center px-6">
  <StepIndicator currentStep={1} />
</div>
      

      {/* Title */}
      <section className="flex h-[16dvh] items-end justify-center px-6">
        <h1 className="text-center text-base font-medium leading-relaxed text-[#1B3230]">
          あなたのお名前を
              <br />
                  教えてください
             </h1>
             </section>
      {/* Content */}
<section className="flex-1 px-8 pt-[6dvh]">
  <label htmlFor="name" className="sr-only">
    あなたのお名前
  </label>

  <input
    id="name"
    name="name"
    type="text"
    value={name}
    onChange={(event) => onNameChange(limitName(event.target.value))}
    placeholder="名前を入力（10文字以内）"
    className="mx-auto block h-10 w-full max-w-sm rounded-md border border-gray-500 bg-white px-4 text-base text-[#2F4544] outline-none placeholder:text-[#B8B8B8] focus:border-[#49B8B1]"
  />
</section>
      
      {/* Footer */}
<footer className="flex h-[22dvh] shrink-0 items-start px-6">
  <button
    type="button"
    onClick={onNext}
    disabled={!isNameValid}
    className="mx-auto block h-12 w-full max-w-sm rounded-full bg-[#49B8B1] text-base font-medium text-white transition-opacity active:opacity-80 disabled:opacity-40 disabled:active:opacity-40"
  >
    次へ
  </button>
</footer>
    </main>
  );
}