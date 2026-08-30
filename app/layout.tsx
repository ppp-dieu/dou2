import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import LiffInitializer from "@/app/components/LiffInitializer";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "dou2",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F2FFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body
        className={`${notoSansJP.className} min-h-full flex flex-col`}
      >
        <LiffInitializer />
        {children}
      </body>
    </html>
  );
}
