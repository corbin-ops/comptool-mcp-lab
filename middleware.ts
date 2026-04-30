import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSafeRedirect, hasValidSession } from "@/lib/auth";

const PUBLIC_PATH_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/login",
  "/privacy",
  "/api/auth/login",
];
const ALWAYS_ALLOWED_PATHS = new Set(["/api/auth/logout"]);
const LOCAL_EXTENSION_INTAKE_PATH = "/api/phase2/browser-intake";
const EXTENSION_TOKEN_HEADER = "x-comp-tool-extension-token";

function isLocalDevelopmentHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function getConfiguredExtensionToken() {
  return process.env.EXTENSION_INTAKE_TOKEN?.trim() ?? "";
}

function getRequestExtensionToken(request: NextRequest) {
  const explicitToken = request.headers.get(EXTENSION_TOKEN_HEADER)?.trim();

  if (explicitToken) {
    return explicitToken;
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);

  return bearerMatch?.[1]?.trim() ?? "";
}

function hasValidExtensionToken(request: NextRequest) {
  const expectedToken = getConfiguredExtensionToken();
  const actualToken = getRequestExtensionToken(request);

  return Boolean(expectedToken && actualToken && actualToken === expectedToken);
}

function applyExtensionCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Comp-Tool-Extension-Token, Authorization",
  );

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === LOCAL_EXTENSION_INTAKE_PATH) {
    if (request.method === "OPTIONS") {
      return applyExtensionCors(new NextResponse(null, { status: 204 }));
    }

    if (request.method === "POST") {
      if (isLocalDevelopmentHost(request.nextUrl.hostname) || hasValidExtensionToken(request)) {
        return applyExtensionCors(NextResponse.next());
      }

      return applyExtensionCors(
        NextResponse.json(
          { error: "Missing or invalid extension intake token." },
          { status: 401 },
        ),
      );
    }
  }

  if (
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    ALWAYS_ALLOWED_PATHS.has(pathname)
  ) {
    return NextResponse.next();
  }

  const authenticated = await hasValidSession(request.cookies);

  if (authenticated) {
    return NextResponse.next();
  }

  const redirectTarget = getSafeRedirect(`${pathname}${search}`);
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirectTo", redirectTarget);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
