import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext, getPostLoginPath } from "@/lib/auth/session";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const context = await getCurrentUserContext();
      return NextResponse.redirect(new URL(next ?? getPostLoginPath(context?.roles ?? []), request.url));
    }
  }

  return NextResponse.redirect(new URL("/auth/login?message=callback-error", request.url));
}
