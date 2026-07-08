// ============ Local JSON-backed client ============
// Drop-in replacement for the Supabase browser client. Same call shapes
// (auth.getUser / from().select().eq().order() / insert().select().single() ...)
// but persistence is local JSON files via /api/storage — no Supabase account,
// no login. Single-user: everything belongs to LOCAL_USER.

type Row = Record<string, unknown>;
// data is `any` on purpose — mirrors the Supabase client's loose result typing
// that all existing call sites were written against.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result = { data: any; error: string | null };

const LOCAL_USER = {
  id: 'local-user',
  email: 'local@jarvis.finance',
};

const LOCAL_SESSION = {
  access_token: 'local',
  user: LOCAL_USER,
};

class LocalQuery implements PromiseLike<Result> {
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | null = null;
  private eqFilters: Row = {};
  private gteFilters: Row = {};
  private orderBy: { column: string; ascending: boolean } | null = null;
  private values: Row | null = null;
  private conflictKeys: string[] = [];
  private wantSingle = false;

  constructor(private table: string) {}

  select(_columns?: string) {
    // After a mutation, .select() just means "return the affected row(s)"
    if (this.action === null) this.action = 'select';
    return this;
  }

  insert(values: Row) {
    this.action = 'insert';
    this.values = values;
    return this;
  }

  upsert(values: Row, opts?: { onConflict?: string }) {
    this.action = 'upsert';
    this.values = values;
    this.conflictKeys = opts?.onConflict ? opts.onConflict.split(',').map(s => s.trim()) : [];
    return this;
  }

  update(values: Row) {
    this.action = 'update';
    this.values = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.eqFilters[column] = value;
    return this;
  }

  gte(column: string, value: unknown) {
    this.gteFilters[column] = value;
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending !== false };
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  private async run(): Promise<Result> {
    try {
      const res = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: this.table,
          action: this.action || 'select',
          eq: this.eqFilters,
          gte: this.gteFilters,
          order: this.orderBy || undefined,
          values: this.values || undefined,
          conflictKeys: this.conflictKeys,
        }),
      });
      const json = (await res.json()) as Result;
      let data = json.data;
      if (this.wantSingle && Array.isArray(data)) data = data[0] ?? null;
      return { data, error: json.error };
    } catch (e) {
      console.error('[LocalClient] storage request failed:', e);
      return { data: null, error: 'storage request failed' };
    }
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

const client = {
  auth: {
    async getUser() {
      return { data: { user: LOCAL_USER }, error: null };
    },
    async getSession() {
      return { data: { session: LOCAL_SESSION }, error: null };
    },
    async signOut() {
      return { error: null };
    },
  },
  from(table: string) {
    return new LocalQuery(table);
  },
};

// Singleton — components put the client in useEffect dependency arrays,
// so returning a fresh object per call would re-trigger effects on every
// render (infinite request loop).
export function createClient() {
  return client;
}
