import { NextRequest, NextResponse } from 'next/server';
import { getEvaluations, getLatestAgent } from '@/lib/agent';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let agentId = searchParams.get('agentId');

    if (!agentId) {
      const defaultAgent = await getLatestAgent();
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
