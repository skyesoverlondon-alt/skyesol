import { q } from "./db.js";
import { getPlatformState, savePlatformState } from "./platform-state.js";

const CONFIG_KEY = "main";
const DAYS = ["day-1", "day-2", "day-3", "day-4", "day-5", "day-6", "day-7"];
const STUDENT_PROFILE_FIELDS = ["productName", "industry", "vision"];
const STUDENT_DEMO_FIELDS = ["name", "user", "feature", "ai", "offer", "next", "reflection"];
const STUDENT_SCORE_FIELDS = ["clarity", "coherence", "feature", "ai", "money", "trust", "presentation", "overall"];
const STUDENT_WORKBOOK_FIELDS = ["output", "questions", "notes", "homework", "done", "needsHelp"];

const DEFAULT_STATE = {
  cohort: {
    name: "0s Founder Cohort",
    term: "Founder-led elite open invitation lane",
    location: "Phoenix · Chicago · Houston · Denver",
    startDate: "",
    promise: "This is a founder-led build room. Students leave with a branded product direction, a real working lane, an AI or automation lane, and a monetization path."
  },
  letters: {
    subject: "Welcome to the 0s Founder Cohort",
    signature: "Skyes Over London",
    intro: "Welcome to the cohort. This room is founder-led, build-first, and built around clarity, discipline, and a real product outcome.",
    body: "Over the next 7 days you are expected to build daily, tighten daily, and leave with a product you can explain clearly. This is not a passive class. This is a serious build environment."
  },
  instructor: {
    resetNotes: "",
    notes: {
      "day-1": "", "day-2": "", "day-3": "", "day-4": "", "day-5": "", "day-6": "", "day-7": ""
    }
  },
  wiring: {
    identity: "", founderRole: "founder_admin", forms: "", welcomeWebhook: "", blobs: "", exports: "", neon: "", neonTable: "cohort_students"
  },
  students: [],
  generatedPreviewId: ""
};

function text(value, max = 5000) { return String(value ?? "").slice(0, max); }
function bool(value) { return !!value; }
function safeObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }

function normalizedConfigPatch(patch = {}) {
  const cohort = safeObject(patch.cohort);
  const letters = safeObject(patch.letters);
  const instructor = safeObject(patch.instructor);
  const wiring = safeObject(patch.wiring);
  return {
    cohort: {
      name: text(cohort.name || DEFAULT_STATE.cohort.name, 200),
      term: text(cohort.term || DEFAULT_STATE.cohort.term, 240),
      location: text(cohort.location || DEFAULT_STATE.cohort.location, 240),
      startDate: text(cohort.startDate || "", 40),
      promise: text(cohort.promise || DEFAULT_STATE.cohort.promise, 2000)
    },
    letters: {
      subject: text(letters.subject || DEFAULT_STATE.letters.subject, 240),
      signature: text(letters.signature || DEFAULT_STATE.letters.signature, 200),
      intro: text(letters.intro || DEFAULT_STATE.letters.intro, 4000),
      body: text(letters.body || DEFAULT_STATE.letters.body, 6000)
    },
    instructor: {
      resetNotes: text(instructor.resetNotes || "", 4000),
      notes: DAYS.reduce((acc, day) => {
        acc[day] = text(safeObject(instructor.notes)[day] || "", 4000);
        return acc;
      }, {})
    },
    wiring: {
      identity: text(wiring.identity || "", 300),
      founderRole: text(wiring.founderRole || DEFAULT_STATE.wiring.founderRole, 120),
      forms: text(wiring.forms || "", 400),
      welcomeWebhook: text(wiring.welcomeWebhook || "", 400),
      blobs: text(wiring.blobs || "", 400),
      exports: text(wiring.exports || "", 400),
      neon: text(wiring.neon || "", 400),
      neonTable: text(wiring.neonTable || DEFAULT_STATE.wiring.neonTable, 200)
    },
    generatedPreviewId: text(patch.generatedPreviewId || "", 80)
  };
}

export function ensureCohortStudentShape(student = {}) {
  const next = { ...student };
  next.id = text(next.id, 80);
  next.name = text(next.name, 200);
  next.email = text(next.email, 240);
  next.org = text(next.org, 200);
  next.track = text(next.track || "Founder Cohort", 160);
  next.seat = text(next.seat, 120);
  next.status = text(next.status || "pending", 40);
  next.notes = text(next.notes, 4000);
  next.createdAt = text(next.createdAt, 120);
  next.attendance = safeObject(next.attendance);
  next.profile = safeObject(next.profile);
  next.workbook = safeObject(next.workbook);
  next.demo = safeObject(next.demo);
  next.selfScore = safeObject(next.selfScore);
  next.founderScore = safeObject(next.founderScore);
  next.attendance = { day1: bool(next.attendance.day1), day2: bool(next.attendance.day2), day3: bool(next.attendance.day3), day4: bool(next.attendance.day4), day5: bool(next.attendance.day5), day6: bool(next.attendance.day6), day7: bool(next.attendance.day7) };
  next.profile = { productName: text(next.profile.productName, 2000), industry: text(next.profile.industry, 2000), vision: text(next.profile.vision, 2000) };
  next.demo = { name: text(next.demo.name, 3000), user: text(next.demo.user, 3000), feature: text(next.demo.feature, 3000), ai: text(next.demo.ai, 3000), offer: text(next.demo.offer, 3000), next: text(next.demo.next, 3000), reflection: text(next.demo.reflection, 3000) };
  next.selfScore = Object.fromEntries(STUDENT_SCORE_FIELDS.map((key) => [key, text(next.selfScore[key], 20)]));
  next.founderScore = { ...Object.fromEntries(STUDENT_SCORE_FIELDS.map((key) => [key, text(next.founderScore[key], 20)])), notes: text(next.founderScore.notes, 4000) };
  for (const day of DAYS) {
    const workbook = safeObject(next.workbook[day]);
    next.workbook[day] = { output: text(workbook.output, 4000), questions: text(workbook.questions, 4000), notes: text(workbook.notes, 4000), homework: text(workbook.homework, 4000), done: bool(workbook.done), needsHelp: bool(workbook.needsHelp) };
  }
  return next;
}

export function sanitizeStudentRecord(student = {}) {
  const next = ensureCohortStudentShape(student);
  return { id: next.id, name: next.name, email: next.email, org: next.org, track: next.track, seat: next.seat, status: next.status, createdAt: next.createdAt, profile: next.profile, workbook: next.workbook, demo: next.demo, selfScore: next.selfScore };
}

function rowToStudent(row = {}) {
  return ensureCohortStudentShape({ id: row.student_id, name: row.name, email: row.email, org: row.org, track: row.track, seat: row.seat, status: row.status, notes: row.notes, createdAt: row.created_at_label, attendance: row.attendance, profile: row.profile, workbook: row.workbook, demo: row.demo, selfScore: row.self_score, founderScore: row.founder_score });
}

function stateFromConfigRow(configRow = {}, students = []) {
  const config = normalizedConfigPatch({ cohort: configRow.cohort || DEFAULT_STATE.cohort, letters: configRow.letters || DEFAULT_STATE.letters, instructor: configRow.instructor || DEFAULT_STATE.instructor, wiring: configRow.wiring || DEFAULT_STATE.wiring, generatedPreviewId: configRow.generated_preview_id || "" });
  return { cohort: config.cohort, letters: config.letters, instructor: config.instructor, wiring: config.wiring, generatedPreviewId: config.generatedPreviewId, students };
}

async function syncPlatformSummary(updatedBy, state) {
  await savePlatformState("cohort-command", { ...state, founder: { code: "", session: false }, studentSession: { id: "", active: false } }, updatedBy);
}

async function getDedicatedState() {
  const [configRes, studentsRes] = await Promise.all([
    q(`select * from cohort_command_configs where config_key = $1 limit 1`, [CONFIG_KEY]),
    q(`select * from cohort_command_students order by created_at desc, student_id asc`, [])
  ]);
  if (!configRes.rowCount && !studentsRes.rowCount) return null;
  const configRow = configRes.rows[0] || {};
  const students = (studentsRes.rows || []).map(rowToStudent);
  return { state: stateFromConfigRow(configRow, students), updated_at: configRow.updated_at || null, updated_by: configRow.updated_by || null };
}

export async function getCohortCommandState() {
  const dedicated = await getDedicatedState();
  if (dedicated?.state) return dedicated;
  const doc = await getPlatformState("cohort-command");
  if (!doc?.state) return null;
  const state = { cohort: normalizedConfigPatch({ cohort: doc.state.cohort }).cohort, letters: normalizedConfigPatch({ letters: doc.state.letters }).letters, instructor: normalizedConfigPatch({ instructor: doc.state.instructor }).instructor, wiring: normalizedConfigPatch({ wiring: doc.state.wiring }).wiring, generatedPreviewId: text(doc.state.generatedPreviewId, 80), students: Array.isArray(doc.state.students) ? doc.state.students.map(ensureCohortStudentShape) : [] };
  return { ...doc, state, storage_mode: "legacy-platform-state" };
}

export async function saveFounderCohortConfig(patch = {}, updatedBy = "admin") {
  const current = await getCohortCommandState();
  const next = normalizedConfigPatch({ cohort: { ...(current?.state?.cohort || DEFAULT_STATE.cohort), ...(patch.cohort || {}) }, letters: { ...(current?.state?.letters || DEFAULT_STATE.letters), ...(patch.letters || {}) }, instructor: { ...(current?.state?.instructor || DEFAULT_STATE.instructor), ...(patch.instructor || {}), notes: { ...(current?.state?.instructor?.notes || DEFAULT_STATE.instructor.notes), ...(safeObject(patch.instructor).notes || {}) } }, wiring: { ...(current?.state?.wiring || DEFAULT_STATE.wiring), ...(patch.wiring || {}) }, generatedPreviewId: Object.prototype.hasOwnProperty.call(patch, "generatedPreviewId") ? patch.generatedPreviewId : (current?.state?.generatedPreviewId || "") });
  await q(`insert into cohort_command_configs(config_key, cohort, letters, instructor, wiring, generated_preview_id, updated_by) values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7) on conflict (config_key) do update set cohort = excluded.cohort, letters = excluded.letters, instructor = excluded.instructor, wiring = excluded.wiring, generated_preview_id = excluded.generated_preview_id, updated_by = excluded.updated_by, updated_at = now()`, [CONFIG_KEY, JSON.stringify(next.cohort), JSON.stringify(next.letters), JSON.stringify(next.instructor), JSON.stringify(next.wiring), next.generatedPreviewId, text(updatedBy) || "admin"]);
  const result = await getCohortCommandState();
  if (result?.state) await syncPlatformSummary(updatedBy, result.state);
  return result;
}

export async function upsertFounderStudent(student = {}, updatedBy = "admin") {
  const next = ensureCohortStudentShape(student);
  if (!next.id) {
    const err = new Error("Student id is required.");
    err.status = 400;
    throw err;
  }
  await q(`insert into cohort_command_students(student_id, name, email, org, track, seat, status, notes, created_at_label, attendance, profile, workbook, demo, self_score, founder_score, updated_by) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16) on conflict (student_id) do update set name = excluded.name, email = excluded.email, org = excluded.org, track = excluded.track, seat = excluded.seat, status = excluded.status, notes = excluded.notes, created_at_label = excluded.created_at_label, attendance = excluded.attendance, profile = excluded.profile, workbook = excluded.workbook, demo = excluded.demo, self_score = excluded.self_score, founder_score = excluded.founder_score, updated_by = excluded.updated_by, updated_at = now()`, [next.id, next.name, next.email, next.org, next.track, next.seat, next.status, next.notes, next.createdAt, JSON.stringify(next.attendance), JSON.stringify(next.profile), JSON.stringify(next.workbook), JSON.stringify(next.demo), JSON.stringify(next.selfScore), JSON.stringify(next.founderScore), text(updatedBy) || "admin"]);
  const stateDoc = await getCohortCommandState();
  if (stateDoc?.state) await syncPlatformSummary(updatedBy, stateDoc.state);
  return { state: stateDoc?.state || null, student: stateDoc?.state?.students?.find((entry) => entry.id === next.id) || next };
}

export function findStudent(state, studentId) {
  return (state?.students || []).find((student) => String(student?.id || "").trim().toLowerCase() === String(studentId || "").trim().toLowerCase()) || null;
}

export function verifyStudentAccess(student, email = "") {
  if (!student) {
    const err = new Error("Student seat not found.");
    err.status = 404;
    err.code = "STUDENT_NOT_FOUND";
    throw err;
  }
  if (student.status !== "active") {
    const err = new Error("That student seat is not active yet.");
    err.status = 403;
    err.code = "STUDENT_INACTIVE";
    throw err;
  }
  const expected = String(student.email || "").trim().toLowerCase();
  const received = String(email || "").trim().toLowerCase();
  if (expected && received && expected !== received) {
    const err = new Error("That email does not match the generated student record.");
    err.status = 403;
    err.code = "STUDENT_EMAIL_MISMATCH";
    throw err;
  }
  if (expected && !received) {
    const err = new Error("Student email is required for this seat.");
    err.status = 400;
    err.code = "STUDENT_EMAIL_REQUIRED";
    throw err;
  }
}

export function buildStudentLanePayload(state, student) {
  return { cohort: state.cohort, letters: state.letters, student: sanitizeStudentRecord(student) };
}

export function applyStudentPatch(student, patch = {}) {
  const next = ensureCohortStudentShape(student);
  if (Object.prototype.hasOwnProperty.call(patch, "name")) next.name = text(patch.name, 200);
  if (Object.prototype.hasOwnProperty.call(patch, "email")) next.email = text(patch.email, 240);
  const profile = patch.profile && typeof patch.profile === "object" ? patch.profile : null;
  if (profile) for (const key of STUDENT_PROFILE_FIELDS) if (Object.prototype.hasOwnProperty.call(profile, key)) next.profile[key] = text(profile[key], 2000);
  const demo = patch.demo && typeof patch.demo === "object" ? patch.demo : null;
  if (demo) for (const key of STUDENT_DEMO_FIELDS) if (Object.prototype.hasOwnProperty.call(demo, key)) next.demo[key] = text(demo[key], 3000);
  const selfScore = patch.selfScore && typeof patch.selfScore === "object" ? patch.selfScore : null;
  if (selfScore) for (const key of STUDENT_SCORE_FIELDS) if (Object.prototype.hasOwnProperty.call(selfScore, key)) next.selfScore[key] = text(selfScore[key], 20);
  const workbook = patch.workbook && typeof patch.workbook === "object" ? patch.workbook : null;
  if (workbook) {
    for (const day of DAYS) {
      if (!workbook[day] || typeof workbook[day] !== "object") continue;
      for (const field of STUDENT_WORKBOOK_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(workbook[day], field)) continue;
        next.workbook[day][field] = field === "done" || field === "needsHelp" ? bool(workbook[day][field]) : text(workbook[day][field], 4000);
      }
    }
  }
  return next;
}

function applyFounderPatch(student, patch = {}) {
  const next = applyStudentPatch(student, patch);

  if (Object.prototype.hasOwnProperty.call(patch, "status")) next.status = text(patch.status, 40);
  if (Object.prototype.hasOwnProperty.call(patch, "notes")) next.notes = text(patch.notes, 4000);
  if (Object.prototype.hasOwnProperty.call(patch, "seat")) next.seat = text(patch.seat, 120);
  if (Object.prototype.hasOwnProperty.call(patch, "org")) next.org = text(patch.org, 200);
  if (Object.prototype.hasOwnProperty.call(patch, "track")) next.track = text(patch.track, 160);

  const attendance = patch.attendance && typeof patch.attendance === "object" ? patch.attendance : null;
  if (attendance) {
    for (const day of ["day1", "day2", "day3", "day4", "day5", "day6", "day7"]) {
      if (!Object.prototype.hasOwnProperty.call(attendance, day)) continue;
      next.attendance[day] = bool(attendance[day]);
    }
  }

  const founderScore = patch.founderScore && typeof patch.founderScore === "object" ? patch.founderScore : null;
  if (founderScore) {
    for (const key of STUDENT_SCORE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(founderScore, key)) continue;
      next.founderScore[key] = text(founderScore[key], 20);
    }
    if (Object.prototype.hasOwnProperty.call(founderScore, "notes")) next.founderScore.notes = text(founderScore.notes, 4000);
  }

  return next;
}

export async function patchFounderStudent(studentId, patch = {}, updatedBy = "admin") {
  const stateDoc = await getCohortCommandState();
  if (!stateDoc?.state) {
    const err = new Error("Cohort command state has not been published yet.");
    err.status = 404;
    throw err;
  }
  const student = findStudent(stateDoc.state, studentId);
  if (!student) {
    const err = new Error("Student seat not found.");
    err.status = 404;
    throw err;
  }
  return await upsertFounderStudent(applyFounderPatch(student, patch), updatedBy);
}

export async function deleteFounderStudent(studentId, updatedBy = "admin") {
  await q(`delete from cohort_command_students where student_id = $1`, [text(studentId)]);
  const stateDoc = await getCohortCommandState();
  if (stateDoc?.state) await syncPlatformSummary(updatedBy, stateDoc.state);
  return { deleted: true, student_id: text(studentId), state: stateDoc?.state || DEFAULT_STATE };
}

export async function clearFounderStudents(updatedBy = "admin") {
  await q(`delete from cohort_command_students`, []);
  const config = await getCohortCommandState();
  const state = { ...(config?.state || DEFAULT_STATE), students: [], generatedPreviewId: "" };
  await saveFounderCohortConfig({ generatedPreviewId: "" }, updatedBy);
  await syncPlatformSummary(updatedBy, state);
  return { cleared: true, state };
}

export async function saveStudentPatch(studentId, patch, updatedBy) {
  const result = await patchFounderStudent(studentId, patch, updatedBy);
  return { state: result.state, student: result.student };
}