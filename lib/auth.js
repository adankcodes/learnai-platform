const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "insecure-dev-secret-change-me";

function signSession(student) {
  return jwt.sign(
    {
      studentId: student.id,
      instituteId: student.instituteId,
      name: student.name,
    },
    SECRET,
    { expiresIn: "7d" }
  );
}

function verifySession(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

module.exports = { signSession, verifySession };
