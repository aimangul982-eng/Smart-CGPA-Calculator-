// Smart CGPA Calculator - Express + SQLite backend
const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Database (created automatically on startup) ----
const db = new Database(path.join(__dirname, "cgpa.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    roll_number TEXT NOT NULL,
    department TEXT NOT NULL,
    semester TEXT NOT NULL,
    subjects TEXT NOT NULL,          -- JSON: [{name, credits, grade, points}]
    total_subjects INTEGER NOT NULL,
    total_credits REAL NOT NULL,
    gpa REAL NOT NULL,
    cgpa REAL NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )
`);

const GRADES = { "A+": 4, A: 4, "A-": 3.67, "B+": 3.33, B: 3, "B-": 2.67, "C+": 2.33, C: 2, "C-": 1.67, D: 1, F: 0 };

app.use(express.json({ limit: "200kb" }));
app.use(express.static(path.join(__dirname, "public")));

function validate(b) {
  const errors = [];
  const str = (v) => typeof v === "string" && v.trim().length > 0;
  if (!str(b.studentName) || b.studentName.length > 100) errors.push("Student name is required.");
  if (!str(b.rollNumber) || b.rollNumber.length > 50) errors.push("Roll number is required.");
  if (!str(b.department) || b.department.length > 100) errors.push("Department is required.");
  if (!str(b.semester) || b.semester.length > 20) errors.push("Semester is required.");
  if (!Array.isArray(b.subjects) || b.subjects.length === 0) errors.push("At least one subject is required.");
  else b.subjects.forEach((s, i) => {
    if (!str(s.name)) errors.push(`Subject ${i + 1}: name is required.`);
    if (!(Number(s.credits) > 0)) errors.push(`Subject ${i + 1}: credit hours must be greater than 0.`);
    if (!(s.grade in GRADES)) errors.push(`Subject ${i + 1}: invalid grade.`);
  });
  ["gpa", "cgpa"].forEach((k) => {
    const n = Number(b[k]);
    if (isNaN(n) || n < 0 || n > 4) errors.push(`${k.toUpperCase()} must be between 0 and 4.`);
  });
  return errors;
}

const toRecord = (r) => ({ ...r, subjects: JSON.parse(r.subjects) });

// POST /api/results - save a result
app.post("/api/results", (req, res) => {
  const b = req.body || {};
  const errors = validate(b);
  if (errors.length) return res.status(400).json({ errors });
  const subjects = b.subjects.map((s) => ({
    name: s.name.trim(), credits: Number(s.credits), grade: s.grade, points: GRADES[s.grade],
  }));
  const totalCredits = subjects.reduce((a, s) => a + s.credits, 0);
  const info = db.prepare(`INSERT INTO results
    (student_name, roll_number, department, semester, subjects, total_subjects, total_credits, gpa, cgpa, status)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    b.studentName.trim(), b.rollNumber.trim(), b.department.trim(), b.semester.trim(),
    JSON.stringify(subjects), subjects.length, totalCredits, Number(b.gpa), Number(b.cgpa), String(b.status || "")
  );
  const row = db.prepare("SELECT * FROM results WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(toRecord(row));
});

// GET /api/results - list (optional ?search=)
app.get("/api/results", (req, res) => {
  const q = String(req.query.search || "").trim();
  const rows = q
    ? db.prepare("SELECT * FROM results WHERE student_name LIKE ? OR roll_number LIKE ? ORDER BY id DESC").all(`%${q}%`, `%${q}%`)
    : db.prepare("SELECT * FROM results ORDER BY id DESC").all();
  res.json(rows.map(toRecord));
});

// GET /api/results/:id
app.get("/api/results/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM results WHERE id = ?").get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Record not found." });
  res.json(toRecord(row));
});

// DELETE /api/results/:id
app.delete("/api/results/:id", (req, res) => {
  const info = db.prepare("DELETE FROM results WHERE id = ?").run(Number(req.params.id));
  if (!info.changes) return res.status(404).json({ error: "Record not found." });
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Smart CGPA Calculator running at http://localhost:${PORT}`));
