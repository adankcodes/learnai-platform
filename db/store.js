// Minimal file-backed datastore.
//
// This is intentionally NOT a real database. For a prototype/demo it removes
// all install friction (no native compilation, no external service to spin
// up). Every table is one JSON file. Swap this module out for a real DB
// (Postgres, etc.) when moving to production multi-institute scale — the
// function signatures below are the contract the rest of the app relies on,
// so a real DB layer can be dropped in behind the same interface.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readTable(name) {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return [];
  const raw = fs.readFileSync(fp, "utf-8").trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeTable(name, rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath(name), JSON.stringify(rows, null, 2), "utf-8");
}

function nextId(rows) {
  return rows.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;
}

// ---- Institutes ----

function getInstitutes() {
  return readTable("institutes");
}

function getInstituteByCode(code) {
  return getInstitutes().find(
    (i) => i.code.toLowerCase() === String(code).toLowerCase()
  );
}

function getInstituteById(id) {
  return getInstitutes().find((i) => i.id === id);
}

function createInstitute(data) {
  const rows = getInstitutes();
  const row = { id: nextId(rows), createdAt: new Date().toISOString(), ...data };
  rows.push(row);
  writeTable("institutes", rows);
  return row;
}

// ---- Students ----

function getStudents() {
  return readTable("students");
}

function getStudentByEmail(instituteId, email) {
  return getStudents().find(
    (s) =>
      s.instituteId === instituteId &&
      s.email.toLowerCase() === String(email).toLowerCase()
  );
}

function getStudentById(id) {
  return getStudents().find((s) => s.id === id);
}

function createStudent(data) {
  const rows = getStudents();
  const row = { id: nextId(rows), createdAt: new Date().toISOString(), ...data };
  rows.push(row);
  writeTable("students", rows);
  return row;
}

// ---- Learning profiles (the "memory") ----

function getProfiles() {
  return readTable("profiles");
}

function getProfile(studentId) {
  let profile = getProfiles().find((p) => p.studentId === studentId);
  if (!profile) {
    profile = {
      studentId,
      learningStyle: null, // e.g. "visual", "step-by-step", "example-first"
      strengths: [], // topic strings the student is confident in
      weaknesses: [], // topic strings the student struggles with
      completedTopics: [], // [{ subject, topic, confidence, completedAt }]
      topicMastery: {}, // topicKey -> { attempts, correct, confidence, lastSeen }
      sessionLog: [], // [{ date, action, topic, summary }]
    };
    saveProfile(profile);
  }
  return profile;
}

function saveProfile(profile) {
  const rows = getProfiles().filter((p) => p.studentId !== profile.studentId);
  rows.push(profile);
  writeTable("profiles", rows);
  return profile;
}

function updateProfile(studentId, updaterFn) {
  const profile = getProfile(studentId);
  const updated = updaterFn(profile) || profile;
  return saveProfile(updated);
}

module.exports = {
  getInstitutes,
  getInstituteByCode,
  getInstituteById,
  createInstitute,
  getStudents,
  getStudentByEmail,
  getStudentById,
  createStudent,
  getProfile,
  saveProfile,
  updateProfile,
};
