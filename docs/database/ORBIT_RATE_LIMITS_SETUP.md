# CobraLearn Orbit â€” Rate-Limiting Database Setup Guide

> **STATUS:** PREPARATION ONLY â€” This script and setup process have **NOT** been executed against any database.
> **Target Table:** `_orbit_rate_limits`
> **SQL Script:** [`orbit-rate-limits.sql`](./orbit-rate-limits.sql)
> **Target Database:** Supabase PostgreSQL (AWS `ap-south-1`)

---

## 1. Purpose of `_orbit_rate_limits`

The `_orbit_rate_limits` table provides atomic, persistent rate-limiting storage for administrative authentication flows in CobraLearn Orbit (including `/admin` login and password recovery).

Unlike standard application models managed through Prisma's declarative schema (`prisma/schema.prisma`), rate limiting uses atomic PostgreSQL upsert queries (`INSERT ... ON CONFLICT DO UPDATE`) directly against this table to enforce strict request budgets without race conditions between concurrent authentication requests.

---

## 2. Table Schema & Index Specification

The schema defined in [`orbit-rate-limits.sql`](./orbit-rate-limits.sql) matches the exact raw queries executed by [`src/lib/server/rate-limiter.ts`](../../src/lib/server/rate-limiter.ts):

| Column Name | Data Type | Nullable | Description |
| :--- | :--- | :---: | :--- |
| `key` | `VARCHAR(128)` | No (`PRIMARY KEY`) | Keyed HMAC SHA-256 hash representing the throttled bucket (e.g. `login:act:<hash>`, `login:ip:<hash>`, `login:global`, `recov:act:<hash>`, `recov:ip:<hash>`). Raw emails and raw IP addresses are never stored. |
| `count` | `INT` | No (`DEFAULT 1`) | Current number of attempts recorded within the active sliding time window. |
| `reset_at` | `TIMESTAMPTZ` | No | Timestamp when the active window resets and counter resets to 1. |

### Index
- **Index Name:** `_orbit_rate_limits_reset_at_idx`
- **Definition:** `CREATE INDEX IF NOT EXISTS "_orbit_rate_limits_reset_at_idx" ON "_orbit_rate_limits" ("reset_at");`
- **Purpose:** Optimizes both the atomic upsert queries checking `reset_at < NOW()` and the periodic background pruning query that deletes expired rows older than 1 hour.

---

## 3. Why the Table Must Exist Before Production Traffic

In development and local environments, [`src/lib/server/rate-limiter.ts`](../../src/lib/server/rate-limiter.ts) attempts to dynamically create this table via `ensurePostgresTable()` using `prisma.$executeRawUnsafe()`.

However, in a production environment:
1. **Transaction Pooling Constraints:** The production runtime connection (`DATABASE_URL`) connects through Supabase PgBouncer (port `6543`) in transaction pooling mode (`?pgbouncer=true`). DDL statements (`CREATE TABLE`, `CREATE INDEX`) can fail, emit transaction warnings, or be blocked by pooler configuration.
2. **Least-Privilege Database Roles:** Production database roles should operate under least privilege and may intentionally lack `CREATE TABLE` privileges in the `public` schema.
3. **Traffic Spikes at Startup:** If multiple concurrent requests hit the portal on a cold start before the table exists, all instances attempt concurrent table creation, causing lock contention or table initialization warnings.

Pre-creating the table ensures the database is fully initialized before any user traffic arrives.

---

## 4. Runtime DDL Failure and In-Memory Fallback

If `ensurePostgresTable()` or the atomic upsert query fails at runtime (e.g., if the table is absent and the connection cannot create it):
- The error is caught gracefully in [`rate-limiter.ts:252`](../../src/lib/server/rate-limiter.ts#L252).
- The system logs a sanitized warning: `[RateLimiter] Database rate limiting failed, engaging safe fallback`.
- The rate limiter immediately falls back to `consumeMemoryRateLimit()`.

---

## 5. Multi-Instance Risks of In-Memory Fallback

While the in-memory fallback prevents portal downtime, it introduces significant security limitations in a multi-instance or serverless deployment:
- **Process Isolation:** The memory store (`Map<string, MemoryBucket>`) is local to a single Node.js operating system process.
- **Diluted Thresholds:** If the portal is deployed with 3 horizontal instances or container replicas, an attacker's requests will be load-balanced across instances. Instead of being blocked after 5 failed login attempts, the attacker could attempt up to 15 times before all instances register threshold exhaustion.
- **Volatility on Restart:** Server restarts, blue-green deployments, or container recycling instantly wipe in-memory counters, resetting all active lockouts.

**Conclusion:** Persistent PostgreSQL storage via `_orbit_rate_limits` is mandatory for consistent, shared rate-limiting enforcement.

---

## 6. Required Database Privileges

### Verified Requirements
The application runtime connection (`DATABASE_URL`, port `6543`) executes the following operations against `_orbit_rate_limits`:
- `SELECT` (`"count"`, `"reset_at"`)
- `INSERT` (upserting new bucket rows)
- `UPDATE` (incrementing counters and advancing `reset_at`)
- `DELETE` (pruning expired rows older than 1 hour)

### Items Requiring Operational Confirmation
- **Runtime Role:** Determine the exact database user specified in `DATABASE_URL` (typically `postgres` or a custom application user in Supabase).
- **Explicit Grants:** In standard Supabase PostgreSQL setups where `DATABASE_URL` uses the project owner (`postgres`), table ownership provides full CRUD permissions automatically. If a restricted custom role is used, grant `SELECT, INSERT, UPDATE, DELETE` on `"_orbit_rate_limits"` to that role after creating the table. Do **not** grant broad DDL (`ALL PRIVILEGES` or schema modifications) to runtime roles.

---

## 7. Recommended Manual Setup Process

Execute the setup script **once** before deploying production application code:

1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard) and navigate to the CobraLearn production project (`AWS ap-south-1`).
2. Open the **SQL Editor** in the left navigation sidebar.
3. Click **New Query**.
4. Copy and paste the entire contents of [`docs/database/orbit-rate-limits.sql`](./orbit-rate-limits.sql).
5. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
6. Confirm the result returns: `Success. No rows returned`.

*(Alternatively, run the script via direct command line using `psql "$DIRECT_URL" -f docs/database/orbit-rate-limits.sql` from an authorized workstation).*

---

## 8. Verifying Table and Index Existence (Read-Only)

Run these read-only SQL queries in the Supabase SQL Editor to confirm the schema and index:

### Check Columns
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = '_orbit_rate_limits'
ORDER BY ordinal_position;
```
*Expected Result:*
- `key`: `character varying`, `NO`, `NULL`
- `count`: `integer`, `NO`, `1`
- `reset_at`: `timestamp with time zone`, `NO`, `NULL`

### Check Index
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = '_orbit_rate_limits';
```
*Expected Result:* Two indexes:
1. `_orbit_rate_limits_pkey` (PRIMARY KEY on `key`)
2. `_orbit_rate_limits_reset_at_idx` (`CREATE INDEX ... ON "_orbit_rate_limits" ("reset_at")`)

---

## 9. Verifying Application Access (Read-Only & Non-Destructive)

To confirm the application can read from the table without modifying production data:

```sql
SELECT COUNT(*) AS total_buckets FROM "_orbit_rate_limits";
```

In the application logs, monitor the first login attempt after deployment:
- Confirm there are **no** `[RateLimiter] Database rate limiting failed` warnings in stdout/stderr.
- A clean start confirms the application successfully queried or updated `_orbit_rate_limits`.

---

## 10. Investigating Failures Safely (Zero Credential Leakage)

If a rate-limiting database issue occurs:
1. **Sanitized Logging:** The application code is built to redact sensitive identifiers:
   - [`src/lib/server/rate-limiter.ts:254`](../../src/lib/server/rate-limiter.ts#L254) logs only `keyPrefix: key.slice(0, 8)` (e.g. `login:ac`), never printing the full HMAC hash, email, or IP address.
   - Database connection errors are normalized through `normalizeAuthError()` to generic 500 messages, preventing connection strings or passwords from appearing in API responses.
2. **Investigation Steps:**
   - Check Supabase Database Health & Connection Pooler metrics in the Supabase Dashboard.
   - Verify `DATABASE_URL` contains the pooler string (`aws-0-ap-south-1.pooler.supabase.com:6543`) with `?pgbouncer=true`.
   - Verify `_orbit_rate_limits` table exists in schema `public`.
   - Never print or dump `process.env["DATABASE_URL"]` to server logs.
