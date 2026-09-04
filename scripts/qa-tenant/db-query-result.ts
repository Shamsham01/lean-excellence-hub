/**
 * Parses stdout from `supabase db query --agent=no --output-format json`.
 *
 * Pinned Supabase CLI 2.115.x contract (proven cross-platform):
 * - `--agent no --output-format json` → JSON array of row objects (deterministic)
 * - `--agent auto|yes --output-format json` → agent envelope `{ boundary, rows, warning }`
 *
 * QA harness uses `--agent no` explicitly so behaviour is identical in Cursor,
 * GitHub Actions, Linux terminals, and Windows PowerShell.
 */

export type SupabaseDbQueryAgentEnvelope = {
  boundary?: string;
  rows?: Record<string, unknown>[];
  warning?: string;
};

export type ParseDbQueryRowsOptions = {
  /** Fail when fewer than this many rows are returned. */
  minRows?: number;
  /** Fail when more than this many rows are returned. */
  maxRows?: number;
};

export class SupabaseDbQueryParseError extends Error {
  readonly stdoutBytes: number;

  constructor(message: string, stdoutBytes: number) {
    super(message);
    this.name = "SupabaseDbQueryParseError";
    this.stdoutBytes = stdoutBytes;
  }
}

function topLevelKeys(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value as Record<string, unknown>).sort();
}

/**
 * Normalizes documented Supabase CLI db-query JSON shapes into a row array.
 *
 * Supported shapes (explicit, not recursive):
 * 1. Array of row objects — `--agent no --output-format json` (QA contract)
 * 2. Agent envelope with `rows` — `--agent yes --output-format json`
 */
export function parseSupabaseDbQueryRows<T extends Record<string, unknown>>(
  stdout: string,
  options: ParseDbQueryRowsOptions = {},
): T[] {
  const stdoutBytes = stdout.length;

  if (stdoutBytes === 0 || stdout.trim().length === 0) {
    throw new SupabaseDbQueryParseError(
      "DB query returned empty stdout.",
      stdoutBytes,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new SupabaseDbQueryParseError(
      `DB query stdout is not valid JSON; stdout bytes: ${stdoutBytes}.`,
      stdoutBytes,
    );
  }

  let rows: T[];

  if (Array.isArray(parsed)) {
    rows = parsed as T[];
  } else if (
    typeof parsed === "object" &&
    parsed !== null &&
    "rows" in parsed &&
    Array.isArray((parsed as SupabaseDbQueryAgentEnvelope).rows)
  ) {
    rows = (parsed as SupabaseDbQueryAgentEnvelope).rows as T[];
  } else {
    throw new SupabaseDbQueryParseError(
      `DB query JSON did not contain result rows; top-level keys: [${topLevelKeys(parsed).join(", ")}].`,
      stdoutBytes,
    );
  }

  if (options.minRows !== undefined && rows.length < options.minRows) {
    throw new SupabaseDbQueryParseError(
      `DB query returned ${rows.length} row(s); expected at least ${options.minRows}.`,
      stdoutBytes,
    );
  }

  if (options.maxRows !== undefined && rows.length > options.maxRows) {
    throw new SupabaseDbQueryParseError(
      `DB query returned ${rows.length} row(s); expected at most ${options.maxRows}.`,
      stdoutBytes,
    );
  }

  return rows;
}

/**
 * Extracts a single named column value from the first row of a db-query result.
 */
export function extractDbQueryColumn<T>(
  stdout: string,
  columnName: string,
  options: ParseDbQueryRowsOptions = {},
): T {
  const rows = parseSupabaseDbQueryRows<Record<string, unknown>>(stdout, {
    minRows: 1,
    maxRows: 1,
    ...options,
  });

  const row = rows[0];
  if (!row || !(columnName in row)) {
    throw new SupabaseDbQueryParseError(
      `DB query first row is missing column "${columnName}"; row keys: [${Object.keys(
        row ?? {},
      )
        .sort()
        .join(", ")}].`,
      stdout.length,
    );
  }

  return row[columnName] as T;
}
