import Image from "next/image";

export default function OnboardingStep3() {
  return (
    <main className="grid h-full grid-rows-20 px-8">
      <div className="row-start-2 text-center">
        <p className="text-[16px] text-[#1B3230]">使い方</p>
      </div>

      <div className="row-start-4 row-end-16 grid min-h-0 w-full max-w-sm grid-rows-3 gap-[3dvh] justify-self-center">
        {/* Step1 */}
        <div className="h-full min-h-0 rounded-[10px] border border-gray-300 bg-white px-3 py-3">
          <div className="flex h-full items-center justify-between">
            <div>
              <p className="text-[20px] font-bold text-[#FF9C85]">
                Step1
              </p>

              <p className="mt-1 px-2 text-[15px] leading-5 text-[#1B3230]">
                パートナーに
                <br />
                伝えたいことを
                <br />
                douに相談します
              </p>
            </div>

            <div>
                     <Image
                        src="/image/step1.svg"
                        alt="step1"
                        width={140}
                        height={150}
                      />
                    
              </div>
          </div>
        </div>

        {/* Step2 */}
        <div className="h-full min-h-0 rounded-[10px] border border-gray-300 bg-white px-3 py-3">
          
          <div className="flex h-full items-center justify-between">
            <div>
              <p className="text-[20px] font-bold text-[#FF9C85]">
                Step2
              </p>

              <p className="mt-1 px-2 text-[15px] leading-5 text-[#1B3230]">
                パートナーの話も
                <br />
                douが間に入って
                <br />
                聞いてくれます
              </p>
            </div>

            <div className=" h-[60px]">
                     <Image
                        src="/image/step2.svg"
                        alt="step2"
                        width={140}
                        height={150}
                      />
                    
              </div>
          </div>
        </div>

        {/* Step3 */}
        <div className="h-full min-h-0 rounded-[10px] border border-gray-300 bg-white px-3 py-3">
          <div className="flex h-full items-center justify-between">
            <div>
              <p className="text-[20px] font-bold text-[#FF9C85]">
                Step3
              </p>

              <p className="mt-1 px-2 text-[15px] leading-5 text-[#1B3230]">
                douが2人の
                <br />
                想いをまとめた
                <br />
                ミタテを届けます
              </p>
            </div>

            <div>
                     <Image
                        src="/image/step3.svg"
                        alt="step3"
                        width={100}
                        height={100}
                      />
                    
              </div>
          </div>
        </div>
      </div>

    </main>
  );
}