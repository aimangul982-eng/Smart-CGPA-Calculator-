// Smart CGPA Calculator - frontend logic
const GRADES = { "A+": 4.0, A: 4.0, "A-": 3.67, "B+": 3.33, B: 3.0, "B-": 2.67, "C+": 2.33, C: 2.0, "C-": 1.67, D: 1.0, F: 0.0 };
const API = "/api/results";
const $ = (id) => document.getElementById(id);

let semester = null; // { subjects, totalCredits, gpa }
let finalResult = null;

// ---------- API layer (falls back to browser storage only if no server is reachable) ----------
let useLocal = false;
const LKEY = "smart-cgpa-records";
const local = {
  all: () => JSON.parse(localStorage.getItem(LKEY) || "[]"),
  save: (list) => localStorage.setItem(LKEY, JSON.stringify(list)),
};
async function api(method, url, body) {
  if (!useLocal) {
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new TypeError("no api");
      const data = await res.json();
      if (!res.ok) throw new Error((data.errors || [data.error]).join(" "));
      return data;
    } catch (e) {
      if (!(e instanceof TypeError)) throw e;
      useLocal = true;
    }
  }
  // Local fallback mirrors the REST API
  const list = local.all();
  const id = Number(url.split("/").pop());
  if (method === "POST") {
    const rec = { id: Date.now(), student_name: body.studentName, roll_number: body.rollNumber, department: body.department, semester: body.semester,
      subjects: body.subjects.map((s) => ({ ...s, points: GRADES[s.grade] })), total_subjects: body.subjects.length,
      total_credits: body.subjects.reduce((a, s) => a + Number(s.credits), 0), gpa: body.gpa, cgpa: body.cgpa, status: body.status,
      created_at: new Date().toLocaleString() };
    list.unshift(rec); local.save(list); return rec;
  }
  if (method === "DELETE") { local.save(list.filter((r) => r.id !== id)); return { success: true }; }
  if (url.includes("?search=") || url === API) {
    const q = decodeURIComponent(url.split("?search=")[1] || "").toLowerCase();
    return list.filter((r) => !q || r.student_name.toLowerCase().includes(q) || r.roll_number.toLowerCase().includes(q));
  }
  const r = list.find((x) => x.id === id); if (!r) throw new Error("Record not found."); return r;
}

// ---------- Helpers ----------
function toast(msg, type = "success") {
  const t = $("toast"); t.textContent = msg; t.className = `toast ${type} show`;
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200);
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function statusOf(c) {
  if (c >= 3.5) return "Excellent"; if (c >= 3.0) return "Very Good"; if (c >= 2.5) return "Good";
  if (c >= 2.0) return "Satisfactory"; return "Needs Improvement";
}
function fieldError(id, msg) {
  const el = $(id); el.classList.toggle("invalid", !!msg);
  const e = document.querySelector(`.err[data-for="${id}"]`); if (e) e.textContent = msg || "";
}

// ---------- Subjects ----------
function addRow(data = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td class="idx"></td>
    <td><input class="s-name" maxlength="100" placeholder="e.g. Data Structures" value="${esc(data.name || "")}"></td>
    <td><input class="s-cr" type="number" min="0.5" step="0.5" placeholder="3" value="${data.credits ?? ""}"></td>
    <td><select class="s-grade"><option value="">Select</option>${Object.keys(GRADES).map((g) => `<option ${data.grade === g ? "selected" : ""}>${g}</option>`).join("")}</select></td>
    <td class="pts">—</td>
    <td><button class="btn danger sm" title="Remove this subject">✕</button></td>`;
  tr.querySelector(".s-grade").addEventListener("change", (e) => {
    tr.querySelector(".pts").textContent = e.target.value ? GRADES[e.target.value].toFixed(2) : "—";
  });
  tr.querySelector("button").addEventListener("click", () => { tr.remove(); renumber(); });
  $("subjectBody").appendChild(tr); renumber();
}
function renumber() { [...$("subjectBody").rows].forEach((r, i) => (r.querySelector(".idx").textContent = i + 1)); }
function invalidateSemester() { semester = null; finalResult = null; $("resultCard").classList.add("hidden"); $("cgpaDisplay").classList.add("hidden"); }

$("addSubject").onclick = () => addRow();
$("removeSubject").onclick = () => {
  const rows = $("subjectBody").rows;
  if (!rows.length) return toast("There are no subjects to remove.", "error");
  rows[rows.length - 1].remove(); renumber();
};
$("clearAll").onclick = () => {
  if ($("subjectBody").rows.length && !confirm("Remove all subjects?")) return;
  $("subjectBody").innerHTML = ""; addRow(); resetStats(); invalidateSemester();
};
function resetStats() {
  $("statSubjects").textContent = "0"; $("statCredits").textContent = "0"; $("statGpa").textContent = "—";
  $("curGpa").value = ""; $("curCredits").value = ""; $("subjectError").classList.add("hidden");
}

function validateStudent() {
  let ok = true;
  const checks = { studentName: "Please enter the student name.", rollNumber: "Please enter the roll number.", department: "Please enter the department.", semester: "Please select a semester." };
  for (const [id, msg] of Object.entries(checks)) {
    const empty = !$(id).value.trim(); fieldError(id, empty ? msg : ""); if (empty) ok = false;
  }
  return ok;
}
function readSubjects() {
  const rows = [...$("subjectBody").rows], errs = [], subjects = [];
  if (!rows.length) errs.push("Please add at least one subject.");
  rows.forEach((r, i) => {
    const name = r.querySelector(".s-name"), cr = r.querySelector(".s-cr"), gr = r.querySelector(".s-grade");
    const n = name.value.trim(), c = parseFloat(cr.value), g = gr.value;
    name.classList.toggle("invalid", !n); cr.classList.toggle("invalid", !(c > 0)); gr.classList.toggle("invalid", !g);
    if (!n) errs.push(`Subject ${i + 1}: subject name cannot be empty.`);
    if (!(c > 0)) errs.push(`Subject ${i + 1}: credit hours must be greater than 0.`);
    if (!g) errs.push(`Subject ${i + 1}: please select a grade.`);
    subjects.push({ name: n, credits: c, grade: g });
  });
  return { errs, subjects };
}

$("calcGpa").onclick = () => {
  const studentOk = validateStudent();
  const { errs, subjects } = readSubjects();
  const box = $("subjectError");
  if (errs.length) { box.innerHTML = errs.map(esc).join("<br>"); box.classList.remove("hidden"); }
  else box.classList.add("hidden");
  if (!studentOk || errs.length) { invalidateSemester(); return toast("Please fix the highlighted fields.", "error"); }

  const totalCredits = subjects.reduce((a, s) => a + s.credits, 0);
  const qualityPoints = subjects.reduce((a, s) => a + s.credits * GRADES[s.grade], 0);
  const gpa = qualityPoints / totalCredits;
  semester = { subjects, totalCredits, gpa };
  $("statSubjects").textContent = subjects.length;
  $("statCredits").textContent = +totalCredits.toFixed(2);
  $("statGpa").textContent = gpa.toFixed(2);
  $("curGpa").value = gpa.toFixed(2);
  $("curCredits").value = +totalCredits.toFixed(2);
  toast(`Semester GPA calculated: ${gpa.toFixed(2)}`);
  $("cgpa").scrollIntoView({ behavior: "smooth" });
};

// ---------- CGPA ----------
$("noPrevious").onchange = (e) => {
  ["prevCgpa", "prevCredits"].forEach((id) => { $(id).disabled = e.target.checked; if (e.target.checked) { $(id).value = ""; fieldError(id, ""); } });
};
$("calcCgpa").onclick = () => {
  if (!semester) return toast("Please calculate your semester GPA first.", "error");
  if (!validateStudent()) return toast("Please complete the student information.", "error");
  let cgpa = semester.gpa;
  const pcRaw = $("prevCgpa").value.trim(), phRaw = $("prevCredits").value.trim();
  const noPrev = $("noPrevious").checked || (!pcRaw && !phRaw);
  fieldError("prevCgpa", ""); fieldError("prevCredits", "");
  if (!noPrev) {
    const pc = parseFloat(pcRaw), ph = parseFloat(phRaw);
    let bad = false;
    if (isNaN(pc) || pc < 0 || pc > 4) { fieldError("prevCgpa", "Previous CGPA must be between 0.00 and 4.00."); bad = true; }
    if (isNaN(ph) || ph <= 0) { fieldError("prevCredits", "Previous credit hours must be greater than 0."); bad = true; }
    if (bad) return toast("Please fix the previous record fields.", "error");
    cgpa = (pc * ph + semester.gpa * semester.totalCredits) / (ph + semester.totalCredits);
  }
  const status = statusOf(cgpa);
  finalResult = {
    studentName: $("studentName").value.trim(), rollNumber: $("rollNumber").value.trim(),
    department: $("department").value.trim(), semester: $("semester").value,
    subjects: semester.subjects, gpa: +semester.gpa.toFixed(2), cgpa: +cgpa.toFixed(2), status,
  };
  $("cgpaValue").textContent = cgpa.toFixed(2);
  $("cgpaStatus").textContent = status;
  $("cgpaDisplay").classList.remove("hidden");
  renderResult();
};
function renderResult() {
  const r = finalResult;
  const items = [["Student Name", r.studentName], ["Roll Number", r.rollNumber], ["Department", r.department], ["Semester", r.semester],
    ["Total Subjects", r.subjects.length], ["Total Credit Hours", +semester.totalCredits.toFixed(2)], ["Semester GPA", r.gpa.toFixed(2)],
    ["Overall CGPA", r.cgpa.toFixed(2)], ["Performance Status", `<span class="status-${r.status.replace(/\s/g, "")}">${r.status}</span>`]];
  $("resultGrid").innerHTML = items.map(([k, v]) => `<div><span>${k}</span><b>${k === "Performance Status" ? v : esc(v)}</b></div>`).join("");
  $("resultCard").classList.remove("hidden");
  $("saveResult").disabled = false;
  $("resultCard").scrollIntoView({ behavior: "smooth" });
}

$("saveResult").onclick = async () => {
  if (!finalResult) return toast("Please calculate CGPA before saving.", "error");
  const btn = $("saveResult"); btn.disabled = true; btn.textContent = "Saving…";
  try {
    await api("POST", API, finalResult);
    toast("✔ Result saved successfully!");
    btn.textContent = "✔ Saved";
    loadRecords();
  } catch (e) {
    toast(e.message || "Could not save the result.", "error");
    btn.disabled = false; btn.textContent = "💾 Save Result";
  }
};

$("resetAll").onclick = () => {
  if (!confirm("Reset the calculator and start a new calculation?")) return;
  ["studentName", "rollNumber", "department", "semester", "prevCgpa", "prevCredits"].forEach((id) => { $(id).value = ""; $(id).disabled = false; fieldError(id, ""); });
  $("noPrevious").checked = false;
  $("subjectBody").innerHTML = ""; addRow();
  resetStats(); invalidateSemester();
  $("saveResult").textContent = "💾 Save Result";
  window.scrollTo({ top: 0, behavior: "smooth" });
  toast("Calculator reset. Start a new calculation!");
};

// ---------- Saved records ----------
async function loadRecords() {
  const q = $("search").value.trim();
  try {
    const list = await api("GET", q ? `${API}?search=${encodeURIComponent(q)}` : API);
    $("recordBody").innerHTML = list.map((r) => `<tr>
      <td>${esc(r.student_name)}</td><td>${esc(r.roll_number)}</td><td>${esc(r.semester)}</td>
      <td><b>${Number(r.gpa).toFixed(2)}</b></td><td><b>${Number(r.cgpa).toFixed(2)}</b></td><td>${esc(r.created_at)}</td>
      <td><button class="btn ghost sm" data-view="${r.id}">View</button> <button class="btn danger sm" data-del="${r.id}">Delete</button></td></tr>`).join("");
    $("noRecords").textContent = q ? "No records match your search." : "No saved records yet.";
    $("noRecords").classList.toggle("hidden", list.length > 0);
  } catch (e) { toast("Could not load saved records.", "error"); }
}
let searchTimer;
$("search").oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadRecords, 250); };
$("recordBody").onclick = async (e) => {
  const v = e.target.dataset.view, d = e.target.dataset.del;
  if (v) {
    try {
      const r = await api("GET", `${API}/${v}`);
      $("modalBody").innerHTML = `<div class="result-grid">
        ${[["Student Name", r.student_name], ["Roll Number", r.roll_number], ["Department", r.department], ["Semester", r.semester],
          ["Total Subjects", r.total_subjects], ["Total Credit Hours", r.total_credits], ["GPA", Number(r.gpa).toFixed(2)],
          ["CGPA", Number(r.cgpa).toFixed(2)], ["Status", r.status], ["Saved On", r.created_at]].map(([k, val]) => `<div><span>${k}</span><b>${esc(val)}</b></div>`).join("")}
        </div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Subject</th><th>Credit Hours</th><th>Grade</th><th>Points</th></tr></thead><tbody>
        ${r.subjects.map((s) => `<tr><td>${esc(s.name)}</td><td>${s.credits}</td><td>${esc(s.grade)}</td><td>${Number(s.points).toFixed(2)}</td></tr>`).join("")}
        </tbody></table></div>`;
      $("modal").classList.remove("hidden");
    } catch (err) { toast(err.message, "error"); }
  }
  if (d) {
    if (!confirm("Are you sure you want to delete this record? This cannot be undone.")) return;
    try { await api("DELETE", `${API}/${d}`); toast("Record deleted."); loadRecords(); }
    catch (err) { toast(err.message, "error"); }
  }
};
$("closeModal").onclick = () => $("modal").classList.add("hidden");
$("modal").onclick = (e) => { if (e.target.id === "modal") $("modal").classList.add("hidden"); };

// ---------- Init ----------
addRow();
loadRecords();
