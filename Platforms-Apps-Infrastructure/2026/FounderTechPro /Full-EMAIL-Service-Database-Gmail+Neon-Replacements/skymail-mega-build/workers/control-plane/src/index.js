import { withClient, transaction } from './db.js';
import { encryptText, decryptText } from './crypto.js';
import { requireAuth } from './auth.js';
import { json, noContent, readJson, slugify, makeDbIdent, randomSuffix, strongPassword } from './http.js';

const PLAN_CATALOG = {
  internal: {
    plan_code: 'internal',
    display_name: 'Internal',
    seats: 25,
    quotas: {
      max_databases: 250,
      max_projects: 250,
      max_members: 50,
      max_api_keys_per_project: 100,
    },
  },
  starter: {
    plan_code: 'starter',
    display_name: 'Starter',
    seats: 3,
    quotas: {
      max_databases: 5,
      max_projects: 5,
      max_members: 3,
      max_api_keys_per_project: 5,
    },
  },
  growth: {
    plan_code: 'growth',
    display_name: 'Growth',
    seats: 10,
    quotas: {
      max_databases: 25,
      max_projects: 25,
      max_members: 10,
      max_api_keys_per_project: 20,
    },
  },
  enterprise: {
    plan_code: 'enterprise',
    display_name: 'Enterprise',
    seats: 100,
    quotas: {
      max_databases: 1000,
      max_projects: 1000,
      max_members: 250,
      max_api_keys_per_project: 500,
    },
  },
};

const ROLE_RANK = { member: 1, admin: 2, owner: 3 };

const BILLING_PLAN_CATALOG = {
  internal: {
    plan_code: 'internal',
    display_name: 'Internal',
    price_monthly_cents: 0,
    currency: 'usd',
    trial_days: 0,
    is_public: false,
    description: 'Internal owner workspace tier.',
  },
  starter: {
    plan_code: 'starter',
    display_name: 'Starter',
    price_monthly_cents: 2900,
    currency: 'usd',
    trial_days: 14,
    is_public: true,
    description: 'Small projects, starter teams, first production database workloads.',
  },
  growth: {
    plan_code: 'growth',
    display_name: 'Growth',
    price_monthly_cents: 9900,
    currency: 'usd',
    trial_days: 14,
    is_public: true,
    description: 'More projects, more seats, more automation and headroom.',
  },
  enterprise: {
    plan_code: 'enterprise',
    display_name: 'Enterprise',
    price_monthly_cents: 29900,
    currency: 'usd',
    trial_days: 14,
    is_public: true,
    description: 'Large deployments, broader team access, premium operating limits.',
  },
};


function routeMatch(pathname, pattern) {
  const pathParts = pathname.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
      continue;
    }
    if (patternParts[i] !== pathParts[i]) return null;
  }
  return params;
}

function defaultPlanFor(auth, requestedPlan) {
  if (requestedPlan && PLAN_CATALOG[requestedPlan]) return requestedPlan;
  return auth.is_super_admin ? 'internal' : 'starter';
}

function mergePlan(planCode, row = null) {
  const base = PLAN_CATALOG[planCode] || PLAN_CATALOG.starter;
  const quotas = { ...base.quotas, ...(row?.quotas_json || {}) };
  return {
    plan_code: planCode,
    display_name: base.display_name,
    seats: row?.seats ?? base.seats,
    quotas,
    status: row?.status || 'active',
    metadata: row?.metadata || {},
  };
}



function billingPlan(planCode) {
  return BILLING_PLAN_CATALOG[planCode] || BILLING_PLAN_CATALOG.starter;
}

function publicPlans() {
  return Object.values(BILLING_PLAN_CATALOG)
    .filter((plan) => plan.is_public)
    .map((plan) => ({
      ...plan,
      price_monthly: (plan.price_monthly_cents / 100).toFixed(2),
    }));
}

function nextMonthIso(date = new Date()) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + 1);
  return copy.toISOString();
}

function addDaysIso(days = 14, date = new Date()) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString();
}

function newToken(prefix = 'tok') {
  return `${prefix}_${randomSuffix(10)}${randomSuffix(10)}`;
}

async function createInvoiceRecord(client, { orgId, subscriptionId = null, planCode, amountCents, currency = 'usd', dueAt = null, description = '', metadata = {}, actor = 'system' }) {
  const invoiceId = crypto.randomUUID();
  const invoiceNumber = `SKYE-${Date.now().toString().slice(-8)}-${randomSuffix(4).toUpperCase()}`;
  const lineItems = [{ type: 'subscription', plan_code: planCode, quantity: 1, unit_amount_cents: amountCents, total_cents: amountCents }];
  await client.query(
    `INSERT INTO invoices (
      id, org_id, subscription_id, invoice_number, status, currency, subtotal_cents, total_cents, description, due_at, line_items_json, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      invoiceId,
      orgId,
      subscriptionId,
      invoiceNumber,
      amountCents > 0 ? 'open' : 'paid',
      currency,
      amountCents,
      amountCents,
      description || `${planCode} monthly subscription`,
      dueAt,
      JSON.stringify(lineItems),
      JSON.stringify(metadata || {}),
    ],
  );
  if (amountCents === 0) {
    await client.query('UPDATE invoices SET paid_at = now() WHERE id = $1', [invoiceId]);
  }
  await logAudit(client, actor, 'invoice', invoiceId, 'invoice_created', { org_id: orgId, plan_code: planCode, amount_cents: amountCents }, null, orgId);
  return invoiceId;
}

async function createCheckoutSessionRecord(client, { orgId = null, signupApplicationId = null, planCode, provider = 'manual', successUrl = null, cancelUrl = null, metadata = {} }) {
  const plan = billingPlan(planCode);
  const sessionId = crypto.randomUUID();
  const sessionToken = newToken('chk');
  await client.query(
    `INSERT INTO checkout_sessions (
      id, org_id, signup_application_id, requested_plan_code, status, provider, amount_cents, currency, session_token, success_url, cancel_url, metadata
    ) VALUES ($1,$2,$3,$4,'open',$5,$6,$7,$8,$9,$10,$11)`,
    [sessionId, orgId, signupApplicationId, planCode, provider, plan.price_monthly_cents, plan.currency, sessionToken, successUrl, cancelUrl, JSON.stringify(metadata || {})],
  );
  return { id: sessionId, session_token: sessionToken, amount_cents: plan.price_monthly_cents, currency: plan.currency, provider };
}

async function ensureBillingBootstrap(client, { orgId, planCode, email, legalName = null, source = 'manual', createInvoice = false, createTrial = false, cancelAtPeriodEnd = false, provider = 'manual' }) {
  const plan = billingPlan(planCode);
  const trialEndsAt = createTrial && plan.trial_days > 0 ? addDaysIso(plan.trial_days) : null;
  const currentPeriodStart = new Date().toISOString();
  const currentPeriodEnd = nextMonthIso();

  await client.query(
    `INSERT INTO billing_customers (id, org_id, billing_email, legal_name, status, metadata)
     VALUES ($1,$2,$3,$4,'active',$5)
     ON CONFLICT (org_id) DO UPDATE
     SET billing_email = EXCLUDED.billing_email,
         legal_name = COALESCE(EXCLUDED.legal_name, billing_customers.legal_name),
         status = 'active',
         metadata = billing_customers.metadata || EXCLUDED.metadata`,
    [crypto.randomUUID(), orgId, email, legalName, JSON.stringify({ source })],
  );

  const existing = await client.query('SELECT * FROM plan_subscriptions WHERE org_id = $1', [orgId]);
  if (existing.rows[0]) {
    await client.query(
      `UPDATE plan_subscriptions
       SET plan_code = $2,
           status = $3,
           seats = COALESCE(seats, $4),
           quotas_json = COALESCE(quotas_json, $5),
           metadata = metadata || $6,
           billing_email = $7,
           provider = $8,
           amount_cents = $9,
           currency = $10,
           billing_interval = 'month',
           trial_started_at = COALESCE(trial_started_at, $11),
           trial_ends_at = COALESCE(trial_ends_at, $12),
           current_period_start = COALESCE(current_period_start, $13),
           current_period_end = COALESCE(current_period_end, $14),
           cancel_at_period_end = $15
       WHERE org_id = $1`,
      [
        orgId,
        planCode,
        createTrial && plan.price_monthly_cents > 0 ? 'trialing' : 'active',
        PLAN_CATALOG[planCode]?.seats || PLAN_CATALOG.starter.seats,
        JSON.stringify(PLAN_CATALOG[planCode]?.quotas || PLAN_CATALOG.starter.quotas),
        JSON.stringify({ billing_source: source }),
        email,
        provider,
        plan.price_monthly_cents,
        plan.currency,
        createTrial ? currentPeriodStart : null,
        trialEndsAt,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      ],
    );
  } else {
    await client.query(
      `INSERT INTO plan_subscriptions (
        id, org_id, plan_code, status, seats, quotas_json, metadata, billing_email, provider, amount_cents, currency, billing_interval,
        trial_started_at, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'month',$12,$13,$14,$15,$16)`,
      [
        crypto.randomUUID(),
        orgId,
        planCode,
        createTrial && plan.price_monthly_cents > 0 ? 'trialing' : 'active',
        PLAN_CATALOG[planCode]?.seats || PLAN_CATALOG.starter.seats,
        JSON.stringify(PLAN_CATALOG[planCode]?.quotas || PLAN_CATALOG.starter.quotas),
        JSON.stringify({ billing_source: source }),
        email,
        provider,
        plan.price_monthly_cents,
        plan.currency,
        createTrial ? currentPeriodStart : null,
        trialEndsAt,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      ],
    );
  }

  const subscription = await client.query('SELECT * FROM plan_subscriptions WHERE org_id = $1', [orgId]);
  const subscriptionId = subscription.rows[0]?.id || null;
  if (createInvoice) {
    await createInvoiceRecord(client, {
      orgId,
      subscriptionId,
      planCode,
      amountCents: plan.price_monthly_cents,
      currency: plan.currency,
      dueAt: trialEndsAt || currentPeriodEnd,
      description: `${plan.display_name} monthly subscription`,
      metadata: { source, trial_ends_at: trialEndsAt },
      actor: email || 'system',
    });
  }
  return subscription.rows[0] || null;
}

async function listSignupApplications(env, auth) {
  return withClient(env, async (client) => {
    if (!(auth.is_super_admin || auth.mode === 'bootstrap')) return [];
    const result = await client.query(
      `SELECT sa.*, o.name AS activated_org_name, pu.email AS activated_user_email
       FROM signup_applications sa
       LEFT JOIN orgs o ON o.id = sa.activated_org_id
       LEFT JOIN platform_users pu ON pu.id = sa.activated_user_id
       ORDER BY sa.created_at DESC
       LIMIT 150`,
    );
    return result.rows;
  });
}

async function getBillingSummary(env, auth, orgId) {
  return withClient(env, async (client) => {
    await requireOrgRole(client, auth, orgId, 'member');
    const [orgRes, customerRes, subRes, invoicesRes, checkoutRes] = await Promise.all([
      client.query('SELECT * FROM orgs WHERE id = $1', [orgId]),
      client.query('SELECT * FROM billing_customers WHERE org_id = $1', [orgId]),
      client.query('SELECT * FROM plan_subscriptions WHERE org_id = $1', [orgId]),
      client.query('SELECT * FROM invoices WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50', [orgId]),
      client.query('SELECT * FROM checkout_sessions WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50', [orgId]),
    ]);
    const subscriptionRow = subRes.rows[0] || null;
    return {
      org: orgRes.rows[0] || null,
      billing_customer: customerRes.rows[0] || null,
      subscription: subscriptionRow ? {
        ...subscriptionRow,
        plan: billingPlan(subscriptionRow.plan_code),
      } : null,
      invoices: invoicesRes.rows,
      checkout_sessions: checkoutRes.rows,
    };
  });
}

async function activateSignupApplication(client, auth, authUser, signupToken) {
  const signupResult = await client.query(
    `SELECT * FROM signup_applications WHERE signup_token = $1 AND status = 'pending'`,
    [signupToken],
  );
  const signup = signupResult.rows[0];
  if (!signup) throw new Error('Pending signup token not found');
  if (!auth.is_super_admin && String(signup.email || '').toLowerCase() !== String(auth.email || '').toLowerCase()) {
    throw new Error('Signup token email does not match authenticated user');
  }
  const bundle = await createDefaultOrgBundle(client, auth, authUser, {
    org_name: signup.org_name,
    project_name: signup.project_name || 'Primary Project',
    environment_name: 'Production',
    plan_code: signup.desired_plan_code,
    mode: 'customer',
  });
  await ensureBillingBootstrap(client, {
    orgId: bundle.org_id,
    planCode: signup.desired_plan_code,
    email: signup.email,
    legalName: signup.org_name,
    source: 'public_signup',
    createInvoice: true,
    createTrial: true,
    provider: 'manual',
  });
  await client.query(
    `UPDATE signup_applications
     SET status = 'activated', activated_user_id = $2, activated_org_id = $3, activated_at = now()
     WHERE id = $1`,
    [signup.id, auth.user_id, bundle.org_id],
  );
  await client.query(
    `UPDATE checkout_sessions
     SET status = 'completed', completed_at = now(), org_id = $2
     WHERE signup_application_id = $1 AND status = 'open'`,
    [signup.id, bundle.org_id],
  );
  await logUsage(client, {
    org_id: bundle.org_id,
    project_id: bundle.project_id,
    environment_id: bundle.environment_id,
    event_type: 'signup_activated',
    quantity: 1,
    unit: 'count',
    metadata: { signup_application_id: signup.id, plan_code: signup.desired_plan_code },
  });
  await logAudit(client, auth.actor, 'signup_application', signup.id, 'activated', {
    org_id: bundle.org_id,
    plan_code: signup.desired_plan_code,
  }, auth, bundle.org_id);
  return { signup, bundle };
}

async function hashSha256(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, '0')).join('');
}

async function logAudit(client, actor, entityType, entityId, action, details = {}, auth = null, orgId = null) {
  await client.query(
    'INSERT INTO audit_events (id, org_id, actor_user_id, actor, entity_type, entity_id, action, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [crypto.randomUUID(), orgId || null, auth?.user_id || null, actor, entityType, entityId || null, action, JSON.stringify(details)],
  );
}

async function logUsage(client, payload) {
  await client.query(
    `INSERT INTO usage_events (id, org_id, project_id, environment_id, instance_id, event_type, quantity, unit, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      crypto.randomUUID(),
      payload.org_id,
      payload.project_id || null,
      payload.environment_id || null,
      payload.instance_id || null,
      payload.event_type,
      payload.quantity ?? 1,
      payload.unit || 'count',
      JSON.stringify(payload.metadata || {}),
    ],
  );
}

async function upsertPlatformUser(client, auth) {
  if (auth.mode === 'bootstrap') {
    return {
      id: null,
      email: auth.email,
      full_name: 'Bootstrap Admin',
      auth_subject: 'bootstrap-admin',
      is_super_admin: true,
      status: 'active',
      mode: 'bootstrap',
    };
  }
  const existing = await client.query('SELECT * FROM platform_users WHERE email = $1', [auth.email]);
  if (existing.rows[0]) {
    const row = existing.rows[0];
    const isSuperAdmin = auth.is_super_admin || row.is_super_admin;
    const updated = await client.query(
      `UPDATE platform_users
       SET full_name = $2, auth_subject = COALESCE($3, auth_subject), is_super_admin = $4, status = 'active', last_login_at = now()
       WHERE id = $1
       RETURNING *`,
      [row.id, auth.full_name || row.full_name || auth.email, auth.auth_subject || row.auth_subject, isSuperAdmin],
    );
    return updated.rows[0];
  }
  const created = await client.query(
    `INSERT INTO platform_users (id, email, full_name, auth_subject, is_super_admin, status, last_login_at)
     VALUES ($1,$2,$3,$4,$5,'active',now())
     RETURNING *`,
    [crypto.randomUUID(), auth.email, auth.full_name || auth.email, auth.auth_subject || auth.email, auth.is_super_admin],
  );
  return created.rows[0];
}

async function getAccessibleOrgIds(client, auth) {
  if (auth.is_super_admin || auth.mode === 'bootstrap') return null;
  if (!auth.user_id) return [];
  const result = await client.query(
    `SELECT org_id
     FROM org_memberships
     WHERE user_id = $1 AND status = 'active'`,
    [auth.user_id],
  );
  return result.rows.map((row) => row.org_id);
}

function hasRole(role, minRole) {
  return (ROLE_RANK[role] || 0) >= (ROLE_RANK[minRole] || 0);
}

async function requireOrgRole(client, auth, orgId, minRole = 'member') {
  if (auth.is_super_admin || auth.mode === 'bootstrap') return { role: 'owner', org_id: orgId };
  if (!auth.user_id) throw new Error('No authenticated platform user');
  const result = await client.query(
    `SELECT om.role, om.org_id
     FROM org_memberships om
     WHERE om.org_id = $1 AND om.user_id = $2 AND om.status = 'active'`,
    [orgId, auth.user_id],
  );
  const membership = result.rows[0];
  if (!membership || !hasRole(membership.role, minRole)) throw new Error('Forbidden for organization');
  return membership;
}

async function resolveProject(client, projectId) {
  const result = await client.query(
    `SELECT p.*, o.name AS org_name, o.slug AS org_slug
     FROM projects p
     JOIN orgs o ON o.id = p.org_id
     WHERE p.id = $1`,
    [projectId],
  );
  return result.rows[0] || null;
}

async function requireProjectRole(client, auth, projectId, minRole = 'member') {
  const project = await resolveProject(client, projectId);
  if (!project) throw new Error('Project not found');
  await requireOrgRole(client, auth, project.org_id, minRole);
  return project;
}

async function resolveEnvironment(client, environmentId) {
  const result = await client.query(
    `SELECT e.*, p.org_id, p.name AS project_name, p.slug AS project_slug
     FROM environments e
     JOIN projects p ON p.id = e.project_id
     WHERE e.id = $1`,
    [environmentId],
  );
  return result.rows[0] || null;
}

async function requireInstanceRole(client, auth, instanceId, minRole = 'member') {
  const result = await client.query(
    `SELECT di.*, p.name AS project_name, p.slug AS project_slug, o.name AS org_name
     FROM database_instances di
     JOIN projects p ON p.id = di.project_id
     JOIN orgs o ON o.id = di.org_id
     WHERE di.id = $1`,
    [instanceId],
  );
  const instance = result.rows[0];
  if (!instance) throw new Error('Database not found');
  await requireOrgRole(client, auth, instance.org_id, minRole);
  return instance;
}

async function listOrgs(env, auth) {
  return withClient(env, async (client) => {
    const accessibleOrgIds = await getAccessibleOrgIds(client, auth);
    const query = `
      SELECT o.*, ps.plan_code, ps.status AS plan_status, ps.seats, ps.quotas_json,
             COUNT(DISTINCT om.user_id) FILTER (WHERE om.status = 'active') AS member_count,
             COUNT(DISTINCT p.id) AS project_count,
             COUNT(DISTINCT di.id) AS database_count
      FROM orgs o
      LEFT JOIN plan_subscriptions ps ON ps.org_id = o.id
      LEFT JOIN org_memberships om ON om.org_id = o.id
      LEFT JOIN projects p ON p.org_id = o.id
      LEFT JOIN database_instances di ON di.org_id = o.id
      ${accessibleOrgIds ? 'WHERE o.id = ANY($1)' : ''}
      GROUP BY o.id, ps.plan_code, ps.status, ps.seats, ps.quotas_json
      ORDER BY o.created_at DESC
    `;
    const result = await client.query(query, accessibleOrgIds ? [accessibleOrgIds] : []);
    return result.rows.map((row) => ({
      ...row,
      subscription: mergePlan(row.plan_code || defaultPlanFor(auth), row),
      member_count: Number(row.member_count || 0),
      project_count: Number(row.project_count || 0),
      database_count: Number(row.database_count || 0),
    }));
  });
}

async function getOrgDetail(env, auth, orgId) {
  return withClient(env, async (client) => {
    await requireOrgRole(client, auth, orgId, 'member');
    const orgResult = await client.query(
      `SELECT o.*, ps.plan_code, ps.status AS plan_status, ps.seats, ps.quotas_json, ps.metadata AS plan_metadata
       FROM orgs o
       LEFT JOIN plan_subscriptions ps ON ps.org_id = o.id
       WHERE o.id = $1`,
      [orgId],
    );
    const org = orgResult.rows[0];
    if (!org) return null;
    const members = await client.query(
      `SELECT om.id, om.role, om.status, om.created_at, pu.id AS user_id, pu.email, pu.full_name, pu.is_super_admin
       FROM org_memberships om
       JOIN platform_users pu ON pu.id = om.user_id
       WHERE om.org_id = $1
       ORDER BY om.created_at ASC`,
      [orgId],
    );
    const subscription = mergePlan(org.plan_code || defaultPlanFor(auth), {
      plan_code: org.plan_code,
      seats: org.seats,
      quotas_json: org.quotas_json,
      metadata: org.plan_metadata,
      status: org.plan_status,
    });
    return {
      ...org,
      subscription,
      members: members.rows,
    };
  });
}

async function listProjects(env, auth) {
  return withClient(env, async (client) => {
    const accessibleOrgIds = await getAccessibleOrgIds(client, auth);
    const query = `
      SELECT p.*, o.name AS org_name, o.slug AS org_slug,
             COUNT(DISTINCT e.id) AS environment_count,
             COUNT(DISTINCT di.id) AS database_count
      FROM projects p
      JOIN orgs o ON o.id = p.org_id
      LEFT JOIN environments e ON e.project_id = p.id
      LEFT JOIN database_instances di ON di.project_id = p.id
      ${accessibleOrgIds ? 'WHERE p.org_id = ANY($1)' : ''}
      GROUP BY p.id, o.name, o.slug
      ORDER BY p.created_at DESC
    `;
    const result = await client.query(query, accessibleOrgIds ? [accessibleOrgIds] : []);
    return result.rows.map((row) => ({
      ...row,
      environment_count: Number(row.environment_count || 0),
      database_count: Number(row.database_count || 0),
    }));
  });
}

async function listEnvironments(env, auth) {
  return withClient(env, async (client) => {
    const accessibleOrgIds = await getAccessibleOrgIds(client, auth);
    const query = `
      SELECT e.*, p.name AS project_name, p.slug AS project_slug, p.org_id, o.name AS org_name
      FROM environments e
      JOIN projects p ON p.id = e.project_id
      JOIN orgs o ON o.id = p.org_id
      ${accessibleOrgIds ? 'WHERE p.org_id = ANY($1)' : ''}
      ORDER BY e.created_at DESC
    `;
    const result = await client.query(query, accessibleOrgIds ? [accessibleOrgIds] : []);
    return result.rows;
  });
}

async function listDatabases(env, auth) {
  return withClient(env, async (client) => {
    const accessibleOrgIds = await getAccessibleOrgIds(client, auth);
    const query = `
      SELECT di.id, di.org_id, di.project_id, di.environment_id, di.name, di.slug, di.plan_code, di.db_name, di.db_user,
             di.status, di.branch_of_instance_id, di.public_hostname, di.public_port, di.public_ssl_mode,
             di.created_at, di.updated_at, di.last_rotation_at,
             p.name AS project_name, p.slug AS project_slug,
             e.name AS environment_name, e.slug AS environment_slug,
             o.name AS org_name, o.slug AS org_slug
      FROM database_instances di
      JOIN projects p ON p.id = di.project_id
      LEFT JOIN environments e ON e.id = di.environment_id
      JOIN orgs o ON o.id = di.org_id
      ${accessibleOrgIds ? 'WHERE di.org_id = ANY($1)' : ''}
      ORDER BY di.created_at DESC
    `;
    const result = await client.query(query, accessibleOrgIds ? [accessibleOrgIds] : []);
    return result.rows;
  });
}

async function getDatabase(env, auth, instanceId) {
  return withClient(env, async (client) => {
    const row = await requireInstanceRole(client, auth, instanceId, 'member');
    const password = decryptText(env.APP_ENCRYPTION_KEY, row.password_ciphertext);
    return {
      ...row,
      password,
      connection_uri: `postgres://${encodeURIComponent(row.db_user)}:${encodeURIComponent(password)}@${row.public_hostname}:${row.public_port}/${row.db_name}?sslmode=${row.public_ssl_mode}`,
    };
  });
}

async function listJobs(env, auth) {
  return withClient(env, async (client) => {
    const accessibleOrgIds = await getAccessibleOrgIds(client, auth);
    const query = `
      SELECT j.*, o.name AS org_name, p.name AS project_name, di.name AS instance_name
      FROM jobs j
      LEFT JOIN orgs o ON o.id = j.org_id
      LEFT JOIN projects p ON p.id = j.project_id
      LEFT JOIN database_instances di ON di.id = j.instance_id
      ${accessibleOrgIds ? 'WHERE j.org_id = ANY($1)' : ''}
      ORDER BY j.created_at DESC
      LIMIT 150
    `;
    const result = await client.query(query, accessibleOrgIds ? [accessibleOrgIds] : []);
    return result.rows;
  });
}

async function getJob(env, auth, jobId) {
  return withClient(env, async (client) => {
    const result = await client.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    const row = result.rows[0] || null;
    if (!row) return null;
    if (row.org_id) await requireOrgRole(client, auth, row.org_id, 'member');
    return row;
  });
}

async function listBackups(env, auth) {
  return withClient(env, async (client) => {
    const accessibleOrgIds = await getAccessibleOrgIds(client, auth);
    const query = `
      SELECT b.*, di.name AS instance_name, p.name AS project_name, o.name AS org_name
      FROM backups b
      LEFT JOIN database_instances di ON di.id = b.instance_id
      LEFT JOIN projects p ON p.id = b.project_id
      LEFT JOIN orgs o ON o.id = b.org_id
      ${accessibleOrgIds ? 'WHERE b.org_id = ANY($1)' : ''}
      ORDER BY b.created_at DESC
      LIMIT 150
    `;
    const result = await client.query(query, accessibleOrgIds ? [accessibleOrgIds] : []);
    return result.rows;
  });
}

async function listRestores(env, auth) {
  return withClient(env, async (client) => {
    const accessibleOrgIds = await getAccessibleOrgIds(client, auth);
    const query = `
      SELECT r.*, di.name AS instance_name, p.name AS project_name, o.name AS org_name
      FROM restores r
      LEFT JOIN database_instances di ON di.id = r.instance_id
      LEFT JOIN projects p ON p.id = r.project_id
      LEFT JOIN orgs o ON o.id = r.org_id
      ${accessibleOrgIds ? 'WHERE r.org_id = ANY($1)' : ''}
      ORDER BY r.created_at DESC
      LIMIT 150
    `;
    const result = await client.query(query, accessibleOrgIds ? [accessibleOrgIds] : []);
    return result.rows;
  });
}

async function listAudit(env, auth) {
  return withClient(env, async (client) => {
    const accessibleOrgIds = await getAccessibleOrgIds(client, auth);
    const query = `
      SELECT ae.*, o.name AS org_name
      FROM audit_events ae
      LEFT JOIN orgs o ON o.id = ae.org_id
      ${accessibleOrgIds ? 'WHERE ae.org_id = ANY($1) OR ae.org_id IS NULL' : ''}
      ORDER BY ae.created_at DESC
      LIMIT 150
    `;
    const result = await client.query(query, accessibleOrgIds ? [accessibleOrgIds] : []);
    return result.rows;
  });
}

async function listUsage(env, auth) {
  return withClient(env, async (client) => {
    const accessibleOrgIds = await getAccessibleOrgIds(client, auth);
    const summaryQuery = `
      SELECT ue.org_id, o.name AS org_name, ue.event_type, ue.unit, SUM(ue.quantity) AS total_quantity, MAX(ue.created_at) AS last_seen_at
      FROM usage_events ue
      JOIN orgs o ON o.id = ue.org_id
      ${accessibleOrgIds ? 'WHERE ue.org_id = ANY($1)' : ''}
      GROUP BY ue.org_id, o.name, ue.event_type, ue.unit
      ORDER BY MAX(ue.created_at) DESC
    `;
    const recentQuery = `
      SELECT ue.*, o.name AS org_name, p.name AS project_name, di.name AS instance_name
      FROM usage_events ue
      LEFT JOIN orgs o ON o.id = ue.org_id
      LEFT JOIN projects p ON p.id = ue.project_id
      LEFT JOIN database_instances di ON di.id = ue.instance_id
      ${accessibleOrgIds ? 'WHERE ue.org_id = ANY($1)' : ''}
      ORDER BY ue.created_at DESC
      LIMIT 150
    `;
    const [summary, recent] = await Promise.all([
      client.query(summaryQuery, accessibleOrgIds ? [accessibleOrgIds] : []),
      client.query(recentQuery, accessibleOrgIds ? [accessibleOrgIds] : []),
    ]);
    return { summary: summary.rows, recent: recent.rows };
  });
}

async function listPlans() {
  return Object.values(PLAN_CATALOG);
}

async function listProjectApiKeys(env, auth, projectId) {
  return withClient(env, async (client) => {
    const project = await requireProjectRole(client, auth, projectId, 'member');
    const result = await client.query(
      `SELECT id, org_id, project_id, name, prefix, status, last_used_at, created_by, created_at
       FROM project_api_keys
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId],
    );
    return { project, api_keys: result.rows };
  });
}

async function createDefaultOrgBundle(client, auth, user, body = {}) {
  const orgName = String(body.org_name || body.workspace_name || user.full_name || user.email || 'Workspace').trim();
  const orgId = crypto.randomUUID();
  const orgSlugBase = slugify(orgName) || `workspace-${randomSuffix(6)}`;
  const orgSlug = `${orgSlugBase}-${randomSuffix(4)}`.slice(0, 56);
  const planCode = defaultPlanFor(auth, body.plan_code);
  const plan = PLAN_CATALOG[planCode];
  const projectId = crypto.randomUUID();
  const projectName = String(body.project_name || 'Primary Project').trim();
  const projectSlug = slugify(projectName) || 'primary-project';
  const environmentId = crypto.randomUUID();
  const environmentName = String(body.environment_name || 'Production').trim();
  const environmentSlug = slugify(environmentName) || 'production';

  await client.query(
    'INSERT INTO orgs (id, name, slug, owner_user_id, mode, status) VALUES ($1,$2,$3,$4,$5,$6)',
    [orgId, orgName, orgSlug, user.id, body.mode || (auth.is_super_admin ? 'owner' : 'customer'), 'active'],
  );
  await client.query(
    'INSERT INTO org_memberships (id, org_id, user_id, role, status) VALUES ($1,$2,$3,$4,$5)',
    [crypto.randomUUID(), orgId, user.id, 'owner', 'active'],
  );
  await client.query(
    `INSERT INTO plan_subscriptions (id, org_id, plan_code, status, seats, quotas_json, metadata)
     VALUES ($1,$2,$3,'active',$4,$5,$6)`,
    [crypto.randomUUID(), orgId, planCode, plan.seats, JSON.stringify(plan.quotas), JSON.stringify({ source: 'auth_sync' })],
  );
  await client.query(
    'INSERT INTO projects (id, org_id, name, slug, plan_code) VALUES ($1,$2,$3,$4,$5)',
    [projectId, orgId, projectName, projectSlug, planCode],
  );
  await client.query(
    'INSERT INTO environments (id, project_id, name, slug, kind) VALUES ($1,$2,$3,$4,$5)',
    [environmentId, projectId, environmentName, environmentSlug, 'production'],
  );
  await logAudit(client, auth.actor, 'org', orgId, 'workspace_created', {
    org_name: orgName,
    project_name: projectName,
    environment_name: environmentName,
    plan_code: planCode,
  }, auth, orgId);
  return { org_id: orgId, project_id: projectId, environment_id: environmentId };
}

async function ensurePlanQuota(client, orgId, quotaKey, nextCount) {
  const result = await client.query('SELECT * FROM plan_subscriptions WHERE org_id = $1', [orgId]);
  const row = result.rows[0];
  const merged = mergePlan(row?.plan_code || 'starter', row || null);
  const limit = Number(merged.quotas[quotaKey] ?? 0);
  if (limit > 0 && nextCount > limit) {
    throw new Error(`Plan quota exceeded for ${quotaKey}`);
  }
  return merged;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return noContent(env);

    try {
      if (url.pathname === '/v1/health' && request.method === 'GET') {
        return json({ ok: true, name: 'SkyeDB Multi-tenant Control Plane', time: new Date().toISOString() }, 200, env);
      }
      if (url.pathname === '/v1/plans' && request.method === 'GET') {
        return json(await listPlans(), 200, env);
      }

      if (url.pathname === '/v1/public/plans' && request.method === 'GET') {
        return json(publicPlans(), 200, env);
      }
      if (url.pathname === '/v1/public/signup' && request.method === 'POST') {
        const body = await readJson(request);
        const email = String(body.email || '').trim().toLowerCase();
        const fullName = String(body.full_name || '').trim();
        const orgName = String(body.org_name || '').trim();
        const projectName = String(body.project_name || '').trim();
        const planCode = String(body.plan_code || 'starter').trim();
        const plan = billingPlan(planCode);
        if (!email || !orgName) return json({ error: 'email and org_name are required' }, 400, env);
        if (!plan.is_public) return json({ error: 'Selected plan is not available for public signup' }, 400, env);
        const created = await withClient(env, async (client) => transaction(client, async (tx) => {
          const signupId = crypto.randomUUID();
          const signupToken = newToken('sgn');
          await tx.query(
            `INSERT INTO signup_applications (id, email, full_name, org_name, project_name, desired_plan_code, status, signup_token, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)`,
            [signupId, email, fullName || null, orgName, projectName || null, planCode, signupToken, JSON.stringify({ source: 'public_signup' })],
          );
          const checkout = await createCheckoutSessionRecord(tx, {
            signupApplicationId: signupId,
            planCode,
            provider: 'manual',
            successUrl: body.success_url || null,
            cancelUrl: body.cancel_url || null,
            metadata: { email, org_name: orgName, project_name: projectName || null },
          });
          await logAudit(tx, email, 'signup_application', signupId, 'created_public_signup', { plan_code: planCode, org_name: orgName }, null, null);
          return {
            id: signupId,
            email,
            full_name: fullName,
            org_name: orgName,
            project_name: projectName,
            desired_plan_code: planCode,
            signup_token: signupToken,
            checkout_session: checkout,
            next_step: 'Create or log into your Netlify Identity account in the admin app, then sync auth to activate the workspace.',
          };
        }));
        return json(created, 201, env);
      }
      const publicSignupParams = routeMatch(url.pathname, '/v1/public/signup/:token');
      if (publicSignupParams && request.method === 'GET') {
        const row = await withClient(env, async (client) => {
          const result = await client.query(
            `SELECT id, email, full_name, org_name, project_name, desired_plan_code, status, created_at, activated_at
             FROM signup_applications WHERE signup_token = $1`,
            [publicSignupParams.token],
          );
          return result.rows[0] || null;
        });
        if (!row) return json({ error: 'Signup token not found' }, 404, env);
        return json(row, 200, env);
      }

      const auth = await requireAuth(request, env);
      const authUser = await withClient(env, async (client) => transaction(client, async (tx) => {
        const user = await upsertPlatformUser(tx, auth);
        auth.user_id = user.id;
        auth.email = user.email;
        auth.is_super_admin = auth.is_super_admin || user.is_super_admin;
        return user;
      }));

      if (url.pathname === '/v1/auth/sync' && request.method === 'POST') {
        const body = await readJson(request);
        const syncPayload = await withClient(env, async (client) => transaction(client, async (tx) => {
          const memberships = await tx.query(
            `SELECT om.org_id, om.role
             FROM org_memberships om
             WHERE om.user_id = $1 AND om.status = 'active'`,
            [auth.user_id],
          );
          let createdWorkspace = null;
          let activatedSignup = null;
          if (auth.user_id && memberships.rows.length === 0 && body.signup_token) {
            activatedSignup = await activateSignupApplication(tx, auth, authUser, String(body.signup_token));
            createdWorkspace = activatedSignup.bundle;
          } else if (auth.user_id && memberships.rows.length === 0 && body.create_personal_org !== false) {
            createdWorkspace = await createDefaultOrgBundle(tx, auth, authUser, body);
            await ensureBillingBootstrap(tx, {
              orgId: createdWorkspace.org_id,
              planCode: defaultPlanFor(auth, body.plan_code),
              email: auth.email,
              legalName: body.org_name || authUser.full_name || auth.email,
              source: 'auth_sync',
              createInvoice: !auth.is_super_admin,
              createTrial: !auth.is_super_admin,
            });
          }
          await logAudit(tx, auth.actor, 'platform_user', auth.user_id, 'auth_synced', {
            created_workspace: Boolean(createdWorkspace),
            activated_signup: Boolean(activatedSignup),
          }, auth, createdWorkspace?.org_id || activatedSignup?.bundle?.org_id || null);
          return {
            created_workspace: createdWorkspace,
            activated_signup: activatedSignup ? {
              signup_application_id: activatedSignup.signup.id,
              org_id: activatedSignup.bundle.org_id,
              project_id: activatedSignup.bundle.project_id,
              environment_id: activatedSignup.bundle.environment_id,
            } : null,
          };
        }));
        const orgs = await listOrgs(env, auth);
        return json({
          user: authUser,
          orgs,
          default_org_id: orgs[0]?.id || null,
          ...syncPayload,
        }, 200, env);
      }


      if (url.pathname === '/v1/signups' && request.method === 'GET') {
        return json(await listSignupApplications(env, auth), 200, env);
      }

      if (url.pathname === '/v1/orgs' && request.method === 'GET') {
        return json(await listOrgs(env, auth), 200, env);
      }
      if ((url.pathname === '/v1/organizations' || url.pathname === '/v1/orgs') && request.method === 'POST') {
        const body = await readJson(request);
        const name = String(body.name || '').trim();
        if (!name) return json({ error: 'name is required' }, 400, env);
        const planCode = defaultPlanFor(auth, body.plan_code);
        const baseSlug = slugify(name) || `org-${randomSuffix(6)}`;
        const slug = `${baseSlug}-${randomSuffix(4)}`.slice(0, 56);
        const orgId = crypto.randomUUID();
        const plan = PLAN_CATALOG[planCode];

        const org = await withClient(env, async (client) => transaction(client, async (tx) => {
          await tx.query(
            'INSERT INTO orgs (id, name, slug, owner_user_id, mode, status) VALUES ($1,$2,$3,$4,$5,$6)',
            [orgId, name, slug, auth.user_id, body.mode || (auth.is_super_admin ? 'owner' : 'customer'), 'active'],
          );
          if (auth.user_id) {
            await tx.query(
              'INSERT INTO org_memberships (id, org_id, user_id, role, status) VALUES ($1,$2,$3,$4,$5)',
              [crypto.randomUUID(), orgId, auth.user_id, 'owner', 'active'],
            );
          }
          await tx.query(
            `INSERT INTO plan_subscriptions (id, org_id, plan_code, status, seats, quotas_json, metadata)
             VALUES ($1,$2,$3,'active',$4,$5,$6)`,
            [crypto.randomUUID(), orgId, planCode, plan.seats, JSON.stringify(plan.quotas), JSON.stringify({ source: 'org_create' })],
          );
          await logAudit(tx, auth.actor, 'org', orgId, 'created', { name, slug, plan_code: planCode }, auth, orgId);
          const result = await tx.query('SELECT * FROM orgs WHERE id = $1', [orgId]);
          return result.rows[0];
        }));
        return json(org, 201, env);
      }

      const orgDetailParams = routeMatch(url.pathname, '/v1/orgs/:id');
      if (orgDetailParams && request.method === 'GET') {
        const row = await getOrgDetail(env, auth, orgDetailParams.id);
        if (!row) return json({ error: 'Organization not found' }, 404, env);
        return json(row, 200, env);
      }

      const orgMembersParams = routeMatch(url.pathname, '/v1/orgs/:id/members');
      if (orgMembersParams && request.method === 'POST') {
        const body = await readJson(request);
        const email = String(body.email || '').trim().toLowerCase();
        const role = String(body.role || 'member').trim().toLowerCase();
        if (!email) return json({ error: 'email is required' }, 400, env);
        if (!['member', 'admin', 'owner'].includes(role)) return json({ error: 'Invalid role' }, 400, env);
        const member = await withClient(env, async (client) => transaction(client, async (tx) => {
          await requireOrgRole(tx, auth, orgMembersParams.id, 'owner');
          const orgMemberships = await tx.query('SELECT COUNT(*)::int AS count FROM org_memberships WHERE org_id = $1 AND status = $2', [orgMembersParams.id, 'active']);
          await ensurePlanQuota(tx, orgMembersParams.id, 'max_members', Number(orgMemberships.rows[0].count || 0) + 1);
          let userResult = await tx.query('SELECT * FROM platform_users WHERE email = $1', [email]);
          let user = userResult.rows[0];
          if (!user) {
            userResult = await tx.query(
              `INSERT INTO platform_users (id, email, full_name, auth_subject, is_super_admin, status)
               VALUES ($1,$2,$3,$4,false,'invited')
               RETURNING *`,
              [crypto.randomUUID(), email, String(body.full_name || email).trim(), email],
            );
            user = userResult.rows[0];
          }
          await tx.query(
            `INSERT INTO org_memberships (id, org_id, user_id, role, status)
             VALUES ($1,$2,$3,$4,'active')
             ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
            [crypto.randomUUID(), orgMembersParams.id, user.id, role],
          );
          await logAudit(tx, auth.actor, 'org_membership', user.id, 'member_upserted', { email, role }, auth, orgMembersParams.id);
          return { user_id: user.id, email: user.email, role };
        }));
        return json(member, 201, env);
      }

      if ((url.pathname === '/v1/projects' || url.pathname === '/v1/projects/') && request.method === 'GET') {
        return json(await listProjects(env, auth), 200, env);
      }
      if (url.pathname === '/v1/projects' && request.method === 'POST') {
        const body = await readJson(request);
        const orgId = body.org_id || body.organization_id;
        const name = String(body.name || '').trim();
        if (!orgId || !name) return json({ error: 'org_id and name are required' }, 400, env);
        const projectId = crypto.randomUUID();
        const slug = slugify(name) || `project-${randomSuffix(6)}`;
        const planCode = defaultPlanFor(auth, body.plan_code);

        const project = await withClient(env, async (client) => transaction(client, async (tx) => {
          await requireOrgRole(tx, auth, orgId, 'admin');
          const countResult = await tx.query('SELECT COUNT(*)::int AS count FROM projects WHERE org_id = $1', [orgId]);
          await ensurePlanQuota(tx, orgId, 'max_projects', Number(countResult.rows[0].count || 0) + 1);
          await tx.query('INSERT INTO projects (id, org_id, name, slug, plan_code) VALUES ($1,$2,$3,$4,$5)', [projectId, orgId, name, slug, planCode]);
          await logAudit(tx, auth.actor, 'project', projectId, 'created', { name, slug, org_id: orgId, plan_code: planCode }, auth, orgId);
          const result = await tx.query('SELECT * FROM projects WHERE id = $1', [projectId]);
          return result.rows[0];
        }));
        return json(project, 201, env);
      }

      if (url.pathname === '/v1/environments' && request.method === 'GET') {
        return json(await listEnvironments(env, auth), 200, env);
      }
      if (url.pathname === '/v1/environments' && request.method === 'POST') {
        const body = await readJson(request);
        const projectId = body.project_id;
        const name = String(body.name || '').trim();
        const kind = String(body.kind || 'production').trim();
        if (!projectId || !name) return json({ error: 'project_id and name are required' }, 400, env);
        const environmentId = crypto.randomUUID();
        const slug = slugify(name) || `env-${randomSuffix(6)}`;

        const environment = await withClient(env, async (client) => transaction(client, async (tx) => {
          const project = await requireProjectRole(tx, auth, projectId, 'admin');
          await tx.query('INSERT INTO environments (id, project_id, name, slug, kind) VALUES ($1,$2,$3,$4,$5)', [environmentId, projectId, name, slug, kind]);
          await logAudit(tx, auth.actor, 'environment', environmentId, 'created', { name, slug, kind, project_id: projectId }, auth, project.org_id);
          const result = await tx.query('SELECT * FROM environments WHERE id = $1', [environmentId]);
          return result.rows[0];
        }));
        return json(environment, 201, env);
      }

      if (url.pathname === '/v1/databases' && request.method === 'GET') {
        return json(await listDatabases(env, auth), 200, env);
      }

      const databaseParams = routeMatch(url.pathname, '/v1/databases/:id');
      if (databaseParams && request.method === 'GET') {
        const row = await getDatabase(env, auth, databaseParams.id);
        if (!row) return json({ error: 'Database not found' }, 404, env);
        return json(row, 200, env);
      }

      if (url.pathname === '/v1/databases' && request.method === 'POST') {
        const body = await readJson(request);
        const projectId = body.project_id;
        const environmentId = body.environment_id || null;
        const name = String(body.name || '').trim();
        const planCode = defaultPlanFor(auth, body.plan_code || body.plan || 'starter');
        if (!projectId || !name) return json({ error: 'project_id and name are required' }, 400, env);

        const instanceId = crypto.randomUUID();
        const jobId = crypto.randomUUID();
        const slug = slugify(name) || `db-${randomSuffix(6)}`;
        const password = strongPassword();
        const dbName = makeDbIdent('db', `${slug}_${randomSuffix(4)}`);
        const dbUser = makeDbIdent('u', `${slug}_${randomSuffix(4)}`);
        const passwordCiphertext = encryptText(env.APP_ENCRYPTION_KEY, password);

        const payload = {
          action: 'create_database',
          db_name: dbName,
          db_user: dbUser,
          password_ciphertext: passwordCiphertext,
        };

        const instance = await withClient(env, async (client) => transaction(client, async (tx) => {
          const project = await requireProjectRole(tx, auth, projectId, 'admin');
          let environment = null;
          if (environmentId) {
            environment = await resolveEnvironment(tx, environmentId);
            if (!environment || environment.project_id !== projectId) throw new Error('Environment not found for project');
          }
          const countResult = await tx.query('SELECT COUNT(*)::int AS count FROM database_instances WHERE org_id = $1', [project.org_id]);
          await ensurePlanQuota(tx, project.org_id, 'max_databases', Number(countResult.rows[0].count || 0) + 1);
          await tx.query(
            `INSERT INTO database_instances (
              id, org_id, project_id, environment_id, name, slug, plan_code, db_name, db_user, password_ciphertext,
              status, branch_of_instance_id, public_hostname, public_port, public_ssl_mode
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'creating',NULL,$11,$12,$13)`,
            [
              instanceId,
              project.org_id,
              projectId,
              environment?.id || null,
              name,
              slug,
              planCode,
              dbName,
              dbUser,
              passwordCiphertext,
              env.PUBLIC_DB_HOST,
              Number(env.PUBLIC_DB_PORT || 5432),
              env.PUBLIC_DB_SSLMODE || 'require',
            ],
          );
          await tx.query(
            `INSERT INTO jobs (id, job_type, status, org_id, project_id, environment_id, instance_id, requested_by_user_id, requested_by, payload)
             VALUES ($1,'create_database','queued',$2,$3,$4,$5,$6,$7,$8)`,
            [jobId, project.org_id, projectId, environment?.id || null, instanceId, auth.user_id, auth.actor, JSON.stringify(payload)],
          );
          await logAudit(tx, auth.actor, 'database_instance', instanceId, 'create_queued', {
            job_id: jobId,
            name,
            slug,
            plan_code: planCode,
            db_name: dbName,
            db_user: dbUser,
          }, auth, project.org_id);
          const result = await tx.query('SELECT * FROM database_instances WHERE id = $1', [instanceId]);
          return { ...result.rows[0], password, queued_job_id: jobId };
        }));
        return json(instance, 201, env);
      }

      const branchParams = routeMatch(url.pathname, '/v1/databases/:id/branch');
      if (branchParams && request.method === 'POST') {
        const body = await readJson(request);
        const name = String(body.name || '').trim();
        if (!name) return json({ error: 'name is required' }, 400, env);
        const created = await withClient(env, async (client) => transaction(client, async (tx) => {
          const source = await requireInstanceRole(tx, auth, branchParams.id, 'admin');
          const countResult = await tx.query('SELECT COUNT(*)::int AS count FROM database_instances WHERE org_id = $1', [source.org_id]);
          await ensurePlanQuota(tx, source.org_id, 'max_databases', Number(countResult.rows[0].count || 0) + 1);
          const instanceId = crypto.randomUUID();
          const jobId = crypto.randomUUID();
          const slug = slugify(name) || `branch-${randomSuffix(6)}`;
          const password = strongPassword();
          const dbName = makeDbIdent('db', `${slug}_${randomSuffix(4)}`);
          const dbUser = makeDbIdent('u', `${slug}_${randomSuffix(4)}`);
          const passwordCiphertext = encryptText(env.APP_ENCRYPTION_KEY, password);
          const payload = {
            action: 'branch_database',
            source_instance_id: source.id,
            source_db_name: source.db_name,
            new_db_name: dbName,
            new_db_user: dbUser,
            password_ciphertext: passwordCiphertext,
          };
          await tx.query(
            `INSERT INTO database_instances (
              id, org_id, project_id, environment_id, name, slug, plan_code, db_name, db_user, password_ciphertext,
              status, branch_of_instance_id, public_hostname, public_port, public_ssl_mode
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'creating',$11,$12,$13,$14)`,
            [
              instanceId,
              source.org_id,
              source.project_id,
              source.environment_id,
              name,
              slug,
              source.plan_code,
              dbName,
              dbUser,
              passwordCiphertext,
              source.id,
              source.public_hostname,
              source.public_port,
              source.public_ssl_mode,
            ],
          );
          await tx.query(
            `INSERT INTO jobs (id, job_type, status, org_id, project_id, environment_id, instance_id, requested_by_user_id, requested_by, payload)
             VALUES ($1,'branch_database','queued',$2,$3,$4,$5,$6,$7,$8)`,
            [jobId, source.org_id, source.project_id, source.environment_id, instanceId, auth.user_id, auth.actor, JSON.stringify(payload)],
          );
          await logAudit(tx, auth.actor, 'database_instance', instanceId, 'branch_queued', { job_id: jobId, source_instance_id: source.id, db_name: dbName }, auth, source.org_id);
          return { id: instanceId, queued_job_id: jobId, password };
        }));
        return json(created, 201, env);
      }

      const rotateParams = routeMatch(url.pathname, '/v1/databases/:id/rotate-password');
      if (rotateParams && request.method === 'POST') {
        const queued = await withClient(env, async (client) => transaction(client, async (tx) => {
          const instance = await requireInstanceRole(tx, auth, rotateParams.id, 'admin');
          const newPassword = strongPassword();
          const newCipher = encryptText(env.APP_ENCRYPTION_KEY, newPassword);
          const payload = {
            action: 'rotate_password',
            db_user: instance.db_user,
            new_password_ciphertext: newCipher,
          };
          const jobId = crypto.randomUUID();
          await tx.query(
            `INSERT INTO jobs (id, job_type, status, org_id, project_id, environment_id, instance_id, requested_by_user_id, requested_by, payload)
             VALUES ($1,'rotate_password','queued',$2,$3,$4,$5,$6,$7,$8)`,
            [jobId, instance.org_id, instance.project_id, instance.environment_id, instance.id, auth.user_id, auth.actor, JSON.stringify(payload)],
          );
          await logAudit(tx, auth.actor, 'database_instance', instance.id, 'rotate_queued', { job_id: jobId }, auth, instance.org_id);
          return { instance_id: instance.id, queued_job_id: jobId, new_password: newPassword };
        }));
        return json(queued, 201, env);
      }

      const backupParams = routeMatch(url.pathname, '/v1/databases/:id/backup');
      if (backupParams && request.method === 'POST') {
        const queued = await withClient(env, async (client) => transaction(client, async (tx) => {
          const instance = await requireInstanceRole(tx, auth, backupParams.id, 'admin');
          const backupId = crypto.randomUUID();
          const jobId = crypto.randomUUID();
          await tx.query(
            'INSERT INTO backups (id, org_id, project_id, instance_id, job_id, status, requested_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [backupId, instance.org_id, instance.project_id, instance.id, jobId, 'queued', auth.actor],
          );
          await tx.query(
            `INSERT INTO jobs (id, job_type, status, org_id, project_id, environment_id, instance_id, requested_by_user_id, requested_by, payload)
             VALUES ($1,'backup_database','queued',$2,$3,$4,$5,$6,$7,$8)`,
            [jobId, instance.org_id, instance.project_id, instance.environment_id, instance.id, auth.user_id, auth.actor, JSON.stringify({ backup_id: backupId })],
          );
          await logAudit(tx, auth.actor, 'backup', backupId, 'backup_queued', { job_id: jobId, instance_id: instance.id }, auth, instance.org_id);
          return { backup_id: backupId, queued_job_id: jobId };
        }));
        return json(queued, 201, env);
      }

      const restoreParams = routeMatch(url.pathname, '/v1/databases/:id/restore');
      if (restoreParams && request.method === 'POST') {
        const body = await readJson(request);
        const backupId = body.backup_id;
        if (!backupId) return json({ error: 'backup_id is required' }, 400, env);
        const queued = await withClient(env, async (client) => transaction(client, async (tx) => {
          const instance = await requireInstanceRole(tx, auth, restoreParams.id, 'admin');
          const backupResult = await tx.query('SELECT * FROM backups WHERE id = $1 AND instance_id = $2', [backupId, instance.id]);
          const backup = backupResult.rows[0];
          if (!backup) throw new Error('Backup not found for database');
          const restoreId = crypto.randomUUID();
          const jobId = crypto.randomUUID();
          await tx.query(
            `INSERT INTO restores (id, org_id, project_id, instance_id, backup_id, job_id, status, requested_by)
             VALUES ($1,$2,$3,$4,$5,$6,'queued',$7)`,
            [restoreId, instance.org_id, instance.project_id, instance.id, backupId, jobId, auth.actor],
          );
          await tx.query(
            `INSERT INTO jobs (id, job_type, status, org_id, project_id, environment_id, instance_id, requested_by_user_id, requested_by, payload)
             VALUES ($1,'restore_database','queued',$2,$3,$4,$5,$6,$7,$8)`,
            [jobId, instance.org_id, instance.project_id, instance.environment_id, instance.id, auth.user_id, auth.actor, JSON.stringify({ restore_id: restoreId, backup_id: backupId })],
          );
          await logAudit(tx, auth.actor, 'restore', restoreId, 'restore_queued', { job_id: jobId, backup_id: backupId, instance_id: instance.id }, auth, instance.org_id);
          return { restore_id: restoreId, queued_job_id: jobId };
        }));
        return json(queued, 201, env);
      }

      if (url.pathname === '/v1/jobs' && request.method === 'GET') {
        return json(await listJobs(env, auth), 200, env);
      }
      const jobParams = routeMatch(url.pathname, '/v1/jobs/:id');
      if (jobParams && request.method === 'GET') {
        const row = await getJob(env, auth, jobParams.id);
        if (!row) return json({ error: 'Job not found' }, 404, env);
        return json(row, 200, env);
      }

      if (url.pathname === '/v1/backups' && request.method === 'GET') {
        return json(await listBackups(env, auth), 200, env);
      }
      if (url.pathname === '/v1/restores' && request.method === 'GET') {
        return json(await listRestores(env, auth), 200, env);
      }
      if (url.pathname === '/v1/audit' && request.method === 'GET') {
        return json(await listAudit(env, auth), 200, env);
      }
      if (url.pathname === '/v1/usage' && request.method === 'GET') {
        return json(await listUsage(env, auth), 200, env);
      }

      const projectKeysParams = routeMatch(url.pathname, '/v1/projects/:id/api-keys');
      if (projectKeysParams && request.method === 'GET') {
        return json(await listProjectApiKeys(env, auth, projectKeysParams.id), 200, env);
      }
      if (projectKeysParams && request.method === 'POST') {
        const body = await readJson(request);
        const name = String(body.name || '').trim();
        if (!name) return json({ error: 'name is required' }, 400, env);
        const created = await withClient(env, async (client) => transaction(client, async (tx) => {
          const project = await requireProjectRole(tx, auth, projectKeysParams.id, 'admin');
          const countResult = await tx.query('SELECT COUNT(*)::int AS count FROM project_api_keys WHERE project_id = $1 AND status = $2', [project.id, 'active']);
          await ensurePlanQuota(tx, project.org_id, 'max_api_keys_per_project', Number(countResult.rows[0].count || 0) + 1);
          const rawSecret = `skdb_${randomSuffix(8)}_${randomSuffix(20)}`;
          const prefix = rawSecret.slice(0, 18);
          const secretHash = await hashSha256(rawSecret);
          const keyId = crypto.randomUUID();
          await tx.query(
            `INSERT INTO project_api_keys (id, org_id, project_id, name, prefix, secret_hash, status, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,'active',$7)`,
            [keyId, project.org_id, project.id, name, prefix, secretHash, auth.actor],
          );
          await logAudit(tx, auth.actor, 'project_api_key', keyId, 'created', { project_id: project.id, name, prefix }, auth, project.org_id);
          return { id: keyId, project_id: project.id, name, prefix, secret: rawSecret };
        }));
        return json(created, 201, env);
      }


      const orgBillingParams = routeMatch(url.pathname, '/v1/orgs/:id/billing');
      if (orgBillingParams && request.method === 'GET') {
        return json(await getBillingSummary(env, auth, orgBillingParams.id), 200, env);
      }

      const orgBillingSubscriptionParams = routeMatch(url.pathname, '/v1/orgs/:id/billing/subscription');
      if (orgBillingSubscriptionParams && request.method === 'POST') {
        const body = await readJson(request);
        const planCode = String(body.plan_code || 'starter').trim();
        const billingEmail = String(body.billing_email || auth.email || '').trim().toLowerCase();
        const legalName = String(body.legal_name || '').trim();
        const cancelAtPeriodEnd = Boolean(body.cancel_at_period_end);
        const issueInvoice = body.issue_invoice !== false;
        const summary = await withClient(env, async (client) => transaction(client, async (tx) => {
          await requireOrgRole(tx, auth, orgBillingSubscriptionParams.id, 'owner');
          await ensureBillingBootstrap(tx, {
            orgId: orgBillingSubscriptionParams.id,
            planCode,
            email: billingEmail,
            legalName,
            source: 'subscription_update',
            createInvoice: issueInvoice,
            createTrial: false,
            cancelAtPeriodEnd,
          });
          await logAudit(tx, auth.actor, 'plan_subscription', null, 'subscription_updated', {
            org_id: orgBillingSubscriptionParams.id,
            plan_code: planCode,
            billing_email: billingEmail,
            cancel_at_period_end: cancelAtPeriodEnd,
          }, auth, orgBillingSubscriptionParams.id);
          return true;
        }));
        return json(await getBillingSummary(env, auth, orgBillingSubscriptionParams.id), 200, env);
      }

      const orgBillingCheckoutParams = routeMatch(url.pathname, '/v1/orgs/:id/billing/checkout-sessions');
      if (orgBillingCheckoutParams && request.method === 'POST') {
        const body = await readJson(request);
        const planCode = String(body.plan_code || 'starter').trim();
        const created = await withClient(env, async (client) => transaction(client, async (tx) => {
          await requireOrgRole(tx, auth, orgBillingCheckoutParams.id, 'owner');
          const session = await createCheckoutSessionRecord(tx, {
            orgId: orgBillingCheckoutParams.id,
            planCode,
            provider: body.provider || 'manual',
            successUrl: body.success_url || null,
            cancelUrl: body.cancel_url || null,
            metadata: { created_by: auth.actor, source: 'org_checkout' },
          });
          await logAudit(tx, auth.actor, 'checkout_session', session.id, 'checkout_session_created', {
            org_id: orgBillingCheckoutParams.id,
            plan_code: planCode,
            amount_cents: session.amount_cents,
          }, auth, orgBillingCheckoutParams.id);
          return session;
        }));
        return json(created, 201, env);
      }

      const orgBillingInvoicePayParams = routeMatch(url.pathname, '/v1/orgs/:id/billing/invoices/:invoiceId/pay');
      if (orgBillingInvoicePayParams && request.method === 'POST') {
        const paid = await withClient(env, async (client) => transaction(client, async (tx) => {
          await requireOrgRole(tx, auth, orgBillingInvoicePayParams.id, 'owner');
          const result = await tx.query(
            `UPDATE invoices
             SET status = 'paid', paid_at = now(), metadata = metadata || $3
             WHERE id = $1 AND org_id = $2
             RETURNING *`,
            [orgBillingInvoicePayParams.invoiceId, orgBillingInvoicePayParams.id, JSON.stringify({ paid_by: auth.actor })],
          );
          const invoice = result.rows[0];
          if (!invoice) throw new Error('Invoice not found for organization');
          await tx.query(
            `UPDATE plan_subscriptions
             SET status = 'active', trial_ends_at = COALESCE(trial_ends_at, now()), current_period_start = now(), current_period_end = $2
             WHERE org_id = $1`,
            [orgBillingInvoicePayParams.id, nextMonthIso()],
          );
          await logAudit(tx, auth.actor, 'invoice', invoice.id, 'invoice_paid', { org_id: orgBillingInvoicePayParams.id }, auth, orgBillingInvoicePayParams.id);
          return invoice;
        }));
        return json(paid, 200, env);
      }

      return json({ error: 'Not found' }, 404, env);
    } catch (error) {
      return json({ error: error.message || 'Unhandled worker error' }, 400, env);
    }
  },
};
