"use client";

import { useEffect, useRef, useState } from "react";
import { getLiffProfile, initializeLiff } from "@/lib/liff";
import { supabase } from "@/lib/supabase";
import { Swiper, SwiperSlide } from "swiper/react";
import { Swiper as SwiperType } from "swiper";
import "swiper/css";
import { useRouter } from "next/navigation";

import OnboardingStep1 from "./components/OnboardingStep1";
import OnboardingStep2 from "./components/OnboardingStep2";
import OnboardingStep3 from "./components/OnboardingStep3";

export default function Home() {
  const router = useRouter();
  const swiperRef = useRef<SwiperType | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [liffError, setLiffError] = useState<string | null>(null);
  const [userExists, setUserExists] = useState<boolean | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeLiff();

        const profile = await getLiffProfile();

        if (profile) {
          setLineUserId(profile.userId);
          const { data, error } = await supabase
  .from("users")
  .select("*")
  .eq("line_user_id", profile.userId)
  .maybeSingle();

if (error) {
  throw error;
}

setUserExists(data !== null);
        }
      } catch (error) {
        console.error("LIFF initialization failed:", error);

        setLiffError(
          error instanceof Error ? error.message : "不明なエラー"
        );
      }
    };

    init();
  }, []);

  return (
    <div className="grid h-dvh grid-rows-20 bg-transparent">
      <div className="fixed left-2 top-2 z-[9999] rounded bg-white p-2 text-xs text-black">
  {liffError ? (
    <div>エラー: {liffError}</div>
  ) : (
    <>
      <div>
        LINE User ID: {lineUserId ?? "取得中"}
      </div>
      <div>
        User Exists:{" "}
        {userExists === null
          ? "確認中"
          : userExists
            ? "true"
            : "false"}
      </div>
    </>
  )}
</div>

      <Swiper
        className="col-start-1 row-start-1 row-end-21 min-h-0 w-full overflow-hidden"
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
      <div className="relative z-50 col-start-1 row-start-17 row-end-19 px-6">
        <button
          onClick={() => {
            if (activeIndex === 2) {
              router.push("/register");
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
            className={`h-2 w-2 rounded-full ${activeIndex === 0 ? "bg-[#2F5955]" : "bg-gray-300"
              }`}
          ></div>
          <div
            className={`h-2 w-2 rounded-full ${activeIndex === 1 ? "bg-[#2F5955]" : "bg-gray-300"
              }`}
          ></div>
          <div
            className={`h-2 w-2 rounded-full ${activeIndex === 2 ? "bg-[#2F5955]" : "bg-gray-300"
              }`}
          ></div>
        </div>
      </div>
    </div>
  );
}