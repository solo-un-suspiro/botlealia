import mysql from "mysql2/promise"
import { ChatSession } from "./chat-session.js"

export class SessionManager {
  constructor(dbConfig) {
    this.sessions = new Map()
    this.dbConfig = dbConfig
    this.pool = null
    this.isDbInitialized = false
    this.connectionRetries = 0
    this.maxRetries = 5
    this.retryDelay = 5000 // 5 segundos
    this.dbKeepAliveTimer = null
    this.dbKeepAliveInterval = 30000 // 30 segundos
    this.lastQueryTime = Date.now()
    this.queryTimeout = 10000 // 10 segundos
  }

  async initializeDbConnection() {
    if (this.pool) {
      try {
        await this.pool.end()
        console.log("Closed previous connection pool")
      } catch (err) {
        console.log("Error closing previous pool:", err.message)
      }
      this.pool = null
    }

    try {
      // Create a connection pool with conservative settings
      this.pool = mysql.createPool({
        ...this.dbConfig,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        namedPlaceholders: true,
        connectTimeout: 30000,
        socketPath: undefined,
        charset: "utf8mb4",
      })

      // Test the connection
      const connection = await this.pool.getConnection()
      console.log("Conexión a la base de datos establecida")
      connection.release()

      this.isDbInitialized = true
      this.connectionRetries = 0
      this.startDbKeepAlive()
      return true
    } catch (error) {
      console.error(`Error al establecer la conexión a la base de datos:`, error)
      this.connectionRetries++

      if (this.connectionRetries < this.maxRetries) {
        console.log(`Reintentando en ${this.retryDelay / 1000} segundos...`)
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
        return this.initializeDbConnection()
      } else {
        console.error(`No se pudo establecer la conexión después de ${this.maxRetries} intentos`)
        return false
      }
    }
  }

  startDbKeepAlive() {
    if (this.dbKeepAliveTimer) {
      clearInterval(this.dbKeepAliveTimer)
    }

    this.dbKeepAliveTimer = setInterval(async () => {
      try {
        // Only ping if no query has been executed recently
        const timeSinceLastQuery = Date.now() - this.lastQueryTime
        if (timeSinceLastQuery > this.dbKeepAliveInterval) {
          console.log("Ejecutando ping para mantener la conexión activa...")

          // Use a promise with timeout to prevent hanging
          const pingPromise = this.pool.query("SELECT 1")
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Ping timeout")), this.queryTimeout),
          )

          await Promise.race([pingPromise, timeoutPromise])
          console.log("Ping exitoso, conexión mantenida activa")
        }
      } catch (error) {
        console.error("Error en el ping de keep-alive:", error.message)

        // If ping fails, try to reinitialize the connection
        console.log("Intentando reinicializar la conexión...")
        await this.initializeDbConnection()
      }
    }, this.dbKeepAliveInterval)
  }

  async ensureConnection() {
    if (!this.pool || !this.isDbInitialized) {
      return await this.initializeDbConnection()
    }

    try {
      // Quick test to see if the pool is still working
      const connection = await this.pool.getConnection()
      connection.release()
      return true
    } catch (error) {
      console.error("Error al verificar la conexión:", error.message)
      return await this.initializeDbConnection()
    }
  }

  async executeQuery(query, values, retryCount = 0) {
    const maxQueryRetries = 3

    // Ensure we have a connection before executing the query
    const connected = await this.ensureConnection()
    if (!connected) {
      throw new Error("No se pudo establecer la conexión a la base de datos")
    }

    try {
      // Update last query time
      this.lastQueryTime = Date.now()

      // Execute the query with a timeout
      const queryPromise = this.pool.query(query, values)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Query timeout")), this.queryTimeout),
      )

      const [result] = await Promise.race([queryPromise, timeoutPromise])
      return result
    } catch (error) {
      console.error(`Error ejecutando la consulta (intento ${retryCount + 1}):`, error.message)

      // Check if we should retry
      if (retryCount < maxQueryRetries) {
        console.log(`Reintentando consulta en 1 segundo...`)
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Reinitialize connection if it seems to be the issue
        if (
          error.code === "PROTOCOL_CONNECTION_LOST" ||
          error.code === "ECONNRESET" ||
          error.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR"
        ) {
          await this.initializeDbConnection()
        }

        // Retry the query
        return this.executeQuery(query, values, retryCount + 1)
      }

      // If we've exhausted retries, throw the error
      throw error
    }
  }

  async closeConnection() {
    if (this.dbKeepAliveTimer) {
      clearInterval(this.dbKeepAliveTimer)
    }

    if (this.pool) {
      try {
        await this.pool.end()
        console.log("Conexión a la base de datos cerrada correctamente")
      } catch (error) {
        console.error("Error al cerrar la conexión a la base de datos:", error.message)
      }
    }
  }

  getSession(chatId) {
    if (!this.sessions.has(chatId)) {
      this.sessions.set(chatId, new ChatSession(chatId))
    }
    return this.sessions.get(chatId)
  }

  async saveSessionToDatabase(session) {
    const duration = Math.floor((Date.now() - session.startTime) / 1000)
    const query = `
    INSERT INTO chat_sessions 
    (chat_id, start_time, duration, report_id, conversation_history, survey_responses) 
    VALUES (?, ?, ?, ?, ?, ?)
  `
    const values = [
      session.chatId,
      new Date(session.startTime)
        .toISOString()
        .slice(0, 19)
        .replace("T", " "), // Formato MySQL datetime
      duration,
      session.reportId,
      JSON.stringify(session.conversationHistory),
      JSON.stringify(session.surveyResponses),
    ]

    try {
      await this.executeQuery(query, values)
      console.log(`[${new Date().toISOString()}] Sesión guardada en la base de datos para chatId: ${session.chatId}`)
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error al guardar la sesión en la base de datos:`, error)
    }
  }

  async endSession(chatId) {
    const session = this.sessions.get(chatId)
    if (session) {
      await this.saveSessionToDatabase(session)

      this.sessions.delete(chatId)
      console.log(`[${new Date().toISOString()}] Sesión finalizada y guardada para chatId: ${chatId}`)
    }
  }
}

