import { retiredApiResponse } from "@/lib/server/retirement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return retiredApiResponse();
}

export function HEAD() {
  return retiredApiResponse(true);
}

export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const OPTIONS = GET;
