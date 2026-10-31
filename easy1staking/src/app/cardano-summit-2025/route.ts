import { retiredPageResponse } from "@/lib/server/retirement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return retiredPageResponse("Cardano Summit 2025 tool");
}

export function HEAD() {
  return retiredPageResponse("Cardano Summit 2025 tool", true);
}

export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const OPTIONS = GET;
