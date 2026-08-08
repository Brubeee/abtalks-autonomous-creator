export interface Persona {
  name: string;
  domain: string;
}

export interface AgentRecord {
  id: string;
  name: string;
  domain: string;
  system_prompt: string;
  created_at: string;
}

export interface Post {
  id: string;
  createdAt: string; // ISO 8601 UTC string
  text: string;
  rationale: string;
  sources: string[];
}

export interface CandidateTopic {
  title: string;
  url: string;
  snippet?: string;
  hasBodyText: boolean;
  sourceType: 'hacker_news' | 'arxiv';
  id: string;
}

export interface SubScores {
  technicalDepth: number; // 1-10
  relevance: number;      // 1-10
  personaFit: number;     // 1-10
  novelty: number;        // 1-10
  justifications?: {
    technicalDepth?: string;
    relevance?: string;
    personaFit?: string;
    novelty?: string;
  };
}

export interface CandidateEvaluation {
  candidate: CandidateTopic;
  topicTitle: string;
  topicUrl: string;
  score: number; // Overall 1 - 10
  subScores: SubScores;
  reason: string;
  passed: boolean;
}

export interface EvaluationRecord {
  id: string;
  agent_id: string;
  created_at: string;
  topic_title: string;
  topic_url: string;
  score: number;
  sub_scores?: SubScores;
  reason: string;
  status: 'published' | 'approved_runner_up' | 'rejected';
}
