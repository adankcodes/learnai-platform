const express = require("express");
const bcrypt = require("bcryptjs");
const store = require("../db/store");
const { signSession } = require("../lib/auth");

const router = express.Router();

// Students reach their institute's white-labeled portal by institute code
// (in a real deployment this would instead be resolved from the subdomain/
// embed origin automatically — kept explicit here for a runnable demo).
router.post("/login", (req, res) => {
  const { instituteCode, email, password } = req.body;

  if (!instituteCode || !email || !password) {
    return res.status(400).json({ error: "Institute code, email, and password are required." });
  }

  const institute = store.getInstituteByCode(instituteCode);
  if (!institute) {
    return res.status(404).json({ error: "No institute found with that code." });
  }

  const student = store.getStudentByEmail(institute.id, email);
  if (!student || !bcrypt.compareSync(password, student.passwordHash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  const token = signSession(student);
  res.json({
    token,
    student: {
      id: student.id,
      name: student.name,
      class: student.class,
      board: student.board,
      exam: student.exam,
    },
    institute: {
      name: institute.name,
      brandColor: institute.brandColor,
      logoText: institute.logoText,
    },
  });
});

// Lets an institute enroll a new student (in production this would be an
// admin-only endpoint; kept open here so the demo is self-contained).
router.post("/register-student", (req, res) => {
  const { instituteCode, name, email, password, studentClass, board, exam } = req.body;

  const institute = store.getInstituteByCode(instituteCode);
  if (!institute) {
    return res.status(404).json({ error: "No institute found with that code." });
  }
  if (store.getStudentByEmail(institute.id, email)) {
    return res.status(409).json({ error: "A student with this email already exists at this institute." });
  }
  if (!name || !email || !password || !studentClass || !board || !exam) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const student = store.createStudent({
    instituteId: institute.id,
    name,
    email,
    passwordHash,
    class: studentClass,
    board,
    exam,
  });

  const token = signSession(student);
  res.status(201).json({
    token,
    student: { id: student.id, name: student.name, class: student.class, board: student.board, exam: student.exam },
    institute: { name: institute.name, brandColor: institute.brandColor, logoText: institute.logoText },
  });
});

module.exports = router;
