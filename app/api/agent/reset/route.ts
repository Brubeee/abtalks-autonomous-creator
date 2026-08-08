import { NextRequest, NextResponse } from 'next/server';
import { clearAllDatabaseRecords } from '@/lib/agent';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await clearAllDatabaseRecords();
    return NextResponse.json({ success: true, message: 'Database reset successfully. Previous iterations and published posts cleared.' }, { status: 200 });
  } catch (err: any) {
    console.error('Error resetting database:', err);
    return NextResponse.json({ success: false, error: err.message || 'Reset failed' }, { status: 500 });
  }
}
