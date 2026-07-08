import { NextRequest, NextResponse } from 'next/server';
import { selectRows, upsertRow } from '@/lib/jsondb';

export const dynamic = 'force-dynamic';

const LOCAL_USER_ID = 'local-user';

// GET: fetch portfolio history for chart
export async function GET(request: NextRequest) {
  const days = parseInt(request.nextUrl.searchParams.get('days') || '30');
  const since = new Date();
  since.setDate(since.getDate() - days);

  const data = await selectRows('portfolio_history', {
    eq: { user_id: LOCAL_USER_ID },
    gte: { date: since.toISOString().split('T')[0] },
    order: { column: 'date', ascending: true },
  });

  return NextResponse.json({ success: true, data });
}

// POST: save today's snapshot
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { totalValue, totalCost, dayPnl, positions } = body;
  const today = new Date().toISOString().split('T')[0];

  await upsertRow('portfolio_history', {
    user_id: LOCAL_USER_ID,
    date: today,
    total_value: totalValue || 0,
    total_cost: totalCost || 0,
    day_pnl: dayPnl || 0,
    positions_json: positions || [],
  }, ['user_id', 'date']);

  return NextResponse.json({ success: true });
}
