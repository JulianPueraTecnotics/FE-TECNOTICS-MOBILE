import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { PATHS } from "../../../router/paths.contants";
import logoDev from "../../../assets/logo.png";
import hero1 from "../../../assets/WEBFACTURACIONELECTRONICA-01.jpg.jpeg";
import hero2 from "../../../assets/WEBFACTURACIONELECTRONICA-02.jpg.jpeg";
import hero3 from "../../../assets/WEBFACTURACIONELECTRONICA-03.jpg.jpeg";
import img09 from "../../../assets/WEBFACTURACIONELECTRONICA-09.png";
import img10 from "../../../assets/WEBFACTURACIONELECTRONICA-10.png";
import "./Home.css";

const HERO_IMAGES = [hero1, hero2, hero3];

const CAROUSEL_INTERVAL_MS = 5000;

const FAQ_ITEMS = [
    {
        question: "¿Cumple con la DIAN?",
        answer: "Sí. Nuestro sistema cumple con todos los requisitos establecidos por la DIAN para la facturación electrónica en Colombia. Las facturas generadas son validadas electrónicamente y cumplen con la normativa vigente, garantizando que tus documentos tengan validez legal.",
    },
    {
        question: "¿Puedo acceder desde cualquier dispositivo?",
        answer: "Sí. La plataforma funciona en la nube, por lo que puedes acceder desde cualquier dispositivo con conexión a internet, como computadores, tablets o teléfonos móviles, sin necesidad de instalar software adicional.",
    },
    {
        question: "¿Mis documentos están seguros?",
        answer: "Sí. Toda la información se almacena en servidores seguros con protocolos de protección de datos y copias de seguridad periódicas. Esto garantiza la confidencialidad, integridad y disponibilidad de tus documentos electrónicos.",
    },
    {
        question: "¿Puedo emitir facturas electrónicas ilimitadas?",
        answer: "Dependiendo del plan contratado, podrás emitir una cantidad determinada o ilimitada de facturas electrónicas. Nuestro objetivo es ofrecer soluciones flexibles que se adapten a las necesidades de cada empresa o emprendedor.",
    },
    {
        question: "¿Cómo funciona la facturación electrónica?",
        answer: "El sistema permite crear la factura digitalmente con los datos del cliente, productos o servicios. Luego, la factura se envía automáticamente a la DIAN para su validación. Una vez aprobada, se genera el documento oficial que puede enviarse al cliente por correo electrónico.",
    },
    {
        question: "¿Cuáles son los beneficios de la Facturación electrónica?",
        answer: "La facturación electrónica ofrece múltiples beneficios, entre ellos:\n• Reducción de costos en papel e impresión\n• Mayor control y organización de la información\n• Envío rápido de facturas a los clientes\n• Cumplimiento con las normativas fiscales\n• Automatización de procesos administrativos",
    },
    {
        question: "¿Qué debo hacer para empezar a facturar?",
        answer: "Solo necesitas registrarte en la plataforma, configurar los datos de tu empresa y habilitar la facturación electrónica según los requisitos de la DIAN. Una vez completado este proceso, podrás comenzar a emitir facturas electrónicas de forma rápida y sencilla.",
    },
];

const MOBILE_BREAKPOINT = 768;

const HomePage: React.FC = () => {
    const location = useLocation();
    const [heroIndex, setHeroIndex] = useState(0);
    const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);
    const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT);

    useEffect(() => {
        const hash = location.hash?.replace("#", "");
        if (hash) {
            const el = document.getElementById(hash);
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [location.pathname, location.hash]);

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        const handle = () => setIsMobile(mql.matches);
        mql.addEventListener("change", handle);
        handle();
        return () => mql.removeEventListener("change", handle);
    }, []);

    useEffect(() => {
        if (isMobile) return;
        const id = setInterval(() => {
            setHeroIndex((i) => (i + 1) % HERO_IMAGES.length);
        }, CAROUSEL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [isMobile]);

    return (
        <div className="home">
            {/* Hero con carrusel – igual a la imagen: overlay azul-verde, texto blanco a la izquierda */}
            <section className="home__hero">
                <div className="home__hero-bg">
                    {HERO_IMAGES.map((src, i) => (
                        <div
                            key={src}
                            className={`home__hero-slide ${i === heroIndex ? "home__hero-slide--active" : ""}`}
                            style={{ backgroundImage: `url(${src})` }}
                        />
                    ))}
                    <div className="home__hero-overlay" aria-hidden />
                </div>
                <div className="home__hero-content">
                    <h1>
                        Factura electronicamente sin
                        <br />
                        complicaciones.
                    </h1>
                    <p>
                        Nuestra plataforma de facturación electrónica en la nube te permite emitir, enviar y gestionar
                        tus facturas de forma rápida, segura y 100% compatible con la normativa de la DIAN.
                    </p>
                    <NavLink to={PATHS.REGISTER} className="home__cta">
                        Comenzar ahora
                    </NavLink>
                </div>
                <div className="home__hero-dots" aria-hidden={isMobile}>
                    {HERO_IMAGES.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            className={`home__hero-dot ${i === heroIndex ? "home__hero-dot--active" : ""}`}
                            aria-label={`Slide ${i + 1}`}
                            onClick={() => setHeroIndex(i)}
                        />
                    ))}
                </div>
            </section>

            {/* 4 features con iconos azules */}
            <section className="home section home__features-wrap">
                <div className="home__features-grid">
                    <div className="home__feature-card">
                        <div className="home__feature-icon">
                            <i className="ri-file-list-3-line"></i>
                        </div>
                        <h3>Facturación electrónica en segundos</h3>
                        <p>
                            Emite facturas electrónicas de forma rápida y segura desde cualquier dispositivo conectado a
                            internet.
                        </p>
                    </div>
                    <div className="home__feature-card">
                        <div className="home__feature-icon">
                            <i className="ri-shield-check-line"></i>
                        </div>
                        <h3>Cumplimiento con la DIAN</h3>
                        <p>
                            Nuestra plataforma cumple con la normativa vigente de la DIAN, garantizando la validez legal
                            de tus facturas electrónicas.
                        </p>
                    </div>
                    <div className="home__feature-card">
                        <div className="home__feature-icon">
                            <i className="ri-cloud-line"></i>
                        </div>
                        <h3>Información segura en la nube</h3>
                        <p>
                            Consulta y gestiona tus documentos electrónicos de forma segura desde cualquier lugar y
                            dispositivo.
                        </p>
                    </div>
                    <div className="home__feature-card">
                        <div className="home__feature-icon">
                            <i className="ri-refresh-line"></i>
                        </div>
                        <h3>Integración y automatización</h3>
                        <p>
                            Conecta tu facturación con otros procesos de tu empresa y automatiza la gestión de tu
                            información.
                        </p>
                    </div>
                </div>

                {/* Facturación Electrónica Inteligente: título + imagen + lista con checkmarks */}
                <h2 className="home__intro-title">Facturación Electrónica Inteligente</h2>
                <p className="home__intro-subtitle">
                    Emite, gestiona y controla tu facturación electrónica de forma simple, rápida y segura cumpliendo con
                    la normativa de la DIAN.
                </p>
                <div className="home__intro-row">
                    <div className="home__intro-image-wrap">
                        <img
                            src={img09}
                            alt="Gestión de facturas en la plataforma"
                            className="home__intro-image"
                        />
                    </div>
                    <ul className="home__intro-benefits">
                        <li><i className="ri-checkbox-circle-fill"></i> Emite facturas electrónicas en segundos.</li>
                        <li><i className="ri-checkbox-circle-fill"></i> Cumple con los requisitos de la DIAN automáticamente.</li>
                        <li><i className="ri-checkbox-circle-fill"></i> Gestiona clientes, productos y servicios fácilmente.</li>
                        <li><i className="ri-checkbox-circle-fill"></i> Envía facturas electrónicas directamente a tus clientes por correo.</li>
                        <li><i className="ri-checkbox-circle-fill"></i> Accede a reportes claros sobre tus ventas y documentos emitidos.</li>
                    </ul>
                </div>
            </section>

            {/* Control total – mismo layout: título centrado + imagen izquierda + lista con checks derecha */}
            <section className="home section home__control">
                <h2 className="home__control-title">Control total de tu facturación</h2>
                <p className="home__control-subtitle">
                    Administra toda tu información desde un solo lugar con herramientas diseñadas para simplificar tu
                    gestión empresarial.
                </p>
                <div className="home__control-row">
                    <div className="home__control-image-wrap">
                        <img
                            src={img10}
                            alt="Panel de estadísticas e indicadores de facturación"
                            className="home__control-image"
                        />
                    </div>
                    <ul className="home__control-benefits">
                        <li><i className="ri-checkbox-circle-fill"></i> Consulta el historial completo de facturas emitidas.</li>
                        <li><i className="ri-checkbox-circle-fill"></i> Visualiza reportes de ventas y documentos en tiempo real.</li>
                        <li><i className="ri-checkbox-circle-fill"></i> Organiza tus clientes, productos y servicios.</li>
                        <li><i className="ri-checkbox-circle-fill"></i> Accede a tu información desde cualquier dispositivo.</li>
                        <li><i className="ri-checkbox-circle-fill"></i> Mantén tus documentos organizados y disponibles cuando los necesites.</li>
                    </ul>
                </div>
            </section>

            {/* Cómo funciona - 4 pasos: iconos circulares, línea conectora, títulos en azul */}
            <section id="como-funciona" className="home section home__steps-section">
                <h2 className="home__steps-main-title">Emite tu facturación electrónica en 4 pasos</h2>
                <p className="home__steps-subtitle">
                    Un proceso simple para cumplir con la DIAN y gestionar tu facturación sin complicaciones.
                </p>
                <div className="home__steps">
                    <div className="home__step">
                        <div className="home__step-icon-wrap">
                            <i className="ri-building-line"></i>
                        </div>
                        <div className="home__step-connector"></div>
                        <h3 className="home__step-title">Registro de la empresa</h3>
                        <p className="home__step-desc">
                            Crea tu cuenta y registra la información de tu empresa para comenzar a emitir documentos
                            electrónicos.
                        </p>
                    </div>
                    <div className="home__step">
                        <div className="home__step-icon-wrap">
                            <i className="ri-settings-3-line"></i>
                        </div>
                        <div className="home__step-connector"></div>
                        <h3 className="home__step-title">Configuración inicial</h3>
                        <p className="home__step-desc">
                            Configura tus datos fiscales, resolución de facturación, clientes y productos para preparar
                            el sistema.
                        </p>
                    </div>
                    <div className="home__step">
                        <div className="home__step-icon-wrap">
                            <i className="ri-file-list-3-line"></i>
                        </div>
                        <div className="home__step-connector"></div>
                        <h3 className="home__step-title">Emisión de facturas</h3>
                        <p className="home__step-desc">
                            Genera y envía tus facturas electrónicas de forma rápida y segura cumpliendo con la
                            normativa DIAN.
                        </p>
                    </div>
                    <div className="home__step">
                        <div className="home__step-icon-wrap">
                            <i className="ri-cloud-line"></i>
                        </div>
                        <div className="home__step-connector"></div>
                        <h3 className="home__step-title">Validación y gestión</h3>
                        <p className="home__step-desc">
                            La factura se valida automáticamente ante la DIAN y queda disponible para consulta, reportes
                            y control.
                        </p>
                    </div>
                </div>
            </section>

            {/* Planes – estilo imagen: puntos azules, precio en pill gradiente, checks azules, botón azul */}
            <section id="planes" className="home section home__plans-section">
                <div className="home__plans-heading">
                    <h2 className="home__plans-title">Elige el plan que se adapta a tu negocio</h2>
                </div>
                <div className="home__plans-grid">
                    <div className="home__plan-card">
                        <h3>Plan Básico</h3>
                        <p className="home__plan-desc">Empresas pequeñas que facturan regularmente.</p>
                        <div className="home__plan-price-pill">$119.000 COP/año</div>
                        <p className="home__plan-que-incluye">QUE INCLUYE</p>
                        <ul className="home__plan-features">
                            <li><i className="ri-checkbox-circle-fill"></i> Hasta 30 documentos electrónicos al año</li>
                            <li><i className="ri-checkbox-circle-fill"></i> 1 usuario administrador</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Facturación electrónica válida ante la DIAN</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Generación de factura electrónica de venta</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Notas crédito y débito</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Envío automático al cliente por correo</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Firma digital incluida por 1 año</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Soporte básico por correo</li>
                        </ul>
                        <NavLink to={PATHS.REGISTER} className="home__plan-cta">
                            Seleccionar plan
                        </NavLink>
                    </div>

                    <div className="home__plan-card">
                        <h3>Plan Empresarial</h3>
                        <p className="home__plan-desc">Emprendedores o empresas con bajo volumen de facturación.</p>
                        <div className="home__plan-price-pill">$249.000 COP/año</div>
                        <p className="home__plan-que-incluye">QUE INCLUYE</p>
                        <ul className="home__plan-features">
                            <li><i className="ri-checkbox-circle-fill"></i> Hasta 150 documentos electrónicos al año</li>
                            <li><i className="ri-checkbox-circle-fill"></i> 1 usuario administrador</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Facturación electrónica DIAN</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Notas crédito y débito</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Envío automático de facturas</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Historial y consulta de documentos</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Reportes básicos de facturación</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Firma digital incluida por 1 año</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Soporte técnico</li>
                        </ul>
                        <NavLink to={PATHS.REGISTER} className="home__plan-cta">
                            Seleccionar plan
                        </NavLink>
                    </div>

                    <div className="home__plan-card home__plan-card--popular">
                        <span className="home__plan-badge">MÁS POPULAR</span>
                        <h3>Plan Profesional</h3>
                        <p className="home__plan-desc">Empresas pequeñas que facturan regularmente.</p>
                        <div className="home__plan-price-pill">$699.000 COP/año</div>
                        <p className="home__plan-que-incluye">QUE INCLUYE</p>
                        <ul className="home__plan-features">
                            <li><i className="ri-checkbox-circle-fill"></i> Hasta 600 documentos electrónicos al año</li>
                            <li><i className="ri-checkbox-circle-fill"></i> 2 usuarios</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Facturación electrónica DIAN</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Notas crédito y débito</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Envío automático por correo</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Reportes avanzados de facturación</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Integración con inventario básico</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Firma digital incluida por 1 año</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Soporte prioritario</li>
                        </ul>
                        <NavLink to={PATHS.REGISTER} className="home__plan-cta">
                            Seleccionar plan
                        </NavLink>
                    </div>

                    <div className="home__plan-card home__plan-card--custom">
                        <h3>Plan Personalizado</h3>
                        <p className="home__plan-desc">
                            Para empresas que necesitan un volumen mayor o condiciones a la medida.
                        </p>
                        <div className="home__plan-custom-fields">
                            <div className="home__plan-select-wrap">
                                <span className="home__plan-select-label">Documentos electrónicos</span>
                                <select className="home__plan-select" disabled aria-label="Documentos electrónicos">
                                    <option>Seleccionar</option>
                                </select>
                                <i className="ri-arrow-down-s-line home__plan-select-arrow" aria-hidden></i>
                            </div>
                            <div className="home__plan-select-wrap">
                                <span className="home__plan-select-label">Usuarios</span>
                                <select className="home__plan-select" disabled aria-label="Usuarios">
                                    <option>Seleccionar</option>
                                </select>
                                <i className="ri-arrow-down-s-line home__plan-select-arrow" aria-hidden></i>
                            </div>
                        </div>
                        <p className="home__plan-que-incluye">QUE INCLUYE</p>
                        <ul className="home__plan-features">
                            <li><i className="ri-checkbox-circle-fill"></i> Documentos electrónicos</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Usuarios</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Facturación electrónica DIAN</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Notas crédito y débito</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Envío automático por correo</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Reportes avanzados de facturación</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Integración con inventario básico</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Firma digital incluida por 1 año</li>
                            <li><i className="ri-checkbox-circle-fill"></i> Soporte prioritario</li>
                        </ul>
                        <NavLink to={PATHS.REGISTER} className="home__plan-cta">
                            Seleccionar plan
                        </NavLink>
                    </div>
                </div>
            </section>

            {/* FAQ – acordeón desplegable, estilo imagen */}
            <section className="home__faq section">
                <h2 className="home__faq-title">Explora las preguntas frecuentes</h2>
                <div className="home__faq-box">
                    {FAQ_ITEMS.map((item, index) => (
                        <div
                            key={index}
                            className={`home__faq-item ${faqOpenIndex === index ? "home__faq-item--open" : ""}`}
                        >
                            <button
                                type="button"
                                className="home__faq-question"
                                onClick={() => setFaqOpenIndex(faqOpenIndex === index ? null : index)}
                                aria-expanded={faqOpenIndex === index}
                                aria-controls={`faq-answer-${index}`}
                                id={`faq-question-${index}`}
                            >
                                <span>{item.question}</span>
                                <i className="ri-arrow-down-s-line home__faq-chevron" aria-hidden></i>
                            </button>
                            <div
                                id={`faq-answer-${index}`}
                                className="home__faq-answer"
                                role="region"
                                aria-labelledby={`faq-question-${index}`}
                            >
                                <p>{item.answer}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="home__footer">
                <div className="home__footer-inner">
                    <div className="home__footer-block home__footer-social">
                        <h3 className="home__footer-title">Redes sociales</h3>
                        <ul className="home__footer-links">
                            <li>
                                <a href="https://wa.me/573185078721" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                                    <i className="ri-whatsapp-fill" />
                                </a>
                            </li>
                            <li>
                                <a href="https://www.instagram.com/tecnotics_sas" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                                    <i className="ri-instagram-line" />
                                </a>
                            </li>
                            <li>
                                <a href="https://www.linkedin.com/company/tecnotics" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                                    <i className="ri-linkedin-fill" />
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div className="home__footer-block home__footer-actions">
                        <h3 className="home__footer-title">Acciones rápidas</h3>
                        <ul className="home__footer-links">
                            <li><NavLink to={PATHS.HOME}>Inicio</NavLink></li>
                            <li><NavLink to={PATHS.HOME_HOW_IT_WORKS}>Cómo funciona</NavLink></li>
                            <li><NavLink to={PATHS.HOME_PLANS}>Planes</NavLink></li>
                            <li><NavLink to={PATHS.LOGIN}>Iniciar sesión</NavLink></li>
                            <li><NavLink to={PATHS.REGISTER}>Registrarse</NavLink></li>
                            <li><NavLink to={PATHS.FORGOT_PASSWORD}>Recuperar contraseña</NavLink></li>
                        </ul>
                    </div>
                    <div className="home__footer-block home__footer-dev">
                        <span className="home__footer-dev-label">Desarrollado por</span>
                        <a href="https://tecnotics.com" target="_blank" rel="noopener noreferrer" className="home__footer-dev-logo" aria-label="Tecnotics">
                            <img src={logoDev} alt="Tecnotics - Soluciones corporativas" />
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default HomePage;
