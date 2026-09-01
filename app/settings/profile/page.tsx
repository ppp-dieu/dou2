"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NameInput from "@/app/register/components/NameInput";
import LoadingScreen from "@/app/components/LoadingScreen";
import {
  getApiAuthHeaders,
  getLiffProfile,
  initializeLiff,
} from "@/lib/liff";
import { supabase } from "@/lib/supabase";

export default function ProfileSettingsPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const isNameValid = name.trim().length > 0;

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      try {
        await initializeLiff();

        const authHeaders = getApiAuthHeaders();

        if (!authHeaders) {
          throw new Error("LINEのログイン情報を取得できませんでした");
        }

        const response = await fetch("/api/home-initial", {
          cache: "no-store",
          headers: {
            ...authHeaders,
          },
        });

        if (!response.ok) {
          throw new Error("ユーザー情報を取得できませんでした");
        }

        const data = (await response.json()) as {
          user: {
            display_name: string | null;
          };
        };

        if (!cancelled) {
          setName(data.user.display_name ?? "");
        }
      } catch (error) {
        console.error("Failed to load user", error);

        window.alert(
          error instanceof Error
            ? error.message
            : "ユーザー情報を取得できませんでした",
        );

        router.replace("/settings");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSave = async () => {
    const trimmedName = name.trim();

    if (!trimmedName || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      await initializeLiff();

      const profile = await getLiffProfile();

      if (!profile) {
        throw new Error("LINEのユーザー情報を取得できませんでした");
      }

      const { error } = await supabase
        .from("users")
        .update({
          display_name: trimmedName,
        })
        .eq("line_user_id", profile.userId);

      if (error) {
        throw error;
      }

      router.replace("/settings");
    } catch (error) {
      console.error("Failed to update display name", error);

      window.alert("名前を変更できませんでした");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <main className="flex h-dvh flex-col">
      {/* Header */}
      <div className="relative h-[18dvh] shrink-0 px-6">
        <button
          type="button"
          onClick={() => router.push("/settings")}
          aria-label="設定に戻る"
          className="absolute left-6 top-6 flex h-10 w-10 items-center justify-center text-[#1B3230] active:opacity-60"
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
      </div>

      {/* Title */}
      <section className="flex h-[16dvh] items-end justify-center px-6">
        <h1 className="text-center text-base font-medium leading-relaxed text-[#1B3230]">
          名前を編集
        </h1>
      </section>

      {/* Content */}
      <section className="flex-1 px-8 pt-[6dvh]">
        <NameInput
          name={name}
          onNameChange={setName}
        />
      </section>

      {/* Footer */}
      <footer className="flex h-[22dvh] shrink-0 items-start px-6">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!isNameValid || isSaving}
          className="mx-auto block h-12 w-full max-w-sm rounded-full bg-[#49B8B1] text-base font-medium text-white transition-opacity active:opacity-80 disabled:opacity-40 disabled:active:opacity-40"
        >
          {isSaving ? "保存中..." : "変更を保存する"}
        </button>
      </footer>
    </main>
  );
}
