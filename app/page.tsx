"use client";

import { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Swiper as SwiperType } from "swiper";
import "swiper/css";

import OnboardingStep1 from "./components/OnboardingStep1";
import OnboardingStep2 from "./components/OnboardingStep2";
import OnboardingStep3 from "./components/OnboardingStep3";

export default function Home() {
  const swiperRef = useRef<SwiperType | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <div className="flex h-dvh flex-col bg-transparent"
    >

<Swiper
   className="min-h-0 flex-1 w-full overflow-hidden"
    slidesPerView={1}
    spaceBetween={0}
    onSwiper={(swiper) => {
  swiperRef.current = swiper;
}}
onSlideChange={(swiper) => {
  setActiveIndex(swiper.activeIndex);
}}
    >
    <SwiperSlide>
      <OnboardingStep1 />
    </SwiperSlide>

    <SwiperSlide>
      <OnboardingStep2 />
    </SwiperSlide>

    <SwiperSlide>
      <OnboardingStep3 />
    </SwiperSlide>
   </Swiper>
<div className="relative z-50 shrink-0 px-6 py-2 pb-[max(2rem,env(safe-area-inset-bottom))]">
  <button
    onClick={() => {
      if (activeIndex === 2){
        console.log("はじめる");
        } else {
          swiperRef.current?.slideNext();
        }
    }}
    className="mx-auto block w-full max-w-sm rounded-full bg-[#49B8B1] py-2.5 text-[18px] font-medium text-white"
  >
    {activeIndex === 2 ? "はじめる" : "次へ"}
  </button>
  <div className="mt-4 flex justify-center gap-3">
    <div
     className={`h-2 w-2 rounded-full ${
      activeIndex === 0 ? "bg-[#2F5955]" : "bg-gray-300"
     }`}
     ></div>
    <div
     className={`h-2 w-2 rounded-full ${
      activeIndex === 1 ? "bg-[#2F5955]" : "bg-gray-300"
     }`}
     ></div>
    <div
     className={`h-2 w-2 rounded-full ${
      activeIndex === 2 ? "bg-[#2F5955]" : "bg-gray-300"
     }`}
     ></div>
  </div>
</div>
</div>
);
  }