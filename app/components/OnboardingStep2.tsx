import Image from "next/image";

export default function OnboardingStep2(){

  return (
    <main className="flex h-full items-center justify-center px-8">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/image/dou_face.svg"
          alt="dou"
          width={150}
          height={150}
        />
      
      <div className="mt-8 flex flex-col  items-center text-center">
        <p className="text-[16px] leading-7 text-[#1B3230]">
          douと申します
        </p>

        <p className="mt-5 whitespace-nowrap text-[16px] font-normal leading-7 text-[#1B3230]">
          2人らしい答えを見つけるため
          <br />
          ミタテをお届けします
        </p>

        <p className="mt-5 text-[16px] leading-7 text-[#1B3230]">
          どうぞよろしくお願いします
        </p>
      </div>
    </div>

    </main>
  );
}