export const FAQ_ITEMS = [
  {
    question: "¿Cumple con la DIAN?",
    answer:
      "Sí. Nuestro sistema cumple con todos los requisitos establecidos por la DIAN para la facturación electrónica en Colombia. Las facturas generadas son validadas electrónicamente y cumplen con la normativa vigente, garantizando que tus documentos tengan validez legal.",
  },
  {
    question: "¿Puedo acceder desde cualquier dispositivo?",
    answer:
      "Sí. La plataforma funciona en la nube, por lo que puedes acceder desde cualquier dispositivo con conexión a internet, como computadores, tablets o teléfonos móviles, sin necesidad de instalar software adicional.",
  },
  {
    question: "¿Mis documentos están seguros?",
    answer:
      "Sí. Toda la información se almacena en servidores seguros con protocolos de protección de datos y copias de seguridad periódicas. Esto garantiza la confidencialidad, integridad y disponibilidad de tus documentos electrónicos.",
  },
  {
    question: "¿Puedo emitir facturas electrónicas ilimitadas?",
    answer:
      "Dependiendo del plan contratado, podrás emitir una cantidad determinada o ilimitada de facturas electrónicas. Nuestro objetivo es ofrecer soluciones flexibles que se adapten a las necesidades de cada empresa o emprendedor.",
  },
  {
    question: "¿Cómo funciona la facturación electrónica?",
    answer:
      "El sistema permite crear la factura digitalmente con los datos del cliente, productos o servicios. Luego, la factura se envía automáticamente a la DIAN para su validación. Una vez aprobada, se genera el documento oficial que puede enviarse al cliente por correo electrónico.",
  },
  {
    question: "¿Cuáles son los beneficios de la Facturación electrónica?",
    answer:
      "La facturación electrónica ofrece múltiples beneficios, entre ellos:\n• Reducción de costos en papel e impresión\n• Mayor control y organización de la información\n• Envío rápido de facturas a los clientes\n• Cumplimiento con las normativas fiscales\n• Automatización de procesos administrativos",
  },
  {
    question: "¿Qué debo hacer para empezar a facturar?",
    answer:
      "Solo necesitas registrarte en la plataforma, configurar los datos de tu empresa y habilitar la facturación electrónica según los requisitos de la DIAN. Una vez completado este proceso, podrás comenzar a emitir facturas electrónicas de forma rápida y sencilla.",
  },
] as const;

export const FEATURE_CARDS = [
  {
    icon: "document-text-outline",
    title: "Facturación electrónica en segundos",
    text: "Emite facturas electrónicas de forma rápida y segura desde cualquier dispositivo conectado a internet.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Cumplimiento con la DIAN",
    text: "Nuestra plataforma cumple con la normativa vigente de la DIAN, garantizando la validez legal de tus facturas electrónicas.",
  },
  {
    icon: "cloud-outline",
    title: "Información segura en la nube",
    text: "Consulta y gestiona tus documentos electrónicos de forma segura desde cualquier lugar y dispositivo.",
  },
  {
    icon: "sync-outline",
    title: "Integración y automatización",
    text: "Conecta tu facturación con otros procesos de tu empresa y automatiza la gestión de tu información.",
  },
] as const;

export const INTRO_BENEFITS = [
  "Emite facturas electrónicas en segundos.",
  "Cumple con los requisitos de la DIAN automáticamente.",
  "Gestiona clientes, productos y servicios fácilmente.",
  "Envía facturas electrónicas directamente a tus clientes por correo.",
  "Accede a reportes claros sobre tus ventas y documentos emitidos.",
] as const;

export const CONTROL_BENEFITS = [
  "Consulta el historial completo de facturas emitidas.",
  "Visualiza reportes de ventas y documentos en tiempo real.",
  "Organiza tus clientes, productos y servicios.",
  "Accede a tu información desde cualquier dispositivo.",
  "Mantén tus documentos organizados y disponibles cuando los necesites.",
] as const;

export const STEPS = [
  {
    icon: "business-outline",
    title: "Registro de la empresa",
    text: "Crea tu cuenta y registra la información de tu empresa para comenzar a emitir documentos electrónicos.",
  },
  {
    icon: "settings-outline",
    title: "Configuración inicial",
    text: "Configura tus datos fiscales, resolución de facturación, clientes y productos para preparar el sistema.",
  },
  {
    icon: "document-text-outline",
    title: "Emisión de facturas",
    text: "Genera y envía tus facturas electrónicas de forma rápida y segura cumpliendo con la normativa DIAN.",
  },
  {
    icon: "cloud-outline",
    title: "Validación y gestión",
    text: "La factura se valida automáticamente ante la DIAN y queda disponible para consulta, reportes y control.",
  },
] as const;

export const PLAN_CARDS = [
  {
    name: "Plan Básico",
    desc: "Empresas pequeñas que facturan regularmente.",
    price: "$119.000 COP/año",
    popular: false,
    features: [
      "Hasta 30 documentos electrónicos al año",
      "1 usuario administrador",
      "Facturación electrónica válida ante la DIAN",
      "Generación de factura electrónica de venta",
      "Notas crédito y débito",
      "Envío automático al cliente por correo",
      "Firma digital incluida por 1 año",
      "Soporte básico por correo",
    ],
  },
  {
    name: "Plan Empresarial",
    desc: "Emprendedores o empresas con bajo volumen de facturación.",
    price: "$249.000 COP/año",
    popular: false,
    features: [
      "Hasta 150 documentos electrónicos al año",
      "1 usuario administrador",
      "Facturación electrónica DIAN",
      "Notas crédito y débito",
      "Envío automático de facturas",
      "Historial y consulta de documentos",
      "Reportes básicos de facturación",
      "Firma digital incluida por 1 año",
      "Soporte técnico",
    ],
  },
  {
    name: "Plan Profesional",
    desc: "Empresas pequeñas que facturan regularmente.",
    price: "$699.000 COP/año",
    popular: true,
    features: [
      "Hasta 600 documentos electrónicos al año",
      "2 usuarios",
      "Facturación electrónica DIAN",
      "Notas crédito y débito",
      "Envío automático por correo",
      "Reportes avanzados de facturación",
      "Integración con inventario básico",
      "Firma digital incluida por 1 año",
      "Soporte prioritario",
    ],
  },
  {
    name: "Plan Personalizado",
    desc: "Para empresas que necesitan un volumen mayor o condiciones a la medida.",
    price: "A medida",
    popular: false,
    custom: true,
    features: [
      "Documentos electrónicos",
      "Usuarios",
      "Facturación electrónica DIAN",
      "Notas crédito y débito",
      "Envío automático por correo",
      "Reportes avanzados de facturación",
      "Integración con inventario básico",
      "Firma digital incluida por 1 año",
      "Soporte prioritario",
    ],
  },
] as const;

export const HOME_COLORS = {
  primary: "#002737",
  accent: "#5a9fb4",
  accentHover: "#4a8fa4",
  pageBg: "#ffffff",
  text: "#1a1a1a",
  textMuted: "#64748b",
  border: "#e0e0e0",
  cardBg: "#ffffff",
  heroOverlay: "rgba(0, 39, 55, 0.5)",
};
