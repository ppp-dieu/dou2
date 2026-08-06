import Image from "next/image";

export default function LoadingScreen() {
  return (
    <main className="flex h-dvh items-center justify-center bg-white">
      <Image
        src="/images/dou_face.svg"
        alt=""
        width={96}
        height={96}
        priority
        className="animate-pulse"
      />
    </main>
  );
}