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

    if (user.role !== "Student") {
      return errorResponse("Only students can access this", 403);
    }

    const client = await getClientPromise();
    const db = client.db("online_course");

    const courses = await db
      .collection("courses")
      .find({
        enrolledStudents: user.id,
      })
      .project({
        enrolledStudents: 0,
      })
      .toArray();

    return successResponse(
      { courses },
      200
    );
  } catch (error) {
    printExceptionLog("GET My Enrollments", error);
    return errorResponse("Internal server error", 500);
  }
}