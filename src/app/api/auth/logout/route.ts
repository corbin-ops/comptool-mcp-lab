import { NextResponse } from "next/server";

import { clearSession } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  return clearSession(response);
}
