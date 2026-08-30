"use client";

import { useEffect } from "react";
import { initializeLiff } from "@/lib/liff";

export default function LiffInitializer() {
  useEffect(() => {
    void initializeLiff().catch((error) => {
      console.error("LIFF initialization failed", error);
    });
  }, []);

  return null;
}
