import Image from "next/image";

export default function LoadingScreen() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-transparent">
      <Image
        src="/image/dou_face.svg"
        alt=""
        width={96}
        height={96}
        priority
        className="animate-pulse"
      />
    </main>
  );
}