import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// GET: fetch portfolio history for chart
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const days = parseInt(request.nextUrl.searchParams.get('days') || '30');
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('portfolio_history')
    .select('date, total_value, total_cost, day_pnl')
    .eq('user_id', user.id)
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data || [] });
}

// POST: save today's snapshot
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { totalValue, totalCost, dayPnl, positions } = body;
  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase
    .from('portfolio_history')
    .upsert({
      user_id: user.id,
      date: today,
      total_value: totalValue || 0,
      total_cost: totalCost || 0,
      day_pnl: dayPnl || 0,
      positions_json: positions || [],
    }, { onConflict: 'user_id,date' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
