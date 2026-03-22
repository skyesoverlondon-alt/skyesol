import { requireAdmin } from "./_lib/admin.js";
import { audit } from "./_lib/audit.js";
import { buildCors, json } from "./_lib/http.js";
import {
  clearFounderStudents,
  deleteFounderStudent,
  getCohortCommandState,
  patchFounderStudent,
  upsertFounderStudent
} from "./_lib/cohort-command.js";
import { wrap } from "./_lib/wrap.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);

  if (req.method === "GET") {
    const state = await getCohortCommandState();
    return json(200, { ok: true, students: state?.state?.students || [], state: state?.state || null }, cors);
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (!body?.student || typeof body.student !== "object") return json(400, { error: "student object is required." }, cors);
    const saved = await upsertFounderStudent(body.student, admin?.role || admin?.via || "admin");
    await audit("admin", "cohort.student_upsert", saved?.student?.id || null, { student_id: saved?.student?.id || null });
    return json(200, { ok: true, ...saved }, cors);
  }

  if (req.method === "PATCH") {
    const body = await req.json().catch(() => ({}));
    const studentId = String(body?.student_id || body?.studentId || "").trim();
    if (!studentId) return json(400, { error: "student_id is required." }, cors);
    const saved = await patchFounderStudent(studentId, body.patch || {}, admin?.role || admin?.via || "admin");
    await audit("admin", "cohort.student_patch", studentId, { student_id: studentId, fields: Object.keys(body.patch || {}) });
    return json(200, { ok: true, ...saved }, cors);
  }

  if (req.method === "DELETE") {
    const body = await req.json().catch(() => ({}));
    if (body?.clear_all) {
      const cleared = await clearFounderStudents(admin?.role || admin?.via || "admin");
      await audit("admin", "cohort.student_clear_all", "cohort-command", {});
      return json(200, { ok: true, ...cleared }, cors);
    }

    const studentId = String(body?.student_id || body?.studentId || "").trim();
    if (!studentId) return json(400, { error: "student_id is required." }, cors);
    const deleted = await deleteFounderStudent(studentId, admin?.role || admin?.via || "admin");
    await audit("admin", "cohort.student_delete", studentId, { student_id: studentId });
    return json(200, { ok: true, ...deleted }, cors);
  }

  return json(405, { error: "Method not allowed" }, cors);
});