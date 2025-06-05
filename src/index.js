import { makeWASocket, DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys"
import NodeCache from "node-cache"
import dotenv from "dotenv"
import { SessionManager } from "./modules/session-manager.js"
import { SurveyManager } from "./modules/survey-manager.js"
import { handleMessage } from "./modules/message-handler.js"
import { withDatabaseFallback } from "./utils/database-utils.js"
import { closeUserDbConnection } from "./modules/user-service.js"
import { closeReportDbConnection } from "./modules/report-service.js"
import { USER_DB_CONFIG } from "./config/constants.js"
import { checkEnvVariables } from "./utils/env-checker.js"
import { messageTracker } from "./utils/message-tracker.js"
import { ConversationLogger } from "./modules/conversation-logger.js"

// Load environment variables
dotenv.config()

// Verificar variables de entorno
checkEnvVariables()

// Mostrar configuración de base de datos
console.log("\n🔧 Configuración de base de datos secundaria:")
console.log(`Host: ${USER_DB_CONFIG.host}`)
console.log(`Usuario: ${USER_DB_CONFIG.user}`)
console.log(`Base de datos: ${USER_DB_CONFIG.database}`)
console.log(`Contraseña configurada: ${USER_DB_CONFIG.password ? "Sí" : "No"}`)

// Initialize cache for message retry
const msgRetryCache = new NodeCache()

// Create global instances of managers
const sessionManager = new SessionManager(USER_DB_CONFIG)
const surveyManager = new SurveyManager()

// INSTANCIA GLOBAL DEL CONVERSATION LOGGER
let globalConversationLogger = null

// Variables para control de reconexión
let reconnectAttempts = 0
const maxReconnectAttempts = 10
let isConnecting = false

// Initialize baileys authentication state outside the connectToWhatsApp function
const authState = await useMultiFileAuthState("auth_info_baileys")
const { state, saveCreds } = authState

async function connectToWhatsApp() {
  if (isConnecting) {
    console.log("🔄 Ya hay una conexión en progreso...")
    return
  }

  isConnecting = true

  try {
    console.log("🚀 Iniciando conexión a WhatsApp...")

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      msgRetryCache,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      browser: ["Lealia Bot", "Chrome", "1.0.0"],
      getMessage: async (key) => {
        return { conversation: "Mensaje no disponible" }
      },
    })

    // Initialize the database connection
    try {
      console.log("🔌 Intentando conectar a la base de datos...")
      const connected = await sessionManager.initializeDbConnection()
      if (connected) {
        console.log("✅ Conexión a la base de datos establecida correctamente")

        // INICIALIZAR EL CONVERSATION LOGGER GLOBAL
        globalConversationLogger = new ConversationLogger(sessionManager)
        console.log("✅ ConversationLogger global inicializado")
      } else {
        console.warn(
          "⚠️ No se pudo establecer la conexión a la base de datos. El bot funcionará con funcionalidad limitada.",
        )
      }
    } catch (dbError) {
      console.error("❌ Error al inicializar la conexión a la base de datos:", dbError)
      console.log("🔄 El bot continuará funcionando sin conexión a la base de datos")
    }

    const connect = () => {
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
          console.log("📱 Código QR generado para autenticación")
        }

        if (connection === "close") {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
          const statusCode = lastDisconnect?.error?.output?.statusCode

          console.log(`❌ Conexión cerrada. Código: ${statusCode}, Reconectar: ${shouldReconnect}`)

          if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000) // Backoff exponencial

            console.log(
              `🔄 Reintentando conexión en ${delay / 1000} segundos... (${reconnectAttempts}/${maxReconnectAttempts})`,
            )

            setTimeout(() => {
              isConnecting = false
              connectToWhatsApp()
            }, delay)
          } else {
            console.log("🛑 Cerrando aplicación...")
            await cleanup()
            process.exit(1)
          }
        } else if (connection === "open") {
          console.log("✅ Conexión a WhatsApp establecida")
          reconnectAttempts = 0
          isConnecting = false

          // Asegurar conexión a la base de datos
          withDatabaseFallback(async () => await sessionManager.ensureConnection())
        } else if (connection === "connecting") {
          console.log("🔄 Conectando a WhatsApp...")
        }
      })

      sock.ev.on("messages.upsert", async (m) => {
        if (!m || !m.messages || m.messages.length === 0) {
          return
        }

        try {
          console.log("📨 Mensaje recibido:", JSON.stringify(m, undefined, 2))

          const msg = m.messages[0]
          const chatId = msg.key.remoteJid

          // Ignorar mensajes de grupos y estados
          if (chatId === "status@broadcast" || chatId.endsWith("@g.us")) {
            console.log("🚫 Ignorando mensaje de grupo o estado")
            return
          }

          // Extraer contenido del mensaje
          const messageContent =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.buttonsResponseMessage?.selectedButtonId ||
            msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
            ""

          if (messageContent) {
            console.log(`👤 Mensaje de ${chatId}: ${messageContent}`)

            // Procesar mensaje con manejo de errores mejorado
            try {
              await handleMessage(sock, chatId, messageContent, msg, sessionManager, surveyManager)
            } catch (error) {
              console.error("❌ Error procesando mensaje:", error)

              // Intentar enviar mensaje de error al usuario
              try {
                await sendMessage(
                  sock,
                  chatId,
                  "Lo siento, estamos experimentando problemas técnicos. Por favor, intenta de nuevo más tarde.",
                )
              } catch (sendError) {
                console.error("❌ Error enviando mensaje de error:", sendError)
              }
            }
          } else {
            console.log("📝 Mensaje sin contenido de texto:", msg.message)
          }
        } catch (error) {
          console.error("❌ Error en el manejo de mensajes:", error)
        }
      })

      sock.ev.on("creds.update", saveCreds)

      // Manejar errores de conexión
      sock.ev.on("connection.error", (error) => {
        console.error("❌ Error de conexión:", error)
      })
    }

    connect()
  } catch (error) {
    console.error("❌ Error al iniciar el bot:", error)
    isConnecting = false

    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)

      console.log(`🔄 Reintentando en ${delay / 1000} segundos...`)
      setTimeout(() => connectToWhatsApp(), delay)
    } else {
      console.log("💥 Máximo número de reintentos alcanzado")
      process.exit(1)
    }
  }
}

// Función mejorada para enviar mensajes CON LOGGING AUTOMÁTICO
export async function sendMessage(sock, chatId, text) {
  try {
    const maxLength = 2000
    const chunks = []

    // Dividir mensaje si es muy largo
    while (text.length > 0) {
      if (text.length <= maxLength) {
        chunks.push(text)
        break
      }

      const chunk = text.substr(0, maxLength)
      let lastSpace = chunk.lastIndexOf(" ")

      if (lastSpace === -1) {
        lastSpace = maxLength
      }

      chunks.push(chunk.substr(0, lastSpace))
      text = text.substr(lastSpace + 1)
    }

    // Enviar cada chunk con un pequeño delay
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      try {
        // Enviar el mensaje
        const sentMsg = await sock.sendMessage(chatId, { text: chunk })

        // Registrar el ID del mensaje enviado por el bot
        if (sentMsg && sentMsg.key && sentMsg.key.id) {
          messageTracker.trackBotMessage(sentMsg.key.id)
        }

        console.log(`📤 Mensaje enviado a ${chatId}: ${chunk.substring(0, 50)}...`)

        // LOGGING AUTOMÁTICO DEL MENSAJE DEL BOT - SOLO UNA VEZ
        await logBotMessage(chatId, chunk)

        // Pequeño delay entre chunks para evitar spam
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      } catch (sendError) {
        console.error(`❌ Error enviando chunk ${i + 1}:`, sendError)
        throw sendError
      }
    }
  } catch (error) {
    console.error("❌ Error en sendMessage:", error)
    throw error
  }
}

// FUNCIÓN PARA LOGGING AUTOMÁTICO DE MENSAJES DEL BOT
async function logBotMessage(chatId, messageContent) {
  try {
    if (!globalConversationLogger) {
      console.log(`[AUTO_LOG_BOT] ConversationLogger no disponible`)
      return
    }

    // Obtener la sesión para conseguir el conversationId
    const session = sessionManager.getSession(chatId)

    // Si no hay conversationId, crear uno nuevo
    if (!session.conversationId) {
      session.conversationId = await globalConversationLogger.startConversation(chatId)
      console.log(`[AUTO_LOG_BOT] Nueva conversación creada: ${session.conversationId}`)
    }

    // Registrar el mensaje del bot
    await globalConversationLogger.logMessage(session.conversationId, chatId, "bot", messageContent, session.chatId)

    console.log(`[AUTO_LOG_BOT] ✅ Mensaje del bot registrado: "${messageContent.substring(0, 50)}..."`)
  } catch (error) {
    console.error(`[AUTO_LOG_BOT] ❌ Error en logging automático del bot:`, error)
  }
}

// FUNCIÓN PARA OBTENER EL CONVERSATION LOGGER GLOBAL
export function getGlobalConversationLogger() {
  return globalConversationLogger
}

// FUNCIÓN PARA OBTENER EL SESSION MANAGER GLOBAL
export function getGlobalSessionManager() {
  return sessionManager
}

// Función de limpieza mejorada
async function cleanup() {
  console.log("🧹 Cerrando la aplicación...")

  try {
    await sessionManager.closeConnection()
    console.log("✅ Session manager cerrado")
  } catch (error) {
    console.error("❌ Error cerrando session manager:", error)
  }

  try {
    await closeUserDbConnection()
    console.log("✅ Conexión de usuarios cerrada")
  } catch (error) {
    console.error("❌ Error cerrando conexión de usuarios:", error)
  }

  try {
    await closeReportDbConnection()
    console.log("✅ Conexión de reportes cerrada")
  } catch (error) {
    console.error("❌ Error cerrando conexión de reportes:", error)
  }
}

// Manejar cierre de aplicación
process.on("SIGINT", async () => {
  console.log("\n🛑 Recibida señal SIGINT...")
  await cleanup()
  process.exit(0)
})

process.on("SIGTERM", async () => {
  console.log("\n🛑 Recibida señal SIGTERM...")
  await cleanup()
  process.exit(0)
})

process.on("uncaughtException", (error) => {
  console.error("💥 Excepción no capturada:", error)
  cleanup().then(() => process.exit(1))
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Promesa rechazada no manejada:", reason)
  console.error("En promesa:", promise)
})

// Iniciar el bot
console.log("🤖 Iniciando Lealia WhatsApp Bot...")
connectToWhatsApp()
