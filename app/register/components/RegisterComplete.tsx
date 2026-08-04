"use client";

import { useRouter } from "next/navigation";
export default function RegisterComplete() {
  const router = useRouter();

  return (
        <main className="flex h-dvh flex-col">
            {/* Message */}
            <section className="flex h-[48dvh] shrink-0 items-end justify-center px-6 pb-[2dvh]">
                <h1 className="text-center text-base font-medium leading-relaxed text-[#1B3230]">
                    登録が完了しました！
                    <br />
                    早速相談を始めましょう
                </h1>
            </section>
            {/* Actions */}
<section className="flex-1 px-8 pt-[6dvh]">
    <button
      type="button"
      onClick={() => router.push("/home")}
      className="mx-auto block h-12 w-full max-w-sm rounded-full bg-[#49B8B1] text-base font-medium text-white transition-opacity active:opacity-80"
    >
      相談する
    </button>

</section>
        </main>
    );
}