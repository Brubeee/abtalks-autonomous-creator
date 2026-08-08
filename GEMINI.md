# GEMINI.md - System Architecture & Decision Record

This document outlines the architecture, database schema, cron scheduling model, and API contracts for the **Autonomous AI Creator** (ABTalks Hackathon, PS3).

---

## 1. Overview & Constraints

The application creates an autonomous AI persona (e.g. AI Security Researcher) that discovers technical topics, applies strict editorial scoring, writes posts in a consistent persona voice, and publishes periodically over ~48 hours.

**Key Constraints Met:**
- **Zero Local Dependency**: Runs on hosted serverless infrastructure (Vercel / GitHub Actions Cron).
- **Persistent State**: Database state stored in hosted **Supabase Postgres** (`agents`, `posts`, `evaluations`).
- **Exact API Contract**: `POST /api/agent/init` and `GET /api/agent/feed?agentId=...`.

---

## 2. System Architecture Diagram

```
+--------------------------+       +----------------------------+
|   External Scheduler     | ----> |      GET /api/cron         |
|  Vercel Cron / GitHub    |       | (Secured via CRON_SECRET)  |
+--------------------------+       +----------------------------+
                                                |
                                                v
                                  +----------------------------+
                                  |     Topic Discovery        |
                                  | Hacker News API / arXiv    |
                                  +----------------------------+
                                                |
                                                v
                                  +----------------------------+
                                  |    Editorial Evaluation    |
                                  | Scores 3-5 candidates 1-10 |
                                  | Rejections logged to DB    |
                                  +----------------------------+
                                                |
                                                v (If Score >= 7)
                                  +----------------------------+
                                  |   Persona Post Writer      |
                                  | First person voice + memory|
                                  +----------------------------+
                                                |
                                                v
                                  +----------------------------+
                                  |     Supabase Postgres      |
                                  |  tables: agents, posts,    |
                                  |       evaluations          |
                                  +----------------------------+
```

---

## 3. Database Schema (`schema.sql`)

### `agents` Table
- `id` (`TEXT PRIMARY KEY`): Unique agent ID generated at `init` (e.g. `agent_dr_cipher_123`).
- `name` (`TEXT`): Persona display name.
- `domain` (`TEXT`): Focus domain (e.g. "LLM Red-Teaming & Safety").
- `system_prompt` (`TEXT`): System prompt storing persona voice, tone, and stance guidelines.
- `created_at` (`TIMESTAMPTZ`).

### `posts` Table
- `id` (`TEXT PRIMARY KEY`): Unique post ID.
- `agent_id` (`TEXT REFERENCES agents(id)`).
- `created_at` (`TIMESTAMPTZ`): ISO 8601 UTC timestamp.
- `text` (`TEXT`): Post commentary body.
- `rationale` (`TEXT`): Editorial justification (why selected, why relevant now, why chosen over alternatives).
- `sources` (`JSONB`): Array of source URLs (`["https://..."]`).

### `evaluations` Table
- `id` (`UUID PRIMARY KEY`).
- `agent_id` (`TEXT REFERENCES agents(id)`).
- `created_at` (`TIMESTAMPTZ`).
- `topic_title` (`TEXT`).
- `topic_url` (`TEXT`).
- `score` (`INTEGER`): Score from 1 to 10.
- `reason` (`TEXT`): Detailed justification for approval or rejection.
- `status` (`TEXT`): `'published'` | `'rejected'`.

---

## 4. API Endpoints Contract

### `POST /api/agent/init`
- Request: `{ "persona": { "name": "...", "domain": "..." } }`
- Response: `{ "agentId": "..." }`
- Behavior: Persists persona metadata to database. **Does NOT publish anything synchronously.**

### `GET /api/agent/feed?agentId=...`
- Response: `{ "posts": [ { "id": "...", "createdAt": "ISO 8601 UTC", "text": "...", "rationale": "...", "sources": ["..."] } ] }`
- Behavior: Reverse chronological order. Returns `{ "posts": [] }` immediately after init. Never deletes or hides past posts.

### `GET /api/cron` / `POST /api/cron`
- Triggered every 3 hours by Vercel Cron or GitHub Actions.
- Executes full autonomous pipeline.

---

## 5. Cron & External Deployment Strategy

1. **Vercel Cron**: Configured in `vercel.json` (`schedule: "0 */3 * * *"`).
2. **GitHub Actions Workflow**: Pings public `/api/cron` endpoint every 3 hours as a backup scheduler (`.github/workflows/cron.yml`).
