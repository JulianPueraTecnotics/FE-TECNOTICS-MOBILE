import { useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { COMPANY_MENU, type MenuItem } from "../../../components/shared/nav/menu.config";
import { PATHS } from "../../../router/paths.contants";
import "./ComingSoon.css";

/** Busca en el menú (plano + hijos) el item cuya ruta coincide con `pathname`. */
function findMenuItemByPath(pathname: string): MenuItem | undefined {
    for (const item of COMPANY_MENU) {
        if (item.path === pathname) return item;
        const child = item.children?.find((c) => c.path === pathname);
        if (child) return child;
    }
    return undefined;
}

/**
 * Página placeholder para módulos aún no construidos (Recaudos, Cotizaciones, Remisiones,
 * Facturas de plantilla, Compras y gastos, Cajas y bancos, Contabilidad).
 * Permite validar la estructura de navegación final sin tener la lógica implementada.
 */
const ComingSoon: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const item = useMemo(() => findMenuItemByPath(location.pathname), [location.pathname]);
    const title = item?.label ?? "Módulo";
    const icon = item?.icon ?? "ri-tools-line";

    return (
        <main className="coming-soon">
            <div className="coming-soon__card">
                <div className="coming-soon__icon">
                    <i className={icon} aria-hidden />
                </div>
                <h1 className="coming-soon__title">{title}</h1>
                <p className="coming-soon__badge">Próximamente</p>
                <p className="coming-soon__text">
                    Este módulo está en construcción. Pronto podrás gestionar <strong>{title}</strong> desde aquí.
                </p>
                <button type="button" className="btn-primary coming-soon__btn" onClick={() => navigate(PATHS.DASHBOARD)}>
                    <i className="ri-arrow-left-line" aria-hidden /> Volver al inicio
                </button>
            </div>
        </main>
    );
};

export default ComingSoon;
