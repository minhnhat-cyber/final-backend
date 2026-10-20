
import { NextResponse } from "next/server";
import { verifyJWT } from "./lib/auth";
import corsHeaders from "./lib/cors";
import {
  X_HEADER_USER_EMAIL,
  X_HEADER_USER_ID,
  X_HEADER_USER_NAME,
} from "./lib/constant";

export function proxy(request) {
  // Allow CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Verify JWT
  const user = verifyJWT(request);

  if (!user) {
    return NextResponse.json(
      { message: "Unauthorized Request" },
      { status: 401, headers: corsHeaders }
    );
  }

  // Validate JWT payload
  if (
    !user.id ||
    !user.username ||
    !user.email ||
    !["Teacher", "Student"].includes(user.role)
  ) {
    return NextResponse.json(
      { message: "Invalid authentication" },
      { status: 403, headers: corsHeaders }
    );
  }

  // Forward trusted user information
  const requestHeaders = new Headers(request.headers);

  requestHeaders.delete(X_HEADER_USER_ID);
  requestHeaders.delete(X_HEADER_USER_NAME);
  requestHeaders.delete(X_HEADER_USER_EMAIL);

  requestHeaders.set(X_HEADER_USER_ID, user.id);
  requestHeaders.set(X_HEADER_USER_NAME, user.username);
  requestHeaders.set(X_HEADER_USER_EMAIL, user.email);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/api/course/:path*",
    "/api/user/:path*",
  ],
};
