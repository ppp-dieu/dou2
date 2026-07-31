type StepIndicatorProps = {
  currentStep: 1 | 2;
};

export default function StepIndicator({
  currentStep,
}: StepIndicatorProps) {
  return (
    <svg
      viewBox="0 0 280 32"
      className="h-8 w-full max-w-[280px]"
      role="img"
      aria-label={`登録ステップ ${currentStep} / 2`}
    >
      <path
        d="M0 0H130L142 16L130 32H0L12 16Z"
        fill="#49B8B1"
      />
      <text
        x="72"
        y="21"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="14"
      >
        1
      </text>

      <path
        d="M144 0H268L280 16L268 32H144L156 16Z"
        fill={currentStep === 2 ? "#49B8B1" : "#D9D9D9"}
      />
      <text
        x="212"
        y="21"
        textAnchor="middle"
        fill={currentStep === 2 ? "#FFFFFF" : "#888888"}
        fontSize="14"
      >
        2
      </text>
    </svg>
  );
}