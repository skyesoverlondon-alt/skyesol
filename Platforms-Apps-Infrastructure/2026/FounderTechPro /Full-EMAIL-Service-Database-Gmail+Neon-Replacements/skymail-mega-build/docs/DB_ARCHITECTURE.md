# Architecture

## Runtime shape

### 1. Netlify admin app

The admin app is now a **multi-tenant operator console**.

It supports:

- bootstrap token access for initial bring-up
- Netlify Identity login for real user accounts
- owner mode for super-admin operators
- customer mode for tenant org members

The dashboard never talks directly to PostgreSQL.

### 2. Cloudflare Worker control plane

The Worker is the only public API surface.

It now handles:

- auth sync
- platform user upsert
- org membership access checks
- org / project / environment management
- project API key creation
- database lifecycle queueing
- usage and audit reads

### 3. Hetzner PostgreSQL host

The Hetzner VM still runs one PostgreSQL cluster, but the control schema is now richer.

The same cluster holds:

- the `skyedb_control` metadata database
- tenant/customer project databases created by the platform

This keeps the MVP simple while preserving a clean upgrade path.

### 4. Hetzner runner

The runner still performs privileged work that Workers cannot safely do:

- create database + role
- branch clone using `CREATE DATABASE ... TEMPLATE ...`
- rotate password
- `pg_dump` backup
- `pg_restore` restore

The runner now also writes **usage events** after successful operations.

### 5. Cloudflare R2

R2 stores logical backup artifacts.

## Multi-tenant data model

Main control-plane tables:

- `platform_users`
- `orgs`
- `org_memberships`
- `plan_subscriptions`
- `projects`
- `environments`
- `database_instances`
- `project_api_keys`
- `jobs`
- `backups`
- `restores`
- `usage_events`
- `audit_events`

## Isolation model

This MVP uses **one PostgreSQL cluster** with **one database per managed workload**.

Each tenant workload gets:

- isolated database name
- isolated login role
- isolated password
- scoped control-plane metadata through org and project IDs

## Permission model

### Owner mode

Super-admin operators can see all orgs and all jobs.

### Customer mode

Regular users only see orgs where they have an active membership.

Membership roles:

- `member`
- `admin`
- `owner`

## Upgrade path

- move signup and tenant onboarding into a dedicated public site
- add billing and quota enforcement by plan subscription
- add API-key-authenticated customer provisioning endpoints
- split control-plane Postgres from tenant data cluster
- add PITR / WAL archive lane
- add pgBouncer / pooler lane
- replace template clone branching with snapshot-level branching later


## Billing lane notes

This pass keeps billing provider-agnostic. The system now records plans, customers, sessions, invoices, and subscription state using a manual provider flag so you can operate the platform immediately and wire a live processor later without redoing the schema.
