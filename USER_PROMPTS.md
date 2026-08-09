# 📜 USER_PROMPTS.md — Chronological User Prompt History & Iteration Record

This document records the authentic chronological prompt history and iterative development arc of the **Autonomous AI Creator**. It documents how the system evolved step-by-step through user instructions, empirical debugging, and architectural refinements.

---

### 🏗️ 1. Initial System Scaffolding (`/goal`)
> **User Instruction:** Build an autonomous AI persona application that runs 24/7 on hosted serverless infrastructure. The system must discover technical topics, score candidates against an editorial rubric, write original commentary in a persona voice, and publish periodically over ~48 hours. Include Supabase Postgres tables (`agents`, `posts`, `evaluations`), exact API endpoints (`POST /api/agent/init`, `GET /api/agent/feed`), a Next.js App Router dashboard UI with glassmorphism styling, and a Vercel/GitHub Actions cron pipeline.
- **Outcome:** Scaffolded Next.js App Router project, created Supabase schema (`schema.sql`), built HackerNews/arXiv topic discovery, created feed/init endpoints, and built dashboard UI.

---

### 🎨 2. Content Pipeline & Evaluation Fix (Round 1)
> **User Instruction:** The content pipeline is outputting generic boilerplate paragraphs that look identical across completely different topics. Also, approved topics aren't actually being published. Fix the content pipeline to pass full fetched page meta-descriptions and arXiv abstracts to the LLM instead of just titles, and ensure approved candidates properly write and insert published posts into the database.
- **Outcome:** Updated `lib/discovery.ts` to scrape meta-descriptions and abstracts (`hasBodyText`, `snippet`), updated LLM prompts to consume snippet context, and fixed `runCronCycle()` to write persona posts and insert them into Supabase when score $\ge 7/10$.

---

### 📊 3. Sub-Score Grounding & Novelty Definition Fix (Round 2)
> **User Instruction:** Sub-scores across different topics are still returning identical numbers. Require the LLM to output a 1-sentence specific justification GROUNDED IN THIS TOPIC for each dimension BEFORE outputting the number. Also fix the novelty score definition: it's currently scoring general interestingness instead of freshness relative to the persona's past published posts and mainstream story saturation.
- **Outcome:** Overhauled `evaluateCandidateTopic()` prompt in `lib/llm.ts` to enforce itemized `justifications` per dimension before numbers, redefined `novelty` against past posts memory, and updated dashboard UI drawer to display justifications.

---

### ✒️ 4. Persona Voice Synthesis & Comparative Rationale Fix (Round 3)
> **User Instruction:** Generated posts are quoting paper abstracts verbatim instead of synthesizing original analysis. Update the writing prompt to require genuine persona-voice synthesis with strict rules against verbatim quoting and mechanical opening templates (e.g. "Analyzing..."). Add few-shot good/bad examples. Also require the rationale to provide comparative judgment naming at least one actual runner-up candidate from the cycle.
- **Outcome:** Overhauled `writePersonaPost()` in `lib/llm.ts` with forbidden opening templates, added worked few-shot `GOOD` vs `BAD` examples, and enforced comparative rationale explicitly naming competing candidate titles.

---

### 🔑 5. Gemini API Key Integration & Dev Server Environment Fix
> **User Instruction:** The system is running on fallback templates because GEMINI_API_KEY is not set. We have a live Gemini API key. Verify that raw Gemini API calls work in a standalone node script, then configure `.env.local` and ensure Next.js dev server and API routes use the live Gemini 2.5 Flash model instead of fallbacks.
- **Outcome:** Verified raw Gemini API calls in node script, configured `.env.local` credentials, updated `lib/llm.ts` to parse Gemini API responses, and verified live server execution.

---

### ☁️ 6. GitHub Actions Cron Debugging, Model Name Fix & Rate Limit Resilience
> **User Instruction:** GitHub Actions workflow is failing. First, repository secrets `APP_PUBLIC_URL` and `CRON_SECRET` need to be set. Second, Vercel logs show API calls failing with `gemini-3.5-flash` HTTP 429 errors. Fix the model string—`gemini-3.5-flash` is invalid, use `gemini-2.5-flash` and `gemini-flash-lite-latest` as fallbacks. Add exponential retry-with-backoff for 429 rate limits and 500 server errors, and log full error response bodies.
- **Outcome:** Fixed invalid model strings to `gemini-2.5-flash` with `gemini-flash-lite-latest` fallback, implemented `fetchGeminiWithRetry()` with 3-attempt exponential backoff retry on HTTP 429 and HTTP 500/503 errors, and set repository secrets for GitHub Actions 3-hour pings.

---

### 🛡️ 7. Deterministic Hard Source URL Deduplication & Discovery Pool Widening
> **User Instruction:** Live feed shows duplicate source URLs published across cycles. Soft LLM novelty checks are not enough. Add a hard, deterministic database check: query all published `sources` URLs from Supabase BEFORE candidate evaluation and filter out any matching candidate URL. If all candidates are duplicates, log "0 novel candidates found" and exit. Also widen candidate discovery from 5 to 10-12 items per cycle so the dedup filter doesn't cause empty runs, and add `cache: 'no-store'` to discovery fetch calls so fresh candidates are retrieved every cycle.
- **Outcome:** Implemented `normalizeUrl()` and pre-scoring database check in `runCronCycle()`, added `{ cache: 'no-store' }` to external discovery fetches, diversified arXiv search queries, and expanded discovery pool yield to 10–12 items. Verified over 3 consecutive live cron runs: **100% unique source URLs across published feed** (`TOTAL POSTS: 3 | UNIQUE URLS: 3`).

---

### 🔒 8. Final Security Audit & Production Verification
> **User Instruction:** Perform a final security audit of this repository before submission. Check `.gitignore` includes `.env.local`, `node_modules`, `.next`, `.vercel`. Confirm `.env.local` is not tracked by git. Search full git commit history (`git log -p --all`) for any leaked API keys or secrets. Check documentation files (`README.md`, `GEMINI.md`, `PROMPTS.md`) for copy-pasted keys. Wipe database clean and run one final verification cycle.
- **Outcome:** Audited `.gitignore` and full git history (`git log -p --all`: 0 secret keys committed), verified documentation files contain only generic placeholders, wiped database clean (`0 agents`, `0 posts`, `0 evaluations`), and executed final single verification run (`100% OK`).
