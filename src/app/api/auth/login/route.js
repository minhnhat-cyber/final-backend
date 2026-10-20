
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
      console.error("[LOGIN] JWT_SECRET_MISSING");
      return errorResponse("Internal server error", 500);
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

    const token = jwt.sign(
      {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

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

    console.log("[LOGIN] LOGIN_SUCCESS");

    return response;
  } catch (error) {
    console.error("[LOGIN] SERVER_ERROR:", error);
    return errorResponse("Internal server error", 500);
  }
}

async function checkUserCredentials(username, password) {
  const client = await getClientPromise();

  const db = client.db(
    process.env.DB_NAME || "online_course"
  );

  console.log(
    "[LOGIN] Database:",
    db.databaseName
  );

  const user = await db.collection("user").findOne({
    $or: [
      { username },
      { email: username },
    ],
  });

  // DEBUG 1: Check whether user exists
  console.log("[LOGIN] User found:", !!user);

  if (!user) {
    return null;
  }

  // DEBUG 2: Check bcrypt password
  const isValid = await bcrypt.compare(
    password,
    user.password
  );

  console.log("[LOGIN] Password matches:", isValid);

  if (!isValid) {
    return null;
  }

  // DEBUG 3: Check role
  const validRole = ["Teacher", "Student"].includes(
    user.role
  );

  console.log("[LOGIN] Role valid:", validRole);

  if (!validRole) {
    return null;
  }

  return user;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
