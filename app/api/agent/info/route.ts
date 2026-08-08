import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agent';
import { inMemoryStore } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let agentId = searchParams.get('agentId');

    if (!agentId) {
      const defaultAgent = await inMemoryStore.getLatestAgent();
      if (defaultAgent) agentId = defaultAgent.id;
    }

    if (!agentId) {
      return NextResponse.json({ agent: null }, { status: 404 });
    }

    const agent = await getAgent(agentId);
    return NextResponse.json({ agent }, { status: 200 });
  } catch (err: any) {
    console.error('Error fetching agent info:', err);
    return NextResponse.json({ agent: null }, { status: 500 });
  }
}
