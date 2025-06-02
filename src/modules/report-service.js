import { analyzeReportWithGemini } from "./ai-service.js"
import { USER_DB_CONFIG } from "../config/constants.js"
import mysql from "mysql2/promise"

let reportDbPool = null

async function initReportDbConnection() {
  if (reportDbPool) {
    try {
      await reportDbPool.end()
      console.log("Closed previous report DB connection pool")
    } catch (err) {
      console.log("Error closing previous report DB pool:", err.message)
    }
    reportDbPool = null
  }

  try {
    // Create a connection pool with conservative settings
    reportDbPool = mysql.createPool({
      ...USER_DB_CONFIG, // Usamos la configuración de la segunda base de datos
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 30000,
      socketPath: undefined,
      charset: "utf8mb4",
    })

    // Test the connection
    const connection = await reportDbPool.getConnection()
    console.log("Conexión a la base de datos de reportes establecida")
    connection.release()
    return true
  } catch (error) {
    console.error(`Error al establecer la conexión a la base de datos de reportes:`, error)
    return false
  }
}

async function executeReportQuery(query, values) {
  if (!reportDbPool) {
    const connected = await initReportDbConnection()
    if (!connected) {
      throw new Error("No se pudo establecer la conexión a la base de datos de reportes")
    }
  }

  try {
    const [result] = await reportDbPool.query(query, values)
    return result
  } catch (error) {
    console.error("Error ejecutando consulta en la base de datos de reportes:", error)
    throw error
  }
}

// Modificar la función createReport para cambiar la compañía por defecto
export async function createReport(data, sessionManager) {
  try {
    const analysis = await analyzeReportWithGemini(data.problem)

    // Insertar en la tabla reports de la base de datos secundaria
    const query = `
      INSERT INTO reports (name, company, phone, email, problem, classification, status, priority, contact_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    const values = [
      data.name || "No proporcionado",
      data.company || "Lealia",
      data.phone || "No proporcionado",
      data.email || "No proporcionado",
      data.problem || "Solicitud de atención humana",
      analysis.classification || "Soporte",
      "Nuevo",
      analysis.priority || "Media",
      data.contact_phone || "No proporcionado",
    ]

    try {
      const result = await executeReportQuery(query, values)
      return result.insertId ? `REP${result.insertId}` : "REP" + Date.now().toString().slice(-6)
    } catch (error) {
      console.error("Error al insertar reporte en la base de datos:", error)
      // Fallback en caso de error
      return "REP" + Date.now().toString().slice(-6)
    }
  } catch (error) {
    console.error("Error creating report:", error)
    throw error
  }
}

export async function saveSurveyResponse(chatId, questionIndex, response) {
  try {
    // Insertar en la tabla survey_responses de la base de datos secundaria
    const query = `
      INSERT INTO survey_responses (chat_id, question_index, response)
      VALUES (?, ?, ?)
    `
    const values = [chatId, questionIndex, response]

    try {
      await executeReportQuery(query, values)
      return true
    } catch (error) {
      console.error("Error al guardar respuesta de encuesta:", error)
      return false
    }
  } catch (error) {
    console.error("Error saving survey response:", error)
    return false
  }
}

export async function closeReportDbConnection() {
  if (reportDbPool) {
    try {
      await reportDbPool.end()
      console.log("Conexión a la base de datos de reportes cerrada correctamente")
    } catch (error) {
      console.error("Error al cerrar la conexión a la base de datos de reportes:", error)
    }
    reportDbPool = null
  }
}
