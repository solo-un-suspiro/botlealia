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

// Load environment variables
dotenv.config()

// Verificar variables de entorno
checkEnvVariables()

// Mostrar configuración de base de datos
console.log("\nConfiguración de base de datos secundaria:")
console.log(`Host: ${USER_DB_CONFIG.host}`)
console.log(`Usuario: ${USER_DB_CONFIG.user}`)
console.log(`Base de datos: ${USER_DB_CONFIG.database}`)
console.log(`Contraseña configurada: ${USER_DB_CONFIG.password ? "Sí" : "No"}`)

// Initialize cache for message retry
const msgRetryCache = new NodeCache()

// Create global instances of managers
const sessionManager = new SessionManager(USER_DB_CONFIG) // Usar USER_DB_CONFIG para la segunda base de datos
const surveyManager = new SurveyManager()

async function connectToWhatsApp() {
  // Initialize baileys authentication state outside the try block
  const authState = await useMultiFileAuthState("auth_info_baileys")
  const state = authState.state
  const saveCreds = authState.saveCreds

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    msgRetryCache,
  })

  try {
    // Initialize the database connection
    try {
      console.log("Intentando conectar a la base de datos...")
      const connected = await sessionManager.initializeDbConnection()
      if (connected) {
        console.log("Conexión a la base de datos establecida correctamente")
      } else {
        console.warn(
          "No se pudo establecer la conexión a la base de datos. El bot funcionará con funcionalidad limitada.",
        )
      }
    } catch (dbError) {
      console.error("Error al inicializar la conexión a la base de datos:", dbError)
      console.log("El bot continuará funcionando sin conexión a la base de datos")
    }

    const connect = () => {
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === "close") {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
          console.log("connection closed due to ", lastDisconnect?.error, ", reconnecting ", shouldReconnect)
          if (shouldReconnect) {
            connect()
          } else {
            await sessionManager.closeConnection()
            await closeUserDbConnection()
            await closeReportDbConnection()
          }
        } else if (connection === "open") {
          console.log("opened connection")
          withDatabaseFallback(async () => await sessionManager.ensureConnection())
        }
      })

      sock.ev.on("messages.upsert", async (m) => {
        if (!m || !m.messages || m.messages.length === 0) {
          return
        }

        console.log(JSON.stringify(m, undefined, 2))

        const msg = m.messages[0]
        const chatId = msg.key.remoteJid

        // Ignorar mensajes de grupos y estados
        if (chatId === "status@broadcast" || chatId.endsWith("@g.us")) {
          return
        }

        const messageContent =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.buttonsResponseMessage?.selectedButtonId ||
          msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
          ""

        if (messageContent) {
          console.log("Received message:", messageContent)
          try {
            await handleMessage(sock, chatId, messageContent, msg, sessionManager, surveyManager)
          } catch (error) {
            console.error("Error processing message:", error)
            await sendMessage(
              sock,
              chatId,
              "Lo siento, estamos experimentando problemas técnicos. Por favor, intenta de nuevo más tarde.",
            )
          }
        } else {
          console.log("Received message with no text content:", msg)
        }
      })

      sock.ev.on("creds.update", saveCreds)
    }

    connect()

    // Handle application closure
    process.on("SIGINT", async () => {
      console.log("Cerrando la aplicación...")
      await sessionManager.closeConnection()
      await closeUserDbConnection()
      await closeReportDbConnection()
      process.exit(0)
    })
  } catch (error) {
    console.error("Error al iniciar el bot:", error)
    process.exit(1)
  }
}

// Export the sendMessage function for use in other modules
export async function sendMessage(sock, chatId, text) {
  const maxLength = 2000 // Adjust this value based on your needs
  const chunks = []

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

  for (const chunk of chunks) {
    await sock.sendMessage(chatId, { text: chunk })
  }
}

// Run the main function to connect to WhatsApp
connectToWhatsApp()
