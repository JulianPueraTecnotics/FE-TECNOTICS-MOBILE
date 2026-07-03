export const DEFAULT_PAGE_SIZE = 20;

export function paginationRange(page: number, pageSize: number, totalItems: number) {
    const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);
    return { start, end };
}
