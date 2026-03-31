import { NextResponse } from "next/server";

export function middleware(req) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/admin/dashboard")) {
    // Client-side auth handles validation
    return NextResponse.next();
  }
}
