import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./ProductsServices.css";
import type { ItemData } from "../../../types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
  getAllItems,
  searchItems,
  deleteItem,
} from "../../../services/items.service";
import ItemModal from "../../../components/modals/ItemModal/ItemModal";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import {
  errorToast,
  successToast,
} from "../../../components/shared/toast/toasts";

type FilterType = "all" | "product" | "service";

const ProductsServicesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
  const [items, setItems] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPageFetching, setIsPageFetching] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(pageFromUrl);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const debouncedSearch = useDebouncedValue(searchTerm, FILTER_DEBOUNCE_MS);

  // Estados para modales
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handlePageChange = (nextPage: number) => {
    const safePage = Math.max(1, Math.min(totalPages, nextPage));
    setPage(safePage);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("page", String(safePage));
      return params;
    });
  };

  // Abrir modal para crear item
  const handleOpenCreateModal = () => {
    setSelectedItem(null);
    setIsItemModalOpen(true);
  };

  // Abrir modal para editar item
  const handleOpenEditModal = (item: ItemData) => {
    setSelectedItem(item);
    setIsItemModalOpen(true);
  };

  // Cerrar modal de item
  const handleCloseItemModal = () => {
    setIsItemModalOpen(false);
    setSelectedItem(null);
  };

  // Cuando se crea/edita un item exitosamente
  const handleItemSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

  // Abrir modal de confirmación para eliminar
  const handleOpenDeleteModal = (itemId: string, itemName: string) => {
    setItemToDelete({ id: itemId, name: itemName });
    setIsConfirmModalOpen(true);
  };

  // Cerrar modal de confirmación
  const handleCloseConfirmModal = () => {
    setIsConfirmModalOpen(false);
    setItemToDelete(null);
  };

  // Confirmar eliminación
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      const response = await deleteItem(itemToDelete.id);
      if (response && response.ok) {
        successToast("Item eliminado exitosamente");
        // Si era el último elemento de una página > 1, retroceder; si no, refrescar.
        if (items.length === 1 && page > 1) {
          handlePageChange(page - 1);
        } else {
          setRefreshKey((k) => k + 1);
        }
        handleCloseConfirmModal();
      }
    } catch (error: unknown) {
      errorToast(error instanceof Error ? error.message : "Error al eliminar");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtrar items por tipo
  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    return item.kind === filter;
  });

  // Formatear precio
  const formatPrice = (price: number) => {
    return price.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  useEffect(() => {
    let ignore = false;
    const hasData = items.length > 0;
    if (hasData) {
      setIsPageFetching(true);
    } else {
      setLoading(true);
    }
    (async () => {
      try {
        const q = debouncedSearch.trim();
        const response = q
          ? await searchItems(q, page, 20)
          : await getAllItems(page, 20);
        if (ignore || !response?.ok) return;
        setItems(response.items);
        setTotalPages(response.pagination.totalPages);
      } catch (error: unknown) {
        if (!ignore) {
          errorToast(
            error instanceof Error ? error.message : "Error al cargar items",
          );
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
  }, [page, debouncedSearch, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps -- items.length solo afecta el tipo de indicador de carga

  useEffect(() => {
    if (page !== pageFromUrl) {
      setPage(pageFromUrl);
    }
  }, [pageFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps -- solo sincronizar desde la URL

  return (
    <main className="products-services-page">
      <div className="products-services-container">
        <div className="products-services-header">
          <div className="header-content">
            <h1>Productos y Servicios</h1>
            <p>Administra el catálogo de productos y servicios que ofreces</p>
          </div>
          <div className="header-actions">
            <button className="btn-primary" onClick={handleOpenCreateModal}>
              Nuevo Item
            </button>
            <div className="search-box">
              <i className="ri-search-line"></i>
              <input
                type="text"
                placeholder="Buscar item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="filter-tabs">
          <button
            className={`tab-button ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Todos
          </button>
          <button
            className={`tab-button ${filter === "product" ? "active" : ""}`}
            onClick={() => setFilter("product")}
          >
            Productos
          </button>
          <button
            className={`tab-button ${filter === "service" ? "active" : ""}`}
            onClick={() => setFilter("service")}
          >
            Servicios
          </button>
        </div>

        {loading ? (
          <div className="page-loading" style={{ textAlign: "center", padding: "40px" }}>
            <p>Cargando items...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="page-loading" style={{ textAlign: "center", padding: "40px" }}>
            <p>No hay items para mostrar</p>
          </div>
        ) : (
          <>
            <div className="pagination pagination--top">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1 || isPageFetching}
                aria-label="Página anterior"
              >
                Anterior
              </button>
              <span className="pagination__info">
                Página {page} de {totalPages}
                {isPageFetching ? " - Actualizando..." : ""}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages || isPageFetching}
                aria-label="Página siguiente"
              >
                Siguiente
              </button>
            </div>
            <div className="products-services-table-container">
              <table className="products-services-table">
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
                      <td className="item-code" data-label="Código">{item.code || "N/A"}</td>
                      <td className="item-name" data-label="Nombre">{item.name}</td>
                      <td data-label="Tipo">
                        <span className={`type-badge ${item.kind}`}>
                          {item.kind === "product" ? "Producto" : "Servicio"}
                        </span>
                      </td>
                      <td className="item-price" data-label="Precio">{formatPrice(item.price)}</td>
                      <td data-label="IVA">{item.taxes?.iva ?? 0}%</td>
                      <td data-label="Cantidad">{item.quantity}</td>
                      <td className="item-unidad" data-label="Unidad">
                        {item.unidad_medida ?? "—"}
                      </td>
                      <td data-label="Acciones">
                        <div className="action-buttons">
                          <button
                            className="btn-icon"
                            title="Editar"
                            onClick={() => handleOpenEditModal(item)}
                          >
                            <i className="ri-edit-line"></i>
                          </button>
                          <button
                            className="btn-icon"
                            title="Eliminar"
                            onClick={() =>
                              item._id != null &&
                              handleOpenDeleteModal(item._id, item.name)
                            }
                          >
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination pagination--bottom">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1 || isPageFetching}
                aria-label="Página anterior"
              >
                Anterior
              </button>
              <span className="pagination__info">
                Página {page} de {totalPages}
                {isPageFetching ? " - Actualizando..." : ""}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages || isPageFetching}
                aria-label="Página siguiente"
              >
                Siguiente
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modales */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={handleCloseItemModal}
        onSuccess={handleItemSuccess}
        item={selectedItem}
      />
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
    </main>
  );
};

export default ProductsServicesPage;
