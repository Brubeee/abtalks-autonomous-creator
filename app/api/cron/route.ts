import { NextRequest, NextResponse } from 'next/server';
import { runCronCycle } from '@/lib/agent';

export const dynamic = 'force-dynamic';

async function handleCron(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const dashboardTrigger = req.headers.get('x-dashboard-trigger') === 'true';
    const fetchSite = req.headers.get('sec-fetch-site');
    const { searchParams } = new URL(req.url);
    const querySecret = searchParams.get('secret');
    const agentId = searchParams.get('agentId') || undefined;

    console.log('[CRON ROUTE LOG] process.env.GEMINI_API_KEY Present:', Boolean(process.env.GEMINI_API_KEY));
    console.log('[CRON ROUTE LOG] Dashboard manual trigger:', dashboardTrigger);

    const expectedSecret = process.env.CRON_SECRET || process.env.NEXT_PUBLIC_CRON_SECRET;
    if (expectedSecret) {
      const token = authHeader ? authHeader.replace('Bearer ', '') : querySecret;
      const isSameOriginDashboardRequest = dashboardTrigger && (!fetchSite || fetchSite === 'same-origin' || fetchSite === 'none');
      if (token !== expectedSecret && !isSameOriginDashboardRequest) {
        return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
      }
    }

    const result = await runCronCycle(agentId);
    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        ...result,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Error executing cron cycle:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal cron execution failure' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
