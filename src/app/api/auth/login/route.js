//src/app/api/auth/logout/route.js

import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { errorResponse } from "@/lib/utils";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request) {
  try {
    const data = await request.json();
    const { username, password } = data;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return errorResponse(
        "Username and password are required",
        400
      );
    }

    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const user = await checkUserCredentials(
      username.trim(),
      password
    );

    if (!user) {
      return errorResponse(
        "Invalid username or password",
        401
      );
    }

    const token = getJWTtoken(user);

    const response = NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );

    response.cookies.set("token", token, {
      httpOnly: true,
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse("Internal server error", 500);
  }
}

async function checkUserCredentials(username, password) {
  const client = await getClientPromise();

  const db = client.db(
    process.env.DB_NAME || "online_course"
  );

  const user = await db.collection("users").findOne({
    $or: [
      { username: username },
      { email: username },
    ],
  });

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(
    password,
    user.password
  );

  if (!isValid) {
    return null;
  }

  if (!["Teacher", "Student"].includes(user.role)) {
    return null;
  }

  return user;
}

function getJWTtoken(user) {
  const payload = {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  });
  
}
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
