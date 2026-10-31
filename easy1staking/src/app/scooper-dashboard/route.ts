import { retiredPageResponse } from "@/lib/server/retirement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return retiredPageResponse("Scooper dashboard");
}

export function HEAD() {
  return retiredPageResponse("Scooper dashboard", true);
}

export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const OPTIONS = GET;
