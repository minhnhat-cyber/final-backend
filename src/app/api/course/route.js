///src/app/api/course/route.js

import { getClientPromise } from "@/lib/mongodb";
import { verifyJWT } from "@/lib/auth";
import {
  errorResponse,
  successResponse,
  printExceptionLog,
} from "@/lib/utils";

const VALID_STATUSES = ["Open", "Close", "Cancel"];

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
    const db = client.db(process.env.DB_NAME || "online_course");

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";

    // Teacher can only view their own courses.
    // Student cannot view cancelled courses.
    const query =
      user.role === "Teacher"
        ? { teacherId: user.id }
        : { status: { $in: ["Open", "Close"] } };

    const courses = await db
      .collection("courses")
      .find(query)
      .project(
        user.role === "Student"
          ? { enrolledStudents: 0 }
          : {}
      )
      .toArray();

    // Find teacher names for searching and display.
    if (user.role === "Student") {
      const teacherIds = [
        ...new Set(
          courses.map((course) => course.teacherId)
        ),
      ];

      const { ObjectId } = await import("mongodb");

      const validIds = teacherIds
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

      const teachers = await db
        .collection("users")
        .find({
          _id: { $in: validIds },
          role: "Teacher",
        })
        .project({ username: 1 })
        .toArray();

      const teacherNames = new Map(
        teachers.map((teacher) => [
          teacher._id.toString(),
          teacher.username,
        ])
      );

      const keyword = search.toLowerCase();

      const result = courses
        .map((course) => ({
          ...course,
          teacherName:
            teacherNames.get(course.teacherId) || "Unknown",
        }))
        .filter((course) => {
          if (!keyword) return true;

          return (
            course.courseName
              ?.toLowerCase()
              .includes(keyword) ||
            course.teacherName
              .toLowerCase()
              .includes(keyword)
          );
        });

      return successResponse({ courses: result }, 200);
    }

    return successResponse({ courses }, 200);

  } catch (error) {
    printExceptionLog("GET Courses", error);

    return errorResponse(
      "GET Courses Internal Error",
      500
    );
  }
}

export async function POST(request) {
  try {
    const user = verifyJWT(request);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    if (user.role !== "Teacher") {
      return errorResponse(
        "Only teachers can create courses",
        403
      );
    }

    const data = await request.json();

    const {
      courseName,
      duration,
      topics,
      price,
      maxStudent,
      status = "Open",
    } = data;

    // Validate course information.
    if (
      typeof courseName !== "string" ||
      !courseName.trim() ||
      !Number.isInteger(duration) ||
      duration <= 0 ||
      !Array.isArray(topics) ||
      topics.length === 0 ||
      !topics.every(
        (topic) =>
          typeof topic === "string" &&
          topic.trim().length > 0
      ) ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(maxStudent) ||
      maxStudent <= 0 ||
      !VALID_STATUSES.includes(status)
    ) {
      return errorResponse(
        "Invalid course information",
        400
      );
    }

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME || "online_course");

    const course = {
      courseName: courseName.trim(),
      duration,
      topics: topics.map((topic) => topic.trim()),
      price,
      maxStudent,
      status,
      teacherId: user.id,
      enrolledStudents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db
      .collection("courses")
      .insertOne(course);

    return successResponse(
      {
        message: "Course created successfully",
        course: {
          ...course,
          _id: result.insertedId,
        },
      },
      201
    );

  } catch (error) {
    printExceptionLog("POST Course", error);

    return errorResponse(
      "POST Course Internal Error",
      500
    );
  }
}
