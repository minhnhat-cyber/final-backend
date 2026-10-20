//src/app/api/user/route.js

import { getClientPromise } from "@/lib/mongodb";
import { verifyJWT } from "@/lib/auth";
import {
  errorResponse,
  successResponse,
  printExceptionLog,
} from "@/lib/utils";

export async function GET(request) {
  try {
    const user = verifyJWT(request);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    if (!["Teacher", "Student"].includes(user.role)) {
      return errorResponse("Forbidden", 403);
    }

    const client = await getClientPromise();
    const db = client.db(
      process.env.DB_NAME || "online_course"
    );

    const targetRole =
      user.role === "Teacher" ? "Student" : "Teacher";

    const users = await db
      .collection("user")
      .find({ role: targetRole })
      .project({
        username: 1,
        email: 1,
        role: 1,
      })
      .toArray();

    return successResponse({ users }, 200);
  } catch (error) {
    printExceptionLog("GET Users", error);
    return errorResponse("Internal server error", 500);
  }
}