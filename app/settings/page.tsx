"use client";

import Link from "next/link";

type SettingItemProps = {
    label: string;
    href: string;
    danger?: boolean;
};

function SettingItem({
    label,
    href,
    danger = false,
}: SettingItemProps) {
    return (
        <Link
            href={href}
            className="flex min-h-14 items-center justify-between border-b border-[#D9E5E3] px-1 active:opacity-60"
        >
            <span
                className={
                    danger
                        ? "text-[14px] text-red-500"
                        : "text-[14px] text-[#2F5954]"
                }
            >
                {label}
            </span>

            {!danger && (
                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5 text-[#49B8B1]"
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
            )}
        </Link>
    );
}

export default function SettingsPage() {
    return (
        <main className="min-h-dvh">
            <div className="mx-auto w-full max-w-md px-5 pb-10">
                <section className="flex mt-5 h-20 items-center justify-center">
                    <h1 className="text-center text-[18px] font-medium text-[#2F5954]">
                        設定
                    </h1>
                </section>

                <section>
                    <h2 className="mb-1 mt-4 text-[12px] text-[#536462]">
                        アカウント
                    </h2>

                    <div className="rounded-2xl border border-[#D9E5E3] bg-white px-4">
                        <SettingItem
                            label="ニックネームの編集"
                            href="/settings/profile"
                        />

                        <SettingItem
                            label="お支払い設定"
                            href="/settings/payment"
                        />
                    </div>
                </section>

                <section>
                    <h2 className="mb-1 mt-6 text-[12px] text-[#536462]">
                        パートナー
                    </h2>

                    <div className="rounded-2xl border border-[#D9E5E3] bg-white px-4">
                        <SettingItem
                            label="パートナー情報の編集"
                            href="/settings/partner-info"
                        />

                        <SettingItem
                            label="パートナー連携の設定"
                            href="/partner"
                        />
                    </div>
                </section>

                <section>
                    <h2 className="mb-1 mt-6 text-[12px] text-[#536462]">
                        サポート
                    </h2>

                    <div className="rounded-2xl border border-[#D9E5E3] bg-white px-4">
                        <SettingItem
                            label="よくある質問"
                            href="/settings/faq"
                        />

                        <SettingItem
                            label="お問い合わせ"
                            href="/settings/contact"
                        />
                    </div>
                </section>

                <section>
                    <h2 className="mb-1 mt-6 text-[12px] text-[#536462]">
                        その他
                    </h2>

                    <div className="rounded-2xl border border-[#D9E5E3] bg-white px-4">
                        <SettingItem
                            label="利用規約"
                            href="/terms"
                        />

                        <SettingItem
                            label="プライバシーポリシー"
                            href="/privacy"
                        />
                    </div>
                </section>

                <section className="mt-8">
                    <div className="rounded-2xl border border-[#D9E5E3] bg-white px-4">
                        <SettingItem
                            label="退会"
                            href="/settings/delete-account"
                            danger
                        />
                    </div>
                </section>
            </div>
        </main>
    );
}