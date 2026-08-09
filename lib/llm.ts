import { CandidateTopic, CandidateEvaluation, AgentRecord, Post, SubScores } from './types';

function getGeminiApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key || key.includes('your_') || key.includes('placeholder')) return undefined;
  return key;
}

function getOpenAiApiKey(): string | undefined {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.includes('your_') || key.includes('placeholder')) return undefined;
  return key;
}

// Supported Gemini models with automatic quota fallback
const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

async function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGeminiWithRetry(model: string, apiKey: string, prompt: string, taskLabel: string): Promise<any> {
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const waitTime = attempt * 3000;
      console.warn(`[GEMINI API MODEL ${model} HTTP 429]: Rate limit encountered for ${taskLabel}. Retrying in ${waitTime / 1000}s (Attempt ${attempt + 1}/${maxRetries + 1})...`);
      await delayMs(waitTime);
    }

    console.log(`[GEMINI API] Attempting live call to model "${model}" for ${taskLabel} (attempt ${attempt + 1})...`);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (res.ok) {
        return await res.json();
      }

      const errorText = await res.text();
      console.warn(`[GEMINI API MODEL ${model} HTTP ${res.status}]:`, errorText);

      if (res.status === 429) {
        if (attempt < maxRetries) {
          continue;
        }
      }
      return null;
    } catch (e) {
      console.warn(`[GEMINI API MODEL ${model}] Fetch error for ${taskLabel}:`, e);
      if (attempt < maxRetries) {
        await delayMs(2500);
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function evaluateCandidateTopic(
  agent: AgentRecord,
  candidate: CandidateTopic,
  recentPosts: Post[]
): Promise<CandidateEvaluation> {
  const apiKey = getGeminiApiKey();
  const openAiKey = getOpenAiApiKey();

  const prompt = `You are the editorial evaluation board for an autonomous AI creator persona.
Persona Name: ${agent.name}
Persona Domain Focus: ${agent.domain}
Persona Guidelines: ${agent.system_prompt}

CANDIDATE TOPIC FULL CONTEXT:
- Title: ${candidate.title}
- Source URL: ${candidate.url}
- Source Type: ${candidate.sourceType}
- Has Full Body Text / Abstract: ${candidate.hasBodyText ? 'YES' : 'NO (Title & URL context only)'}
- Context Snippet / Abstract: ${candidate.snippet || 'No body text provided.'}

RECENT PUBLISHED POSTS MEMORY:
${recentPosts.map((p) => `- ${p.text.substring(0, 120)}...`).join('\n') || 'None'}

EVALUATION MANDATE:
Evaluate this candidate topic across 4 distinct dimensions. For EACH dimension, write a 1-sentence specific justification GROUNDED IN THIS TOPIC BEFORE outputting the number.

SCORING CRITERIA PER DIMENSION (1-10):
1. "technicalDepth" (1-10): Does it contain real technical/architectural substance vs superficial fluff/marketing?
2. "relevance" (1-10): Is it directly relevant to ${agent.domain}?
3. "personaFit" (1-10): Does it align with ${agent.name}'s analytical stance?
4. "novelty" (1-10): Score how novel or under-covered this specific angle is, considering:
   (a) Whether this persona has published on a similar topic before (compare against recent past posts memory above).
   (b) Whether this is a widely-covered mainstream story (score LOW, 3-4/10) vs a niche/technical finding unlikely to be broadly covered elsewhere (score HIGH, 8-9/10).

DO NOT return identical scores across different topics. Mainstream general stories (NASA, tech layoffs, general opinion pieces) MUST score LOW on novelty and relevance.

Output JSON strictly formatted as:
{
  "justifications": {
    "technicalDepth": "<1 sentence justifying technical depth>",
    "relevance": "<1 sentence justifying relevance to ${agent.domain}>",
    "personaFit": "<1 sentence justifying alignment with ${agent.name}>",
    "novelty": "<1 sentence justifying novelty vs past posts and mainstream coverage>"
  },
  "subScores": {
    "technicalDepth": <1-10 integer>,
    "relevance": <1-10 integer>,
    "personaFit": <1-10 integer>,
    "novelty": <1-10 integer>
  },
  "reason": "<Overall 1-2 sentence editorial justification.>"
}`;

  console.log(`\n========================================`);
  console.log(`[LLM EVALUATION PROMPT PAYLOAD for "${candidate.title}"]`);
  console.log(`GEMINI_API_KEY PRESENT: ${Boolean(apiKey)}`);
  console.log(prompt);
  console.log(`========================================\n`);

  let geminiAttempted = false;
  if (apiKey) {
    for (const model of GEMINI_MODELS) {
      geminiAttempted = true;
      const data = await fetchGeminiWithRetry(model, apiKey, prompt, `evaluation "${candidate.title}"`);
      if (data) {
        console.log(`\n========================================`);
        console.log(`[REAL GEMINI RAW API EVALUATION RESPONSE (${model}) for "${candidate.title}"]:`);
        console.log(JSON.stringify(data, null, 2));
        console.log(`========================================\n`);

        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          let parsed: any;
          try {
            parsed = JSON.parse(rawJson);
          } catch (parseError) {
            console.error(`[GEMINI API] Evaluation JSON parse failed for model ${model}:`, parseError);
            console.error('[GEMINI API] Raw evaluation text:', rawJson);
            continue;
          }
          const sub: SubScores = {
            technicalDepth: Math.min(10, Math.max(1, Number(parsed.subScores?.technicalDepth) || 5)),
            relevance: Math.min(10, Math.max(1, Number(parsed.subScores?.relevance) || 5)),
            personaFit: Math.min(10, Math.max(1, Number(parsed.subScores?.personaFit) || 5)),
            novelty: Math.min(10, Math.max(1, Number(parsed.subScores?.novelty) || 5)),
            justifications: parsed.justifications || {},
          };
          const avgScore = Math.round((sub.technicalDepth + sub.relevance + sub.personaFit + sub.novelty) / 4);
          const passed = avgScore >= 7;

          return {
            candidate,
            topicTitle: candidate.title,
            topicUrl: candidate.url,
            score: avgScore,
            subScores: sub,
            reason: parsed.reason || 'Evaluated across 4 distinct dimensions.',
            passed,
          };
        }
        console.error(`[GEMINI API] Evaluation response from model ${model} did not contain usable JSON text.`);
      }
    }
  } else {
    console.warn('[GEMINI API] No usable Gemini API key found in process.env for candidate evaluation.');
  }

  if (openAiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`[OPENAI RAW API EVALUATION RESPONSE for "${candidate.title}"]:`, JSON.stringify(data, null, 2));
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          const sub: SubScores = {
            technicalDepth: Math.min(10, Math.max(1, Number(parsed.subScores?.technicalDepth) || 5)),
            relevance: Math.min(10, Math.max(1, Number(parsed.subScores?.relevance) || 5)),
            personaFit: Math.min(10, Math.max(1, Number(parsed.subScores?.personaFit) || 5)),
            novelty: Math.min(10, Math.max(1, Number(parsed.subScores?.novelty) || 5)),
            justifications: parsed.justifications || {},
          };
          const avgScore = Math.round((sub.technicalDepth + sub.relevance + sub.personaFit + sub.novelty) / 4);
          const passed = avgScore >= 7;

          return {
            candidate,
            topicTitle: candidate.title,
            topicUrl: candidate.url,
            score: avgScore,
            subScores: sub,
            reason: parsed.reason || 'Evaluated across 4 distinct dimensions.',
            passed,
          };
        }
      }
    } catch (e) {
      console.warn('OpenAI evaluation fallback:', e);
    }
  }

  if (apiKey && !geminiAttempted) {
    console.warn('[GEMINI API] All Gemini models were rate-limited. Waiting 3s before retry...');
    await delayMs(3000);
  }

  throw new Error(`Gemini evaluation failed for "${candidate.title}". All API models were rate limited or returned non-200 responses.`);
}

export async function writePersonaPost(
  agent: AgentRecord,
  candidate: CandidateTopic,
  recentPosts: Post[],
  evaluations: CandidateEvaluation[] = []
): Promise<{ text: string; rationale: string; sources: string[] }> {
  const apiKey = getGeminiApiKey();
  const openAiKey = getOpenAiApiKey();

  const otherCandidates = evaluations
    .filter((e) => e.topicTitle !== candidate.title)
    .map((e) => `"${e.topicTitle}" (${e.passed ? 'approved' : 'rejected'}, Score: ${e.score}/10)`);

  const otherCandidatesStr = otherCandidates.length > 0
    ? otherCandidates.join(', ')
    : 'other submissions this cycle';

  const prompt = `SYSTEM PROMPT & PERSONA IDENTITY:
You are ${agent.name}, a world-class researcher in ${agent.domain}.
${agent.system_prompt}

CRITICAL EDITORIAL REQUIREMENTS:
1. POST WRITING RULES:
   - Synthesize the source finding ENTIRELY IN YOUR OWN PERSONA VOICE.
   - NO VERBATIM QUOTING of abstract sentences. Lifting full sentences from the source is strictly forbidden. Short technical terms or numbers (e.g. "VC dimension d>=1") are fine.
   - STRICTLY FORBIDDEN OPENING TEMPLATES:
     * DO NOT open with "Analyzing [title]."
     * DO NOT open with "Based on the source content:"
     * DO NOT open with "From an AI security perspective,"
   - MANDATORY ELEMENTS (Your post MUST include at least 3 of these):
     (a) Explain what the development/paper actually does in your own words.
     (b) Connect it specifically to ${agent.domain} (an actual concrete implication of THIS finding).
     (c) Identify a concrete risk, limitation, or failure mode in the approach.
     (d) Make a forward-looking claim about where this leads.

2. RATIONALE WRITING RULES:
   - Rationale MUST answer 3 distinct questions in your editorial voice (DO NOT quote the abstract or repeat the post text!):
     (1) Timeliness: Why this matters right now.
     (2) Comparative Judgment: Why this candidate won over other evaluated topics this cycle. YOU MUST EXPLICITLY NAME AT LEAST ONE OTHER EVALUATED CANDIDATE FROM THIS LIST (${otherCandidatesStr}) AND EXPLAIN WHY IT LOST OUT!
     (3) Value Proposition: The one-sentence "so what" for a reader deciding whether to click through.

WORKED EXAMPLES OF GOOD VS BAD OUTPUT:

--- BAD OUTPUT EXAMPLE (DO NOT DO THIS) ---
BAD TEXT: "Analyzing 'Selective Context Preference Optimization'. Based on the source content: 'Language models increasingly condition their answers on external signals, and a single misleading one can turn a correct answer wrong.' Auditing these implementation specifics prevents runtime failure."
BAD RATIONALE: "Selected 'Selective Context Preference Optimization' specifically because the source content details: 'Language models increasingly condition their answers...'."
(Why BAD: Uses mechanical quote-wrapping, verbatim quotes abstract sentences, rationale repeats post text, no comparative judgment).

--- GOOD OUTPUT EXAMPLE (DO THIS STANCE) ---
GOOD TEXT: "Selective context preference optimization tackles a subtle failure mode in RAG pipelines: models that blindly trust context can be hijacked by a single poisoned retrieval snippet, while models trained to ignore context become uselessly rigid. By optimizing models to dynamically evaluate context trustworthiness before conditioning generation, this research offers a practical path toward resilient agent memory. The main limitation is compute overhead during preference alignment, but as agentic workflows handle unvetted web data, selective context verification will become table stakes."
GOOD RATIONALE: "Timely because untrusted RAG pipelines are currently vulnerable to prompt injection attacks. Selected over runner-up 'NASA Voyager 2 Probe' because Voyager 2 is mainstream hardware news outside our scope, whereas context preference optimization directly mitigates LLM memory poisoning risks. Essential reading for engineers deploying autonomous agents on unvetted retrieval data."
-------------------------------------------

SOURCE CONTENT TO SYNTHESIZE:
- Title: ${candidate.title}
- Source URL: ${candidate.url}
- Has Full Body Text / Abstract: ${candidate.hasBodyText ? 'YES' : 'NO (Title-only)'}
- Context Snippet / Abstract: ${candidate.snippet || 'No body text.'}

EVALUATED CANDIDATES THIS CYCLE (FOR COMPARATIVE RATIONALE):
${otherCandidatesStr}

RECENT PUBLISHED POSTS MEMORY:
${recentPosts.map((p) => `- ${p.text.substring(0, 100)}...`).join('\n') || 'None'}

Output JSON strictly formatted as:
{
  "text": "<Full original analytical post (130-220 words) in persona voice, synthesizing findings without verbatim quotes, highlighting risks and forward implications.>",
  "rationale": "<Editorial rationale containing timeliness, comparative judgment naming at least one competing candidate by title, and value proposition.>",
  "sources": ["${candidate.url}"]
}`;

  console.log(`\n========================================`);
  console.log(`[LLM WRITING PROMPT PAYLOAD for "${candidate.title}"]`);
  console.log(`GEMINI_API_KEY PRESENT: ${Boolean(apiKey)}`);
  console.log(prompt);
  console.log(`========================================\n`);

  let geminiAttempted = false;
  if (apiKey) {
    for (const model of GEMINI_MODELS) {
      geminiAttempted = true;
      const data = await fetchGeminiWithRetry(model, apiKey, prompt, `post writing "${candidate.title}"`);
      if (data) {
        console.log(`\n========================================`);
        console.log(`[REAL GEMINI RAW API WRITING RESPONSE (${model}) for "${candidate.title}"]:`);
        console.log(JSON.stringify(data, null, 2));
        console.log(`========================================\n`);

        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          let parsed: any;
          try {
            parsed = JSON.parse(rawJson);
          } catch (parseError) {
            console.error(`[GEMINI API] Writing JSON parse failed for model ${model}:`, parseError);
            console.error('[GEMINI API] Raw writing text:', rawJson);
            continue;
          }
          if (parsed.text && parsed.rationale) {
            return {
              text: parsed.text,
              rationale: parsed.rationale,
              sources: Array.isArray(parsed.sources) && parsed.sources.length > 0 ? parsed.sources : [candidate.url],
            };
          }
        }
        console.error(`[GEMINI API] Writing response from model ${model} did not contain usable JSON text.`);
      }
    }
  } else {
    console.warn('[GEMINI API] No usable Gemini API key found in process.env for post writing.');
  }

  if (openAiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`[OPENAI RAW API WRITING RESPONSE for "${candidate.title}"]:`, JSON.stringify(data, null, 2));
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.text && parsed.rationale) {
            return {
              text: parsed.text,
              rationale: parsed.rationale,
              sources: Array.isArray(parsed.sources) && parsed.sources.length > 0 ? parsed.sources : [candidate.url],
            };
          }
        }
      }
    } catch (e) {
      console.warn('OpenAI post writing fallback:', e);
    }
  }

  throw new Error(`Gemini post writing failed for "${candidate.title}". All API models were rate limited or returned non-200 responses.`);
}
