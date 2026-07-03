import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./shims/fixExpoStaticError";
import "./index.css";
import "./mobile-overrides.css";
import PortalApp from "./PortalApp";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <PortalApp />
    </StrictMode>,
);
