"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiAuthHeaders } from "@/lib/liff";
import LoadingScreen from "@/app/components/LoadingScreen";

type ChatMessage = {
  id: string;
  sender: "user" | "ai";
  text: string;
};

type ConsultationAnswer = {
  questionNumber: number;
  question: string;
  answer: string;
};

type ConsultantResult = {
  event: string;
  feelings: string[];
  wish: string;
};

const AI_MESSAGES = [
  "ありがとうございます。\nお話しいただいた内容を受け取りました。",
  "それでは、これまでのお話をもとにお気持ちをまとめます。",
];
const RESPONDENT_AI_MESSAGES = [
  "パートナーからのご相談を仲介させていただくdouと申します。\nいくつかお話をお伺いできればと思うので、どうぞよろしくお願いします。",
];

function formatRespondentConsultation(result: ConsultantResult) {
  return [
    "パートナーからは、次のような相談を受けています。",
    `起こったこと：\n${result.event}`,
    `パートナーの気持ち：\n${result.feelings.join("、")}`,
    `これから：\n${result.wish}`,
  ].join("\n\n");
}

export default function ConsultationPage() {
  const initialConsultation =
    typeof window !== "undefined"
      ? sessionStorage.getItem("consultationInput") ?? ""
      : "";

  const initialQuestion =
    typeof window !== "undefined"
      ? sessionStorage.getItem("initialConsultationQuestion") ?? ""
      : "";

  const [message, setMessage] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [consultation] = useState(initialConsultation);
  const [showAiMessage, setShowAiMessage] = useState(
    initialQuestion.length > 0,
  );
  const router = useRouter();
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    initialQuestion
      ? [
        {
          id: "ai-initial",
          sender: "ai",
          text: initialQuestion,
        },
      ]
      : [],
  );
  const [answers, setAnswers] = useState<ConsultationAnswer[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(initialQuestion);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showNextButton, setShowNextButton] = useState(false);
  const [isSavingAnswers, setIsSavingAnswers] = useState(false);
  const [isRespondent, setIsRespondent] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const chatScrollRef = useRef<HTMLElement>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [isRespondentInitialLoading, setIsRespondentInitialLoading] =
    useState(false);

  useEffect(() => {
    const visualViewport = window.visualViewport;

    if (!visualViewport) {
      return;
    }

    const updateKeyboardHeight = () => {
      const height =
        window.innerHeight -
        visualViewport.height -
        visualViewport.offsetTop;

      setKeyboardHeight(Math.max(0, height));
    };

    updateKeyboardHeight();

    visualViewport.addEventListener("resize", updateKeyboardHeight);
    visualViewport.addEventListener("scroll", updateKeyboardHeight);

    return () => {
      visualViewport.removeEventListener("resize", updateKeyboardHeight);
      visualViewport.removeEventListener("scroll", updateKeyboardHeight);
    };
  }, []);

  const handleReturnHome = () => {
    sessionStorage.removeItem("consultationInput");
    router.replace("/home");
  };

  useEffect(() => {
    const savedConsultation = sessionStorage.getItem("consultationInput");
    const consultationId = sessionStorage.getItem("consultationId");
    const consultationRole = sessionStorage.getItem("consultationRole");

    if (!consultationId) {
      router.replace("/home");
      return;
    }

    if (consultationRole === "respondent") {
      let cancelled = false;

      const loadConsultantResult = async () => {
        setIsRespondentInitialLoading(true);

        try {
          const authHeaders = getApiAuthHeaders();

          if (!authHeaders) {
            throw new Error("LINEのログイン情報を取得できませんでした");
          }

          const response = await fetch(
            `/api/respondent-consultation/${encodeURIComponent(consultationId)}`,
            {
              cache: "no-store",
              headers: {
                ...authHeaders,
              },
            },
          );
          const data = (await response.json().catch(() => null)) as {
            result?: ConsultantResult;
            error?: string;
          } | null;

          if (!response.ok || !data?.result) {
            throw new Error(data?.error ?? "相談内容を取得できませんでした");
          }

          if (cancelled) {
            return;
          }

          const consultantResult = data.result;

          const chatResponse = await fetch(
            "/api/respondent-consultation-chat",
            {
              method: "POST",
              cache: "no-store",
              headers: {
                ...authHeaders,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                consultationId,
                qaPairs: [],
                currentQuestionCount: 0,
              }),
            },
          );
          const chatData = (await chatResponse.json().catch(() => null)) as {
            question?: string;
            error?: string;
          } | null;

          if (!chatResponse.ok || !chatData?.question) {
            throw new Error(
              chatData?.error ?? "最初の質問を取得できませんでした",
            );
          }

          if (cancelled) {
            return;
          }

          const initialQuestion = chatData.question;
          setIsRespondent(true);
          setCurrentQuestion(initialQuestion);
          setShowAiMessage(true);
          setIsRespondentInitialLoading(false);
          setChatMessages([
            {
              id: "respondent-consultation-result",
              sender: "ai",
              text: formatRespondentConsultation(consultantResult),
            },
            {
              id: `respondent-question-0-${Date.now()}`,
              sender: "ai",
              text: initialQuestion,
            },
          ]);
          setIsAiResponding(false);
        } catch (error) {
          if (cancelled) {
            return;
          }

          setIsRespondentInitialLoading(false);

          console.error("Failed to load consultant result", error);

          console.error("Failed to load consultant result", error);
          window.alert(
            error instanceof Error
              ? error.message
              : "相談内容を取得できませんでした",
          );
          router.replace("/home");
        }
      };

      void loadConsultantResult();

      return () => {
        cancelled = true;
      };

    }

    if (!savedConsultation) {
      router.replace("/home");
      return;
    }

    const initialQuestion = sessionStorage.getItem(
      "initialConsultationQuestion",
    );

    if (!initialQuestion) {
      router.replace("/home");
      return;
    }
  }, [router]);
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [showAiMessage, chatMessages, showNextButton, isAiResponding]);

  const handleSendMessage = async () => {
    const trimmedMessage = message.trim();

    if (
      !trimmedMessage ||
      !showAiMessage ||
      isAiResponding ||
      isCompleted
    ) {
      return;
    }

    const answeredQuestionIndex = currentQuestionIndex;

    const newAnswer: ConsultationAnswer = {
      questionNumber: answeredQuestionIndex + 1,
      question: currentQuestion,
      answer: trimmedMessage,
    };

    const updatedAnswers = [...answers, newAnswer];
    const nextAttemptCount = attemptCount + 1;

    setChatMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `user-${answeredQuestionIndex}-${Date.now()}`,
        sender: "user",
        text: trimmedMessage,
      },
    ]);

    setMessage("");
    setAttemptCount(nextAttemptCount);
    setIsAiResponding(true);

    try {
      const consultationId = sessionStorage.getItem("consultationId");
      const authHeaders = getApiAuthHeaders();

      if (!consultationId || !authHeaders) {
        throw new Error(
          "相談情報またはLINEのログイン情報を確認できませんでした",
        );
      }

      const response = await fetch(
        isRespondent
          ? "/api/respondent-consultation-chat"
          : "/api/consultation-chat",
        {
          method: "POST",
          cache: "no-store",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            consultationId,
            ...(isRespondent ? {} : { initialConsultation: consultation }),
            qaPairs: updatedAnswers.map(({ question, answer }) => ({
              question,
              answer,
            })),
            currentQuestionCount: isRespondent
              ? nextAttemptCount
              : updatedAnswers.length,
          }),
        },
      );

      const data = (await response.json().catch(() => null)) as {
        accepted?: boolean;
        question?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.question) {
        throw new Error(
          data?.error ?? "次の質問を取得できませんでした",
        );
      }

      const nextQuestion = data.question;

      // 回答として成立していなかった場合
      if (data.accepted === false) {
        // 6回目までに有効回答が4件そろわなかった場合は終了
        if (nextAttemptCount >= 6) {
          setChatMessages((currentMessages) => [
            ...currentMessages,
            {
              id: `ai-failed-${Date.now()}`,
              sender: "ai",
              text: "相談内容を十分に整理できませんでした。\nお手数ですが、もう一度最初から相談内容を入力してください。",
            },
          ]);

          setIsCompleted(true);
          setShowRetryButton(true);
          setIsAiResponding(false);
          return;
        }

        // 1〜5回目の無効回答なら、もう一度回答してもらう
        setChatMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `ai-retry-${Date.now()}`,
            sender: "ai",
            text: nextQuestion,
          },
        ]);

        setIsAiResponding(false);
        return;
      }

      // 有効な回答だけ保存
      setAnswers(updatedAnswers);

      // 有効な回答が4件そろったら成功
      if (updatedAnswers.length === 4) {
        setChatMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `ai-complete-${Date.now()}`,
            sender: "ai",
            text: AI_MESSAGES[0],
          },
        ]);

        setIsCompleted(true);

        window.setTimeout(() => {
          setChatMessages((currentMessages) => [
            ...currentMessages,
            {
              id: `ai-summary-${Date.now()}`,
              sender: "ai",
              text: AI_MESSAGES[1],
            },
          ]);

          window.setTimeout(() => {
            setShowNextButton(true);
            setIsAiResponding(false);
          }, 500);
        }, 700);

        return;
      }

      // 6回使っても有効回答が4件に届かなければ終了
      if (nextAttemptCount >= 6) {
        setChatMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `ai-failed-${Date.now()}`,
            sender: "ai",
            text: "相談内容を十分に整理できませんでした。\nもう一度最初から相談内容を入力してください。",
          },
        ]);

        setIsCompleted(true);
        setShowRetryButton(true);
        setIsAiResponding(false);
        return;
      }
      // 有効な回答なら次の質問へ進む
      setCurrentQuestion(nextQuestion);

      setChatMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `ai-${answeredQuestionIndex + 1}-${Date.now()}`,
          sender: "ai",
          text: nextQuestion,
        },
      ]);

      setCurrentQuestionIndex(answeredQuestionIndex + 1);
      setIsAiResponding(false);

    } catch (error) {
      console.error(
        "Failed to load next consultation question",
        error,
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "次の質問を取得できませんでした",
      );

      setIsAiResponding(false);
    }
  };

  const handleNext = async () => {
    if (isSavingAnswers || answers.length !== 4) {
      return;
    }

    setIsSavingAnswers(true);

    try {
      const consultationId = sessionStorage.getItem("consultationId");
      const authHeaders = getApiAuthHeaders();

      if (!consultationId || !authHeaders) {
        throw new Error(
          "相談情報またはLINEのログイン情報を確認できませんでした",
        );
      }

      const response = await fetch("/api/consultation-answers", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          consultationId,
          qaPairs: answers.map(({ question, answer }) => ({
            question,
            answer,
          })),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(
          data?.error ?? "相談回答を保存できませんでした",
        );
      }

      router.push("/consultation/confirm");
    } catch (error) {
      console.error("Failed to save consultation answers", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "相談回答を保存できませんでした",
      );
    } finally {
      setIsSavingAnswers(false);
    }
  };
  if (isRespondentInitialLoading) {
    return <LoadingScreen />;
  }

  return (


    <main className="flex h-dvh flex-col">

      {/* ヘッダー */}
      <header className="shrink-0 border-b border-gray-300 bg-[#49B8B1]">
        <div className="mx-auto grid w-full max-w-md grid-cols-[40px_1fr_40px] items-center px-5 py-4">
          <button
            type="button"
            onClick={() => setIsExitModalOpen(true)}
            aria-label="前の画面に戻る"
            className="flex h-10 w-10 items-center justify-center text-white active:opacity-60"
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

          <h1 className="text-center text-[20px] font-medium text-white">
            dou
          </h1>

          <div aria-hidden="true" />
        </div>
      </header>

      {/* チャットエリア */}
      <section
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto px-5 py-6"
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-5">
          {consultation && (
            <div className="self-end max-w-[85%] rounded-2xl border border-gray-300 bg-white px-4 py-3 text-[15px] leading-6 text-[#1B3230]">
              {consultation}
            </div>
          )}

          {showAiMessage && isRespondent && (
            <div className="...">
              {RESPONDENT_AI_MESSAGES[0]}
            </div>
          )}
          {chatMessages.map((chatMessage) => (
            <div
              key={chatMessage.id}
              className={
                chatMessage.sender === "user"
                  ? "max-w-[85%] self-end whitespace-pre-wrap rounded-2xl border border-gray-300 bg-white px-4 py-3 text-[15px] leading-6 text-[#1B3230]"
                  : "ai-message-in max-w-[85%] self-start whitespace-pre-wrap rounded-2xl bg-[#ACE6E2] border border-gray-100 px-4 py-3 text-[15px] leading-6 text-[#1B3230]"
              }
            >
              {chatMessage.text}
            </div>
          ))}

          {isAiResponding && (
            <div className="flex w-fit items-center gap-1 self-start rounded-2xl border border-gray-100 bg-[#ACE6E2] px-4 py-3">
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-[#536462]"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-[#536462]"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-[#536462]"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          )}
          {showNextButton && (
            <button
              type="button"
              onClick={() => void handleNext()}
              disabled={isSavingAnswers}
              className="mx-auto h-12 w-full max-w-sm rounded-full bg-[#49B8B1] text-[16px] font-medium text-white active:opacity-80 disabled:opacity-40"
            >
              次へ
            </button>
          )}
          {showRetryButton && (
            <button
              type="button"
              onClick={handleReturnHome}
              className="mx-auto h-12 w-full max-w-sm rounded-full bg-[#49B8B1] text-[16px] font-medium text-white active:opacity-80"
            >
              最初からやり直す
            </button>
          )}

          {/* 自動スクロールの到達地点 */}
          <div ref={chatBottomRef} className="h-px" aria-hidden="true" />
        </div>
      </section>

      {/* 入力エリア */}
      <footer
        className="shrink-0 border-t border-[#E5E5E5] bg-white px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3"
        style={{
          transform: `translateY(-${keyboardHeight}px)`,
        }}
      >
        <div className="mx-auto flex w-full max-w-md items-end gap-3">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={!showAiMessage || isAiResponding || isCompleted}
            placeholder="メッセージを入力"
            rows={1}
            className="max-h-32 min-h-12 flex-1 resize-none rounded-3xl border border-[#CFCFCF] bg-white px-4 py-3 text-[16px] leading-6 text-[#1B3230] outline-none placeholder:text-[#A8A8A8] focus:border-[#49B8B1]"
          />

          <button
            type="button"
            onClick={handleSendMessage}
            disabled={
              message.trim().length === 0 ||
              !showAiMessage ||
              isAiResponding ||
              isCompleted
            }
            aria-label="メッセージを送信"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#49B8B1] text-white disabled:opacity-40"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
            >
              <path
                d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </footer>
      {isExitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-modal-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white px-6 py-6 shadow-lg">
            <h2
              id="exit-modal-title"
              className="text-center text-[18px] font-bold text-[#1B3230]"
            >
              相談を終了しますか？
            </h2>

            <p className="mt-3 text-center text-[15px] leading-6 text-[#536462]">
              これまでの内容が削除されます
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setIsExitModalOpen(false)}
                className="h-12 w-full rounded-full bg-[#49B8B1] text-[16px] font-medium text-white active:opacity-80"
              >
                相談を続ける
              </button>

              <button
                type="button"
                onClick={handleReturnHome}
                className="h-12 w-full rounded-full border border-[#49B8B1] bg-white text-[16px] font-medium text-[#49B8B1] active:opacity-60"
              >
                ホームへ
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
