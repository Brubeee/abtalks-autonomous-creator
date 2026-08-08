import { NextRequest, NextResponse } from 'next/server';
import { getFeed } from '@/lib/agent';
import { inMemoryStore } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let agentId = searchParams.get('agentId');

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

    const posts = await getFeed(agentId);
    return NextResponse.json({ posts: posts || [] }, { status: 200 });
  } catch (err: any) {
    console.error('Error in /api/agent/feed:', err);
    return NextResponse.json({ posts: [] }, { status: 200 });
  }
}
