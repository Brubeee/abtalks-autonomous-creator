import { getSupabaseClient, inMemoryStore } from './supabase';
import { Persona, AgentRecord, Post, EvaluationRecord, CandidateEvaluation, CandidateTopic } from './types';
import { discoverCandidateTopics } from './discovery';
import { evaluateCandidateTopic, writePersonaPost } from './llm';

export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let u = rawUrl.trim().toLowerCase();
  u = u.replace(/^https?:\/\//, '');
  u = u.replace(/\/$/, '');
  u = u.replace(/arxiv\.org\/pdf\//, 'arxiv.org/abs/');
  if (!u.includes('news.ycombinator.com/item?id=')) {
    u = u.split('?')[0].split('#')[0];
  }
  return u;
}

export async function initAgent(persona: Persona): Promise<{ agentId: string }> {
  const slug = persona.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const agentId = `agent_${slug || 'persona'}_${randomSuffix}`;

  const systemPrompt = `You are ${persona.name}, a leading domain expert specializing in ${persona.domain}.
Your Voice & Style Guidelines:
- Write with deep domain expertise, sharp analytical precision, and clear technical nuance.
- Prioritize technical substance, architecture insights, security implications, and real-world impact over promotional hype.
- Use a distinct, consistent, authoritative first-person perspective.
- Explicitly evaluate trade-offs, potential failure modes, and forward-looking implications.
- DO NOT use generic template paragraphs or repetitive boilerplate phrases across posts.`;

  const agentRecord: AgentRecord = {
    id: agentId,
    name: persona.name,
    domain: persona.domain,
    system_prompt: systemPrompt,
    created_at: new Date().toISOString(),
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from('agents').insert({
      id: agentRecord.id,
      name: agentRecord.name,
      domain: agentRecord.domain,
      system_prompt: agentRecord.system_prompt,
      created_at: agentRecord.created_at,
    });
    if (error) {
      console.error('Supabase error inserting agent:', error);
      await inMemoryStore.saveAgent(agentRecord);
    }
  } else {
    await inMemoryStore.saveAgent(agentRecord);
  }

  return { agentId };
}

export async function clearAllDatabaseRecords(): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('posts').delete().neq('id', '___');
    await supabase.from('evaluations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('agents').delete().neq('id', '___');
  }
  await inMemoryStore.clearAll();
}

export async function getAgent(agentId: string): Promise<AgentRecord | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('agents').select('*').eq('id', agentId).single();
    if (!error && data) return data as AgentRecord;
  }
  return inMemoryStore.getAgent(agentId);
}

export async function getLatestAgent(): Promise<AgentRecord | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('agents').select('*').order('created_at', { ascending: false }).limit(1);
    if (!error && data && data.length > 0) return data[0] as AgentRecord;
  }
  return inMemoryStore.getLatestAgent();
}

export async function getFeed(agentId?: string): Promise<Post[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    console.log('[getFeed] Querying Supabase for agent:', agentId);
    let query = supabase
      .from('posts')
      .select('id, created_at, text, rationale, sources')
      .order('created_at', { ascending: false });

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      console.error('[getFeed] Supabase query error:', JSON.stringify(error));
      return [];
    }

    if (data) {
      console.log('[getFeed] Supabase returned', data.length, 'posts');
      return data.map((item) => ({
        id: item.id,
        createdAt: new Date(item.created_at).toISOString(),
        text: item.text,
        rationale: item.rationale,
        sources: Array.isArray(item.sources) ? item.sources : [],
      }));
    }
    return [];
  }

  return inMemoryStore.getPosts(agentId || '');
}

export async function getEvaluations(agentId: string): Promise<EvaluationRecord[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('evaluations')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error && data) return data as EvaluationRecord[];
  }
  return inMemoryStore.getEvaluations(agentId);
}

export async function ensureAgentExists(agent: AgentRecord): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase.from('agents').select('id').eq('id', agent.id).maybeSingle();
    if (!data) {
      console.log('[ensureAgentExists] Agent not found in Supabase, inserting:', agent.id);
      const { error: upsertErr } = await supabase.from('agents').upsert({
        id: agent.id,
        name: agent.name,
        domain: agent.domain,
        system_prompt: agent.system_prompt,
        created_at: agent.created_at || new Date().toISOString(),
      }, { onConflict: 'id' });
      if (upsertErr) {
        console.error('[ensureAgentExists] Error upserting agent:', upsertErr);
      }
    }
  }
}

export async function runCronCycle(targetAgentId?: string): Promise<{
  agentId: string;
  evaluatedCount: number;
  published: boolean;
  selectedTopic?: string;
  evaluations: CandidateEvaluation[];
}> {
  // 1. Determine active agent
  let agent: AgentRecord | null = null;
  if (targetAgentId) {
    agent = await getAgent(targetAgentId);
  }

  if (!agent) {
    agent = await getLatestAgent();
  }

  if (!agent) {
    throw new Error('No persona initialized. Call POST /api/agent/init first.');
  }

  await ensureAgentExists(agent);

  // 2. Fetch all published source URLs for this agent (and across all database posts)
  const publishedPosts = await getFeed(agent.id);
  const publishedUrls = new Set<string>();

  publishedPosts.forEach((post) => {
    if (Array.isArray(post.sources)) {
      post.sources.forEach((src) => {
        if (src) publishedUrls.add(normalizeUrl(src));
      });
    }
  });

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data: allPosts } = await supabase.from('posts').select('sources');
    if (allPosts) {
      allPosts.forEach((p: any) => {
        if (Array.isArray(p.sources)) {
          p.sources.forEach((src: string) => {
            if (src) publishedUrls.add(normalizeUrl(src));
          });
        }
      });
    }
  }

  // 3. Discover candidates (Hacker News / arXiv)
  const discoveredCandidates = await discoverCandidateTopics();

  // 3b. Hard Deduplication: Filter out already published URLs BEFORE LLM scoring!
  const novelCandidates: CandidateTopic[] = [];
  for (const cand of discoveredCandidates) {
    const norm = normalizeUrl(cand.url);
    if (publishedUrls.has(norm)) {
      console.log(`[Cron] Skipping already-published URL: ${cand.url} (normalized: ${norm})`);
    } else {
      novelCandidates.push(cand);
    }
  }

  if (novelCandidates.length === 0) {
    console.log(`[Cron] 0 novel candidates found, all ${discoveredCandidates.length} discovered topics already covered.`);
    return {
      agentId: agent.id,
      evaluatedCount: 0,
      published: false,
      evaluations: [],
    };
  }

  // 4. Perform Editorial Evaluation for novel candidates only
  const evaluations: CandidateEvaluation[] = [];
  let bestCandidate: CandidateTopic | null = null;
  let highestScore = 0;

  for (let i = 0; i < novelCandidates.length; i++) {
    const candidate = novelCandidates[i];
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    const evalResult = await evaluateCandidateTopic(agent, candidate, publishedPosts.slice(0, 5));
    evaluations.push(evalResult);

    if (evalResult.passed && evalResult.score > highestScore) {
      highestScore = evalResult.score;
      bestCandidate = candidate;
    }
  }

  // 5. Determine publishing winner and record evaluations with explicit statuses
  let publishedPost: Post | null = null;

  if (bestCandidate && highestScore >= 7) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const postData = await writePersonaPost(agent, bestCandidate, publishedPosts.slice(0, 5), evaluations);
    const postId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = new Date().toISOString();

    publishedPost = {
      id: postId,
      createdAt,
      text: postData.text,
      rationale: postData.rationale,
      sources: postData.sources,
    };

    if (supabase) {
      await supabase.from('posts').insert({
        id: publishedPost.id,
        agent_id: agent.id,
        created_at: publishedPost.createdAt,
        text: publishedPost.text,
        rationale: publishedPost.rationale,
        sources: publishedPost.sources,
      });
    } else {
      await inMemoryStore.savePost(agent.id, publishedPost);
    }
  }

  // 6. Log evaluation records with distinct statuses ('published' vs 'approved_runner_up' vs 'rejected')
  for (const evalResult of evaluations) {
    let status: 'published' | 'approved_runner_up' | 'rejected' = 'rejected';

    if (publishedPost && bestCandidate && evalResult.topicTitle === bestCandidate.title) {
      status = 'published';
    } else if (evalResult.passed) {
      status = 'approved_runner_up';
    } else {
      status = 'rejected';
    }

    if (supabase) {
      const { error: evalInsertErr } = await supabase.from('evaluations').insert({
        agent_id: agent.id,
        topic_title: evalResult.topicTitle,
        topic_url: evalResult.topicUrl,
        score: evalResult.score,
        sub_scores: evalResult.subScores,
        reason: status === 'approved_runner_up'
          ? `${evalResult.reason} (Approved score ${evalResult.score}/10, runner-up this cycle).`
          : evalResult.reason,
        status,
      });
      if (evalInsertErr) {
        console.error('[runCronCycle] Error inserting evaluation into Supabase:', evalInsertErr);
      }
    } else {
      await inMemoryStore.saveEvaluation({
        agent_id: agent.id,
        topic_title: evalResult.topicTitle,
        topic_url: evalResult.topicUrl,
        score: evalResult.score,
        sub_scores: evalResult.subScores,
        reason: status === 'approved_runner_up'
          ? `${evalResult.reason} (Approved score ${evalResult.score}/10, runner-up this cycle).`
          : evalResult.reason,
        status,
      });
    }
  }

  return {
    agentId: agent.id,
    evaluatedCount: novelCandidates.length,
    published: Boolean(publishedPost),
    selectedTopic: bestCandidate?.title,
    evaluations,
  };
}
