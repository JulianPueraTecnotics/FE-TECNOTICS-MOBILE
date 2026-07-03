import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import "./ProductsServices.css";
import type { ItemData } from "../../../types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getAllItems, searchItems, deleteItem } from "../../../services/items.service";
import ItemModal from "../../../components/modals/ItemModal/ItemModal";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import {
  ListPageShell,
  ListPageContainer,
  ListPageHeader,
  PaginationToolbar,
  paginationRange,
  FilterField,
    FiltersMobileDrawer,
  FieldControl,
  useEffectiveViewMode,
  ColumnFilterFields,
  useColumnFilters,
  type ColumnFilterDef,
  type ViewMode,
} from "../../../components/design-system";

type FilterType = "all" | "product" | "service";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

const normalizePageSize = (value: number): number =>
  PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
  { id: "codigo", label: "Código", type: "text", icon: "ri-barcode-line" },
  { id: "nombre", label: "Nombre", type: "text", icon: "ri-text" },
  { id: "precio", label: "Precio", type: "number", icon: "ri-money-dollar-circle-line" },
  { id: "iva", label: "IVA", type: "number", icon: "ri-percent-line" },
  { id: "cantidad", label: "Cantidad", type: "number", icon: "ri-stack-line" },
  { id: "unidad", label: "Unidad", type: "text", icon: "ri-ruler-line" },
];

const ProductsServicesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
  const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
  const qFromUrl = searchParams.get("q") ?? "";

  const [items, setItems] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPageFetching, setIsPageFetching] = useState(false);
  const [filterSearch, setFilterSearch] = useState(qFromUrl);
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(limitFromUrl);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const effectiveViewMode = useEffectiveViewMode(viewMode);
  const [filtersOpen, setFiltersOpen] = useState(() => qFromUrl !== "");
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
  const filtersDropdownRef = useRef<HTMLDivElement>(null);
  const filtersToggleRef = useRef<HTMLButtonElement>(null);
  const filtersPanelRef = useRef<HTMLDivElement>(null);
  const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

  const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);

  const getRowFilterValue = useCallback((row: ItemData, filterId: string): string => {
    switch (filterId) {
      case "codigo": return row.code ?? "";
      case "nombre": return row.name ?? "";
      case "precio": return String(row.price ?? 0);
      case "iva": return String(row.taxes?.iva ?? 0);
      case "cantidad": return String(row.quantity ?? 0);
      case "unidad": return row.unidad_medida ?? "";
      default: return "";
    }
  }, []);

  const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
    useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);

  const hasActiveFilters = filterSearch.trim() !== "" || filter !== "all" || hasActiveClientFilters;

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateFiltersInQuery = (updates: { q?: string }) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("page", "1");
      if (updates.q !== undefined) {
        const value = updates.q.trim();
        if (!value) params.delete("q");
        else params.set("q", value);
      }
      return params;
    });
    setPage(1);
  };

  const didMountFilters = useRef(false);
  useEffect(() => {
    if (!didMountFilters.current) {
      didMountFilters.current = true;
      return;
    }
    if (page !== 1) {
      setPage(1);
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set("page", "1");
        return params;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, pageSize]);

  useEffect(() => {
    const timeout = window.setTimeout(() => updateFiltersInQuery({ q: debouncedSearch }), FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    let ignore = false;
    const hasData = items.length > 0;
    if (hasData) setIsPageFetching(true);
    else setLoading(true);

    (async () => {
      try {
        const q = debouncedSearch.trim();
        const response = q ? await searchItems(q, page, pageSize) : await getAllItems(page, pageSize);
        if (ignore) return;
        if (response?.ok) {
          setItems(response.items ?? []);
          setTotalPages(response.pagination?.totalPages ?? 1);
          setTotalItems(response.pagination?.total ?? 0);
        } else {
          setItems([]);
          setTotalPages(1);
          setTotalItems(0);
          errorToast("No se pudieron cargar todos los items del servidor");
        }
      } catch (error: unknown) {
        if (!ignore) {
          errorToast(error instanceof Error ? error.message : "Error al cargar items");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setIsPageFetching(false);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [page, pageSize, debouncedSearch, refreshKey]);

  useEffect(() => {
    if (page !== pageFromUrl) setPage(pageFromUrl);
  }, [pageFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePageChange = (nextPage: number) => {
    const safePage = Math.max(1, Math.min(totalPages, nextPage));
    setPage(safePage);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("page", String(safePage));
      return params;
    });
  };

  const handlePageSizeChange = (nextSize: number) => {
    const safeSize = normalizePageSize(nextSize);
    setPageSize(safeSize);
    setPage(1);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("page", "1");
      params.set("limit", String(safeSize));
      return params;
    });
  };

  const clearFilters = () => {
    setFilterSearch("");
    setFilter("all");
    clearColFilters();
    updateFiltersInQuery({ q: "" });
  };

  const updateFiltersPanelPosition = useCallback(() => {
    const toggle = filtersToggleRef.current;
    const panel = filtersPanelRef.current;
    if (!toggle) return;

    const rect = toggle.getBoundingClientRect();
    const gap = 6;
    const width = Math.min(640, window.innerWidth - 32);
    const left = Math.max(16, rect.right - width);
    const panelHeight = panel?.offsetHeight ?? 0;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUp = panelHeight > 0 && spaceBelow < panelHeight && rect.top > panelHeight + gap;
    const top = openUp ? rect.top - gap - panelHeight : rect.bottom + gap;

    setFiltersPanelStyle({
      position: "fixed",
      top: Math.max(8, top),
      left,
      width,
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useLayoutEffect(() => {
    if (!filtersOpen || isMobile) return;
    updateFiltersPanelPosition();
    const frame = requestAnimationFrame(updateFiltersPanelPosition);
    return () => cancelAnimationFrame(frame);
  }, [filtersOpen, isMobile, updateFiltersPanelPosition, filterSearch, filter]);

  useEffect(() => {
    if (!filtersOpen || isMobile) return;
    const onReflow = () => updateFiltersPanelPosition();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [filtersOpen, isMobile, updateFiltersPanelPosition]);

  useEffect(() => {
    if (!filtersOpen || isMobile) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (filtersDropdownRef.current?.contains(target) || filtersPanelRef.current?.contains(target)) return;
      setFiltersOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen, isMobile]);

  useEffect(() => {
        if (!filtersOpen || !isMobile) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFiltersOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [filtersOpen, isMobile]);

  const handleOpenCreateModal = () => {
    setSelectedItem(null);
    setIsItemModalOpen(true);
  };

  const handleOpenEditModal = (item: ItemData) => {
    setSelectedItem(item);
    setIsItemModalOpen(true);
  };

  const handleCloseItemModal = () => {
    setIsItemModalOpen(false);
    setSelectedItem(null);
  };

  const handleItemSuccess = () => setRefreshKey((k) => k + 1);

  const handleOpenDeleteModal = (itemId: string, itemName: string) => {
    setItemToDelete({ id: itemId, name: itemName });
    setIsConfirmModalOpen(true);
  };

  const handleCloseConfirmModal = () => {
    setIsConfirmModalOpen(false);
    setItemToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      const response = await deleteItem(itemToDelete.id);
      if (response && response.ok) {
        successToast("Item eliminado exitosamente");
        if (items.length === 1 && page > 1) handlePageChange(page - 1);
        else setRefreshKey((k) => k + 1);
        handleCloseConfirmModal();
      }
    } catch (error: unknown) {
      errorToast(error instanceof Error ? error.message : "Error al eliminar");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredItems = filterRows(items.filter((item) => {
    if (filter === "all") return true;
    return item.kind === filter;
  }));

  const formatPrice = (price: number) =>
    price.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  const renderTypeBadge = (item: ItemData) => (
    <span className={`type-badge ${item.kind}`}>{item.kind === "product" ? "Producto" : "Servicio"}</span>
  );

  const renderActions = (item: ItemData, layout: "table" | "list" | "cards" = "table") => (
    <div className={`action-buttons ds-row-actions products-services-actions--${layout}`}>
      <button type="button" className="btn-action" title="Editar" onClick={() => handleOpenEditModal(item)}>
        <i className="ri-edit-line" aria-hidden />
        {layout === "table" ? "Editar" : null}
      </button>
      <button
        type="button"
        className="btn-action"
        title="Eliminar"
        onClick={() => item._id != null && handleOpenDeleteModal(item._id, item.name)}
      >
        <i className="ri-delete-bin-line" aria-hidden />
        {layout === "table" ? "Eliminar" : null}
      </button>
    </div>
  );

  const { start, end } = paginationRange(page, pageSize, totalItems);

  const renderTable = () => (
    <div className="products-services-table-container ds-table-container">
      <table className="products-services-table ds-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Precio</th>
            <th>IVA</th>
            <th>Cantidad</th>
            <th>Unidad</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((item, index) => (
            <tr key={item._id ?? `item-${index}`}>
              <td className="item-code" data-label="Código">
                {item.code || "N/A"}
              </td>
              <td className="item-name" data-label="Nombre">
                {item.name}
              </td>
              <td data-label="Tipo">{renderTypeBadge(item)}</td>
              <td className="item-price" data-label="Precio">
                {formatPrice(item.price)}
              </td>
              <td data-label="IVA">{item.taxes?.iva ?? 0}%</td>
              <td data-label="Cantidad">{item.quantity}</td>
              <td className="item-unidad" data-label="Unidad">
                {item.unidad_medida ?? "—"}
              </td>
              <td data-label="Acciones">{renderActions(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderList = () => (
    <div className="products-services-list-view">
      {filteredItems.map((item, index) => (
        <article key={item._id ?? `item-list-${index}`} className="products-services-list-item">
          <div className="products-services-list-item__body">
            <div className="products-services-list-item__head">
              <strong className="products-services-list-item__title">{item.name}</strong>
              {renderTypeBadge(item)}
            </div>
            <div className="products-services-list-item__sub">
              <strong>{item.code || "Sin código"}</strong>
            </div>
            <dl className="products-services-list-item__fields">
              <div className="products-services-list-item__field products-services-list-item__field--highlight">
                <dt>Precio</dt>
                <dd className="item-price">{formatPrice(item.price)}</dd>
              </div>
              <div className="products-services-list-item__field">
                <dt>IVA</dt>
                <dd>{item.taxes?.iva ?? 0}%</dd>
              </div>
              <div className="products-services-list-item__field">
                <dt>Cantidad</dt>
                <dd>{item.quantity}</dd>
              </div>
              <div className="products-services-list-item__field">
                <dt>Unidad</dt>
                <dd>{item.unidad_medida ?? "—"}</dd>
              </div>
            </dl>
          </div>
          <footer className="products-services-list-item__actions">{renderActions(item, "list")}</footer>
        </article>
      ))}
    </div>
  );

  const renderCards = () => (
    <div className="products-services-cards-view">
      {filteredItems.map((item, index) => (
        <article key={item._id ?? `item-card-${index}`} className="products-services-card">
          <div className="products-services-card__header">
            <strong className="products-services-card__title">{item.name}</strong>
            {renderTypeBadge(item)}
          </div>
          <div className="products-services-card__sub">
            <strong>{item.code || "Sin código"}</strong>
          </div>
          <dl className="products-services-card__fields products-services-card__fields--grid">
            <div className="products-services-card__field products-services-card__field--highlight">
              <dt>Precio</dt>
              <dd className="item-price">{formatPrice(item.price)}</dd>
            </div>
            <div className="products-services-card__field">
              <dt>IVA</dt>
              <dd>{item.taxes?.iva ?? 0}%</dd>
            </div>
            <div className="products-services-card__field">
              <dt>Cantidad</dt>
              <dd>{item.quantity}</dd>
            </div>
            <div className="products-services-card__field">
              <dt>Unidad</dt>
              <dd>{item.unidad_medida ?? "—"}</dd>
            </div>
          </dl>
          <footer className="products-services-card__actions">{renderActions(item, "cards")}</footer>
        </article>
      ))}
    </div>
  );

  const renderView = () => {
    if (effectiveViewMode === "list") return renderList();
    if (effectiveViewMode === "cards") return renderCards();
    return renderTable();
  };

  const filterContent = (
        <>
          <FilterField label="Búsqueda" htmlFor="products-services-filter-search" icon="ri-search-line">
                    <FieldControl
                      id="products-services-filter-search"
                      type="text"
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      placeholder="Buscar item..."
                    />
                  </FilterField>
                  <FilterField label="Tipo" htmlFor="products-services-filter-tipo" icon="ri-price-tag-3-line">
                    <FieldControl
                      as="select"
                      id="products-services-filter-tipo"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as FilterType)}
                    >
                      <option value="all">Todos</option>
                      <option value="product">Productos</option>
                      <option value="service">Servicios</option>
                    </FieldControl>
                  </FilterField>
          <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="products-col" />
        </>
  );

  const filtersPanelContent = (
    <>
      <div className="products-services-filters-panel__head">
        <h2 id="products-services-filters-heading" className="products-services-filters-panel__title">
          Filtrar items
        </h2>
        {hasActiveFilters && (
          <button type="button" className="products-services-filters-clear" onClick={clearFilters}>
            Limpiar
          </button>
        )}
      </div>
      <div className="products-services-filters-grid">{filterContent}</div>
    </>
  );

  const filtersToolbar = (
    <div className="products-services-filters-toolbar">
      {hasActiveFilters && (
        <button type="button" className="products-services-filters-clear products-services-filters-clear--inline" onClick={clearFilters}>
          <i className="ri-close-circle-line" aria-hidden />
          Limpiar
        </button>
      )}
      <div className="products-services-filters-dropdown" ref={filtersDropdownRef}>
        <button
          ref={filtersToggleRef}
          type="button"
          className={`products-services-filters-toggle ${filtersOpen ? "open" : ""}`}
          onClick={() => setFiltersOpen((value) => !value)}
          aria-expanded={filtersOpen}
          aria-haspopup="true"
          aria-controls="products-services-filters-panel"
        >
          <i className="ri-filter-3-line" aria-hidden />
          Filtros
          {hasActiveFilters && <span className="products-services-filters-badge" aria-hidden />}
          <i className={`ri-arrow-down-s-line products-services-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
        </button>
        {filtersOpen &&
          !isMobile &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={filtersPanelRef}
              id="products-services-filters-panel"
              className="products-services-filters-panel products-services-filters-panel--floating"
              style={filtersPanelStyle}
              role="region"
              aria-labelledby="products-services-filters-heading"
            >
              {filtersPanelContent}
            </div>,
            document.body,
          )}
      </div>
    </div>
  );

  return (
    <ListPageShell className="products-services-page">
      <ListPageContainer className="products-services-container">
        <div className="products-services-sticky-head">
          <ListPageHeader
            className="products-services-header"
            title="Productos y Servicios"
            subtitle="Administra el catálogo de productos y servicios que ofreces"
            actions={
              <button type="button" className="btn-primary" onClick={handleOpenCreateModal}>
                <i className="ri-add-line" aria-hidden />
                Nuevo Item
              </button>
            }
          />
        </div>

        <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar items"
    ariaLabelledBy="products-services-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

        <PaginationToolbar
          position="top"
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          rangeStart={start}
          rangeEnd={end}
          isFetching={isPageFetching || loading}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showViewToggle
          beforeViewToggle={filtersToolbar}
          emptyLabel={totalItems === 0 ? "Sin items" : undefined}
        />

        {loading ? (
          <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
            <p>Cargando items...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
            <p>No hay items para mostrar</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
            <p>No hay items que coincidan con el filtro de tipo</p>
          </div>
        ) : (
          <>
            {renderView()}
            <PaginationToolbar
              position="bottom"
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              rangeStart={start}
              rangeEnd={end}
              onPageChange={handlePageChange}
              isFetching={isPageFetching}
              emptyLabel={totalItems === 0 ? "Sin items" : undefined}
            />
          </>
        )}
      </ListPageContainer>

      <ItemModal isOpen={isItemModalOpen} onClose={handleCloseItemModal} onSuccess={handleItemSuccess} item={selectedItem} />
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={handleCloseConfirmModal}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar Item?"
        message={`¿Estás seguro de que deseas eliminar "${itemToDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
        loading={isDeleting}
      />
    </ListPageShell>
  );
};

export default ProductsServicesPage;
