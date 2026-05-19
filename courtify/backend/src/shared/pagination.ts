/**
 * Central pagination config — change PAGE_SIZE here to affect all list endpoints.
 * Override via env: PAGE_SIZE=20 in docker-compose or .env
 */
export const PAGE_SIZE = parseInt(process.env.PAGE_SIZE ?? '20', 10);

export interface PaginatedResult<T> {
  rows: T[];
  total_count: number;
  current_page: number;
  total_pages: number;
  per_page: number;
}

export function paginate<T>(
  rows: T[],
  total_count: number,
  page: number,
): PaginatedResult<T> {
  return {
    rows,
    total_count,
    current_page: page,
    total_pages: Math.ceil(total_count / PAGE_SIZE),
    per_page: PAGE_SIZE,
  };
}

/** Shared query schema fields — add to any module's QuerySchema */
export const paginationQueryDefaults = {
  page: 1,
  sort_dir: 'desc' as const,
};
