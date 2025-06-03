import { sendMessage } from "../index.js"
import { getGeminiResponse, getFallbackResponse } from "./ai-service.js"
import { createReport } from "./report-service.js"
import { withDatabaseFallback } from "../utils/database-utils.js"
import { showMainMenu, handleMenuInput } from "./menu-handler.js"
import { BusinessHours } from "../utils/business-hours.js"
import { messageTracker } from "../utils/message-tracker.js"

const businessHours = new BusinessHours()

// Cache para prevenir mensajes duplicados
const messageCache = new Map()
const CACHE_DURATION = 5000 // 5 segundos

// Lista de frases que indican fin de atención humana
const END_HUMAN_SUPPORT_PHRASES = [
  "fin de la atención humana. iniciando encuesta de satisfacción.",
  "fin de la atencion humana.",
  "fin de la atención humana",
  "fin de la atencion humana",
  "fin atencion humana",
  "fin atención humana",
  "finalizar atencion humana",
  "finalizar atención humana",
]

function isDuplicateMessage(chatId, messageContent) {
  const key = `${chatId}:${messageContent}`
  const now = Date.now()

  if (messageCache.has(key)) {
    const timestamp = messageCache.get(key)
    if (now - timestamp < CACHE_DURATION) {
      console.log(`🔄 Mensaje duplicado detectado para ${chatId}: ${messageContent}`)
      return true
    }
  }

  messageCache.set(key, now)

  // Limpiar cache antiguo
  for (const [cacheKey, timestamp] of messageCache) {
    if (now - timestamp > CACHE_DURATION) {
      messageCache.delete(cacheKey)
    }
  }

  return false
}

// Función para verificar si un mensaje es de fin de atención humana
function isEndHumanSupportMessage(messageContent) {
  const lowerMessage = messageContent.trim().toLowerCase()
  return END_HUMAN_SUPPORT_PHRASES.some((phrase) => lowerMessage.includes(phrase))
}

async function handleSurvey(sock, chatId, messageContent, session, surveyManager, sessionManager) {
  console.log(`[SURVEY] Processing survey response: ${messageContent} for question ${session.currentSurveyQuestion}`)

  try {
    // Verificar que surveyManager está disponible
    if (!surveyManager || typeof surveyManager.getTotalQuestions !== "function") {
      console.error(`[SURVEY] Survey manager not available or missing getTotalQuestions method`)
      await sendMessage(
        sock,
        chatId,
        "Lo sentimos, hay un problema técnico con nuestra encuesta. Tu mensaje ha sido registrado. ¡Gracias por contactarnos!",
      )
      session.isSurveyActive = false
      return true
    }

    const totalQuestions = surveyManager.getTotalQuestions()
    console.log(`[SURVEY] Total questions: ${totalQuestions}, Current question: ${session.currentSurveyQuestion}`)

    // Verificar que estamos dentro del rango de preguntas
    if (session.currentSurveyQuestion < totalQuestions) {
      // Verificar si la respuesta es válida
      if (session.isValidSurveyResponse(messageContent)) {
        console.log(`[SURVEY] Valid response received: ${messageContent}`)
        session.addSurveyResponse(messageContent)
        session.currentSurveyQuestion++
        console.log(`[SURVEY] Moving to question ${session.currentSurveyQuestion}`)

        // Verificar si hay más preguntas
        if (session.currentSurveyQuestion < totalQuestions) {
          const nextQuestion = surveyManager.getQuestion(session.currentSurveyQuestion)
          console.log(`[SURVEY] Sending next question: ${nextQuestion}`)
          await sendMessage(
            sock,
            chatId,
            `📊 ${nextQuestion}\n\nPor favor, responde con un número del 1 al 9, donde 1 es muy insatisfecho y 9 es muy satisfecho.`,
          )
        } else {
          // Encuesta completada
          console.log(`[SURVEY] Survey completed, responses:`, session.surveyResponses)
          await sendMessage(
            sock,
            chatId,
            "🎉 ¡Gracias por completar nuestra encuesta! Tus respuestas son muy valiosas para mejorar el servicio de Lealia. ¡Que tengas un excelente día! 🌟",
          )
          session.isSurveyActive = false

          try {
            // Guardar respuestas y finalizar sesión
            console.log(`[SURVEY] Saving survey responses and ending session for user ${chatId}`)
            await sessionManager.saveSessionToDatabase(session)
            await sessionManager.endSession(chatId)
          } catch (error) {
            console.error(`[SURVEY] Error ending session:`, error)
          }
        }
      } else {
        // Respuesta inválida
        console.log(`[SURVEY] Invalid response received: ${messageContent}`)
        const currentQuestion = surveyManager.getQuestion(session.currentSurveyQuestion)
        await sendMessage(
          sock,
          chatId,
          `⚠️ Por favor, responde con un número del 1 al 9, donde 1 es muy insatisfecho y 9 es muy satisfecho.\n\n📊 ${currentQuestion}`,
        )
      }
      return true
    } else {
      // Fuera del rango de preguntas (no debería ocurrir)
      console.log(`[SURVEY] Question index out of range: ${session.currentSurveyQuestion} >= ${totalQuestions}`)
      session.isSurveyActive = false
      return false
    }
  } catch (error) {
    console.error(`[SURVEY] Error handling survey:`, error)
    await sendMessage(
      sock,
      chatId,
      "Lo sentimos, ha ocurrido un error al procesar tu respuesta. Por favor, intenta de nuevo más tarde.",
    )
    return true
  }
}

// Función para iniciar la encuesta de satisfacción
async function startSatisfactionSurvey(sock, chatId, session, surveyManager, sessionManager) {
  console.log(`[SURVEY] Starting satisfaction survey for user ${chatId}`)

  try {
    // Reiniciar la encuesta y configurar la sesión
    session.isWaitingForHumanResponse = false
    session.resetSurvey()

    // Reanudar el temporizador de inactividad
    session.resumeInactivityTimer(
      async () => {
        await sendMessage(sock, chatId, "¿Sigues ahí? Estoy aquí para ayudarte si tienes más preguntas.")
      },
      async () => {
        await sendMessage(
          sock,
          chatId,
          "Parece que no hay actividad. Si necesitas más ayuda, no dudes en contactarnos nuevamente. ¡Que tengas un buen día!",
        )
        await sessionManager.endSession(chatId)
      },
    )

    // Enviar la primera pregunta de la encuesta
    if (!surveyManager || typeof surveyManager.getQuestion !== "function") {
      console.error(`[SURVEY] Survey manager not available or missing getQuestion method`)
      await sendMessage(
        sock,
        chatId,
        "📊 ¿Cómo calificarías la atención recibida?\n\nPor favor, responde con un número del 1 al 9, donde 1 es muy insatisfecho y 9 es muy satisfecho.",
      )
    } else {
      const firstQuestion = surveyManager.getQuestion(0)
      await sendMessage(
        sock,
        chatId,
        `📊 ${firstQuestion}\n\nPor favor, responde con un número del 1 al 9, donde 1 es muy insatisfecho y 9 es muy satisfecho.`,
      )
    }

    console.log(`[SURVEY] Survey started successfully for user ${chatId}`)
    return true
  } catch (error) {
    console.error(`[SURVEY] Error starting survey:`, error)
    await sendMessage(
      sock,
      chatId,
      "📊 ¿Cómo calificarías la atención recibida?\n\nPor favor, responde con un número del 1 al 9, donde 1 es muy insatisfecho y 9 es muy satisfecho.",
    )
    return false
  }
}

export async function handleMessage(sock, chatId, messageContent, msg, sessionManager, surveyManager) {
  try {
    console.log(`[MESSAGE] Handling message from ${chatId}: ${messageContent}`)

    // Registrar el origen del mensaje usando nuestro sistema personalizado
    const messageId = msg.key?.id
    const messageOrigin = messageTracker.getMessageOrigin(msg)

    console.log(`[MESSAGE] Message ID: ${messageId}, Origin: ${messageOrigin}`)

    // Si el mensaje tiene un ID y no está en nuestro registro, asumimos que es de un humano
    if (messageId && messageOrigin === "likely-human") {
      messageTracker.trackHumanMessage(messageId)
    }

    // IMPORTANTE: Verificar primero si es un mensaje de fin de atención humana
    // Esta verificación debe hacerse antes de comprobar si el mensaje es del bot
    if (isEndHumanSupportMessage(messageContent)) {
      console.log(`[HUMAN] Human support end message detected: "${messageContent}"`)

      // Verificar si realmente es un mensaje humano o del bot
      if (messageOrigin === "bot" || messageOrigin === "likely-bot") {
        console.log(`[HUMAN] Warning: End message appears to be from the bot itself. Origin: ${messageOrigin}`)
        // Podemos decidir si continuar o no basado en una configuración
      }

      // Obtener o crear la sesión
      const session = sessionManager.getSession(chatId)

      // Iniciar la encuesta de satisfacción
      await startSatisfactionSurvey(sock, chatId, session, surveyManager, sessionManager)
      return
    }

    // Verificar si es mensaje del bot para evitar loops
    if (messageOrigin === "bot" || messageOrigin === "likely-bot") {
      console.log(`[MESSAGE] Ignoring bot's own message (origin: ${messageOrigin}): ${messageContent}`)
      return
    }

    // Verificar duplicados
    if (isDuplicateMessage(chatId, messageContent)) {
      return
    }

    // Verificar lock de procesamiento
    const canProcess = await sessionManager.lockMessageProcessing(chatId)
    if (!canProcess) {
      return
    }

    try {
      // Verificar horarios de atención PRIMERO
      if (!businessHours.isBusinessHours()) {
        console.log(`[BUSINESS_HOURS] Message received outside business hours from ${chatId}`)
        await sendMessage(sock, chatId, businessHours.getOutOfHoursMessage())
        return
      }

      const session = sessionManager.getSession(chatId)
      const phoneNumber = chatId
      const messageText = messageContent.toLowerCase()

      // Verificar si estamos esperando respuesta humana
      if (!msg.key.fromMe && session.isWaitingForHumanResponse) {
        console.log(`[HUMAN] Message received while waiting for human response, ignoring bot processing`)
        return
      }

      // Manejo de inactividad
      if (session.currentFlow === "inactivity_check") {
        console.log(`[INACTIVITY] Processing inactivity check response for user ${chatId}: ${messageText}`)
        if (
          messageText === "1" ||
          messageText.includes("sí") ||
          messageText.includes("si") ||
          messageText.includes("continuar")
        ) {
          console.log(`[INACTIVITY] User ${chatId} wants to continue, showing main menu`)
          session.currentFlow = "main_menu"
          session.isInactive = false
          await showMainMenu(sock, chatId, session)
          return
        } else if (messageText === "2" || messageText.includes("no") || messageText.includes("terminar")) {
          console.log(`[INACTIVITY] User ${chatId} wants to end conversation, ending session`)
          await sendMessage(
            sock,
            chatId,
            "👋 ¡Gracias por contactar a Lealia! Si necesitas algo más en el futuro, estaremos aquí para ayudarte. ¡Que tengas un excelente día! 😊",
          )
          await sessionManager.endSession(chatId)
          return
        } else {
          console.log(`[INACTIVITY] Invalid response from user ${chatId}: ${messageText}`)
          await sendMessage(sock, chatId, "Por favor, responde con:\n1️⃣ Sí, continuar\n2️⃣ No, terminar conversación")
          return
        }
      }

      // Verificar inactividad
      if (session.isInactive && !session.isTransferred) {
        console.log(`[INACTIVITY] User ${chatId} was inactive, sending inactivity check`)
        session.isInactive = false
        await sendMessage(
          sock,
          chatId,
          "⏰ Hemos notado que has estado inactivo. ¿Deseas continuar con la conversación?\n\n1️⃣ Sí, continuar con Lealia\n2️⃣ No, terminar conversación",
        )
        session.currentFlow = "inactivity_check"
        session.currentStep = "awaiting_response"
        session.resetInactivityTimer()
        return
      }

      // Actualizar actividad
      session.updateLastActivity()
      console.log(`[ACTIVITY] Updated last activity for user ${chatId}`)

      // Asegurar conexión DB
      withDatabaseFallback(async () => await sessionManager.ensureConnection())

      // MANEJO DE LA ENCUESTA - Versión mejorada
      if (session.isSurveyActive) {
        console.log(`[SURVEY] Survey is active for user ${chatId}, question ${session.currentSurveyQuestion}`)
        try {
          const surveyHandled = await handleSurvey(sock, chatId, messageContent, session, surveyManager, sessionManager)
          if (surveyHandled) {
            console.log(`[SURVEY] Survey handling successful for user ${chatId}`)
            return
          } else {
            console.log(`[SURVEY] Survey not handled, continuing with normal message processing`)
          }
        } catch (error) {
          console.error(`[SURVEY] Error in survey handling:`, error)
          // Continuar con el procesamiento normal si hay un error en la encuesta
        }
      }

      // Verificar explícitamente si debemos iniciar una encuesta basada en el mensaje
      if (
        !session.isSurveyActive &&
        (messageContent.toLowerCase().includes("iniciar encuesta") ||
          messageContent.toLowerCase().includes("comenzar encuesta"))
      ) {
        console.log(`[SURVEY] Survey trigger phrase detected in regular message flow: "${messageContent}"`)
        await startSatisfactionSurvey(sock, chatId, session, surveyManager, sessionManager)
        return
      }

      // MANEJO DEL MENÚ
      console.log(`[MENU] Attempting to handle menu input for user ${chatId}`)
      const menuHandled = await handleMenuInput(sock, chatId, messageContent, session)
      if (menuHandled) {
        console.log(`[MENU] Menu input handled successfully for user ${chatId}`)
        return
      }

      // Si es un nuevo chat, mostrar el menú principal
      if (session.conversationHistory.length === 0) {
        console.log(`[NEW] New conversation with user ${chatId}, showing main menu`)
        await showMainMenu(sock, chatId, session)
        return
      }

      // MANEJO DE RECOLECCIÓN DE DATOS PARA REPORTE
      if (session.isCollectingReportData) {
        console.log(`[REPORT] Collecting report data for user ${chatId}, field: ${session.currentField}`)
        session.reportData[session.currentField] = messageContent
        const reportFields = ["name", "phone", "email", "company", "problem"]
        const currentIndex = reportFields.indexOf(session.currentField)
        console.log(`[REPORT] Current field index: ${currentIndex}, value: ${messageContent}`)

        if (currentIndex < reportFields.length - 1) {
          session.currentField = reportFields[currentIndex + 1]
          console.log(`[REPORT] Moving to next field: ${session.currentField}`)

          const fieldPrompts = {
            name: "👤 Por favor, proporciona tu nombre completo (sin acentos):",
            phone: "📞 Por favor, proporciona tu número de teléfono:",
            email: "📧 Por favor, proporciona tu email registrado en Lealia:",
            company: "🏢 Por favor, proporciona tu sucursal de Lealia:",
            problem: "📝 Por favor, describe el problema que estás experimentando:",
          }

          await sendMessage(
            sock,
            chatId,
            fieldPrompts[session.currentField] || `Por favor, proporciona tu ${session.currentField}:`,
          )
        } else {
          // Todos los campos recolectados, crear el reporte
          console.log(`[REPORT] All fields collected, creating report`)
          try {
            const contactPhone = chatId.split("@")[0]
            session.reportData.contact_phone = contactPhone
            console.log(`[REPORT] Report data:`, session.reportData)

            const reportId = await withDatabaseFallback(
              async () => await createReport(session.reportData, sessionManager),
              "temporal-" + Date.now(),
            )

            console.log(`[REPORT] Report created with ID: ${reportId}`)
            session.reportId = reportId
            await sendMessage(
              sock,
              chatId,
              "✅ Gracias por proporcionar la información. Te transferiremos con un agente especializado de Lealia para resolver tu problema de forma personalizada.",
            )
            session.isCollectingReportData = false
            session.reportData = {}
            session.currentField = ""
            session.isWaitingForHumanResponse = true
            session.pauseInactivityTimer()
            console.log(`[REPORT] User ${chatId} transferred to human agent, inactivity timer paused`)
          } catch (error) {
            console.error(`[REPORT] Error creating report:`, error)
            await sendMessage(
              sock,
              chatId,
              "Lo siento, hubo un error al crear el reporte. Por favor, intenta de nuevo o contacta directamente con nuestro servicio al cliente.",
            )
            session.isCollectingReportData = false
            session.reportData = {}
            session.currentField = ""
          }
        }
        return
      }

      // CONVERSACIÓN NORMAL CON IA
      console.log(`[AI] Processing message with AI for user ${chatId}: ${messageContent}`)
      session.conversationHistory.push(`Usuario: ${messageContent}`)

      // Limitar historial para evitar problemas de memoria
      if (session.conversationHistory.length > 20) {
        session.conversationHistory = session.conversationHistory.slice(-20)
      }

      let response
      try {
        console.log(`[AI] Calling Gemini API for user ${chatId}`)
        response = await getGeminiResponse(messageContent, session.conversationHistory)
        console.log(`[AI] Gemini API response received: ${response.substring(0, 100)}...`)
      } catch (error) {
        if (error.message === "API_QUOTA_EXCEEDED") {
          console.log(`[AI] Gemini API quota exceeded for user ${chatId}, using fallback response`)
          response = await getFallbackResponse(messageContent)
        } else {
          console.error(`[AI] Error getting AI response:`, error)
          throw error
        }
      }

      session.conversationHistory.push(`Bot: ${response}`)
      console.log(`[AI] Bot response for user ${chatId}: ${response.substring(0, 100)}...`)

      if (
        response.toLowerCase().includes("crear un reporte") ||
        messageContent.toLowerCase().includes("hablar con un humano") ||
        messageContent.toLowerCase().includes("agente") ||
        messageContent.toLowerCase().includes("persona real")
      ) {
        console.log(`[HUMAN] User ${chatId} requested human agent, starting report creation`)
        session.isCollectingReportData = true
        session.currentField = "name"
        await sendMessage(
          sock,
          chatId,
          `Entiendo que necesitas ayuda adicional para resolver tu problema. Voy a crear un reporte para que un agente de soporte te contacte y pueda ayudarte de manera más personalizada. Por favor, proporciona la siguiente información:\n\nPrimero, ¿cuál es tu nombre completo?`,
        )
      } else {
        await sendMessage(sock, chatId, response)
      }

      // Iniciar el temporizador de inactividad después de procesar el mensaje
      console.log(`[ACTIVITY] Starting inactivity timer for user ${chatId}`)
      session.startInactivityTimer(
        async () => {
          console.log(`[INACTIVITY] Warning user ${chatId} about inactivity`)
          await sendMessage(sock, chatId, "¿Sigues ahí? Estoy aquí para ayudarte si tienes más preguntas.")
        },
        async () => {
          console.log(`[INACTIVITY] Ending session for inactive user ${chatId}`)
          await sendMessage(
            sock,
            chatId,
            "Parece que no hay actividad. Si necesitas más ayuda, no dudes en contactarnos nuevamente. ¡Que tengas un buen día!",
          )
          await sessionManager.endSession(chatId)
        },
      )
    } finally {
      // Siempre liberar el lock
      sessionManager.unlockMessageProcessing(chatId)
    }
  } catch (error) {
    console.error(`[ERROR] Error processing message for user ${chatId}:`, error)

    // Liberar lock en caso de error
    sessionManager.unlockMessageProcessing(chatId)

    try {
      await sendMessage(
        sock,
        chatId,
        "Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo o contacta directamente con nuestro servicio al cliente.",
      )
    } catch (sendError) {
      console.error(`[ERROR] Error sending error message:`, sendError)
    }
  }
}
