import { cookies } from "next/headers";
import type { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "dew-claw-comp-tool-session";
const SESSION_NAMESPACE = "dew-claw:comp-tool-auth";

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function getAppPassword() {
  return process.env.APP_PASSWORD?.trim() ?? "";
}

function getAuthSecret() {
  return process.env.AUTH_SECRET?.trim() || getAppPassword();
}

export function isAuthConfigured() {
  return Boolean(getAppPassword() && getAuthSecret());
}

async function createSessionToken() {
  const authSecret = getAuthSecret();

  if (!authSecret) {
    return null;
  }

  const payload = new TextEncoder().encode(`${SESSION_NAMESPACE}:${authSecret}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);

  return toHex(digest);
}

export function getSafeRedirect(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function passwordMatches(candidate: string) {
  const expectedPassword = getAppPassword();

  return Boolean(expectedPassword) && candidate === expectedPassword;
}

export async function hasValidSession(cookieStore: Pick<RequestCookies, "get">) {
  const expectedToken = await createSessionToken();
  const actualToken = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

  return Boolean(expectedToken && actualToken && actualToken === expectedToken);
}

export async function isAuthenticated() {
  const cookieStore = await cookies();

  return hasValidSession(cookieStore);
}

export async function applySession(response: NextResponse) {
  const token = await createSessionToken();

  if (!token) {
    return response;
  }

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}

export function clearSession(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
