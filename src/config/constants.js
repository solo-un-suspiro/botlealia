// Company information
export const COMPANY_INFO =
  "Lealia es una plataforma que permite a los empleados canjear puntos por diversos productos y tarjetas de regalo."

// Database configuration
export const DB_CONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}

// Secondary database configuration for user verification
export const USER_DB_CONFIG = {
  host: process.env.USER_DB_HOST,
  user: process.env.USER_DB_USER,
  password: process.env.USER_DB_PASSWORD,
  database: process.env.USER_DB_NAME,
}

// Timeouts and intervals
export const INACTIVITY_TIMEOUT = 2 * 60 * 1000 // 2 minutos
export const REMINDER_TIMEOUT = 2 * 60 * 1000 // 2 minutos adicionales
export const DB_KEEP_ALIVE_INTERVAL = 30000 // 30 segundos
export const QUERY_TIMEOUT = 10000 // 10 segundos
export const MAX_MESSAGE_LENGTH = 2000 // Longitud máxima de un mensaje

// Menu options
export const MENU_OPTIONS = {
  MAIN_MENU: [
    "1️⃣ Olvidé Usuario o Contraseña",
    "2️⃣ Problemas con mi pedido",
    "3️⃣ Realizar un pedido especial",
    "4️⃣ Duda de mi carga de puntos",
    "5️⃣ Problemas con mi portal",
    "6️⃣ Dirección de entrega",
    "7️⃣ Consultar Saldo",
    "8️⃣ Terminar sesión",
  ],
  ORDER_PROBLEMS: [
    "1️⃣ Llegó dañado",
    "2️⃣ Tiempo de entrega",
    "3️⃣ Problema de funcionamiento",
    "4️⃣ Cancelación o reembolso",
    "5️⃣ Volver al menú principal",
  ],
  COIN_ISSUES: [
    "1️⃣ Los puntos que tengo no coinciden",
    "2️⃣ No tengo puntos correspondientes al mes",
    "3️⃣ Volver al menú principal",
  ],
  PORTAL_PROBLEMS: [
    "1️⃣ No puedo accesar con mis credenciales",
    "2️⃣ No puedo realizar pedido",
    "3️⃣ No tengo puntos cargados",
    "4️⃣ Volver al menú principal",
  ],
  CLOSING_MENU: ["1️⃣ Sí, necesito más ayuda", "2️⃣ No, gracias"],
}

// Email templates
export const EMAIL_TEMPLATES = {
  DAMAGED_ORDER: {
    to: "amarrieta@centiva.mx",
    cc: "khuitron@centiva.mx",
    subject: "Producto dañado - Reporte desde WhatsApp",
  },
  FUNCTIONALITY_PROBLEM: {
    to: "amarrieta@centiva.mx",
    cc: "khuitron@centiva.mx",
    subject: "Problema de funcionamiento - Reporte desde WhatsApp",
  },
  CANCELLATION: {
    to: "amarrieta@centiva.mx",
    subject: "Solicitud de cancelación o reembolso - Reporte desde WhatsApp",
  },
  COIN_DISCREPANCY: {
    to: "mescobar@centiva.mx",
    subject: "Discrepancia en puntos - Reporte desde WhatsApp",
  },
  ADDRESS_CHANGE: {
    to: "mescobar@centiva.mx",
    cc: ["acoronel@centiva.mx", "amarrieta@centiva.mx"],
    subject: "Cambio de dirección - Reporte desde WhatsApp",
  },
  SPECIAL_ORDER: {
    to: "pedidos@lealia.com.mx",
    subject: "Consulta sobre pedido especial - WhatsApp Bot",
  },
}

// Portal URLs
export const PORTAL_URLS = {
  MAIN: "https://tienda.lealia.com.mx/",
  SPECIAL_ORDERS: "https://tienda.lealia.com.mx/pedidos-especiales",
  LOGIN: "https://tienda.lealia.com.mx/login",
  BALANCE: "https://tienda.lealia.com.mx/mi-cuenta/saldo",
}
