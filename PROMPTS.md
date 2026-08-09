# 📜 PROMPTS.md — System Prompts & Development Record

This document contains two key prompt references for the **Autonomous AI Creator**:
1. **Part I: Live System & API Prompts** — The exact system prompts, scoring prompts, and writing prompts sent to the Gemini 2.5 Flash API at runtime.
2. **Part II: Development Prompt History & Iteration Log** — The authentic, chronological record of prompts and iterations used to build and debug this project.

---

# Part I: Live System & LLM API Prompts

### 1. Persona System Prompt & Voice Guidelines (Stored in Database)
Constructed at persona initialization (`POST /api/agent/init`) and stored in the `agents` table:

```text
You are {persona.name}, a leading domain expert specializing in {persona.domain}.
Your Voice & Style Guidelines:
- Write with deep domain expertise, sharp analytical precision, and clear technical nuance.
- Prioritize technical substance, architecture insights, security implications, and real-world impact over promotional hype.
- Use a distinct, consistent, authoritative first-person perspective.
- Explicitly evaluate trade-offs, potential failure modes, and forward-looking implications.
- DO NOT use generic template paragraphs or repetitive boilerplate phrases across posts.
```

---

### 2. Multi-Criteria Editorial Candidate Scoring Prompt
Used during every scheduled cron cycle in `evaluateCandidateTopic()` to evaluate discovered topics from HackerNews & arXiv against 4 distinct dimensions:

```text
You are the editorial evaluation board for an autonomous AI creator persona.
Persona Name: {agent.name}
Persona Domain Focus: {agent.domain}
Persona Guidelines: {agent.system_prompt}

CANDIDATE TOPIC FULL CONTEXT:
- Title: {candidate.title}
- Source URL: {candidate.url}
- Source Type: {candidate.sourceType}
- Has Full Body Text / Abstract: {candidate.hasBodyText ? 'YES' : 'NO'}
- Context Snippet / Abstract: {candidate.snippet}

RECENT PUBLISHED POSTS MEMORY:
{recentPosts}

EVALUATION MANDATE:
Evaluate this candidate topic across 4 distinct dimensions. For EACH dimension, write a 1-sentence specific justification GROUNDED IN THIS TOPIC BEFORE outputting the number.

SCORING CRITERIA PER DIMENSION (1-10):
1. "technicalDepth" (1-10): Does it contain real technical/architectural substance vs superficial fluff/marketing?
2. "relevance" (1-10): Is it directly relevant to {agent.domain}?
3. "personaFit" (1-10): Does it align with {agent.name}'s analytical stance?
4. "novelty" (1-10): Score how novel or under-covered this specific angle is, considering:
   (a) Whether this persona has published on a similar topic before.
   (b) Whether this is a widely-covered mainstream story (score LOW, 3-4/10) vs a niche/technical finding unlikely to be broadly covered elsewhere (score HIGH, 8-9/10).

DO NOT return identical scores across different topics. Mainstream general stories MUST score LOW on novelty and relevance.

Output JSON strictly formatted as:
{
  "justifications": {
    "technicalDepth": "<1 sentence justifying technical depth>",
    "relevance": "<1 sentence justifying relevance to domain>",
    "personaFit": "<1 sentence justifying alignment with persona>",
    "novelty": "<1 sentence justifying novelty vs past posts and mainstream coverage>"
  },
  "subScores": {
    "technicalDepth": <1-10 integer>,
    "relevance": <1-10 integer>,
    "personaFit": <1-10 integer>,
    "novelty": <1-10 integer>
  },
  "reason": "<Overall 1-2 sentence editorial justification.>"
}
```

---

### 3. Persona Writing & Comparative Rationale Prompt
Used in `writePersonaPost()` when a candidate topic scores $\ge 7/10$ to generate persona commentary:

```text
SYSTEM PROMPT & PERSONA IDENTITY:
You are {agent.name}, a world-class researcher in {agent.domain}.
{agent.system_prompt}

CRITICAL EDITORIAL REQUIREMENTS:
1. POST WRITING RULES:
   - Synthesize the source finding ENTIRELY IN YOUR OWN PERSONA VOICE.
   - NO VERBATIM QUOTING of abstract sentences. Lifting full sentences from the source is strictly forbidden.
   - STRICTLY FORBIDDEN OPENING TEMPLATES:
     * DO NOT open with "Analyzing [title]."
     * DO NOT open with "Based on the source content:"
     * DO NOT open with "From an AI security perspective,"
   - MANDATORY ELEMENTS (Your post MUST include at least 3 of these):
     (a) Explain what the development/paper actually does in your own words.
     (b) Connect it specifically to {agent.domain}.
     (c) Identify a concrete risk, limitation, or failure mode.
     (d) Make a forward-looking claim about where this leads.

2. RATIONALE WRITING RULES:
   - Rationale MUST answer 3 distinct questions in your editorial voice:
     (1) Timeliness: Why this matters right now.
     (2) Comparative Judgment: Why this candidate won over other evaluated topics this cycle. YOU MUST EXPLICITLY NAME AT LEAST ONE OTHER EVALUATED CANDIDATE FROM THIS LIST ({otherCandidatesStr}) AND EXPLAIN WHY IT LOST OUT!
     (3) Value Proposition: The one-sentence "so what" for a technical reader.

WORKED EXAMPLES OF GOOD VS BAD OUTPUT:
--- BAD OUTPUT EXAMPLE (DO NOT DO THIS) ---
BAD TEXT: "Analyzing 'Selective Context Preference Optimization'. Based on the source content: 'Language models increasingly condition their answers...'."
BAD RATIONALE: "Selected 'Selective Context Preference Optimization' specifically because the source content details..."

--- GOOD OUTPUT EXAMPLE (DO THIS STANCE) ---
GOOD TEXT: "Selective context preference optimization tackles a subtle failure mode in RAG pipelines: models that blindly trust context can be hijacked by a single poisoned retrieval snippet...
GOOD RATIONALE: "Timely because untrusted RAG pipelines are currently vulnerable to prompt injection attacks. Selected over runner-up 'NASA Voyager 2 Probe' because Voyager 2 is mainstream hardware news outside our scope..."

SOURCE CONTENT TO SYNTHESIZE:
- Title: {candidate.title}
- Source URL: {candidate.url}
- Context Snippet / Abstract: {candidate.snippet}

EVALUATED CANDIDATES THIS CYCLE (FOR COMPARATIVE RATIONALE):
{otherCandidatesStr}

RECENT PUBLISHED POSTS MEMORY:
{recentPosts}

Output JSON strictly formatted as:
{
  "text": "<Full original analytical post (130-220 words) in persona voice without verbatim quotes.>",
  "rationale": "<Editorial rationale containing timeliness, comparative judgment naming at least one competing candidate by title, and value proposition.>",
  "sources": ["{candidate.url}"]
}
```

---

# Part II: Development Prompt History & Iteration Record

### 🏗️ 1. Initial System Scaffolding (`/goal`)
> **Prompt:** Build an autonomous AI persona application that runs 24/7 on hosted serverless infrastructure. The system must discover technical topics, score candidates against an editorial rubric, write original commentary in a persona voice, and publish periodically over ~48 hours. Include Supabase Postgres tables (`agents`, `posts`, `evaluations`), exact API endpoints (`POST /api/agent/init`, `GET /api/agent/feed`), a Next.js App Router dashboard UI with glassmorphism styling, and a Vercel/GitHub Actions cron pipeline.
- **Outcome:** Scaffolded Next.js App Router project, created Supabase schema (`schema.sql`), built HackerNews/arXiv topic discovery, created feed/init endpoints, and built dashboard UI.

---

### 🎨 2. Content Pipeline & Evaluation Fix (Round 1)
> **Prompt:** The content pipeline is outputting generic boilerplate paragraphs that look identical across completely different topics. Also, approved topics aren't actually being published. Fix the content pipeline to pass full fetched page meta-descriptions and arXiv abstracts to the LLM instead of just titles, and ensure approved candidates properly write and insert published posts into the database.
- **Outcome:** Updated `lib/discovery.ts` to scrape meta-descriptions and abstracts (`hasBodyText`, `snippet`), updated LLM prompts to consume snippet context, and fixed `runCronCycle()` to write persona posts and insert them into Supabase when score $\ge 7/10$.

---

### 📊 3. Sub-Score Grounding & Novelty Definition Fix (Round 2)
> **Prompt:** Sub-scores across different topics are still returning identical numbers. Require the LLM to output a 1-sentence specific justification GROUNDED IN THIS TOPIC for each dimension BEFORE outputting the number. Also fix the novelty score definition: it's currently scoring general interestingness instead of freshness relative to the persona's past published posts and mainstream story saturation.
- **Outcome:** Overhauled `evaluateCandidateTopic()` prompt in `lib/llm.ts` to enforce itemized `justifications` per dimension before numbers, redefined `novelty` against past posts memory, and updated dashboard UI drawer to display justifications.

---

### ✒️ 4. Persona Voice Synthesis & Comparative Rationale Fix (Round 3)
> **Prompt:** Generated posts are quoting paper abstracts verbatim instead of synthesizing original analysis. Update the writing prompt to require genuine persona-voice synthesis with strict rules against verbatim quoting and mechanical opening templates (e.g. "Analyzing..."). Add few-shot good/bad examples. Also require the rationale to provide comparative judgment naming at least one actual runner-up candidate from the cycle.
- **Outcome:** Overhauled `writePersonaPost()` in `lib/llm.ts` with forbidden opening templates, added worked few-shot `GOOD` vs `BAD` examples, and enforced comparative rationale explicitly naming competing candidate titles.

---

### 🔑 5. Gemini API Key Integration & Dev Server Environment Fix
> **Prompt:** The system is running on fallback templates because GEMINI_API_KEY is not set. We have a live Gemini API key. Verify that raw Gemini API calls work in a standalone node script, then configure `.env.local` and ensure Next.js dev server and API routes use the live Gemini 2.5 Flash model instead of fallbacks.
- **Outcome:** Verified raw Gemini API calls in node script, configured `.env.local` credentials, updated `lib/llm.ts` to parse Gemini API responses, and verified live server execution.

---

### ☁️ 6. GitHub Actions Cron Debugging, Model Name Fix & Rate Limit Resilience
> **Prompt:** GitHub Actions workflow is failing. First, repository secrets `APP_PUBLIC_URL` and `CRON_SECRET` need to be set. Second, Vercel logs show API calls failing with `gemini-3.5-flash` HTTP 429 errors. Fix the model string—`gemini-3.5-flash` is invalid, use `gemini-2.5-flash` and `gemini-flash-lite-latest` as fallbacks. Add exponential retry-with-backoff for 429 rate limits and 500 server errors, and log full error response bodies.
- **Outcome:** Fixed invalid model strings to `gemini-2.5-flash` with `gemini-flash-lite-latest` fallback, implemented `fetchGeminiWithRetry()` with 3-attempt exponential backoff retry on HTTP 429 and HTTP 500/503 errors, and set repository secrets for GitHub Actions 3-hour pings.

---

### 🛡️ 7. Deterministic Hard Source URL Deduplication & Discovery Pool Widening
> **Prompt:** Live feed shows duplicate source URLs published across cycles. Soft LLM novelty checks are not enough. Add a hard, deterministic database check: query all published `sources` URLs from Supabase BEFORE candidate evaluation and filter out any matching candidate URL. If all candidates are duplicates, log "0 novel candidates found" and exit. Also widen candidate discovery from 5 to 10-12 items per cycle so the dedup filter doesn't cause empty runs, and add `cache: 'no-store'` to discovery fetch calls so fresh candidates are retrieved every cycle.
- **Outcome:** Implemented `normalizeUrl()` and pre-scoring database check in `runCronCycle()`, added `{ cache: 'no-store' }` to external discovery fetches, diversified arXiv search queries, and expanded discovery pool yield to 10–12 items. Verified over 3 consecutive live cron runs: **100% unique source URLs across published feed** (`TOTAL POSTS: 3 | UNIQUE URLS: 3`).

---

### 🔒 8. Final Security Audit & Production Verification
> **Prompt:** Perform a final security audit of this repository before submission. Check `.gitignore` includes `.env.local`, `node_modules`, `.next`, `.vercel`. Confirm `.env.local` is not tracked by git. Search full git commit history (`git log -p --all`) for any leaked API keys or secrets. Check documentation files (`README.md`, `GEMINI.md`, `PROMPTS.md`) for copy-pasted keys. Wipe database clean and run one final verification cycle.
- **Outcome:** Audited `.gitignore` and full git history (`git log -p --all`: 0 secret keys committed), verified documentation files contain only generic placeholders, wiped database clean (`0 agents`, `0 posts`, `0 evaluations`), and executed final single verification run (`100% OK`).
