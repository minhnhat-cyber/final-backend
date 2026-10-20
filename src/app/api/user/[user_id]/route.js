//src/app/api/user/[user_id]/route.js

import { getClientPromise } from "@/lib/mongodb";
import { verifyJWT } from "@/lib/auth";
import {
  errorResponse,
  successResponse,
  printExceptionLog,
} from "@/lib/utils";
import { ObjectId } from "mongodb";

export async function GET(request, { params }) {
  try {
    const user = verifyJWT(request);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    if (!["Teacher", "Student"].includes(user.role)) {
      return errorResponse("Forbidden", 403);
    }

    const { user_id } = await params;

    if (!ObjectId.isValid(user_id)) {
      return errorResponse("Invalid user ID", 400);
    }

    // Users can view their own information,
    // or basic public information of teachers.
    const client = await getClientPromise();
    const db = client.db(
      process.env.DB_NAME || "online_course"
    );

    const targetUser = await db
      .collection("user")
      .findOne(
        { _id: new ObjectId(user_id) },
        {
          projection: {
            username: 1,
            email: 1,
            role: 1,
          },
        }
      );

    if (!targetUser) {
      return errorResponse("User not found", 404);
    }

    if (
      targetUser._id.toString() !== user.id &&
      targetUser.role !== "Teacher"
    ) {
      return errorResponse("Forbidden", 403);
    }

    return successResponse({ user: targetUser }, 200);
  } catch (error) {
    printExceptionLog("GET User Detail", error);
    return errorResponse("Internal server error", 500);
  }
}