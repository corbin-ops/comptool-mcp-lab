import { NextResponse } from "next/server";

import { enrichCompRequestFromParcelLink } from "@/comp-tool/parcel-link";
import { parseCompEvaluateRequest } from "@/comp-tool/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON request body." }, { status: 400 });
  }

  const parsedRequest = parseCompEvaluateRequest(payload);
  const enrichment = await enrichCompRequestFromParcelLink(parsedRequest);

  return NextResponse.json({
    request: enrichment.request,
    parcelEnrichment: enrichment.parcelEnrichment,
    warnings: enrichment.warnings,
  });
}
