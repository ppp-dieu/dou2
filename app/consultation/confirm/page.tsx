"use client";

import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Swiper as SwiperType } from "swiper";
import "swiper/css";
import { useRouter } from "next/navigation";
import { getApiAuthHeaders } from "@/lib/liff";
import LoadingScreen from "../../components/LoadingScreen";

type GeneratedResultCandidates = {
    events: string[];
    feelings: string[][];
    wishes: string[];
};

function isThreeNonBlankStrings(value: unknown): value is string[] {
    return (
        Array.isArray(value) &&
        value.length === 3 &&
        value.every(
            (candidate) =>
                typeof candidate === "string" &&
                candidate.trim().length > 0,
        )
    );
}

function isOneNonBlankStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) &&
        value.length === 1 &&
        typeof value[0] === "string" &&
        value[0].trim().length > 0
    );
}

function isThreeFeelingCandidates(value: unknown): value is string[][] {
    return (
        Array.isArray(value) &&
        value.length === 3 &&
        value.every(isOneNonBlankStringArray)
    );
}

function isGeneratedResultCandidates(
    value: unknown,
): value is GeneratedResultCandidates {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidates = value as Record<string, unknown>;

    return (
        isThreeNonBlankStrings(candidates.events) &&
        isThreeFeelingCandidates(candidates.feelings) &&
        isThreeNonBlankStrings(candidates.wishes)
    );
}

export default function ConsultationConfirmPage() {
    const [eventIndex, setEventIndex] = useState(0);
    const [feelingIndex, setFeelingIndex] = useState(0);
    const [wishIndex, setWishIndex] = useState(0);
    const [isGeneratingResult, setIsGeneratingResult] = useState(true);
    const router = useRouter();
    const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
    const [isSavingResult, setIsSavingResult] = useState(false);
    const [isResultSaved, setIsResultSaved] = useState(false);
    const [consultationRole, setConsultationRole] = useState<string | null>(null);
    const [generatedEvents, setGeneratedEvents] = useState<string[]>([]);
    const [generatedFeelings, setGeneratedFeelings] = useState<string[][]>([]);
    const [generatedWishes, setGeneratedWishes] = useState<string[]>([]);
    const hasRequestedCandidatesRef = useRef(false);

    useEffect(() => {
        const initializeConfirmPage = async () => {
            try {
                const storedConsultationRole =
                    sessionStorage.getItem("consultationRole");
                setConsultationRole(storedConsultationRole);

                if (hasRequestedCandidatesRef.current) {
                    return;
                }

                hasRequestedCandidatesRef.current = true;

                const consultationId = sessionStorage.getItem("consultationId");
                const authHeaders = getApiAuthHeaders();

                if (!consultationId || !authHeaders) {
                    throw new Error(
                        "相談情報またはLINEのログイン情報を確認できませんでした",
                    );
                }

                const response = await fetch(
                    "/api/consultation-result/generate",
                    {
                        method: "POST",
                        headers: {
                            ...authHeaders,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ consultationId }),
                    },
                );

                const data = (await response.json().catch(() => null)) as
                    | unknown
                    | null;

                if (!response.ok) {
                    const errorData = data as { error?: unknown } | null;
                    throw new Error(
                        typeof errorData?.error === "string"
                            ? errorData.error
                            : "整理結果候補を生成できませんでした",
                    );
                }

                if (!isGeneratedResultCandidates(data)) {
                    throw new Error("整理結果候補の形式が正しくありません");
                }

                setGeneratedEvents(data.events);
                setGeneratedFeelings(data.feelings);
                setGeneratedWishes(data.wishes);
            } catch (error) {
                console.error("Failed to generate consultation result", error);
                window.alert(
                    error instanceof Error
                        ? error.message
                        : "整理結果候補を生成できませんでした",
                );
                router.replace("/home");
            } finally {
                setIsGeneratingResult(false);
            }
        };

        void initializeConfirmPage();
    }, [router]);

    const eventSwiperRef = useRef<SwiperType | null>(null);

    const feelingSwiperRef = useRef<SwiperType | null>(null);

    const wishSwiperRef = useRef<SwiperType | null>(null);

    const handleSaveResult = async () => {
        if (isSavingResult || isResultSaved) {
            return;
        }

        setIsSavingResult(true);

        try {
            const consultationId = sessionStorage.getItem("consultationId");
            const consultationRole = sessionStorage.getItem("consultationRole");
            const authHeaders = getApiAuthHeaders();

            if (!consultationId || !authHeaders) {
                throw new Error(
                    "相談情報またはLINEのログイン情報を確認できませんでした",
                );
            }
            console.log("save result payload", {
                consultationId,
                event: generatedEvents[eventIndex],
                feelings: generatedFeelings[feelingIndex],
                wish: generatedWishes[wishIndex],
            });
            const selectedEvent =
                generatedEvents[eventIndex] ?? generatedEvents[0];

            const selectedFeelings =
                generatedFeelings[feelingIndex] ?? generatedFeelings[0];

            const selectedWish =
                generatedWishes[wishIndex] ?? generatedWishes[0];
            const response = await fetch("/api/consultation-results", {
                method: "POST",
                headers: {
                    ...authHeaders,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    consultationId,
                    event: selectedEvent,
                    feelings: selectedFeelings,
                    wish: selectedWish,
                }),
            });

            if (!response.ok) {
                const data = (await response.json().catch(() => null)) as {
                    error?: string;
                } | null;

                throw new Error(data?.error ?? "整理結果を保存できませんでした");
            }

            setIsResultSaved(true);

            if (consultationRole === "respondent") {
                router.replace("/consultation/waiting");
                return;
            }

            const partnerResponse = await fetch("/api/partner", {
                cache: "no-store",
                headers: {
                    ...authHeaders,
                },
            });

            if (!partnerResponse.ok) {
                throw new Error("パートナー連携状態を確認できませんでした");
            }

            const partnerData = (await partnerResponse.json()) as {
                couple: {
                    status: string;
                } | null;
            };

            if (partnerData.couple?.status === "connected") {
                router.replace("/consultation/waiting");
                return;
            }

            router.replace("/partner");
        } catch (error) {
            console.error("Failed to save consultation result", error);
            window.alert(
                error instanceof Error
                    ? error.message
                    : "整理結果を保存できませんでした",
            );
        } finally {
            setIsSavingResult(false);
        }
    };
    if (isGeneratingResult) {
        return <LoadingScreen />;
    }
    return (
        <main className="h-dvh overflow-hidden">
            <div className="mx-auto grid h-full w-full max-w-md grid-rows-20 px-5">
                {/* 2：タイトル */}
                <section className="row-start-2 row-end-3 flex items-center justify-center">
                    <h1 className="text-center text-[18px] font-medium text-[#2F5954]">
                        あなたのお話を整理しました
                    </h1>
                </section>

                {/* 3〜6：起こったこと 70字 */}
                <section className="row-start-3 row-end-6 min-h-0 min-w-0">
                    <div className="pt-2 flex h-full flex-col">
                        <h2 className="shrink-0 text-[14px] text-[#2F5954]">
                            起こったこと
                        </h2>

                        <div className="relative min-h-0 min-w-0 flex-1">
                            <div className="absolute inset-0 rounded-2xl shadow-md">
                                <Swiper
                                    className="h-full w-full rounded-2xl"
                                    loop
                                    onSwiper={(swiper) => {
                                        eventSwiperRef.current = swiper;
                                    }}
                                    onSlideChange={(swiper) => {
                                        setEventIndex(swiper.realIndex);
                                    }}
                                >
                                    {generatedEvents.map((eventOption, index) => (
                                        <SwiperSlide key={index} className="h-full">
                                            <div className="flex h-full w-full items-center rounded-2xl border border-[#D9E5E3] bg-white p-6">
                                                <p className="w-full text-[14px] leading-5 text-[#2F5954]">
                                                    {eventOption}
                                                </p>
                                            </div>
                                        </SwiperSlide>
                                    ))}
                                </Swiper>
                            </div>

                            <button
                                type="button"
                                onClick={() => eventSwiperRef.current?.slidePrev()}
                                aria-label="前の候補"
                                className="absolute -left-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#49B8B1] text-white active:opacity-60"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    className="h-6 w-6"
                                    fill="none"
                                >
                                    <path
                                        d="M15 18 9 12l6-6"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>

                            <button
                                type="button"
                                onClick={() => eventSwiperRef.current?.slideNext()}
                                aria-label="次の候補"
                                className="absolute -right-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#49B8B1] text-white active:opacity-60"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    className="h-6 w-6"
                                    fill="none"
                                >
                                    <path
                                        d="m9 18 6-6-6-6"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </section>

                {/* 7〜11：あなたの気持ち */}
                <section className="row-start-8 row-end-11 min-h-0 min-w-0">
                    <div className="flex h-full flex-col pt-2">
                        <h2 className="shrink-0 text-[14px] text-[#2F5954]">
                            あなたの気持ち
                        </h2>

                        <div className="relative flex min-h-0 min-w-0 flex-1 items-center">
                            <button
                                type="button"
                                onClick={() => feelingSwiperRef.current?.slidePrev()}
                                aria-label="前の候補"
                                className="absolute -left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#49B8B1] text-white active:opacity-60"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    className="h-6 w-6"
                                    fill="none"
                                >
                                    <path
                                        d="M15 18 9 12l6-6"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>

                            <div className="h-full min-w-0 flex-1 rounded-2xl shadow-md">
                                <Swiper
                                    className="h-full w-full rounded-2xl"
                                    loop
                                    onSwiper={(swiper) => {
                                        feelingSwiperRef.current = swiper;
                                    }}
                                    onSlideChange={(swiper) => {
                                        setFeelingIndex(swiper.realIndex);
                                    }}
                                >
                                    {generatedFeelings.map((feelingOption, optionIndex) => (
                                        <SwiperSlide key={optionIndex} className="h-full">
                                            <div className="flex h-full w-full items-center rounded-2xl border border-[#D9E5E3] bg-white p-6">
                                                <p className="w-full text-[14px] leading-5 text-[#2F5954]">
                                                    {feelingOption[0]}
                                                </p>
                                            </div>
                                        </SwiperSlide>
                                    ))}
                                </Swiper>
                            </div>

                            <button
                                type="button"
                                onClick={() => feelingSwiperRef.current?.slideNext()}
                                aria-label="次の候補"
                                className="absolute -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#49B8B1] text-white active:opacity-60"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    className="h-6 w-6"
                                    fill="none"
                                >
                                    <path
                                        d="m9 18 6-6-6-6"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </section>

                {/* 12〜14：望み 38字*/}
                <section className="row-start-11 row-end-15 min-h-0 min-w-0">
                    <div className="flex h-full flex-col pt-2">
                        <h2 className="shrink-0 text-[14px] text-[#2F5954]">
                            これから
                        </h2>

                        <div className="relative flex min-h-0 min-w-0 flex-1 items-center">
                            <button
                                type="button"
                                onClick={() => wishSwiperRef.current?.slidePrev()}
                                aria-label="前の候補"
                                className="absolute -left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#49B8B1] text-white active:opacity-60"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    className="h-6 w-6"
                                    fill="none"
                                >
                                    <path
                                        d="M15 18 9 12l6-6"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>

                            <div className="h-full min-w-0 flex-1 rounded-2xl shadow-md">
                                <Swiper
                                    className="h-full w-full rounded-2xl"
                                    loop
                                    onSwiper={(swiper) => {
                                        wishSwiperRef.current = swiper;
                                    }}
                                    onSlideChange={(swiper) => {
                                        setWishIndex(swiper.realIndex);
                                    }}
                                >
                                    {generatedWishes.map((wishOption, index) => (
                                        <SwiperSlide key={index} className="h-full">
                                            <div className="flex h-full w-full items-center rounded-2xl border border-[#D9E5E3] bg-white p-6">
                                                <p className="w-full text-[14px] leading-5 text-[#2F5954]">
                                                    {wishOption}
                                                </p>
                                            </div>
                                        </SwiperSlide>
                                    ))}
                                </Swiper>
                            </div>

                            <button
                                type="button"
                                onClick={() => wishSwiperRef.current?.slideNext()}
                                aria-label="次の候補"
                                className="absolute -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#49B8B1] text-white active:opacity-60"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    className="h-6 w-6"
                                    fill="none"
                                >
                                    <path
                                        d="m9 18 6-6-6-6"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </section>

                {/* 15〜18：注意文 + ボタン */}
                <section className="row-start-15 row-end-19 min-h-0 overflow-hidden">
                    <div className="flex h-full min-h-0 flex-col justify-center pt-6">

                        {/* 注意文 + 進めるボタン */}
                        <div className="flex flex-col ">
                            <p className="text-center text-[12px] leading-4 text-[#536462]">
                                {consultationRole === "respondent"
                                    ? "この内容を元にミタテを作成します"
                                    : "この内容をもとにdouがパートナーに質問を開始します"}
                            </p>

                            <button
                                type="button"
                                onClick={() => void handleSaveResult()}
                                disabled={isSavingResult || isResultSaved}
                                className="h-11 w-full rounded-full bg-[#49B8B1] text-[16px] font-medium text-white active:opacity-80 disabled:opacity-40"
                            >
                                {isSavingResult
                                    ? "保存中..."
                                    : isResultSaved
                                        ? "保存しました"
                                        : "この内容で進める"}
                            </button>
                        </div>

                        {/* やり直すボタン */}
                        <button
                            type="button"
                            onClick={() => setIsRestartModalOpen(true)}
                            className="mx-auto mt-2 h-10 w-70 rounded-full border border-[#49B8B1] bg-white text-[14px] text-[#49B8B1] active:opacity-60"
                        >
                            チャットをやり直す
                        </button>

                    </div>
                </section>
            </div>
            {isRestartModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="restart-modal-title"
                >
                    <div className="w-full max-w-sm rounded-2xl bg-white px-6 py-6 shadow-lg">
                        <h2
                            id="restart-modal-title"
                            className="text-center text-[18px] font-bold text-[#2F5954]"
                        >
                            チャットをやり直しますか？
                        </h2>

                        <p className="mt-3 text-center text-[15px] leading-6 text-[#536462]">
                            これまでの回答は破棄されます
                        </p>

                        <div className="mt-6 flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => setIsRestartModalOpen(false)}
                                className="h-12 w-full rounded-full bg-[#49B8B1] text-[16px] font-medium text-white active:opacity-80"
                            >
                                このまま続ける
                            </button>
                            <button
                                type="button"
                                onClick={() => router.replace("/consultation")}
                                className="h-12 w-full rounded-full border border-[#49B8B1] bg-white text-[16px] font-medium text-[#49B8B1] active:opacity-60"
                            >
                                やり直す
                            </button>

                        </div>
                    </div>
                </div>
            )}
        </main>

    );
}
