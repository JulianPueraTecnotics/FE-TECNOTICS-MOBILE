import { useTheme } from "../../../store/theme.context";
import "./ThemeToggle.css";

interface ThemeToggleProps {
    className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === "dark";

    return (
        <button
            type="button"
            className={`theme-toggle${isDark ? " is-dark" : ""}${className ? ` ${className}` : ""}`}
            onClick={toggleTheme}
            role="switch"
            aria-checked={isDark}
            aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            title={isDark ? "Tema claro" : "Tema oscuro"}
        >
            <span className="theme-toggle__track">
                <i className="ri-sun-line theme-toggle__icon theme-toggle__icon--sun" aria-hidden />
                <span className="theme-toggle__thumb" aria-hidden />
                <i className="ri-moon-line theme-toggle__icon theme-toggle__icon--moon" aria-hidden />
            </span>
        </button>
    );
};

export default ThemeToggle;
