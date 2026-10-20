
import { getClientPromise } from "@/lib/mongodb";
import { verifyJWT } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/utils";
import { ObjectId } from "mongodb";

const VALID_STATUSES = ["Open", "Close", "Cancel"];

export async function GET(request, { params }) {
  try {
    const user = verifyJWT(request);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    if (!["Teacher", "Student"].includes(user.role)) {
      return errorResponse("Forbidden", 403);
    }

    const { course_id } = await params;

    if (!ObjectId.isValid(course_id)) {
      return errorResponse("Invalid course ID", 400);
    }

    const client = await getClientPromise();
    const db = client.db(
  process.env.DB_NAME || "online_course"
);

    const course = await db.collection("courses").findOne({
      _id: new ObjectId(course_id),
    });

    if (!course) {
      return errorResponse("Course not found", 404);
    }

    if (
      user.role === "Teacher" &&
      course.teacherId !== user.id
    ) {
      return errorResponse("Forbidden", 403);
    }

    if (
      user.role === "Student" &&
      course.status === "Cancel"
    ) {
      return errorResponse("Course not found", 404);
    }

  
if (user.role === "Student") {
  const { enrolledStudents, ...publicCourse } = course;

  return successResponse(
    { course: publicCourse },
    200
  );
}

// Teacher: get enrolled students
const studentIds = course.enrolledStudents || [];

const validIds = studentIds
  .filter((id) => ObjectId.isValid(id))
  .map((id) => new ObjectId(id));

const students = await db
  .collection("users")
  .find({
    _id: { $in: validIds },
    role: "Student",
  })
  .project({
    username: 1,
    email: 1,
    role: 1,
  })
  .toArray();

return successResponse(
  {
    course: {
      ...course,
      enrolledStudents: students,
    },
  },
  200
);


  } catch (error) {
    console.error("GET course error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function PUT(request, { params }) {
  try {
    const user = verifyJWT(request);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    if (user.role !== "Teacher") {
      return errorResponse("Forbidden", 403);
    }

    const { course_id } = await params;

    if (!ObjectId.isValid(course_id)) {
      return errorResponse("Invalid course ID", 400);
    }

    const data = await request.json();

    const allowedFields = [
      "courseName",
      "duration",
      "topics",
      "price",
      "maxStudent",
      "status",
    ];

    const update = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        update[field] = data[field];
      }
    }

    if (Object.keys(update).length === 0) {
      return errorResponse("No fields to update", 400);
    }

    if (
      ("courseName" in update &&
        (typeof update.courseName !== "string" ||
          !update.courseName.trim())) ||
      ("duration" in update &&
        (!Number.isInteger(update.duration) ||
          update.duration <= 0)) ||
      ("topics" in update &&
        (!Array.isArray(update.topics) ||
          update.topics.length === 0 ||
          !update.topics.every(
            (topic) =>
              typeof topic === "string" && topic.trim()
          ))) ||
      ("price" in update &&
        (typeof update.price !== "number" ||
          !Number.isFinite(update.price) ||
          update.price < 0)) ||
      ("maxStudent" in update &&
        (!Number.isInteger(update.maxStudent) ||
          update.maxStudent <= 0)) ||
      ("status" in update &&
        !VALID_STATUSES.includes(update.status))
    ) {
      return errorResponse("Invalid course data", 400);
    }

    if ("courseName" in update) {
      update.courseName = update.courseName.trim();
    }

    if ("topics" in update) {
      update.topics = update.topics.map((topic) =>
        topic.trim()
      );
    }

    const client = await getClientPromise();
    const db = client.db(
  process.env.DB_NAME || "online_course"
);
    const courses = db.collection("courses");

    const filter = {
      _id: new ObjectId(course_id),
      teacherId: user.id,
    };

    const course = await courses.findOne(filter);

    if (!course) {
      return errorResponse("Course not found or forbidden", 404);
    }

    if (
      "maxStudent" in update &&
      update.maxStudent <
        (course.enrolledStudents?.length || 0)
    ) {
      return errorResponse(
        "Max Student cannot be smaller than current enrollment",
        400
      );
    }

update.updatedAt = new Date();

const updateFilter = { ...filter };

if ("maxStudent" in update) {
  updateFilter.$expr = {
    $lte: [
      {
        $size: {
          $ifNull: ["$enrolledStudents", []],
        },
      },
      update.maxStudent,
    ],
  };
}

const result = await courses.updateOne(
  updateFilter,
  {
    $set: update,
  }
);

if (result.matchedCount === 0) {
  return errorResponse(
    "Course update failed or maxStudent is below enrollment",
    409
  );
}

    return successResponse(
      {
        message: "Course updated successfully",
        modifiedCount: result.modifiedCount,
      },
      200
    );
  } catch (error) {
    console.error("PUT course error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = verifyJWT(request);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    if (user.role !== "Teacher") {
      return errorResponse("Forbidden", 403);
    }

    const { course_id } = await params;

    if (!ObjectId.isValid(course_id)) {
      return errorResponse("Invalid course ID", 400);
    }

    const client = await getClientPromise();
    const db = client.db(
  process.env.DB_NAME || "online_course"
);
    const courses = db.collection("courses");

    
    const result = await courses.deleteOne({
      _id: new ObjectId(course_id),
      teacherId: user.id,
      $or: [
        { enrolledStudents: { $size: 0 } },
        { enrolledStudents: { $exists: false } },
      ],
    });

    if (result.deletedCount === 0) {
      return errorResponse(
        "Course not found, forbidden, or has enrolled students",
        409
      );
    }

    return successResponse(
      { message: "Course deleted successfully" },
      200
    );
  } catch (error) {
    console.error("DELETE course error:", error);
    return errorResponse("Internal server error", 500);
  }
}