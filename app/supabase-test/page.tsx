"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SupabaseTestPage() {
  const [message, setMessage] = useState("接続確認中...");

  useEffect(() => {
    const checkConnection = async () => {
      const { error } = await supabase.auth.getSession();

      if (error) {
        setMessage(`接続エラー：${error.message}`);
        return;
      }

      setMessage("Supabaseへの接続に成功しました");
    };

    checkConnection();
  }, []);

  return (
    <main className="flex h-dvh items-center justify-center px-6">
      <p>{message}</p>
    </main>
  );
}