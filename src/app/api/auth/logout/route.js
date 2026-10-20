//src/app/api/auth/logout/route.js
import corsHeaders from "@/lib/cors";
import { NextResponse } from "next/server";

export async function POST() {
    const response = NextResponse.json(
        { message: "Logged out successfully" },
        { status: 200, headers: corsHeaders }
    );
    response.cookies.set("token", "", { path: "/", maxAge: 0 });
    return response;
}