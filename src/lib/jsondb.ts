// ============ Local JSON File Store ============
// Single-user replacement for Supabase tables. Each table is one JSON file
// under <project>/data/. Server-side only — accessed via /api/storage or
// directly from API routes.

import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export type Row = Record<string, unknown>;

export const ALLOWED_TABLES = ['portfolios', 'watchlist', 'alerts', 'trade_journal', 'portfolio_history'] as const;
export type TableName = (typeof ALLOWED_TABLES)[number];

const DATA_DIR = path.join(process.cwd(), 'data');

// Serialize writes per table so concurrent requests don't clobber each other
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(table: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(table) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(table, next.catch(() => undefined));
  return next;
}

function tablePath(table: TableName): string {
  return path.join(DATA_DIR, `${table}.json`);
}

async function readTable(table: TableName): Promise<Row[]> {
  try {
    const raw = await fs.readFile(tablePath(table), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeTable(table: TableName, rows: Row[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(tablePath(table), JSON.stringify(rows, null, 2), 'utf-8');
}

export interface SelectOptions {
  eq?: Row;
  gte?: Row;
  order?: { column: string; ascending: boolean };
}

function matches(row: Row, opts: SelectOptions): boolean {
  for (const [k, v] of Object.entries(opts.eq || {})) {
    if (row[k] !== v) return false;
  }
  for (const [k, v] of Object.entries(opts.gte || {})) {
    if (row[k] == null || (row[k] as string | number) < (v as string | number)) return false;
  }
  return true;
}

export async function selectRows(table: TableName, opts: SelectOptions = {}): Promise<Row[]> {
  let rows = (await readTable(table)).filter(r => matches(r, opts));
  if (opts.order) {
    const { column, ascending } = opts.order;
    rows = rows.sort((a, b) => {
      const av = a[column] as string | number, bv = b[column] as string | number;
      if (av === bv) return 0;
      const cmp = av == null ? -1 : bv == null ? 1 : av < bv ? -1 : 1;
      return ascending ? cmp : -cmp;
    });
  }
  return rows;
}

export async function insertRow(table: TableName, row: Row): Promise<Row> {
  return withLock(table, async () => {
    const rows = await readTable(table);
    const newRow: Row = { id: randomUUID(), created_at: new Date().toISOString(), ...row };
    rows.push(newRow);
    await writeTable(table, rows);
    return newRow;
  });
}

export async function updateRows(table: TableName, values: Row, eq: Row): Promise<number> {
  return withLock(table, async () => {
    const rows = await readTable(table);
    let count = 0;
    const updated = rows.map(r => {
      if (matches(r, { eq })) {
        count++;
        return { ...r, ...values };
      }
      return r;
    });
    await writeTable(table, updated);
    return count;
  });
}

export async function deleteRows(table: TableName, eq: Row): Promise<number> {
  return withLock(table, async () => {
    const rows = await readTable(table);
    const kept = rows.filter(r => !matches(r, { eq }));
    await writeTable(table, kept);
    return rows.length - kept.length;
  });
}

/** Insert, or replace the existing row that matches all conflictKeys. */
export async function upsertRow(table: TableName, row: Row, conflictKeys: string[]): Promise<Row> {
  return withLock(table, async () => {
    const rows = await readTable(table);
    const idx = conflictKeys.length > 0
      ? rows.findIndex(r => conflictKeys.every(k => r[k] === row[k]))
      : -1;
    if (idx >= 0) {
      const merged = { ...rows[idx], ...row, updated_at: new Date().toISOString() };
      rows[idx] = merged;
      await writeTable(table, rows);
      return merged;
    }
    const newRow: Row = { id: randomUUID(), created_at: new Date().toISOString(), ...row };
    rows.push(newRow);
    await writeTable(table, rows);
    return newRow;
  });
}

export function isAllowedTable(table: string): table is TableName {
  return (ALLOWED_TABLES as readonly string[]).includes(table);
}
