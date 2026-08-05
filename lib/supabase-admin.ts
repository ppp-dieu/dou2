import "server-only";

import { createClient } from "@supabase/supabase-js";

function requireServerEnvironment(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export function createSupabaseAdminClient() {
  return createClient(
    requireServerEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requireServerEnvironment("SUPABASE_SECRET_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
