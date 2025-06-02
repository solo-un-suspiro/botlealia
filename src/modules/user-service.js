import { USER_DB_CONFIG } from "../config/constants.js"
import mysql from "mysql2/promise"

let userDbPool = null

async function initUserDbConnection() {
  if (userDbPool) {
    try {
      await userDbPool.end()
      console.log("Closed previous user DB connection pool")
    } catch (err) {
      console.log("Error closing previous user DB pool:", err.message)
    }
    userDbPool = null
  }

  try {
    userDbPool = mysql.createPool({
      ...USER_DB_CONFIG,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 30000,
      socketPath: undefined,
      charset: "utf8mb4",
    })

    const connection = await userDbPool.getConnection()
    console.log("Conexión a la base de datos de usuarios establecida")
    connection.release()
    return true
  } catch (error) {
    console.error(`Error al establecer la conexión a la base de datos de usuarios:`, error)
    return false
  }
}

async function executeUserQuery(query, values) {
  if (!userDbPool) {
    const connected = await initUserDbConnection()
    if (!connected) {
      throw new Error("No se pudo establecer la conexión a la base de datos de usuarios")
    }
  }

  try {
    const [result] = await userDbPool.query(query, values)
    return result
  } catch (error) {
    console.error("Error ejecutando consulta en la base de datos de usuarios:", error)
    throw error
  }
}

export async function verifyUserInDatabase(userData) {
  try {
    const query = `
      SELECT username, password FROM users 
      WHERE rfc = ? AND name = ? AND branch = ? AND email = ?
    `
    const values = [userData.rfc, userData.nombre, userData.sucursal, userData.email]

    const result = await executeUserQuery(query, values)

    if (result.length > 0) {
      return {
        username: result[0].username,
        password: result[0].password,
      }
    }

    return null
  } catch (error) {
    console.error("Error verifying user in database:", error)
    return null
  }
}

// New function to check order status using the new API
export async function checkOrderStatusFromAPI(orderNumber) {
  try {
    console.log(`[API] Calling order status API for order: ${orderNumber}`)
    const url = `https://centivapp.com/td_apis/get_pedido.php?pedido=${orderNumber}`

    console.log(`[API] Order API URL: ${url}`)
    const response = await fetch(url)

    if (!response.ok) {
      console.error(`[API] Order API returned status: ${response.status}`)
      throw new Error("Error en la solicitud")
    }

    const data = await response.json()
    console.log(`[API] Order API response:`, data)

    if (data && data.length > 0) {
      const order = data[0]

      // Map the API response to our expected format
      const orderStatus = {
        found: true,
        orderNumber: order.id_portal || orderNumber,
        product: order.productos || "Producto no especificado",
        customerName: order.nombrecompleto || "Cliente no especificado",
        orderDate: order.timeorden ? new Date(order.timeorden).toLocaleDateString("es-MX") : "Fecha no disponible",
        total: order.total ? Number.parseFloat(order.total).toLocaleString("es-MX") : "0",
        status: getOrderStatusInSpanish(order.status, order.estatus_pedido),
        trackingNumber: order.no_guia || order.no_guia_cliente || null,
        trackingUrl: order.link_mensajeria || order.link_mensajeria_cliente || null,
        estimatedDelivery: order.fechaentrega || order.fechaentrega_cliente || null,
        courier: determineCourier(order.link_mensajeria || order.link_mensajeria_cliente),
        rfc: order.rfc,
        email: order.email,
        phone: order.phone,
        address: `${order.address_1 || ""} ${order.address_2 || ""}`.trim(),
        city: order.city,
        state: order.state,
        postcode: order.postcode,
      }

      console.log(`[API] Processed order status:`, orderStatus)
      return orderStatus
    } else {
      console.log(`[API] No order found for order number: ${orderNumber}`)
      return { found: false }
    }
  } catch (error) {
    console.error(`[API] Error checking order status:`, error)
    return { found: false, error: error.message }
  }
}

// Helper function to translate order status to Spanish
function getOrderStatusInSpanish(status, estatusPedido) {
  const statusMap = {
    processing: "En proceso",
    completed: "Completado",
    pending: "Pendiente",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
    failed: "Fallido",
    "on-hold": "En espera",
  }

  // Use estatus_pedido if available, otherwise translate status
  if (estatusPedido && estatusPedido !== "Sin procesar") {
    return estatusPedido
  }

  return statusMap[status] || status || "Estado desconocido"
}

// Helper function to determine courier from tracking URL
function determineCourier(trackingUrl) {
  if (!trackingUrl) return null

  if (trackingUrl.includes("dhl")) return "DHL"
  if (trackingUrl.includes("fedex")) return "FedEx"
  if (trackingUrl.includes("ups")) return "UPS"
  if (trackingUrl.includes("estafeta")) return "Estafeta"
  if (trackingUrl.includes("paquetexpress")) return "Paquete Express"

  return "Paquetería"
}

// Keep the old function for backward compatibility (if needed elsewhere)
export async function checkOrderStatus(userData) {
  try {
    const query = `
      SELECT order_number, courier, tracking_number, estimated_delivery, tracking_url 
      FROM orders 
      WHERE rfc = ? AND order_number = ?
    `
    const values = [userData.rfc, userData.oc]

    const result = await executeUserQuery(query, values)

    if (result.length > 0) {
      return {
        found: true,
        orderNumber: result[0].order_number,
        courier: result[0].courier,
        trackingNumber: result[0].tracking_number,
        estimatedDelivery: result[0].estimated_delivery,
        trackingUrl: result[0].tracking_url,
      }
    }

    return { found: false }
  } catch (error) {
    console.error("Error checking order status:", error)
    return { found: false }
  }
}

export async function createHumanSupportReport(data) {
  try {
    const query = `
      INSERT INTO reports (name, company, phone, email, problem, classification, status, priority, contact_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    const values = [
      data.name,
      data.company,
      data.phone,
      data.email,
      data.problem,
      data.classification,
      "Nuevo",
      data.priority,
      data.contact_phone,
    ]

    const result = await executeUserQuery(query, values)
    return result.insertId ? `REP${result.insertId}` : "REP" + Date.now().toString().slice(-6)
  } catch (error) {
    console.error("Error creating human support report:", error)
    throw error
  }
}

export async function closeUserDbConnection() {
  if (userDbPool) {
    try {
      await userDbPool.end()
      console.log("Conexión a la base de datos de usuarios cerrada correctamente")
    } catch (error) {
      console.error("Error al cerrar la conexión a la base de datos de usuarios:", error)
    }
    userDbPool = null
  }
}
