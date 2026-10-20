import { getClientPromise } from "@/lib/mongodb";
import {
  errorResponse,
  successResponse,
  printExceptionLog,
} from "@/lib/utils";
import { verifyJWT } from "@/lib/auth";
import { ObjectId } from "mongodb";

export async function POST(request, { params }) {
  try {
    // 1. Authentication
    const user = verifyJWT(request);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    // 2. Authorization
    if (user.role !== "Student") {
      return errorResponse(
        "Only students can enroll",
        403
      );
    }

    // 3. Get course ID
    const { course_id } = await params;

    if (!ObjectId.isValid(course_id)) {
      return errorResponse("Invalid course ID", 400);
    }

    // 4. Connect MongoDB
    const client = await getClientPromise();
    const db = client.db("online_course");
    const courses = db.collection("courses");

    // 5. Find course
    const course = await courses.findOne({
      _id: new ObjectId(course_id),
    });

    if (!course) {
      return errorResponse("Course not found", 404);
    }

    // 6. Check status
    if (course.status !== "Open") {
      return errorResponse(
        "Course is not open for enrollment",
        409
      );
    }

    // 7. Check duplicate enrollment
    const students = course.enrolledStudents || [];

    if (students.includes(user.id)) {
      return errorResponse(
        "Student already enrolled",
        409
      );
    }

    // 8. Check available seats
    if (students.length >= course.maxStudent) {
      return errorResponse("Course is full", 409);
    }

    // 9. Atomic enrollment
    const result = await courses.updateOne(
      {
        _id: new ObjectId(course_id),
        status: "Open",
        enrolledStudents: { $ne: user.id },
        $expr: {
          $lt: [
            {
              $size: {
                $ifNull: ["$enrolledStudents", []],
              },
            },
            "$maxStudent",
          ],
        },
      },
      {
        $addToSet: {
          enrolledStudents: user.id,
        },
      }
    );

    if (result.modifiedCount === 0) {
      return errorResponse(
        "Enrollment failed. Course may be full or already enrolled.",
        409
      );
    }

    return successResponse(
      {
        message: "Enrollment successful",
        courseId: course_id,
      },
      200
    );
  } catch (error) {
    printExceptionLog("POST Enrollment", error);

    return errorResponse(
      "Enrollment Internal Error",
      500
    );
  }
}