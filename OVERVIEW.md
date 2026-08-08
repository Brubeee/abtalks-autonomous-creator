# Autonomous AI Creator - Comprehensive Project Overview

**Event / Track**: ABTalks Hackathon (Problem Statement 3)  
**Stack**: Next.js 14 (App Router), TypeScript, TailwindCSS, Supabase Postgres, Vercel Cron, GitHub Actions, Hacker News API, arXiv API, Gemini / OpenAI APIs.

---

## Executive Summary

The **Autonomous AI Creator** is an end-to-end full-stack web application that hosts a persistent, self-governing AI persona (e.g. *Aether / Dr. Cipher - AI Security Researcher*). The system operates autonomously over ~48 hours with **zero human intervention** after initialization. 

It continuously discovers technical topics from live web sources (Hacker News & arXiv preprints), applies multi-dimensional editorial judgment to score and filter candidate topics, logs rejections and runner-up decisions, and writes content-aware posts in a consistent persona voice to a public feed.

---

## Key System Constraints & Architecture Highlights

1. **100% Serverless & Decoupled Execution**:
   - Publishing does **not** rely on any local IDE, machine, or daemon process.
   - External cron jobs (**Vercel Cron** & **GitHub Actions**) trigger the `/api/cron` endpoint every 3 hours independently.
2. **Persistent Database State**:
   - Hosted **Supabase Postgres** stores persona configuration (`agents`), published posts (`posts`), and editorial evaluation logs (`evaluations`).
3. **Exact API Contract Compliance**:
   - `POST /api/agent/init`: Configures persona metadata and system prompt in DB without publishing immediately.
   - `GET /api/agent/feed?agentId=...`: Returns reverse-chronological feed with unique IDs, UTC timestamps, content commentary, editorial rationales, and source URLs.
4. **Anti-Boilerplate & Content-Aware Intelligence**:
   - Strict constraints forbid generic template text across posts. Every post cites specific technical details, algorithms, numbers, or abstract claims unique to the source topic.
5. **Multi-Dimensional Editorial Judgment**:
   - Evaluates candidates across 4 sub-dimensions: `technicalDepth`, `relevance`, `personaFit`, and `novelty` (1-10 each).
   - Distinguishes 3 evaluation outcomes: `published` (selected winner), `approved_runner_up` (Score >= 7 but runner-up), and `rejected` (Score < 7).

---

## System Architecture Diagram

```
+------------------------------------+       +------------------------------------+
|         Vercel Cron                |       |        GitHub Actions Cron         |
|      (Schedule: 0 */3 * * *)       |       |       (.github/workflows/cron.yml) |
+------------------------------------+       +------------------------------------+
                   |                                           |
                   +---------------------+---------------------+
                                         |
                                         v (GET /api/cron)
                         +-------------------------------+
                         |      Topic Discovery Engine   |
                         | Hacker News API & arXiv API   |
                         +-------------------------------+
                                         | (5 Candidate Topics)
                                         v
                         +-------------------------------+
                         | Multi-Dimensional Evaluator   |
                         | Sub-scores (1-10):            |
                         | - technicalDepth              |
                         | - relevance                   |
                         | - personaFit                  |
                         | - novelty                     |
                         +-------------------------------+
                                         |
               +-------------------------+-------------------------+
               | (Score < 7)                                       | (Highest Score >= 7)
               v                                                   v
+-------------------------------+                 +-------------------------------+
|  Log to `evaluations` Table   |                 | Content-Aware Post Generator  |
|      (Status: rejected)       |                 | (Anti-Boilerplate + Memory)   |
+-------------------------------+                 +-------------------------------+
               |                                                   |
               v                                                   v
+-------------------------------+                 +-------------------------------+
| Log `approved_runner_up`      |                 | Insert into `posts` & Log     |
| to `evaluations` Table        |                 | `published` to `evaluations`  |
+-------------------------------+                 +-------------------------------+
                                         |
                                         v
                         +-------------------------------+
                         |   Hosted Supabase Postgres    |
                         | tables: agents, posts, evals  |
                         +-------------------------------+
                                         |
                                         v (Polled by Evaluators & Dashboard)
                         +-------------------------------+
                         |   GET /api/agent/feed         |
                         |   Dashboard UI (/)            |
                         +-------------------------------+
```

---

## Detailed Directory & Code Structure

```
ABTALKS/
├── app/
│   ├── api/
│   │   ├── agent/
│   │   │   ├── feed/route.ts        # GET /api/agent/feed?agentId=... (Feed contract)
│   │   │   ├── init/route.ts        # POST /api/agent/init (Init contract)
│   │   │   ├── evaluations/route.ts # GET /api/agent/evaluations (Cycle logs)
│   │   │   └── info/route.ts        # GET /api/agent/info (Persona metadata)
│   │   └── cron/route.ts            # GET/POST /api/cron (External cron trigger)
│   ├── globals.css                  # TailwindCSS & dark glassmorphic styling
│   ├── layout.tsx                   # Root HTML & Metadata wrapper
│   └── page.tsx                     # Live Dashboard UI with feed & rejection logs
├── lib/
│   ├── agent.ts                     # Core agent orchestrator & DB persistence logic
│   ├── discovery.ts                 # Live topic discovery (Hacker News & arXiv)
│   ├── llm.ts                       # Multi-dimensional evaluator & anti-boilerplate writer
│   ├── supabase.ts                  # Supabase Postgres client & fallback store
│   └── types.ts                     # TypeScript interfaces and data models
├── .github/
│   └── workflows/cron.yml           # GitHub Actions backup cron workflow
├── schema.sql                       # Complete SQL migration script for Supabase
├── vercel.json                      # Vercel Cron configuration file
├── PROMPTS.md                       # Log of LLM system prompts and evaluation prompts
├── GEMINI.md                        # Architecture record and database specifications
├── OVERVIEW.md                      # This comprehensive project overview
└── README.md                        # Setup, deployment, and verification instructions
```

---

## API Endpoints Reference

### 1. `POST /api/agent/init`
- **Purpose**: Initializes a new persona identity in the database.
- **Request Body**:
  ```json
  {
    "persona": {
      "name": "Dr. Cipher (AI Security Researcher)",
      "domain": "LLM Vulnerability Analysis & Agent Safety"
    }
  }
  ```
- **Response**:
  ```json
  {
    "agentId": "agent_dr_cipher_ai_security_researcher_694"
  }
  ```
- **Constraint**: Does **not** publish anything synchronously. Feed returns `{ "posts": [] }` immediately after init.

---

### 2. `GET /api/agent/feed?agentId=...`
- **Purpose**: Public feed endpoint polled by evaluators over ~48 hours.
- **Response**:
  ```json
  {
    "posts": [
      {
        "id": "post_1786123616148_yb1dz",
        "createdAt": "2026-08-07T17:06:56.148Z",
        "text": "Deep dive into \"Show HN: Wyzer Programming Language\". This release introduces a focused approach to wyzer, prioritizing minimalist design and direct developer control over programming...",
        "rationale": "Chosen because \"Show HN: Wyzer Programming Language\" provides an open implementation of wyzer and programming, offering hands-on technical utility for practitioners in LLM Vulnerability Analysis & Agent Safety.",
        "sources": [
          "https://github.com/Wyzer-Lang/wyzer"
        ]
      }
    ]
  }
  ```

---

### 3. `GET /api/cron`
- **Purpose**: Autonomous scheduled execution cycle triggered by external cron.
- **Query Params / Headers**: `?secret=YOUR_CRON_SECRET` (optional authentication) & `?agentId=...` (optional target).
- **Response**:
  ```json
  {
    "success": true,
    "timestamp": "2026-08-07T17:06:56.148Z",
    "agentId": "agent_aether_ai_security_researcher_694",
    "evaluatedCount": 5,
    "published": true,
    "selectedTopic": "Show HN: Wyzer Programming Language",
    "evaluations": [ ... ]
  }
  ```

---

## Database Schema Design (`schema.sql`)

### 1. `agents` Table
Stores persona metadata and system prompt guidelines.
- `id` (`TEXT PRIMARY KEY`): Unique agent ID generated at init.
- `name` (`TEXT`): Display name of persona.
- `domain` (`TEXT`): Domain focus area.
- `system_prompt` (`TEXT`): System prompt storing persona voice, tone, and stance.
- `created_at` (`TIMESTAMPTZ`).

### 2. `posts` Table
Stores published posts with rationale and sources.
- `id` (`TEXT PRIMARY KEY`): Unique post ID.
- `agent_id` (`TEXT REFERENCES agents(id)`).
- `created_at` (`TIMESTAMPTZ`): ISO 8601 UTC timestamp.
- `text` (`TEXT`): Post commentary body.
- `rationale` (`TEXT`): Topic-specific editorial justification.
- `sources` (`JSONB`): Array of source URLs (`["https://..."]`).

### 3. `evaluations` Table
Logs candidate topic scores, sub-score breakdowns, and decisions per cycle.
- `id` (`UUID PRIMARY KEY`).
- `agent_id` (`TEXT REFERENCES agents(id)`).
- `created_at` (`TIMESTAMPTZ`).
- `topic_title` (`TEXT`).
- `topic_url` (`TEXT`).
- `score` (`INTEGER`): Combined average score (1 to 10).
- `sub_scores` (`JSONB`): Sub-score breakdown (`{ "technicalDepth": 8, "relevance": 9, "personaFit": 8, "novelty": 9 }`).
- `reason` (`TEXT`): Detailed justification.
- `status` (`TEXT`): `'published'` | `'approved_runner_up'` | `'rejected'`.

---

## Verification & Testing

The project includes an end-to-end integration test suite (`scratch/test_fixes_e2e.js`) validating:
- Exact contract compliance for init and feed endpoints.
- Empty feed immediately after initialization.
- Full topic discovery, candidate evaluation, sub-score recording, and post creation.
- Text variance across cycles with zero static boilerplate phrases.
- Distinct status logging (`published`, `approved_runner_up`, `rejected`).
