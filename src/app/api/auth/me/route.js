
import { getClientPromise } from "@/lib/mongodb";
import { verifyJWT } from "@/lib/auth";
import {
  errorResponse,
  successResponse,
  printExceptionLog,
} from "@/lib/utils";
import { ObjectId } from "mongodb";

export async function GET(request) {
  try {
    const user = verifyJWT(request);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    if (
      !ObjectId.isValid(user.id) ||
      !["Teacher", "Student"].includes(user.role)
    ) {
      return errorResponse("Invalid session", 401);
    }

    const client = await getClientPromise();

    const db = client.db(
      process.env.DB_NAME || "online_course"
    );

    const currentUser = await db
      .collection("user")
      .findOne(
        { _id: new ObjectId(user.id) },
        {
          projection: {
            username: 1,
            email: 1,
            role: 1,
          },
        }
      );

    if (!currentUser) {
      return errorResponse("User not found", 401);
    }

    if (!["Teacher", "Student"].includes(currentUser.role)) {
      return errorResponse("Invalid user role", 403);
    }

    return successResponse(
      {
        user: {
          id: currentUser._id.toString(),
          username: currentUser.username,
          email: currentUser.email,
          role: currentUser.role,
        },
      },
      200
    );
  } catch (error) {
    printExceptionLog("GET Auth Me", error);
    return errorResponse("Internal server error", 500);
  }
}
