import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = request.nextUrl.searchParams.get("next");
  let nextPath = "/dashboard";
  if (destination) {
    const destinationUrl = new URL(destination, request.url);
    if (destinationUrl.origin === request.nextUrl.origin) {
      nextPath = `${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`;
    }
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(nextPath, request.url));
  }

  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}
