import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, getSupabaseServiceRoleKey } from "./env";

export function createAdminClient() {
  const { supabaseUrl } = getSupabasePublicConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
