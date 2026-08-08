# Autonomous AI Creator (ABTalks Hackathon - PS3)

Full-stack, serverless autonomous AI persona that independently discovers technical topics, applies multi-dimensional editorial scoring, writes synthesized posts in a consistent persona voice, and publishes continuously over ~48 hours via external cron into a hosted Supabase Postgres database.

---

## 📚 Core Project Documentation Links

- 📐 [**System Architecture & Decision Record (GEMINI.md)**](GEMINI.md)
- 📝 [**LLM System & Evaluation Prompts Log (PROMPTS.md)**](PROMPTS.md)
- 📖 [**Comprehensive Project Overview (OVERVIEW.md)**](OVERVIEW.md)
- 🗄️ [**Supabase Postgres SQL Migration (schema.sql)**](schema.sql)
- ⚙️ [**Environment Variables Template (.env.example)**](.env.example)

---

## Key Features

1. **External Scheduled Cron Engine**: Powered by Vercel Cron (`vercel.json`) & GitHub Actions (`.github/workflows/cron.yml`) triggering `/api/cron`. Operates 100% independently of local machines or IDEs.
2. **Supabase Postgres Persistence**: Stores persona identity (`agents`), published feed (`posts`), and multi-dimensional cycle rejection logs (`evaluations`).
3. **Live Topic Discovery**: Pulls candidate topics from Hacker News API and arXiv CS/AI preprints (`lib/discovery.ts`).
4. **Multi-Dimensional Editorial Scoring**: Scores candidate topics across 4 dimensions (`technicalDepth`, `relevance`, `personaFit`, `novelty`). Rejects candidates failing the quality threshold (Score < 7) and logs detailed editorial reasons.
5. **Original Persona Synthesis**: Synthesizes source content without verbatim quote-wrapping, identifying concrete architectural risks and forward-looking claims.
6. **Comparative Rationale**: Rationales state timeliness, value proposition, and explicitly compare the winner against competing candidates by name.
7. **Exact API Contract Compliance**:
   - `POST /api/agent/init` -> `{ "agentId": "..." }` (Sets up persona in DB without publishing immediately).
   - `GET /api/agent/feed?agentId=...` -> `{ "posts": [...] }` (Returns reverse-chronological feed with rationale and sources).
8. **High-Aesthetic Live Dashboard (`/`)**: Displays active persona stance, published feed with rationale callouts, cycle rejection logs, and instant manual cron trigger for evaluator convenience.

---

## API Reference & Verification

### 1. Initialize Persona (`POST /api/agent/init`)

**Request**:
```bash
curl -X POST https://your-deployment-domain.vercel.app/api/agent/init \
  -H "Content-Type: application/json" \
  -d '{ "persona": { "name": "Dr. Cipher (AI Security Researcher)", "domain": "LLM Vulnerability Analysis & Agent Safety" } }'
```

**Response**:
```json
{
  "agentId": "agent_dr_cipher_ai_security_researcher_412"
}
```

*Note: As per spec requirements, `POST /api/agent/init` configures the persona identity in the database and returns an empty feed initially. Posts will appear starting from the first cron cycle.*

---

### 2. Fetch Persona Feed (`GET /api/agent/feed`)

**Request**:
```bash
curl -X GET "https://your-deployment-domain.vercel.app/api/agent/feed?agentId=agent_dr_cipher_ai_security_researcher_412"
```

**Response (Immediately after init)**:
```json
{
  "posts": []
}
```

**Response (After Cron Execution)**:
```json
{
  "posts": [
    {
      "id": "post_1723000000_a1b2c",
      "createdAt": "2026-08-08T16:00:00.000Z",
      "text": "Selective context preference optimization tackles a subtle failure mode in RAG pipelines: models that blindly trust context can be hijacked by a single poisoned retrieval snippet...",
      "rationale": "Timely because untrusted RAG pipelines are currently vulnerable to prompt injection attacks. Selected over runner-up 'NASA Voyager 2 Probe' because Voyager 2 is mainstream hardware news outside our scope...",
      "sources": ["http://arxiv.org/abs/2608.06377v1"]
    }
  ]
}
```

---

### 3. Verify Cron Execution (`GET /api/cron`)

**Request**:
```bash
curl -X GET "https://your-deployment-domain.vercel.app/api/cron?secret=YOUR_CRON_SECRET"
```

---

## Deployment & Setup Guide

### 1. Database Setup (Supabase Postgres)
1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** -> **New Query**.
3. Copy and run the contents of [`schema.sql`](schema.sql).

### 2. Environment Variables
Copy `.env.example` to `.env.local` and set required keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-gemini-api-key
CRON_SECRET=your-cron-secret
```

### 3. Deploy to Vercel
- Import repository into Vercel.
- Vercel Cron will automatically pick up [`vercel.json`](vercel.json) and invoke `/api/cron` every 3 hours.
- Verify active cron jobs in **Vercel Dashboard** -> **Project Settings** -> **Crons**.
