const { verifySession } = require("../lib/auth");
const store = require("../db/store");

module.exports = function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Not logged in." });
  }

  const payload = verifySession(token);
  if (!payload) {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }

  const student = store.getStudentById(payload.studentId);
  if (!student) {
    return res.status(401).json({ error: "Account not found." });
  }

  const institute = store.getInstituteById(student.instituteId);

  req.student = student;
  req.institute = institute;
  next();
};
