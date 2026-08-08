import { NextRequest, NextResponse } from 'next/server';
import { getEvaluations } from '@/lib/agent';
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
      return NextResponse.json({ evaluations: [] }, { status: 200 });
    }

    const evaluations = await getEvaluations(agentId);
    return NextResponse.json({ evaluations: evaluations || [] }, { status: 200 });
  } catch (err: any) {
    console.error('Error fetching evaluations:', err);
    return NextResponse.json({ evaluations: [] }, { status: 200 });
  }
}
