const express = require("express");
const store = require("../db/store");

const router = express.Router();

router.get("/", (req, res) => {
  const profile = store.getProfile(req.student.id);
  res.json({ profile, student: req.student, institute: req.institute });
});

module.exports = router;
