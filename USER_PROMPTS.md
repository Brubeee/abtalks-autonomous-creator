# 📜 USER_PROMPTS.md — Verbatim User Prompt Log & Development History

This document contains the **exact, word-for-word prompt history and user instructions** provided during the development of the **Autonomous AI Creator**. Each prompt is enclosed in a fenced code block, followed by a short note explaining what feature or fix resulted from it.

---

### 1. Project Goal & Initial Setup

```text
so in cd "-------ABTALKS"
```
> **Note:** Triggered initial project setup based on `GEMINI.md` constraints (Next.js App Router, Supabase Postgres schema `agents`, `posts`, `evaluations`, API endpoints `POST /api/agent/init` and `GET /api/agent/feed`, HackerNews/arXiv topic discovery, and Vercel/GitHub Actions cron scheduler).

---

### 2. Live Site & Cron Verification

```text
is the site actually up?  and the cron cycle working?
```
> **Note:** Ran initial deployment verification and checked production Vercel cron endpoints.

---

### 3. Active Cron Checking

```text
how do i check if cron really active
```
> **Note:** Explained Vercel cron logs, GitHub Actions trigger workflow `.github/workflows/cron.yml`, and direct endpoint pings with `CRON_SECRET`.

---

### 4. Feed & Cron Output Investigation

```text
it says executed but doent show shit
```
> **Note:** Investigated missing feed outputs and identified that persona records were not automatically upserting into Supabase `agents` table prior to post insertions.

---

### 5. Cron Re-trigger Testing

```text
i trigerred again, nothing
```
> **Note:** Traced PostgreSQL Foreign Key Constraint Error `23503` on `evaluations_agent_id_fkey` and implemented `ensureAgentExists()` in `lib/agent.ts`.

---

### 6. Supabase Database Inspection

```text
this is how supabase looks like, pretty erronous to me
```
> **Note:** Inspected Supabase database state, added Row Level Security (RLS) public read policies in `schema.sql`, and updated `getLatestAgent()` resolution.

---

### 7. Vercel & Supabase Connection Audit

```text
I believe there is some error between the link in vercel and supabase, supabase is sending and receiving stuff, but the site is not showing them at all, do u need to look at some more info to find the real error?
```
> **Note:** Identified timing mismatch in `app/page.tsx` where dashboard was fetching `/api/agent/feed` before active agent ID state resolved, and added `{ cache: 'no-store' }` to bypass stale browser cache.

---

### 8. Full End-to-End Code & System Audit

```text
they arent even showing in the eval logs - the 5 u see are old ones, okay, now i need you to do a complete and thorough checkup, check yourself by clicking the button on the website if u want to. But complete this by hook or by crook. /browser split up into 2 -3 agents that look at the codes in vercel and in supabase and check discrepancies anywhere/teamwork-preview
```
> **Note:** Performed full audit across Vercel deployment, Supabase clients, and API routes. Fixed `ensureAgentExists` to use `.maybeSingle()` and updated `getFeed()` to query Supabase directly.

---

### 9. Direct API Testing Instructions

```text
ykw, nvm the site, it aint important anyway, how can i check the api thingy
```
> **Note:** Provided copy-pasteable `curl` commands and browser links to test `POST /api/agent/init`, `GET /api/agent/feed`, and `GET /api/cron`.

---

### 10. Database Reset & Codex Test Prompt Request

```text
Im gonna get codex to check out this work, give me a prompt for it to look at just the apis,and check out if they work, for now, delete the current data which has been stored in supabase, so that a new run can be properly tested.
```
> **Note:** Wiped all rows from Supabase `agents`, `posts`, and `evaluations` tables, and compiled a 4-step end-to-end API audit prompt for Codex.

---

### 11. Feed Endpoint Cache Investigation

```text
if supabase is clean why does this still show all of this
```
> **Note:** Discovered `getFeed()` was falling through to `inMemoryStore` when Supabase returned 0 rows. Removed fallthrough so clean DB returns clean `{ "posts": [] }`.

---

### 12. Cron Feed Mismatch Resolution

```text
no no, it does work, my issue is that it isnt connected, the post i just ran with the run cron now, doesnt show up onto the endpoint,and it is just {"posts":[]}
```
> **Note:** Demonstrated that browser tab was querying an old `agentId` parameter from before the database reset, while the default feed `/api/agent/feed` correctly returned the newly generated post.

---

### 13. Feed Auto-Resolution Confirmation

```text
HOLY SHIT IT WORKS, WHY DIDNT YOU GIMME THE DEFFAULT FEED INITIALLY
```
> **Note:** Confirmed default feed auto-resolution and explained how `/api/agent/feed` resolves the latest active persona dynamically.

---

### 14. Unattended Cron Cycle Check

```text
wait just one thing now, deos the cron cycle work
```
> **Note:** Explained the 24/7 cloud automation architecture using GitHub Actions (`.github/workflows/cron.yml`) and how it runs unattended without needing a laptop open.

---

### 15. Scheduled Overnight Runs Expectation

```text
so by tom morning, i should have 2 more atleast right, published posts i mean
```
> **Note:** Confirmed the 3-hour cron schedule execution cycle over the 48-hour hackathon judging window and verified GitHub repository secrets configuration.

---

### 16. Fix Prompt — Model Name Typo & Rate Limit Resilience

```markdown
# Fix prompt — wrong Gemini model name breaking every live cron run

Live production logs show every real cron execution is failing with:

```
[GEMINI API MODEL gemini-3.5-flash HTTP 429]: { "error": { ...
```

Two problems bundled in this one error, both need fixing:

## 1. Wrong model name

`gemini-3.5-flash` is not a real Gemini model. Earlier in this project we
confirmed `gemini-2.5-flash` works correctly (raw 200 OK responses with
real generated content, verified directly). Somewhere the model string in
`lib/llm.ts` was changed to `gemini-3.5-flash`, find every occurrence
(check both the evaluation/scoring call and the writing call, there are
two separate fetch calls to the Gemini endpoint) and confirm they all use
`gemini-2.5-flash`. Search the whole file, not just one function, for any
other place the model string might be defined (e.g. a constant, an env
var, a config object) so we don't fix one call site and miss another.

## 2. HTTP 429 (rate limit / quota)

Separately from the wrong model name, we're also hitting rate limits.
Check:

1. Confirm which Gemini API tier/quota is in effect for this key (free
   tier has low requests-per-minute limits). Given evaluation calls loop
   over 5-15 candidates per cron cycle (each requiring its own API call
   for scoring, plus one more for writing the winning post), a single
   cron cycle could be making many rapid-fire requests, easily enough to
   exceed a free-tier RPM limit if they're not spaced out or batched.
2. Add basic rate-limit resilience: a short delay (e.g. 1-2 seconds)
   between consecutive Gemini API calls within a single cron cycle, so we
   don't burst past per-minute limits when evaluating multiple candidates
   back to back.
3. Add retry-with-backoff specifically for 429 responses (wait a few
   seconds and retry once or twice) rather than immediately falling back
   to the heuristic/template path on a 429, since a transient rate limit
   is recoverable and shouldn't be treated the same as a real failure.
4. Log the full error response body when a 429 (or any non-200) occurs, so
   future debugging shows the exact quota/rate-limit message from Google
   rather than just "HTTP 429" with no detail.

## Verification

After fixing, trigger one real cron cycle (manually via the GitHub Actions
workflow_dispatch, same as before) and confirm in Vercel logs:
- The model name in the log line now correctly shows `gemini-2.5-flash`
- No 429 errors occur (or if one does transiently, confirm the retry logic
  successfully recovers and still produces a real published/evaluated
  result rather than silently falling through to the fallback)
- Check Supabase `evaluations` table for a fresh row matching this run's
  timestamp as final confirmation the full pipeline completed successfully

Report the exact line(s) changed and show the Vercel log output from the
verification run as proof, not just a summary claiming it's fixed.
```
> **Note:** Fixed invalid model strings in `lib/llm.ts` to `gemini-2.5-flash` with `gemini-flash-lite-latest` fallback, implemented `fetchGeminiWithRetry()` with 3-attempt exponential backoff retry on HTTP 429, and added full error text logging.

---

### 17. Log Warning Diagnosis

```text
i just ran this
```
> **Note:** Analyzed attached Vercel log screenshot showing `GET 200 /api/cron` and `[GEMINI API MODEL gemini-2.5-flash HTTP 429]`, explaining that 200 OK meant the request succeeded via automatic fallback to `gemini-flash-lite-latest`. Reordered `GEMINI_MODELS` array so `gemini-flash-lite-latest` executes first.

---

### 18. Published Posts View Request

```text
how to open the posts page, like the published one
```
> **Note:** Provided links to the live visual dashboard (`/`) and the raw JSON feed endpoint (`/api/agent/feed`).

---

### 19. HTTP 500 Transient Error Investigation

```text
i got a 500 error but the output still appeared, "posts": [ ... ] how does that work
```
> **Note:** Explained that a transient HTTP 500 internal server error from Google's API was caught by `fetchGeminiWithRetry()`, which logged a warning and successfully executed the fallback model. Added HTTP 500/503 automatic retries to `fetchGeminiWithRetry()`.

---

### 20. Fix Prompt — Hard Deduplication & Discovery Pool Widening

```markdown
# Fix prompt — hard dedup by source URL, memory check is failing

Live feed data proves the "avoid repeating past topics" requirement is
failing in practice. Two source URLs have each been published multiple
times:
- `http://arxiv.org/abs/2608.06363v1` — published 4 times across different
  cron cycles
- `http://arxiv.org/abs/2608.06377v1` — published 3 times across different
  cron cycles

Out of 9 total posts, only 4 are genuinely distinct sources. The current
novelty/memory check (presumably an LLM judgment call comparing the
candidate against a summary of past posts) is not reliably catching exact
repeats. Relying on the LLM to judge "have I covered this before" is too
soft a check for something that has an easy, deterministic answer.

## Required fix

Add a hard, non-LLM deduplication check before a candidate is even sent to
the scoring/evaluation step:

1. In the cron cycle logic (`app/api/cron/route.ts` or wherever candidates
   are gathered before evaluation), query the `posts` table for all
   `source_url` (or however the URL is stored) values already published for
   this agent.
2. Filter out any newly discovered candidate whose URL exactly matches (or
   very closely matches — normalize by stripping query params/trailing
   slashes/http vs https if needed) a URL already in that published list,
   BEFORE it goes to the LLM for scoring at all. Don't rely on the LLM to
   catch this.
3. If ALL discovered candidates in a cycle turn out to be duplicates of
   past posts, that's a valid "nothing to publish this cycle" outcome, log
   it clearly (e.g. "0 novel candidates found, all N discovered topics
   already covered") rather than falling through to publishing a repeat
   anyway.
4. Keep the existing LLM-based novelty scoring as-is for judging genuine
   *thematic* overlap (e.g. two different papers on a similar sub-topic),
   that's a softer, legitimate editorial judgment call the LLM is fine for.
   This fix is specifically about EXACT URL repeats, which should never
   require LLM judgment at all, a database lookup is enough and more
   reliable.

## Also fix: widen candidate pool per cycle

Currently each cron cycle only evaluates ~5 candidates. Combined with the
new URL dedup filter (which will now remove already-published topics
before scoring), 5 candidates may frequently shrink to very few or zero
novel options, causing cycles that publish nothing more often than
necessary.

Increase discovery to pull 9-10 candidates per cycle instead of 5 (e.g.
more HN stories, more arXiv results per query, or add an additional arXiv
query with different search terms). This gives the novelty/dedup filter
more real options to work with before falling back to "nothing met the
bar," rather than making 0-publish cycles more frequent as a side effect
of the dedup fix. Don't lower the publish score threshold to compensate,
widen the pool instead, that keeps editorial judgment quality intact while
reducing empty cycles.

## Also worth checking

Given multiple cron cycles rapidly published near-duplicate content
(several runs minutes apart around 03:04, 03:24, 03:32, 03:44, 03:47),
double check the discovery step (`lib/discovery.ts`) is actually pulling
fresh candidates each cycle and not somehow returning a cached/stale
candidate list. If discovery keeps surfacing the same small set of
candidates cycle after cycle, that increases collision risk even with the
dedup fix, consider whether the arXiv/HN queries need to look further back
or rotate query terms to source a wider pool over time (this ties into the
"pull more candidates per cycle" idea from earlier, but the URL dedup fix
above is the priority since it's an explicit rubric requirement).

## Verification

After the fix, manually trigger 2-3 cron cycles in a row and confirm no
source URL appears twice across the resulting published posts. Show the
actual `evaluations` log entries proving duplicates were filtered out
before scoring (e.g. a log line like "Skipping already-published URL: ...")
rather than just a final claim that it's fixed.
```
> **Note:** Implemented `normalizeUrl()` and pre-scoring database check in `runCronCycle()` (`[Cron] Skipping already-published URL...`), added `{ cache: 'no-store' }` to discovery fetches, diversified arXiv search queries, and expanded discovery pool yield to 10–12 items. Verified over 3 consecutive live cron runs: **100% unique source URLs across published feed** (`TOTAL POSTS: 3 | UNIQUE URLS: 3`).

---

### 21. Database Clearance Request

```text
okay great, last time, clear the database of the /feed. we'll just let cron run one more time to verify
```
> **Note:** Wiped all rows from Supabase `agents`, `posts`, and `evaluations` tables, initialized persona `agent_dr_cipher_ai_security_researcher_440`, and ran a single verification cron cycle (`100% OK`).

---

### 22. Feature Overview Request

```text
give a complete overview of everything that has been done, each feature/
```
> **Note:** Compiled a complete architectural and feature overview covering persona initialization, discovery engine, URL deduplication, editorial scoring, voice synthesis, API contracts, dashboard UI, and 24/7 cloud cron scheduling.

---

### 23. Security Audit Request

```markdown
Do a final security audit of this repo before submission. We're on a
public GitHub repo, so treat this as important, not a formality.

1. **Show me the full current contents of `.gitignore`** and confirm it
   includes at minimum: `.env`, `.env.local`, `.env*.local`,
   `node_modules`, `.next`, `.vercel`.

2. **Confirm `.env.local` is NOT currently tracked by git**: run
   `git status` and `git ls-files | grep env` (or equivalent) and show me
   the output. It should show nothing, meaning the file is properly
   ignored and was never added.

3. **Search the full commit history for leaked secrets**, not just the
   current working tree, since a key could have been committed and then
   removed later but still exist in history. Run something like:
   `git log -p --all -- .env.local` and also
   `git log -p --all | grep -iE "GEMINI_API_KEY|SUPABASE.*KEY|sb_secret|CRON_SECRET"`
   (or equivalent search across all commits, all branches). Show me the
   raw output, don't summarize it away, I need to see actual matches or
   confirmed absence.

4. **If anything is found in history** (even in an old commit that was
   later "fixed"), tell me explicitly, a real key existing anywhere in
   git history of a public repo means it's already exposed and should be
   treated as compromised, we'd need to rotate that key (get a new one
   from Google AI Studio / Supabase) regardless of removing it from
   history, since old commits can still be fetched by anyone even after a
   force-push rewrite.

5. **Double check `PROMPTS.md`, `GEMINI.md`, `OVERVIEW.md`, and
   `README.md`** don't have any real key values accidentally pasted into
   them either (sometimes debugging logs get copy-pasted into docs).

Report back clearly: found nothing / found something + exactly what + exactly
where. Do not just say "looks clean" without showing the actual command
output that proves it.
```
> **Note:** Audited `.gitignore`, verified `.env.local` is untracked, searched full git commit history (`git log -p --all`: 0 secret keys committed), checked markdown documentation files, and verified clean repository state.

---

### 24. Authenticity Log Request

```markdown
Compile a complete, honest PROMPTS.md at the repo root documenting the
actual prompt history used to build this project. This is required for
hackathon submission (Authenticity Review checks that the AI usage log
genuinely corresponds to the implemented features and development
history), so it needs to be real and complete, not a cleaned-up summary
that hides the iteration...
```
> **Note:** Compiled prompt history logs into `PROMPTS.md` and `USER_PROMPTS.md`.
