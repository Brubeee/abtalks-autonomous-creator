import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AgentRecord, Post, EvaluationRecord } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isRealConfigValue(value: string | undefined): value is string {
  return Boolean(value && !value.includes('your_') && !value.includes('placeholder'));
}

export const hasSupabaseConfig = isRealConfigValue(supabaseUrl) && isRealConfigValue(supabaseKey);

export function getSupabaseClient(): SupabaseClient | null {
  if (hasSupabaseConfig && supabaseUrl && supabaseKey) {
    return createClient(supabaseUrl, supabaseKey);
  }
  return null;
}

// Fallback in-memory persistence when Supabase credentials are pending during local setup
class InMemoryStore {
  private agents: Map<string, AgentRecord> = new Map();
  private posts: Post[] = [];
  private evaluations: EvaluationRecord[] = [];

  constructor() {
    this.initDefault();
  }

  initDefault() {
    const defaultId = 'agent_ai_sec_01';
    this.agents.set(defaultId, {
      id: defaultId,
      name: 'Aether (AI Security Researcher)',
      domain: 'AI Vulnerability Analysis & Alignment Security',
      system_prompt: `You are Aether, a world-class AI Security Researcher. You specialize in LLM red-teaming, model alignment vulnerabilities, supply chain risks in ML pipelines, and technical analysis of emerging AI systems. Write in an authoritative, analytical, precise, yet accessible tone. Focus on technical substance rather than marketing hype.`,
      created_at: new Date().toISOString(),
    });
  }

  async clearAll(): Promise<void> {
    this.agents.clear();
    this.posts = [];
    this.evaluations = [];
    this.initDefault();
  }

  async getAgent(id: string): Promise<AgentRecord | null> {
    return this.agents.get(id) || null;
  }

  async saveAgent(agent: AgentRecord): Promise<void> {
    this.agents.set(agent.id, agent);
  }

  async getLatestAgent(): Promise<AgentRecord | null> {
    const values = Array.from(this.agents.values());
    return values.length > 0 ? values[values.length - 1] : null;
  }

  async getPosts(agentId: string): Promise<Post[]> {
    return this.posts
      .filter((p) => (p as any).agentId === agentId || true)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async savePost(agentId: string, post: Post): Promise<void> {
    this.posts.unshift({ ...post, ...( { agentId } as any) });
  }

  async saveEvaluation(record: Omit<EvaluationRecord, 'id' | 'created_at'>): Promise<EvaluationRecord> {
    const fullRecord: EvaluationRecord = {
      id: `eval_${Math.random().toString(36).substring(2, 9)}`,
      created_at: new Date().toISOString(),
      ...record,
    };
    this.evaluations.unshift(fullRecord);
    return fullRecord;
  }

  async getEvaluations(agentId: string): Promise<EvaluationRecord[]> {
    return this.evaluations
      .filter((e) => e.agent_id === agentId || true)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

const globalForStore = globalThis as typeof globalThis & {
  __abtalksInMemoryStore?: InMemoryStore;
};

export const inMemoryStore = globalForStore.__abtalksInMemoryStore ?? new InMemoryStore();
globalForStore.__abtalksInMemoryStore = inMemoryStore;
