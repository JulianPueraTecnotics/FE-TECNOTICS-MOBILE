import { useEffect, useMemo, useRef, useState } from "react";
import { paginationRange } from "../../../components/design-system";
import { normalizePageSize, PAGE_SIZE_OPTIONS } from "../ledgerFormat";

export function useClientPagination<T>(items: T[], resetDeps: unknown[] = [], initialPageSize = 20) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(initialPageSize);

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);

    const paginated = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return items.slice(start, start + pageSize);
    }, [items, safePage, pageSize]);

    const { start, end } = paginationRange(safePage, pageSize, totalItems);

    const didMount = useRef(false);
    useEffect(() => {
        if (!didMount.current) {
            didMount.current = true;
            return;
        }
        setPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...resetDeps, pageSize]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const handlePageChange = (next: number) => setPage(Math.max(1, Math.min(totalPages, next)));
    const handlePageSizeChange = (next: number) => {
        setPageSize(normalizePageSize(next));
        setPage(1);
    };

    return {
        page: safePage,
        pageSize,
        totalItems,
        totalPages,
        paginated,
        start,
        end,
        handlePageChange,
        handlePageSizeChange,
        PAGE_SIZE_OPTIONS,
    };
}
