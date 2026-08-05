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
  const [liffError, setLiffError] = useState<string | null>(null);
  const [userExists, setUserExists] = useState<boolean | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeLiff();

        const profile = await getLiffProfile();

        if (profile) {
          const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("line_user_id", profile.userId)
            .maybeSingle();

          if (error) {
            throw error;
          }

          if (data) {
            if (data.registration_completed) {
              router.replace("/home");
              return;
            }

            setUserExists(true);
          } else {
            const { error: insertError } = await supabase
              .from("users")
              .upsert(
                {
                  line_user_id: profile.userId,
                  picture_url: profile.pictureUrl ?? null,
                  registration_completed: false,
                  first_accessed_at: new Date().toISOString(),
                },
                {
                  onConflict: "line_user_id",
                  ignoreDuplicates: true,
                }
              );

            if (insertError) {
              throw insertError;
            }

            setUserExists(true);
          }
        }
      } catch (error) {
        console.error("Error:", error);

        setLiffError(JSON.stringify(error));
      }
    };

    init();
  }, [router]);
  if (userExists === null && !liffError) {
    return <main className="h-dvh bg-white" />;
  }

  return (
    <div className="grid h-dvh grid-rows-20 bg-transparent">    
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