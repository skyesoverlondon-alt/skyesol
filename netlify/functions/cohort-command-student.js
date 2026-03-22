import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { hasConfiguredDb } from "./_lib/db.js";
import { audit } from "./_lib/audit.js";
import {
  buildStudentLanePayload,
  findStudent,
  getCohortCommandState,
  saveStudentPatch,
  verifyStudentAccess
} from "./_lib/cohort-command.js";

function notReady(cors) {
  return json(503, {
    error: "Cohort student lane is not connected to shared storage yet.",
    code: "DB_NOT_CONFIGURED",
    hint: "Set NEON_DATABASE_URL and publish founder cohort state from the founder lane first."
  }, cors);
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (!hasConfiguredDb()) return notReady(cors);

  const readPayload = async () => {
    if (req.method === "GET") {
      const url = new URL(req.url);
      return {
        student_id: url.searchParams.get("student_id") || "",
        email: url.searchParams.get("email") || ""
      };
    }
    return await req.json().catch(() => ({}));
  };

  const payload = await readPayload();
  const studentId = String(payload.student_id || payload.studentId || "").trim();
  const email = String(payload.email || "").trim();
  if (!studentId) return json(400, { error: "student_id is required." }, cors);

  const doc = await getCohortCommandState();
  if (!doc?.state) {
    return json(404, {
      error: "Cohort command state has not been published yet.",
      code: "COHORT_STATE_NOT_FOUND"
    }, cors);
  }

  const student = findStudent(doc.state, studentId);
  verifyStudentAccess(student, email);

  if (req.method === "GET") {
    return json(200, { ok: true, lane: buildStudentLanePayload(doc.state, student) }, cors);
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const result = await saveStudentPatch(student.id, payload.patch || {}, `student:${student.id}`);
  await audit(`student:${student.id}`, "cohort.student_update", student.id, {
    fields: Object.keys(payload.patch || {}),
    has_email: !!student.email
  });

  return json(200, { ok: true, lane: buildStudentLanePayload(result.state, result.student) }, cors);
});