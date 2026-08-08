import { NextRequest, NextResponse } from 'next/server';
import { initAgent } from '@/lib/agent';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || !body.persona || !body.persona.name || !body.persona.domain) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected format: { "persona": { "name": "...", "domain": "..." } }' },
        { status: 400 }
      );
    }

    const { persona } = body;
    const result = await initAgent({
      name: persona.name,
      domain: persona.domain,
    });

    return NextResponse.json({ agentId: result.agentId }, { status: 200 });
  } catch (err: any) {
    console.error('Error in /api/agent/init:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
