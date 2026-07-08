import { NextRequest, NextResponse } from 'next/server';
import { isAllowedTable, selectRows, insertRow, updateRows, deleteRows, upsertRow, SelectOptions, Row } from '@/lib/jsondb';

export const dynamic = 'force-dynamic';

interface StorageRequest {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  eq?: Row;
  gte?: Row;
  order?: { column: string; ascending: boolean };
  values?: Row;
  conflictKeys?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StorageRequest;
    const { table, action } = body;

    if (!isAllowedTable(table)) {
      return NextResponse.json({ data: null, error: `Unknown table: ${table}` }, { status: 400 });
    }

    switch (action) {
      case 'select': {
        const opts: SelectOptions = { eq: body.eq, gte: body.gte, order: body.order };
        const data = await selectRows(table, opts);
        return NextResponse.json({ data, error: null });
      }
      case 'insert': {
        const data = await insertRow(table, body.values || {});
        return NextResponse.json({ data, error: null });
      }
      case 'update': {
        await updateRows(table, body.values || {}, body.eq || {});
        return NextResponse.json({ data: null, error: null });
      }
      case 'delete': {
        await deleteRows(table, body.eq || {});
        return NextResponse.json({ data: null, error: null });
      }
      case 'upsert': {
        const data = await upsertRow(table, body.values || {}, body.conflictKeys || []);
        return NextResponse.json({ data, error: null });
      }
      default:
        return NextResponse.json({ data: null, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    console.error('[Storage API] error:', e);
    return NextResponse.json({ data: null, error: 'Storage operation failed' }, { status: 500 });
  }
}
