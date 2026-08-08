import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, hasSupabaseConfig } from '@/lib/supabase';
import { getFeed } from '@/lib/agent';
import { inMemoryStore } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let agentId = searchParams.get('agentId');
    const debug = searchParams.get('debug') === 'true';

    // If agentId is not provided, try to find the latest active agent for convenience
    if (!agentId) {
      const defaultAgent = await inMemoryStore.getLatestAgent();
      if (defaultAgent) {
        agentId = defaultAgent.id;
      }
    }

    if (!agentId) {
      return NextResponse.json({ posts: [] }, { status: 200 });
    }

    // Debug mode: return extra info about Supabase connectivity
    if (debug) {
      const supabase = getSupabaseClient();
      const debugInfo: any = {
        agentId,
        hasSupabaseConfig,
        supabaseClientExists: Boolean(supabase),
        envCheck: {
          NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
          SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        },
      };

      if (supabase) {
        const { data, error } = await supabase
          .from('posts')
          .select('id, created_at')
          .eq('agent_id', agentId)
          .order('created_at', { ascending: false });
        debugInfo.supabaseQuery = {
          error: error ? JSON.stringify(error) : null,
          dataLength: data ? data.length : null,
          firstId: data && data[0] ? data[0].id : null,
        };
      }

      const posts = await getFeed(agentId);
      return NextResponse.json({ posts, debug: debugInfo }, { status: 200 });
    }

    const posts = await getFeed(agentId);
    return NextResponse.json({ posts: posts || [] }, { status: 200 });
  } catch (err: any) {
    console.error('Error in /api/agent/feed:', err);
    return NextResponse.json({ posts: [], error: err.message }, { status: 200 });
  }
}

