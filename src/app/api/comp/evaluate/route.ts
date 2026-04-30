import { NextResponse } from "next/server";

import { buildCompEvaluationResponse } from "@/comp-tool/evaluate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON request body." }, { status: 400 });
  }

  return NextResponse.json(await buildCompEvaluationResponse(payload));
}
