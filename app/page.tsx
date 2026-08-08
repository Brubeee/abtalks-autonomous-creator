'use client';

import { useState, useEffect } from 'react';
import { Post, EvaluationRecord, AgentRecord } from '@/lib/types';
import {
  Bot,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Zap,
  BookOpen,
  PlusCircle,
  Cpu,
  Layers,
  Award,
} from 'lucide-react';

export default function Dashboard() {
  const [activeAgent, setActiveAgent] = useState<AgentRecord | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [triggeringCron, setTriggeringCron] = useState<boolean>(false);
  const [showInitModal, setShowInitModal] = useState<boolean>(false);

  // Init Form State
  const [initName, setInitName] = useState<string>('Dr. Cipher (AI Security Researcher)');
  const [initDomain, setInitDomain] = useState<string>('LLM Red-Teaming, Alignment & Agent Safety');
  const [initStatus, setInitStatus] = useState<string>('');

  const fetchDashboardData = async (agentId?: string) => {
    try {
      setLoading(true);
      let targetId = agentId || activeAgent?.id || '';

      if (!targetId) {
        const infoRes = await fetch('/api/agent/info', { cache: 'no-store' });
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          if (infoData.agent) {
            setActiveAgent(infoData.agent);
            targetId = infoData.agent.id;
          }
        }
      } else {
        const infoRes = await fetch(`/api/agent/info?agentId=${encodeURIComponent(targetId)}`, { cache: 'no-store' });
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          if (infoData.agent) {
            setActiveAgent(infoData.agent);
          }
        }
      }

      const [feedRes, evalRes] = await Promise.all([
        fetch(`/api/agent/feed${targetId ? `?agentId=${encodeURIComponent(targetId)}` : ''}`, { cache: 'no-store' }),
        fetch(`/api/agent/evaluations${targetId ? `?agentId=${encodeURIComponent(targetId)}` : ''}`, { cache: 'no-store' }),
      ]);

      if (feedRes.ok) {
        const feedData = await feedRes.json();
        setPosts(feedData.posts || []);
      }

      if (evalRes.ok) {
        const evalData = await evalRes.json();
        setEvaluations(evalData.evaluations || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleManualCronTrigger = async () => {
    try {
      setTriggeringCron(true);
      const agentParam = activeAgent ? `?agentId=${encodeURIComponent(activeAgent.id)}` : '';
      const res = await fetch(`/api/cron${agentParam}`, {
        headers: { 'x-dashboard-trigger': 'true' },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Cron trigger failed with HTTP ${res.status}`);
      }

      if (data.published) {
        setInitStatus(`Cron executed! Published new post: "${data.selectedTopic}"`);
      } else if (data.evaluatedCount > 0) {
        setInitStatus(`Cron executed! Evaluated ${data.evaluatedCount} candidates. All rejected based on criteria.`);
      } else {
        setInitStatus('Cron executed successfully.');
      }

      await fetchDashboardData(activeAgent?.id);
    } catch (err) {
      console.error('Error triggering cron:', err);
      setInitStatus('Cron trigger failed.');
    } finally {
      setTriggeringCron(false);
    }
  };

  const handleInitAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setInitStatus('Initializing persona in database...');
      const res = await fetch('/api/agent/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: {
            name: initName,
            domain: initDomain,
          },
        }),
      });

      const data = await res.json();
      if (data.agentId) {
        setInitStatus(`Successfully initialized! Agent ID: ${data.agentId}`);
        setShowInitModal(false);
        await fetchDashboardData(data.agentId);
      } else {
        setInitStatus(data.error || 'Initialization failed.');
      }
    } catch (err: any) {
      setInitStatus(err.message || 'Initialization error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-4 md:p-8 selection:bg-cyan-500 selection:text-white">
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full filter blur-[120px] pointer-events-none animate-pulse-glow" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full filter blur-[120px] pointer-events-none animate-pulse-glow" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* Header Bar */}
        <header className="glass-panel p-6 rounded-2xl border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
                  Autonomous AI Creator
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  ABTalks PS3
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                48-Hour Zero-Human Autonomous Persona & Editorial Engine
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Cron Scheduler Active (Every 3h)
            </div>

            <button
              onClick={handleManualCronTrigger}
              disabled={triggeringCron}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white transition-all shadow-md hover:shadow-cyan-500/25 disabled:opacity-50"
            >
              <Zap className={`w-3.5 h-3.5 ${triggeringCron ? 'animate-spin' : ''}`} />
              {triggeringCron ? 'Executing Editorial Cycle...' : 'Trigger Cron Cycle'}
            </button>

            <button
              onClick={async () => {
                if (confirm('Reset database and clear all previous posts/evaluations?')) {
                  setLoading(true);
                  await fetch('/api/agent/reset', { method: 'POST' });
                  setInitStatus('Database reset successfully.');
                  await fetchDashboardData();
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 transition-all"
            >
              Reset DB
            </button>

            <button
              onClick={() => setShowInitModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
              Init Persona
            </button>
          </div>
        </header>

        {initStatus && (
          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/50 text-cyan-300 text-xs flex items-center justify-between">
            <span>{initStatus}</span>
            <button onClick={() => setInitStatus('')} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Active Persona Banner */}
        {activeAgent ? (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">Active Persona</span>
                </div>
                <h2 className="text-xl font-bold text-slate-100">{activeAgent.name}</h2>
                <p className="text-xs text-slate-400">Domain Focus: {activeAgent.domain}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden md:block">
                  <div className="text-[11px] text-slate-500 font-mono">AGENT ID</div>
                  <div className="text-xs font-mono text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                    {activeAgent.id}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-slate-500" />
                Persisted System Prompt & Anti-Boilerplate Guidelines:
              </div>
              <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 font-mono leading-relaxed max-h-24 overflow-y-auto">
                {activeAgent.system_prompt}
              </p>
            </div>
          </div>
        ) : (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-center space-y-3">
            <Bot className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No Active Persona Found</h3>
            <p className="text-xs text-slate-400">Initialize a persona to get started.</p>
            <button
              onClick={() => setShowInitModal(true)}
              className="px-4 py-2 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg"
            >
              Initialize Persona
            </button>
          </div>
        )}

        {/* Main Grid: Feed & Rejection Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Published Feed Section */}
          <section className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-slate-100">Autonomous Feed</h2>
                <span className="text-xs text-slate-400 font-normal">
                  ({posts.length} {posts.length === 1 ? 'post' : 'posts'})
                </span>
              </div>
              <button
                onClick={() => fetchDashboardData(activeAgent?.id)}
                className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            {posts.length === 0 ? (
              <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-3">
                <Clock className="w-10 h-10 text-slate-600 mx-auto animate-pulse" />
                <h3 className="text-sm font-semibold text-slate-300">Feed Empty (Awaiting First Cron Cycle)</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Initialization configures persona metadata without publishing immediately.
                  Posts will populate automatically after the first scheduled cron run.
                </p>
                <button
                  onClick={handleManualCronTrigger}
                  disabled={triggeringCron}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30 transition-all"
                >
                  <Zap className="w-3 h-3" /> Run First Cron Cycle Now
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <article
                    key={post.id}
                    className="glass-card p-6 rounded-2xl space-y-4 border border-slate-800/80 shadow-lg relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {post.id}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(post.createdAt).toUTCString()}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-200 leading-relaxed font-normal whitespace-pre-wrap">
                      {post.text}
                    </p>

                    <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/70 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                        <Sparkles className="w-3 h-3" />
                        Topic-Specific Editorial Rationale
                      </div>
                      <p className="text-xs text-slate-300 italic leading-relaxed">{post.rationale}</p>
                    </div>

                    {post.sources && post.sources.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[11px] text-slate-500 font-medium">Sources:</span>
                        {post.sources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {src.length > 40 ? `${src.substring(0, 38)}...` : src}
                          </a>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Editorial Rejection & Decision Logs */}
          <section className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-slate-100">Editorial Judgment Logs</h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {evaluations.length} Evaluated
              </span>
            </div>

            {evaluations.length === 0 ? (
              <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto" />
                <h3 className="text-xs font-semibold text-slate-300">No Editorial Evaluations Logged Yet</h3>
                <p className="text-[11px] text-slate-400">
                  Candidate topics will be scored across technical depth, relevance, persona fit, and novelty.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                {evaluations.map((item) => {
                  const isPublished = item.status === 'published';
                  const isRunnerUp = item.status === 'approved_runner_up';
                  return (
                    <div
                      key={item.id}
                      className={`glass-panel p-4 rounded-xl space-y-2.5 border transition-all ${
                        isPublished
                          ? 'border-emerald-500/40 bg-emerald-950/15'
                          : isRunnerUp
                          ? 'border-sky-500/30 bg-sky-950/10'
                          : 'border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={item.topic_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-slate-200 hover:text-cyan-300 line-clamp-2 transition-colors"
                        >
                          {item.topic_title}
                        </a>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md shrink-0 flex items-center gap-1 ${
                            isPublished
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isRunnerUp
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {isPublished ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Published
                            </>
                          ) : isRunnerUp ? (
                            <>
                              <Award className="w-3 h-3" /> Runner-Up
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Rejected
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                        <span className="font-mono text-slate-500">
                          {new Date(item.created_at).toLocaleTimeString()}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span>Score:</span>
                          <span
                            className={`font-bold ${
                              item.score >= 7 ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {item.score}/10
                          </span>
                        </div>
                      </div>

                      {/* Sub-Scores Breakdown Pills */}
                      {item.sub_scores && (
                        <div className="grid grid-cols-4 gap-1.5 text-[10px] text-center font-mono">
                          <div className="bg-slate-900/80 p-1 rounded border border-slate-800">
                            <div className="text-slate-500 text-[9px]">Depth</div>
                            <div className="font-bold text-cyan-400">{item.sub_scores.technicalDepth || 5}</div>
                          </div>
                          <div className="bg-slate-900/80 p-1 rounded border border-slate-800">
                            <div className="text-slate-500 text-[9px]">Relevance</div>
                            <div className="font-bold text-sky-400">{item.sub_scores.relevance || 5}</div>
                          </div>
                          <div className="bg-slate-900/80 p-1 rounded border border-slate-800">
                            <div className="text-slate-500 text-[9px]">Fit</div>
                            <div className="font-bold text-blue-400">{item.sub_scores.personaFit || 5}</div>
                          </div>
                          <div className="bg-slate-900/80 p-1 rounded border border-slate-800">
                            <div className="text-slate-500 text-[9px]">Novelty</div>
                            <div className="font-bold text-indigo-400">{item.sub_scores.novelty || 5}</div>
                          </div>
                        </div>
                      )}

                      <p className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800/50 leading-relaxed">
                        {item.reason}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Init Persona Modal */}
      {showInitModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                Initialize Persona
              </h3>
              <button
                onClick={() => setShowInitModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInitAgent} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">Persona Name</label>
                <input
                  type="text"
                  value={initName}
                  onChange={(e) => setInitName(e.target.value)}
                  required
                  placeholder="e.g. Dr. Cipher (AI Security Researcher)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">Domain Expertise</label>
                <input
                  type="text"
                  value={initDomain}
                  onChange={(e) => setInitDomain(e.target.value)}
                  required
                  placeholder="e.g. AI Vulnerabilities & Alignment Security"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed bg-cyan-950/30 p-2.5 rounded-lg border border-cyan-900/40">
                Note: Initializing configures persona voice & system prompt in the database.
                It will NOT publish any post synchronously. Posts begin on the first scheduled cron run.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInitModal(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-md disabled:opacity-50"
                >
                  {loading ? 'Initializing...' : 'Save & Initialize'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
