import { NextResponse } from "next/server";

import { applySession, getSafeRedirect, isAuthConfigured, passwordMatches } from "@/lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const redirectTo = getSafeRedirect(String(formData.get("redirectTo") ?? "/"));

  if (!isAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=config", request.url), { status: 303 });
  }

  if (!(await passwordMatches(password))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "invalid");
    loginUrl.searchParams.set("redirectTo", redirectTo);

    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 });
  return applySession(response);
}
