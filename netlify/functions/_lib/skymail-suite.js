import { hasConfiguredDb, q } from "./db.js";
import { savePlatformState } from "./platform-state.js";

const META_KEY = "main";

const COLLECTIONS = [
  {
    key: "sharedDesk",
    table: "skymail_shared_desk",
    select: `select payload, created_at, updated_at, updated_by from skymail_shared_desk order by coalesce(last_touch, current_date) desc, updated_at desc`,
    insert: `insert into skymail_shared_desk(item_id, subject, email, owner, queue, priority, status, waiting, last_touch, payload, updated_by)
             values ($1, $2, $3, $4, $5, $6, $7, $8, nullif($9, '')::date, $10::jsonb, $11)
             on conflict (item_id)
             do update set
               subject = excluded.subject,
               email = excluded.email,
               owner = excluded.owner,
               queue = excluded.queue,
               priority = excluded.priority,
               status = excluded.status,
               waiting = excluded.waiting,
               last_touch = excluded.last_touch,
               payload = excluded.payload,
               updated_by = excluded.updated_by,
               updated_at = now()`,
    map(item, updatedBy = "admin") {
      return [
        text(item.id),
        text(item.subject),
        text(item.email),
        text(item.owner),
        text(item.queue),
        text(item.priority),
        text(item.status),
        text(item.waiting),
        text(item.lastTouch),
        JSON.stringify({
          id: text(item.id),
          subject: text(item.subject),
          contact: text(item.contact),
          company: text(item.company),
          email: text(item.email),
          owner: text(item.owner),
          queue: text(item.queue),
          priority: text(item.priority),
          status: text(item.status),
          waiting: text(item.waiting),
          lastTouch: text(item.lastTouch),
          slaHours: number(item.slaHours),
          notes: text(item.notes),
          tags: stringList(item.tags)
        }),
        text(updatedBy) || "admin"
      ];
    }
  },
  {
    key: "followUps",
    table: "skymail_follow_ups",
    select: `select payload, created_at, updated_at, updated_by from skymail_follow_ups order by coalesce(next_touch, current_date) asc, updated_at desc`,
    insert: `insert into skymail_follow_ups(item_id, lead_name, email, stage, health, owner, next_touch, payload, updated_by)
             values ($1, $2, $3, $4, $5, $6, nullif($7, '')::date, $8::jsonb, $9)
             on conflict (item_id)
             do update set
               lead_name = excluded.lead_name,
               email = excluded.email,
               stage = excluded.stage,
               health = excluded.health,
               owner = excluded.owner,
               next_touch = excluded.next_touch,
               payload = excluded.payload,
               updated_by = excluded.updated_by,
               updated_at = now()`,
    map(item, updatedBy = "admin") {
      return [
        text(item.id),
        text(item.lead),
        text(item.email),
        text(item.stage),
        text(item.health),
        text(item.owner),
        text(item.nextTouch),
        JSON.stringify({
          id: text(item.id),
          lead: text(item.lead),
          email: text(item.email),
          stage: text(item.stage),
          nextTouch: text(item.nextTouch),
          cadence: text(item.cadence),
          template: text(item.template),
          health: text(item.health),
          sequenceStep: number(item.sequenceStep),
          owner: text(item.owner),
          notes: text(item.notes)
        }),
        text(updatedBy) || "admin"
      ];
    }
  },
  {
    key: "intake",
    table: "skymail_intake_records",
    select: `select payload, created_at, updated_at, updated_by from skymail_intake_records order by coalesce(due_on, current_date) asc, updated_at desc`,
    insert: `insert into skymail_intake_records(item_id, client_name, email, stage, due_on, estimated_value, payload, updated_by)
             values ($1, $2, $3, $4, nullif($5, '')::date, $6, $7::jsonb, $8)
             on conflict (item_id)
             do update set
               client_name = excluded.client_name,
               email = excluded.email,
               stage = excluded.stage,
               due_on = excluded.due_on,
               estimated_value = excluded.estimated_value,
               payload = excluded.payload,
               updated_by = excluded.updated_by,
               updated_at = now()`,
    map(item, updatedBy = "admin") {
      return [
        text(item.id),
        text(item.client),
        text(item.email),
        text(item.stage),
        text(item.due),
        number(item.value),
        JSON.stringify({
          id: text(item.id),
          client: text(item.client),
          contact: text(item.contact),
          email: text(item.email),
          stage: text(item.stage),
          value: number(item.value),
          nextAction: text(item.nextAction),
          due: text(item.due),
          checklist: stringList(item.checklist),
          files: stringList(item.files),
          notes: text(item.notes)
        }),
        text(updatedBy) || "admin"
      ];
    }
  },
  {
    key: "contacts",
    table: "skymail_contacts",
    select: `select payload, created_at, updated_at, updated_by from skymail_contacts order by score desc, updated_at desc`,
    insert: `insert into skymail_contacts(item_id, email, company, segment, owner, score, payload, updated_by)
             values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
             on conflict (item_id)
             do update set
               email = excluded.email,
               company = excluded.company,
               segment = excluded.segment,
               owner = excluded.owner,
               score = excluded.score,
               payload = excluded.payload,
               updated_by = excluded.updated_by,
               updated_at = now()`,
    map(item, updatedBy = "admin") {
      return [
        text(item.id),
        text(item.email),
        text(item.company),
        text(item.segment),
        text(item.owner),
        number(item.score),
        JSON.stringify({
          id: text(item.id),
          name: text(item.name),
          company: text(item.company),
          email: text(item.email),
          phone: text(item.phone),
          score: number(item.score),
          segment: text(item.segment),
          owner: text(item.owner),
          lastReply: text(item.lastReply),
          notes: text(item.notes),
          tags: stringList(item.tags)
        }),
        text(updatedBy) || "admin"
      ];
    }
  },
  {
    key: "replyTemplates",
    table: "skymail_reply_templates",
    select: `select payload, created_at, updated_at, updated_by from skymail_reply_templates order by category asc, title asc`,
    insert: `insert into skymail_reply_templates(item_id, title, category, subject, payload, updated_by)
             values ($1, $2, $3, $4, $5::jsonb, $6)
             on conflict (item_id)
             do update set
               title = excluded.title,
               category = excluded.category,
               subject = excluded.subject,
               payload = excluded.payload,
               updated_by = excluded.updated_by,
               updated_at = now()`,
    map(item, updatedBy = "admin") {
      return [
        text(item.id),
        text(item.title),
        text(item.category),
        text(item.subject),
        JSON.stringify({
          id: text(item.id),
          title: text(item.title),
          category: text(item.category),
          subject: text(item.subject),
          body: text(item.body)
        }),
        text(updatedBy) || "admin"
      ];
    }
  },
  {
    key: "recoveryLog",
    table: "skymail_recovery_log",
    select: `select payload, created_at, updated_at, updated_by from skymail_recovery_log order by severity asc, updated_at desc`,
    insert: `insert into skymail_recovery_log(item_id, email, severity, action, est_value, payload, updated_by)
             values ($1, $2, $3, $4, $5, $6::jsonb, $7)
             on conflict (item_id)
             do update set
               email = excluded.email,
               severity = excluded.severity,
               action = excluded.action,
               est_value = excluded.est_value,
               payload = excluded.payload,
               updated_by = excluded.updated_by,
               updated_at = now()`,
    map(item, updatedBy = "admin") {
      return [
        text(item.id),
        text(item.email),
        text(item.severity),
        text(item.action),
        number(item.estValue),
        JSON.stringify({
          id: text(item.id),
          name: text(item.name),
          email: text(item.email),
          reason: text(item.reason),
          estValue: number(item.estValue),
          action: text(item.action),
          severity: text(item.severity)
        }),
        text(updatedBy) || "admin"
      ];
    }
  }
];

const COLLECTION_BY_KEY = Object.fromEntries(COLLECTIONS.map((collection) => [collection.key, collection]));

function text(value) {
  return String(value || "").trim();
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringList(value) {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function normalizeState(state = {}) {
  return {
    meta: state?.meta && typeof state.meta === "object" && !Array.isArray(state.meta) ? state.meta : {},
    analytics: state?.analytics && typeof state.analytics === "object" && !Array.isArray(state.analytics) ? state.analytics : {},
    sharedDesk: Array.isArray(state?.sharedDesk) ? state.sharedDesk : [],
    followUps: Array.isArray(state?.followUps) ? state.followUps : [],
    intake: Array.isArray(state?.intake) ? state.intake : [],
    contacts: Array.isArray(state?.contacts) ? state.contacts : [],
    replyTemplates: Array.isArray(state?.replyTemplates) ? state.replyTemplates : [],
    recoveryLog: Array.isArray(state?.recoveryLog) ? state.recoveryLog : []
  };
}

function withRowMeta(row = {}) {
  const payload = row.payload && typeof row.payload === "object" ? { ...row.payload } : {};
  payload.createdAt = row.created_at || payload.createdAt || null;
  payload.updatedAt = row.updated_at || payload.updatedAt || null;
  payload.updatedBy = row.updated_by || payload.updatedBy || "";
  return payload;
}

async function tableRows(sql) {
  const result = await q(sql, []);
  return (result.rows || []).map(withRowMeta).filter((row) => row && typeof row === "object");
}

export function buildSkymailSuiteSummary(state = {}) {
  const normalized = normalizeState(state);
  const analytics = normalized.analytics || {};
  const openDesk = normalized.sharedDesk.filter((item) => ["open", "assigned"].includes(text(item.status).toLowerCase())).length;
  const pendingFollowUps = normalized.followUps.filter((item) => text(item.nextTouch)).length;
  const recoveryValue = normalized.recoveryLog.reduce((sum, item) => sum + number(item.estValue), 0);
  return {
    shared_desk_count: normalized.sharedDesk.length,
    open_desk_count: openDesk,
    follow_up_count: normalized.followUps.length,
    pending_follow_up_count: pendingFollowUps,
    intake_count: normalized.intake.length,
    contact_count: normalized.contacts.length,
    reply_template_count: normalized.replyTemplates.length,
    recovery_count: normalized.recoveryLog.length,
    recovery_value: recoveryValue,
    monthly_recovered: number(analytics.monthlyRecovered),
    reply_compliance: number(analytics.replyCompliance),
    avg_first_response_mins: number(analytics.avgFirstResponseMins),
    open_assignments: number(analytics.openAssignments),
    hot_leads: number(analytics.hotLeads),
    summary_text: `${normalized.sharedDesk.length} desk threads · ${normalized.followUps.length} follow-ups · ${number(analytics.monthlyRecovered)} recovered`
  };
}

export async function getSkymailSuiteState() {
  if (!hasConfiguredDb()) return null;

  const [sharedDesk, followUps, intake, contacts, replyTemplates, recoveryLog, metaRow] = await Promise.all([
    tableRows(COLLECTIONS[0].select),
    tableRows(COLLECTIONS[1].select),
    tableRows(COLLECTIONS[2].select),
    tableRows(COLLECTIONS[3].select),
    tableRows(COLLECTIONS[4].select),
    tableRows(COLLECTIONS[5].select),
    q(`select analytics, meta, updated_by, created_at, updated_at from skymail_suite_meta where suite_key = $1 limit 1`, [META_KEY])
  ]);

  const hasDedicatedRows = [sharedDesk, followUps, intake, contacts, replyTemplates, recoveryLog].some((list) => list.length > 0) || (metaRow.rows || []).length > 0;
  if (!hasDedicatedRows) {
    const legacy = await q(`select state, updated_at from platform_state_docs where app_id = 'skymail-suite' limit 1`, []);
    const state = legacy.rows[0]?.state;
    if (state && typeof state === "object") {
      const normalized = normalizeState(state);
      normalized.meta = {
        ...normalized.meta,
        updatedAt: normalized.meta.updatedAt || legacy.rows[0]?.updated_at || null,
        storageMode: "legacy-platform-state"
      };
      return {
        state: normalized,
        summary: buildSkymailSuiteSummary(normalized),
        storage_mode: "legacy-platform-state",
        updated_at: legacy.rows[0]?.updated_at || null
      };
    }
  }

  const meta = metaRow.rows[0] || {};
  const state = {
    meta: {
      ...(meta.meta || {}),
      updatedAt: meta.updated_at || null,
      storageMode: "dedicated-mail-tables"
    },
    analytics: meta.analytics || {},
    sharedDesk,
    followUps,
    intake,
    contacts,
    replyTemplates,
    recoveryLog
  };

  return {
    state,
    summary: buildSkymailSuiteSummary(state),
    storage_mode: "dedicated-mail-tables",
    updated_at: meta.updated_at || null,
    updated_by: meta.updated_by || null
  };
}

export async function saveSkymailSuiteState(state, updatedBy = "admin") {
  if (!hasConfiguredDb()) {
    const err = new Error("Database not configured.");
    err.status = 503;
    throw err;
  }

  const normalized = normalizeState(state);

  for (const collection of COLLECTIONS) {
    await q(`delete from ${collection.table}`, []);
    for (const item of normalized[collection.key]) {
      await q(collection.insert, collection.map(item, updatedBy));
    }
  }

  await q(
    `insert into skymail_suite_meta(suite_key, analytics, meta, updated_by)
     values ($1, $2::jsonb, $3::jsonb, $4)
     on conflict (suite_key)
     do update set
       analytics = excluded.analytics,
       meta = excluded.meta,
       updated_by = excluded.updated_by,
       updated_at = now()`,
    [
      META_KEY,
      JSON.stringify(normalized.analytics || {}),
      JSON.stringify({ ...(normalized.meta || {}), storageMode: "dedicated-mail-tables" }),
      text(updatedBy) || "admin"
    ]
  );

  return await getSkymailSuiteState();
}

function requireCollection(key) {
  const collection = COLLECTION_BY_KEY[String(key || "").trim()];
  if (!collection) {
    const err = new Error("Unknown SkyMail collection.");
    err.status = 400;
    throw err;
  }
  return collection;
}

export async function getSkymailLaneItems(collectionKey) {
  if (!hasConfiguredDb()) return [];
  const collection = requireCollection(collectionKey);
  return await tableRows(collection.select);
}

async function touchSkymailMeta(updatedBy) {
  await q(
    `insert into skymail_suite_meta(suite_key, analytics, meta, updated_by)
     values ($1, '{}'::jsonb, '{}'::jsonb, $2)
     on conflict (suite_key)
     do update set
       updated_by = excluded.updated_by,
       updated_at = now()`,
    [META_KEY, text(updatedBy) || "admin"]
  );
}

async function syncSkymailPlatformState(updatedBy) {
  const saved = await getSkymailSuiteState();
  if (saved?.state) await savePlatformState("skymail-suite", saved.state, updatedBy);
  return saved;
}

export async function upsertSkymailLaneItem(collectionKey, item, updatedBy = "admin") {
  if (!hasConfiguredDb()) {
    const err = new Error("Database not configured.");
    err.status = 503;
    throw err;
  }
  const collection = requireCollection(collectionKey);
  const mapped = collection.map(item || {}, updatedBy);
  await q(collection.insert, mapped);
  await touchSkymailMeta(updatedBy);
  const saved = await syncSkymailPlatformState(updatedBy);
  return {
    item: (saved?.state?.[collection.key] || []).find((entry) => String(entry?.id || "") === String(mapped[0])) || null,
    state: saved?.state || null,
    summary: saved?.summary || null
  };
}

export async function deleteSkymailLaneItem(collectionKey, itemId, updatedBy = "admin") {
  if (!hasConfiguredDb()) {
    const err = new Error("Database not configured.");
    err.status = 503;
    throw err;
  }
  const collection = requireCollection(collectionKey);
  await q(`delete from ${collection.table} where item_id = $1`, [text(itemId)]);
  await touchSkymailMeta(updatedBy);
  const saved = await syncSkymailPlatformState(updatedBy);
  return {
    deleted: true,
    item_id: text(itemId),
    state: saved?.state || null,
    summary: saved?.summary || null
  };
}