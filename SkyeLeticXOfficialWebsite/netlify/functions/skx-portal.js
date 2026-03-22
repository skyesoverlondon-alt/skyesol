
const { getStore } = require('@netlify/blobs');
const { ok, fail, parseBody, corsHeaders } = require('./_lib/response');
const { getPool, ensureSchema, key } = require('./_lib/db');
const { tokenRoles, hasRole, normalizeRole } = require('./_lib/auth');

function noteStore() { return getStore('skx-dashboard-notes'); }
function cacheStore() { return getStore('skx-dashboard-cache'); }

async function loadProfile(db, email) {
  if (!email) return null;
  const { rows } = await db.query('select * from profiles where email = $1', [String(email).toLowerCase()]);
  return rows[0] || null;
}
async function getContext(context, db) {
  const user = context && context.clientContext ? context.clientContext.user : null;
  const email = user && user.email ? String(user.email).toLowerCase() : null;
  const profile = await loadProfile(db, email);
  return {
    user,
    email,
    profile,
    profileRole: profile && profile.role ? normalizeRole(profile.role) : null,
    roles: user ? tokenRoles(user) : [],
    displayName: (profile && profile.display_name) || (user && user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || email || 'Guest'
  };
}
function requireLogin(ctx) {
  if (!ctx.user) throw new Error('Login required through Netlify Identity.');
}
function requireRoles(ctx, allowed) {
  requireLogin(ctx);
  if (!hasRole(ctx, allowed)) throw new Error(`This action requires one of: ${allowed.join(', ')}`);
}
async function getSummary(db) {
  const [playerCount, teamCount, combineCount, openFees, paidTotal, picksCount] = await Promise.all([
    db.query('select count(*)::int as count from players'),
    db.query('select count(*)::int as count from teams'),
    db.query('select count(*)::int as count from combines'),
    db.query("select coalesce(sum(amount),0)::numeric as total from finance_entries where status = 'open'"),
    db.query("select coalesce(sum(amount),0)::numeric as total from finance_entries where status = 'paid'"),
    db.query('select count(*)::int as count from draft_picks')
  ]);
  return {
    player_count: playerCount.rows[0].count,
    team_count: teamCount.rows[0].count,
    combine_count: combineCount.rows[0].count,
    open_fees: Number(openFees.rows[0].total || 0),
    paid_total: Number(paidTotal.rows[0].total || 0),
    picks_count: picksCount.rows[0].count
  };
}
async function getRecent(db) {
  const [players, teams, finance, combines, picks] = await Promise.all([
    db.query('select id, full_name, school_level, school_name, status, entry_lane, combine_score, draft_rank, team_name, created_at from players order by created_at desc limit 12'),
    db.query('select id, team_name, market, owner_name, owner_email, status, roster_limit, created_at from teams order by created_at desc limit 12'),
    db.query('select id, category, description, amount, status, due_date, created_at from finance_entries order by created_at desc limit 12'),
    db.query('select id, title, location, event_date, checkin_time, status, created_at from combines order by coalesce(event_date, current_date) asc, created_at desc limit 12'),
    db.query('select id, round_no, pick_no, player_name, selected_by_name, created_at, team_id from draft_picks order by created_at desc limit 12')
  ]);
  return { players: players.rows, teams: teams.rows, finance: finance.rows, combines: combines.rows, picks: picks.rows };
}
async function cacheSummary(summary) {
  try {
    const store = cacheStore();
    await store.set('latest-summary', JSON.stringify({ summary, updatedAt: new Date().toISOString() }));
  } catch {}
}
async function getNote(scope) {
  try {
    const store = noteStore();
    return (await store.get(`note-${scope}.json`, { type: 'json' })) || null;
  } catch {
    return null;
  }
}
async function saveNote(scope, text, author) {
  const store = noteStore();
  const payload = { scope, text: text || '', author, updatedAt: new Date().toISOString() };
  await store.set(`note-${scope}.json`, JSON.stringify(payload));
  return payload;
}
function isTeamOwnerForTeam(ctx, teamId) {
  return ctx.profile && ctx.profile.team_id && Number(ctx.profile.team_id) === Number(teamId);
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(), body: '' };
  try {
    await ensureSchema();
    const db = getPool();
    const body = parseBody(event);
    const action = event.httpMethod === 'GET' ? (event.queryStringParameters && event.queryStringParameters.action) : body.action;
    const ctx = await getContext(context, db);

    if (action === 'bootstrap') {
      const summary = await getSummary(db);
      await cacheSummary(summary);
      return ok({ user: ctx.user ? { email: ctx.user.email } : null, profileRole: ctx.profileRole, roles: ctx.roles, profile: ctx.profile, summary });
    }

    if (action === 'public_interest') {
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      if (!name || !email) return fail(400, 'Name and email are required.');
      const insert = await db.query(
        `insert into expansion_interest (interest_key, name, email, phone, org_name, lane, city, state, message)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [key('interest'), name, email, body.phone || null, body.org_name || null, body.lane || null, body.city || null, body.state || null, body.message || null]
      );
      return ok({ record: insert.rows[0] });
    }

    if (action === 'public_player_submit') {
      const firstName = String(body.first_name || '').trim();
      const lastName = String(body.last_name || '').trim();
      if (!firstName || !lastName) return fail(400, 'First and last name are required.');
      const insert = await db.query(
        `insert into players (player_key, first_name, last_name, full_name, email, phone, entry_lane, school_level, school_name, city, state, height_inches, position, status, form_source, waiver_signed, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'registered',$14,$15,$16)
         returning *`,
        [key('player'), firstName, lastName, `${firstName} ${lastName}`.trim(), body.email || null, body.phone || null, body.entry_lane || 'open_combine', body.school_level || null, body.school_name || null, body.city || null, body.state || null, body.height_inches || null, body.position || null, body.form_source || 'netlify_form', !!body.waiver_signed, body.notes || null]
      );
      return ok({ player: insert.rows[0] });
    }

    if (action === 'league_summary') {
      requireRoles(ctx, ['president', 'vp', 'cfo', 'team_owner']);
      const summary = await getSummary(db);
      const recent = await getRecent(db);
      return ok({ summary, recent });
    }

    if (action === 'teams') {
      requireRoles(ctx, ['president', 'vp', 'team_owner']);
      const { rows } = await db.query(`
        select t.*, coalesce(p.player_count,0)::int as player_count
        from teams t
        left join (
          select team_id, count(*) as player_count from players where team_id is not null group by team_id
        ) p on p.team_id = t.id
        order by t.created_at desc
      `);
      return ok({ teams: rows });
    }

    if (action === 'players') {
      requireRoles(ctx, ['president', 'vp', 'team_owner', 'cfo']);
      const { rows } = await db.query('select * from players order by created_at desc limit 250');
      return ok({ players: rows });
    }

    if (action === 'combines') {
      requireRoles(ctx, ['president', 'vp', 'team_owner']);
      const { rows } = await db.query('select * from combines order by coalesce(event_date, current_date) asc, created_at desc');
      return ok({ combines: rows });
    }

    if (action === 'finance') {
      requireRoles(ctx, ['president', 'cfo']);
      const totals = await db.query(`
        select
          coalesce(sum(case when status = 'open' then amount else 0 end),0)::numeric as open_total,
          coalesce(sum(case when status = 'paid' then amount else 0 end),0)::numeric as paid_total,
          coalesce(sum(case when category = 'payout' and status != 'paid' then amount else 0 end),0)::numeric as payout_queue
        from finance_entries
      `);
      const entries = await db.query('select * from finance_entries order by created_at desc limit 250');
      return ok({ totals: totals.rows[0], entries: entries.rows });
    }

    if (action === 'draft_board') {
      requireRoles(ctx, ['president', 'vp', 'team_owner']);
      const available = await db.query(`
        select id, player_key, full_name, school_level, school_name, position, status, entry_lane, combine_score, draft_rank, city, state
        from players
        where team_id is null and status in ('registered','checked_in','eligible','combine_complete','draft_pool')
        order by draft_rank asc nulls last, combine_score desc nulls last, created_at asc
      `);
      const teams = await db.query(`
        select t.*, coalesce(r.player_count,0)::int as player_count
        from teams t
        left join (select team_id, count(*) player_count from players where team_id is not null group by team_id) r on r.team_id = t.id
        order by t.team_name asc
      `);
      const picks = await db.query('select * from draft_picks order by created_at desc limit 100');
      return ok({ available_players: available.rows, teams: teams.rows, picks: picks.rows, linked_team_id: ctx.profile && ctx.profile.team_id ? Number(ctx.profile.team_id) : null });
    }

    if (action === 'player_self') {
      requireLogin(ctx);
      let player;
      if (ctx.profile && ctx.profile.player_id) {
        const result = await db.query('select * from players where id = $1', [ctx.profile.player_id]);
        player = result.rows[0] || null;
      }
      if (!player && ctx.email) {
        const result = await db.query('select * from players where lower(coalesce(identity_email,email)) = $1 order by created_at desc limit 1', [ctx.email]);
        player = result.rows[0] || null;
      }
      const finance = player ? await db.query('select * from finance_entries where player_id = $1 order by created_at desc', [player.id]) : { rows: [] };
      const team = player && player.team_id ? await db.query('select * from teams where id = $1', [player.team_id]) : { rows: [] };
      const combines = await db.query('select * from combines order by coalesce(event_date, current_date) asc, created_at desc limit 24');
      return ok({ player, finance_entries: finance.rows, team: team.rows[0] || null, combines: combines.rows });
    }

    if (action === 'save_note') {
      requireRoles(ctx, ['president', 'vp', 'cfo', 'team_owner']);
      const scope = String(body.scope || '').trim();
      if (!scope) return fail(400, 'Note scope is required.');
      const note = await saveNote(scope, body.text || '', ctx.displayName || ctx.email || 'Unknown');
      return ok({ note });
    }

    if (action === 'load_note') {
      requireRoles(ctx, ['president', 'vp', 'cfo', 'team_owner']);
      const scope = String((event.queryStringParameters && event.queryStringParameters.scope) || '').trim();
      if (!scope) return fail(400, 'Note scope is required.');
      const note = await getNote(scope);
      return ok({ note });
    }

    if (action === 'seed_founding_slots') {
      requireRoles(ctx, ['president', 'vp']);
      const existing = await db.query("select count(*)::int as count from teams where team_key like 'founding-%'");
      const current = existing.rows[0].count;
      if (current >= 26) return ok({ created: 0, message: 'Founding slots already exist.' });
      let created = 0;
      for (let i = current + 1; i <= 26; i++) {
        const idx = String(i).padStart(2, '0');
        await db.query(
          `insert into teams (team_key, team_name, status, season_year, owner_role) values ($1,$2,'founding_slot',2026,'team_owner') on conflict do nothing`,
          [`founding-${idx}`, `Founding Franchise Slot ${idx}`]
        );
        created += 1;
      }
      return ok({ created });
    }

    if (action === 'upsert_team') {
      requireRoles(ctx, ['president', 'vp']);
      const id = body.id ? Number(body.id) : null;
      if (!body.team_name) return fail(400, 'Team name is required.');
      if (id) {
        const { rows } = await db.query(
          `update teams set team_name=$1, owner_name=$2, owner_email=$3, market=$4, status=$5, roster_limit=$6, updated_at=now() where id=$7 returning *`,
          [body.team_name, body.owner_name || null, (body.owner_email || null), body.market || null, body.status || 'active', Number(body.roster_limit || 15), id]
        );
        return ok({ team: rows[0] });
      }
      const { rows } = await db.query(
        `insert into teams (team_key, team_name, owner_name, owner_email, market, status, roster_limit) values ($1,$2,$3,$4,$5,$6,$7) returning *`,
        [body.team_key || key('team'), body.team_name, body.owner_name || null, body.owner_email || null, body.market || null, body.status || 'active', Number(body.roster_limit || 15)]
      );
      return ok({ team: rows[0] });
    }

    if (action === 'link_profile') {
      requireRoles(ctx, ['president', 'vp']);
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return fail(400, 'Email is required.');
      const { rows } = await db.query(
        `insert into profiles (email, display_name, role, team_id, player_id, meta, updated_at)
         values ($1,$2,$3,$4,$5,$6::jsonb, now())
         on conflict (email) do update set display_name = excluded.display_name, role = excluded.role, team_id = excluded.team_id, player_id = excluded.player_id, meta = excluded.meta, updated_at = now()
         returning *`,
        [email, body.display_name || null, normalizeRole(body.role || ''), body.team_id ? Number(body.team_id) : null, body.player_id ? Number(body.player_id) : null, JSON.stringify(body.meta || {})]
      );
      return ok({ profile: rows[0] });
    }

    if (action === 'upsert_player') {
      requireRoles(ctx, ['president', 'vp', 'team_owner']);
      const id = body.id ? Number(body.id) : null;
      const firstName = String(body.first_name || '').trim();
      const lastName = String(body.last_name || '').trim();
      if (!firstName || !lastName) return fail(400, 'First and last name are required.');
      let teamId = body.team_id ? Number(body.team_id) : null;
      if (hasRole(ctx, ['team_owner']) && ctx.profile && ctx.profile.team_id && !hasRole(ctx, ['president','vp'])) {
        teamId = Number(ctx.profile.team_id);
      }
      let teamName = null;
      if (teamId) {
        const team = await db.query('select team_name from teams where id = $1', [teamId]);
        teamName = team.rows[0] ? team.rows[0].team_name : null;
      }
      if (id) {
        const { rows } = await db.query(
          `update players set first_name=$1, last_name=$2, full_name=$3, email=$4, phone=$5, entry_lane=$6, school_level=$7, school_name=$8, city=$9, state=$10, height_inches=$11, position=$12, status=$13, combine_score=$14, draft_rank=$15, team_id=$16, team_name=$17, identity_email=$18, waiver_signed=$19, notes=$20, updated_at=now() where id=$21 returning *`,
          [firstName, lastName, `${firstName} ${lastName}`.trim(), body.email || null, body.phone || null, body.entry_lane || 'open_combine', body.school_level || null, body.school_name || null, body.city || null, body.state || null, body.height_inches || null, body.position || null, body.status || 'registered', body.combine_score || null, body.draft_rank || null, teamId, teamName, body.identity_email || null, !!body.waiver_signed, body.notes || null, id]
        );
        return ok({ player: rows[0] });
      }
      const { rows } = await db.query(
        `insert into players (player_key, first_name, last_name, full_name, email, phone, entry_lane, school_level, school_name, city, state, height_inches, position, status, combine_score, draft_rank, team_id, team_name, identity_email, waiver_signed, form_source, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) returning *`,
        [key('player'), firstName, lastName, `${firstName} ${lastName}`.trim(), body.email || null, body.phone || null, body.entry_lane || 'open_combine', body.school_level || null, body.school_name || null, body.city || null, body.state || null, body.height_inches || null, body.position || null, body.status || 'registered', body.combine_score || null, body.draft_rank || null, teamId, teamName, body.identity_email || null, !!body.waiver_signed, body.form_source || 'dashboard', body.notes || null]
      );
      return ok({ player: rows[0] });
    }

    if (action === 'update_player_status') {
      requireRoles(ctx, ['president', 'vp', 'team_owner']);
      const playerId = Number(body.player_id || 0);
      if (!playerId) return fail(400, 'player_id is required.');
      const current = await db.query('select id, team_id from players where id = $1', [playerId]);
      if (!current.rows[0]) return fail(404, 'Player not found.');
      if (hasRole(ctx, ['team_owner']) && !hasRole(ctx, ['president','vp']) && ctx.profile && ctx.profile.team_id && current.rows[0].team_id && Number(current.rows[0].team_id) !== Number(ctx.profile.team_id)) {
        return fail(403, 'You can only update players on your team.');
      }
      const { rows } = await db.query('update players set status = $1, combine_score = coalesce($2, combine_score), draft_rank = coalesce($3, draft_rank), updated_at = now() where id = $4 returning *', [body.status || 'registered', body.combine_score || null, body.draft_rank || null, playerId]);
      return ok({ player: rows[0] });
    }

    if (action === 'create_combine') {
      requireRoles(ctx, ['president', 'vp']);
      if (!body.title) return fail(400, 'Combine title is required.');
      const { rows } = await db.query(
        `insert into combines (event_key, title, location, event_date, checkin_time, status, notes)
         values ($1,$2,$3,$4,$5,$6,$7) returning *`,
        [key('combine'), body.title, body.location || null, body.event_date || null, body.checkin_time || null, body.status || 'scheduled', body.notes || null]
      );
      return ok({ combine: rows[0] });
    }

    if (action === 'add_finance_entry') {
      requireRoles(ctx, ['president', 'cfo']);
      const amount = Number(body.amount || 0);
      if (!body.category || !amount) return fail(400, 'Category and amount are required.');
      const { rows } = await db.query(
        `insert into finance_entries (entry_key, category, player_id, team_id, description, amount, status, due_date, owner_email)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [key('ledger'), body.category, body.player_id ? Number(body.player_id) : null, body.team_id ? Number(body.team_id) : null, body.description || null, amount, body.status || 'open', body.due_date || null, body.owner_email || null]
      );
      return ok({ entry: rows[0] });
    }

    if (action === 'mark_finance_paid') {
      requireRoles(ctx, ['president', 'cfo']);
      const entryId = Number(body.entry_id || 0);
      if (!entryId) return fail(400, 'entry_id is required.');
      const { rows } = await db.query("update finance_entries set status = 'paid', paid_at = now() where id = $1 returning *", [entryId]);
      return ok({ entry: rows[0] });
    }

    if (action === 'make_draft_pick') {
      requireRoles(ctx, ['president', 'vp', 'team_owner']);
      const playerId = Number(body.player_id || 0);
      const pickNo = Number(body.pick_no || 0);
      let teamId = Number(body.team_id || 0);
      if (!playerId || !pickNo) return fail(400, 'player_id and pick_no are required.');
      if (hasRole(ctx, ['team_owner']) && !hasRole(ctx, ['president','vp'])) {
        if (!(ctx.profile && ctx.profile.team_id)) return fail(403, 'Your identity is not linked to a team yet.');
        teamId = Number(ctx.profile.team_id);
      }
      if (!teamId) return fail(400, 'team_id is required.');
      const player = await db.query('select * from players where id = $1', [playerId]);
      if (!player.rows[0]) return fail(404, 'Player not found.');
      if (player.rows[0].team_id) return fail(409, 'Player is already assigned to a team.');
      const team = await db.query('select * from teams where id = $1', [teamId]);
      if (!team.rows[0]) return fail(404, 'Team not found.');
      const { rows } = await db.query(
        `insert into draft_picks (pick_key, round_no, pick_no, team_id, player_id, player_name, selected_by_email, selected_by_name, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [key('pick'), Number(body.round_no || 1), pickNo, teamId, playerId, player.rows[0].full_name, ctx.email || null, ctx.displayName || null, body.notes || null]
      );
      await db.query('update players set team_id = $1, team_name = $2, status = $3, updated_at = now() where id = $4', [teamId, team.rows[0].team_name, 'drafted', playerId]);
      return ok({ pick: rows[0] });
    }

    if (action === 'player_update_self') {
      requireLogin(ctx);
      const playerCtx = await db.query('select * from players where lower(coalesce(identity_email,email)) = $1 order by created_at desc limit 1', [ctx.email]);
      const player = playerCtx.rows[0];
      if (!player) return fail(404, 'No player profile is linked to this account yet.');
      const { rows } = await db.query('update players set phone=$1, city=$2, state=$3, school_name=$4, position=$5, notes=$6, updated_at=now() where id = $7 returning *', [body.phone || player.phone, body.city || player.city, body.state || player.state, body.school_name || player.school_name, body.position || player.position, body.notes || player.notes, player.id]);
      return ok({ player: rows[0] });
    }

    return fail(400, 'Unknown action.');
  } catch (error) {
    return fail(500, error.message || 'Unhandled server error.');
  }
};
