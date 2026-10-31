import { NextRequest, NextResponse } from "next/server";

const redirects: Record<string, string> = {
  "/staking-assessment": "/pool",
  "/tools/uplc-link": "/projects/uplc-link",
};

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/$/, "");

  const destination = redirects[pathname];
  if (destination) {
    const origin = new URL(request.url);
    // Next normalizes loopback hostnames; preserve the incoming request origin.
    origin.host = request.headers.get("host") || origin.host;
    return NextResponse.redirect(new URL(destination, origin), 308);
  }


  return NextResponse.next();
}
