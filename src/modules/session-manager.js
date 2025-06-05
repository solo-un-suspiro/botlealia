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
    this.retryDelay = 5000
    this.dbKeepAliveTimer = null
    this.dbKeepAliveInterval = 30000
    this.lastQueryTime = Date.now()
    this.queryTimeout = 15000
    this.reconnectInProgress = false
    this.messageProcessingLock = new Map()
    this.isShuttingDown = false // Nueva bandera para evitar operaciones durante el cierre
  }

  async initializeDbConnection() {
    if (this.reconnectInProgress || this.isShuttingDown) {
      console.log("Reconexión ya en progreso o sistema cerrándose, esperando...")
      return false
    }

    this.reconnectInProgress = true

    try {
      if (this.pool) {
        try {
          await this.pool.end()
          console.log("Closed previous connection pool")
        } catch (err) {
          console.log("Error closing previous pool:", err.message)
        }
        this.pool = null
      }

      // Configuración corregida del pool (sin opciones inválidas)
      this.pool = mysql.createPool({
        host: this.dbConfig.host,
        user: this.dbConfig.user,
        password: this.dbConfig.password,
        database: this.dbConfig.database,
        waitForConnections: true,
        connectionLimit: 3,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        namedPlaceholders: true,
        connectTimeout: 30000,
        charset: "utf8mb4",
        idleTimeout: 300000, // 5 minutos
        maxIdle: 2,
        // Removidas las opciones inválidas: acquireTimeout, timeout, reconnect
      })

      // Test de conexión con timeout
      const testConnection = await Promise.race([
        this.pool.getConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timeout")), 10000)),
      ])

      console.log("✅ Conexión a la base de datos establecida")
      testConnection.release()

      this.isDbInitialized = true
      this.connectionRetries = 0
      this.startDbKeepAlive()
      return true
    } catch (error) {
      console.error(`❌ Error al establecer la conexión a la base de datos:`, error.message)
      this.connectionRetries++

      if (this.connectionRetries < this.maxRetries) {
        console.log(
          `🔄 Reintentando en ${this.retryDelay / 1000} segundos... (${this.connectionRetries}/${this.maxRetries})`,
        )
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
        return this.initializeDbConnection()
      } else {
        console.error(`💥 No se pudo establecer la conexión después de ${this.maxRetries} intentos`)
        return false
      }
    } finally {
      this.reconnectInProgress = false
    }
  }

  startDbKeepAlive() {
    if (this.dbKeepAliveTimer) {
      clearInterval(this.dbKeepAliveTimer)
    }

    this.dbKeepAliveTimer = setInterval(async () => {
      // No hacer ping si estamos cerrando
      if (this.isShuttingDown) {
        return
      }

      try {
        const timeSinceLastQuery = Date.now() - this.lastQueryTime
        if (timeSinceLastQuery > this.dbKeepAliveInterval) {
          console.log("🏓 Ejecutando ping para mantener la conexión activa...")

          // Verificar que el pool existe y no está cerrado
          if (!this.pool || this.pool._closed) {
            console.log("⚠️ Pool cerrado, reinicializando...")
            await this.initializeDbConnection()
            return
          }

          const pingPromise = this.pool.query("SELECT 1 as ping")
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Ping timeout")), this.queryTimeout),
          )

          await Promise.race([pingPromise, timeoutPromise])
          console.log("✅ Ping exitoso, conexión mantenida activa")
          this.lastQueryTime = Date.now()
        }
      } catch (error) {
        console.error("❌ Error en el ping de keep-alive:", error.message)

        // Solo intentar reinicializar si no estamos cerrando y no hay una reconexión en progreso
        if (!this.reconnectInProgress && !this.isShuttingDown) {
          console.log("🔄 Intentando reinicializar la conexión...")
          await this.initializeDbConnection()
        }
      }
    }, this.dbKeepAliveInterval)
  }

  async ensureConnection() {
    if (this.isShuttingDown) {
      return false
    }

    if (!this.pool || !this.isDbInitialized || this.reconnectInProgress || this.pool._closed) {
      return await this.initializeDbConnection()
    }

    try {
      const connection = await Promise.race([
        this.pool.getConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Connection test timeout")), 5000)),
      ])
      connection.release()
      return true
    } catch (error) {
      console.error("❌ Error al verificar la conexión:", error.message)
      return await this.initializeDbConnection()
    }
  }

  async executeQuery(query, values, retryCount = 0) {
    if (this.isShuttingDown) {
      throw new Error("Sistema cerrándose, no se pueden ejecutar consultas")
    }

    const maxQueryRetries = 2

    const connected = await this.ensureConnection()
    if (!connected) {
      throw new Error("No se pudo establecer la conexión a la base de datos")
    }

    try {
      this.lastQueryTime = Date.now()

      const queryPromise = this.pool.query(query, values)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Query timeout")), this.queryTimeout),
      )

      const [result] = await Promise.race([queryPromise, timeoutPromise])
      return result
    } catch (error) {
      console.error(`❌ Error ejecutando la consulta (intento ${retryCount + 1}):`, error.message)

      if (retryCount < maxQueryRetries && !this.isShuttingDown) {
        console.log(`🔄 Reintentando consulta en 2 segundos...`)
        await new Promise((resolve) => setTimeout(resolve, 2000))

        if (
          error.code === "PROTOCOL_CONNECTION_LOST" ||
          error.code === "ECONNRESET" ||
          error.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR" ||
          error.message.includes("timeout") ||
          error.message.includes("Pool is closed")
        ) {
          await this.initializeDbConnection()
        }

        return this.executeQuery(query, values, retryCount + 1)
      }

      throw error
    }
  }

  async lockMessageProcessing(chatId) {
    if (this.messageProcessingLock.has(chatId)) {
      console.log(`⏳ Mensaje ya siendo procesado para ${chatId}, ignorando...`)
      return false
    }

    this.messageProcessingLock.set(chatId, Date.now())
    return true
  }

  unlockMessageProcessing(chatId) {
    this.messageProcessingLock.delete(chatId)
  }

  getSession(chatId) {
    if (!this.sessions.has(chatId)) {
      console.log(`🆕 Creando nueva sesión para ${chatId}`)
      this.sessions.set(chatId, new ChatSession(chatId))
    }
    return this.sessions.get(chatId)
  }

  async saveSessionToDatabase(session) {
    if (this.isShuttingDown) {
      console.log("Sistema cerrándose, no se puede guardar la sesión")
      return
    }

    try {
      const duration = Math.floor((Date.now() - session.startTime) / 1000)
      const query = `
        INSERT INTO chat_sessions 
        (chat_id, start_time, duration, report_id, conversation_history, survey_responses) 
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        duration = VALUES(duration),
        conversation_history = VALUES(conversation_history),
        survey_responses = VALUES(survey_responses)
      `
      const values = [
        session.chatId,
        new Date(session.startTime).toISOString().slice(0, 19).replace("T", " "),
        duration,
        session.reportId,
        JSON.stringify(session.conversationHistory.slice(-50)),
        JSON.stringify(session.surveyResponses),
      ]

      await this.executeQuery(query, values)
      console.log(`💾 Sesión guardada en la base de datos para chatId: ${session.chatId}`)
    } catch (error) {
      console.error(`❌ Error al guardar la sesión en la base de datos:`, error.message)
    }
  }

  async endSession(chatId) {
    try {
      const session = this.sessions.get(chatId)
      if (session) {
        // Limpiar todos los timers
        if (session.inactivityTimer) {
          clearTimeout(session.inactivityTimer)
          session.inactivityTimer = null
        }
        if (session.warningTimer) {
          clearTimeout(session.warningTimer)
          session.warningTimer = null
        }

        // Solo guardar en DB si no estamos cerrando
        if (!this.isShuttingDown) {
          await this.saveSessionToDatabase(session)
        }

        this.sessions.delete(chatId)
        this.unlockMessageProcessing(chatId)

        console.log(`🗑️ Sesión finalizada y guardada para chatId: ${chatId}`)
      }
    } catch (error) {
      console.error(`❌ Error al finalizar sesión:`, error.message)
    }
  }

  async closeConnection() {
    console.log("🧹 Iniciando cierre del session manager...")
    this.isShuttingDown = true

    try {
      if (this.dbKeepAliveTimer) {
        clearInterval(this.dbKeepAliveTimer)
        this.dbKeepAliveTimer = null
      }

      // Limpiar todas las sesiones
      for (const [chatId, session] of this.sessions) {
        if (session.inactivityTimer) clearTimeout(session.inactivityTimer)
        if (session.warningTimer) clearTimeout(session.warningTimer)
      }
      this.sessions.clear()
      this.messageProcessingLock.clear()

      if (this.pool && !this.pool._closed) {
        await this.pool.end()
        console.log("✅ Conexión a la base de datos cerrada correctamente")
      }
    } catch (error) {
      console.error("❌ Error al cerrar la conexión a la base de datos:", error.message)
    }
  }
}
