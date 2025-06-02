import { sendMessage } from "../index.js"
import { getGeminiResponse, getFallbackResponse } from "./ai-service.js"
import { createReport } from "./report-service.js"
import { withDatabaseFallback } from "../utils/database-utils.js"
import { showMainMenu, handleMenuInput } from "./menu-handler.js"

async function handleSurvey(sock, chatId, messageContent, session, surveyManager, sessionManager) {
  console.log(`[SURVEY] Processing survey response: ${messageContent} for question ${session.currentSurveyQuestion}`)

  if (session.currentSurveyQuestion < surveyManager.getTotalQuestions()) {
    if (session.isValidSurveyResponse(messageContent)) {
      console.log(`[SURVEY] Valid response received: ${messageContent}`)
      session.addSurveyResponse(messageContent)
      session.currentSurveyQuestion++
      console.log(`[SURVEY] Moving to question ${session.currentSurveyQuestion}`)

      if (session.currentSurveyQuestion < surveyManager.getTotalQuestions()) {
        console.log(`[SURVEY] Sending next question: ${surveyManager.getQuestion(session.currentSurveyQuestion)}`)
        await sendMessage(
          sock,
          chatId,
          `${surveyManager.getQuestion(session.currentSurveyQuestion)}\n\nPor favor, responde con un número del 1 al 9, donde 1 es muy insatisfecho y 9 es muy satisfecho.`,
        )
      } else {
        console.log(`[SURVEY] Survey completed, responses:`, session.surveyResponses)
        await sendMessage(
          sock,
          chatId,
          "🎉 ¡Gracias por completar nuestra encuesta! Tus respuestas son muy valiosas para mejorar el servicio de Lealia. ¡Que tengas un excelente día! 🌟",
        )
        session.isSurveyActive = false
        try {
          console.log(`[SURVEY] Ending session for user ${chatId}`)
          await sessionManager.endSession(chatId)
        } catch (error) {
          console.error(`[SURVEY] Error ending session:`, error)
        }
      }
    } else {
      console.log(`[SURVEY] Invalid response received: ${messageContent}`)
      await sendMessage(
        sock,
        chatId,
        `⚠️ Por favor, responde con un número del 1 al 9, donde 1 es muy insatisfecho y 9 es muy satisfecho.\n\n📊 ${surveyManager.getQuestion(session.currentSurveyQuestion)}`,
      )
    }
    return true
  }
  return false
}

export async function handleMessage(sock, chatId, messageContent, msg, sessionManager, surveyManager) {
  console.log(`[MESSAGE] Handling message from ${chatId}: ${messageContent}`)

  const session = sessionManager.getSession(chatId)
  const phoneNumber = chatId
  const messageText = messageContent.toLowerCase()

  // Add handling for inactivity check flow - MOVE THIS UP before other flow processing
  if (session.currentFlow === "inactivity_check") {
    console.log(`[INACTIVITY] Processing inactivity check response for user ${chatId}: ${messageText}`)
    if (
      messageText === "1" ||
      messageText.includes("sí") ||
      messageText.includes("si") ||
      messageText.includes("continuar")
    ) {
      console.log(`[INACTIVITY] User ${chatId} wants to continue, showing main menu`)
      await showMainMenu(sock, chatId, session)
      return
    } else if (messageText === "2" || messageText.includes("no") || messageText.includes("terminar")) {
      console.log(`[INACTIVITY] User ${chatId} wants to end conversation, ending session`)
      await sendMessage(phoneNumber, {
        text: "👋 ¡Gracias por contactar a Lealia! Si necesitas algo más en el futuro, estaremos aquí para ayudarte. ¡Que tengas un excelente día! 😊",
      })
      await sessionManager.endSession(phoneNumber)
      return
    } else {
      console.log(`[INACTIVITY] Invalid response from user ${chatId}: ${messageText}`)
      await sendMessage(phoneNumber, {
        text: "Por favor, responde con:\n1️⃣ Sí, continuar\n2️⃣ No, terminar conversación",
      })
      return
    }
  }

  // Check for inactivity
  if (session.isInactive && !session.isTransferred) {
    console.log(`[INACTIVITY] User ${chatId} was inactive, sending inactivity check`)
    session.isInactive = false
    await sock.sendMessage(phoneNumber, {
      text: "⏰ Hemos notado que has estado inactivo. ¿Deseas continuar con la conversación?\n\n1️⃣ Sí, continuar con Lealia\n2️⃣ No, terminar conversación",
    })

    session.currentFlow = "inactivity_check"
    session.currentStep = "awaiting_response"
    session.resetInactivityTimer()
    return
  }

  // Verificar si el mensaje contiene el texto de finalización
  if (
    messageContent.trim().toLowerCase() === "fin de la atención humana. iniciando encuesta de satisfacción." ||
    messageContent.trim().toLowerCase() === "fin de la atencion humana." ||
    messageContent.trim().toLowerCase() === "fin de la atención humana"
  ) {
    console.log(`[HUMAN] Human support ended for user ${chatId}, starting satisfaction survey`)
    session.isWaitingForHumanResponse = false
    session.resetSurvey()
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
    await sendMessage(
      sock,
      chatId,
      `📊 ${surveyManager.getQuestion(0)}\n\nPor favor, responde con un número del 1 al 9, donde 1 es muy insatisfecho y 9 es muy satisfecho.`,
    )
    return
  }

  // Si el mensaje es del bot (fromMe es true), ignorarlo
  if (msg.key.fromMe) {
    console.log(`[MESSAGE] Ignoring bot's own message: ${messageContent}`)
    return
  }

  // Si el mensaje no es del bot y estamos esperando una respuesta humana, simplemente retornamos
  if (!msg.key.fromMe && session.isWaitingForHumanResponse) {
    console.log(`[HUMAN] Message received while waiting for human response, ignoring bot processing`)
    return
  }

  // Actualizar la última actividad y reiniciar el temporizador de inactividad
  session.updateLastActivity()
  console.log(`[ACTIVITY] Updated last activity for user ${chatId}`)

  // Intentar asegurar la conexión, pero no bloquear si falla
  withDatabaseFallback(async () => await sessionManager.ensureConnection())

  try {
    // MANEJO DE LA ENCUESTA
    if (session.isSurveyActive) {
      console.log(`[SURVEY] Survey is active for user ${chatId}`)
      const surveyHandled = await handleSurvey(sock, chatId, messageContent, session, surveyManager, sessionManager)
      if (surveyHandled) return
    }

    // MANEJO DEL MENÚ
    console.log(`[MENU] Attempting to handle menu input for user ${chatId}`)
    const menuHandled = await handleMenuInput(sock, chatId, messageContent, session)
    if (menuHandled) {
      console.log(`[MENU] Menu input handled successfully for user ${chatId}`)
      return
    }

    // Add to the handleMessage method, in the flow processing section
    if (
      session.currentFlow === "forgot_credentials" ||
      session.currentFlow === "portal_access" ||
      session.currentFlow === "check_balance"
    ) {
      console.log(`[FLOW] Processing ${session.currentFlow} flow for user ${chatId}`)
      await handleMenuInput(sock, chatId, messageText, session) // Assuming processCredentialFlow is part of handleMenuInput
      return
    }

    if (session.currentFlow === "points_discrepancy_followup") {
      console.log(`[POINTS] Processing points discrepancy followup for user ${chatId}: ${messageText}`)
      if (messageText === "1" || messageText.includes("sí") || messageText.includes("si")) {
        // Transfer to human agent
        console.log(`[POINTS] User ${chatId} needs additional help, collecting report data`)
        session.isCollectingReportData = true
        session.currentField = "name"
        await sendMessage(
          sock,
          chatId,
          `Entiendo que necesitas ayuda adicional para resolver tu problema. Voy a crear un reporte para que un agente de soporte te contacte y pueda ayudarte de manera más personalizada. Por favor, proporciona la siguiente información:\n\nPrimero, ¿cuál es tu nombre completo?`,
        )
      } else if (messageText === "2" || messageText.includes("no")) {
        // End conversation and send survey
        console.log(`[POINTS] User ${chatId} doesn't need additional help, ending conversation`)
        await sendMessage(sock, chatId, {
          text: "¡Gracias por contactarnos! Esperamos haber resuelto tu duda. 😊",
        })
        session.isSurveyActive = true
        session.currentSurveyQuestion = 0
        await sendMessage(
          sock,
          chatId,
          `📊 ${surveyManager.getQuestion(0)}\n\nPor favor, responde con un número del 1 al 9, donde 1 es muy insatisfecho y 9 es muy satisfecho.`,
        )
      } else {
        console.log(`[POINTS] Invalid response from user ${chatId}: ${messageText}`)
        await sendMessage(sock, chatId, {
          text: "Por favor, responde con:\n1️⃣ Sí, necesito más ayuda\n2️⃣ No, gracias",
        })
      }
      return
    }

    // Update points_questions flow handling
    if (session.currentFlow === "points_questions" && session.currentStep === "awaiting_selection") {
      console.log(`[POINTS] Processing points questions selection for user ${chatId}: ${messageText}`)
      if (messageText === "1") {
        console.log(`[POINTS] User ${chatId} selected coin discrepancy`)
        session.currentFlow = "points_discrepancy_followup"
        await sendMessage(sock, chatId, {
          text: "¿Necesitas que te transfiera con un agente humano para revisar tu caso?\n1️⃣ Sí, necesito más ayuda\n2️⃣ No, gracias",
        })
      } else if (messageText === "2") {
        // Continue with normal flow for "No tengo monedas correspondientes al mes"
        console.log(`[POINTS] User ${chatId} selected no monthly coins`)
        await sendMessage(sock, chatId, "Entendido, te ayudaremos con eso.")
      } else if (messageText === "3") {
        console.log(`[POINTS] User ${chatId} returning to main menu`)
        await showMainMenu(sock, chatId, session)
      } else {
        console.log(`[POINTS] Invalid selection from user ${chatId}: ${messageText}`)
        await sendMessage(sock, chatId, {
          text: "Por favor, selecciona una opción válida (1-3):",
        })
      }
      return
    }

    // Update portal_problems flow handling
    if (session.currentFlow === "portal_problems" && session.currentStep === "awaiting_selection") {
      console.log(`[PORTAL] Processing portal problems selection for user ${chatId}: ${messageText}`)
      if (messageText === "1") {
        console.log(`[PORTAL] User ${chatId} selected portal access problem`)
        session.currentFlow = "portal_access"
        await sendMessage(sock, chatId, "Entendido, te ayudaremos con el acceso al portal.")
      } else if (messageText === "2") {
        // Continue with normal flow for "No puedo realizar pedido"
        console.log(`[PORTAL] User ${chatId} selected cannot make order`)
        await sendMessage(sock, chatId, "Entendido, te ayudaremos con el pedido.")
      } else if (messageText === "3") {
        // Continue with normal flow for "No tengo puntos cargados"
        console.log(`[PORTAL] User ${chatId} selected no points loaded`)
        await sendMessage(sock, chatId, "Entendido, te ayudaremos con los puntos.")
      } else if (messageText === "4") {
        console.log(`[PORTAL] User ${chatId} returning to main menu`)
        await showMainMenu(sock, chatId, session)
      } else {
        console.log(`[PORTAL] Invalid selection from user ${chatId}: ${messageText}`)
        await sendMessage(sock, chatId, {
          text: "Por favor, selecciona una opción válida (1-4):",
        })
      }
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
        if (session.currentField === "name") {
          await sendMessage(sock, chatId, "👤 Por favor, proporciona tu nombre completo (sin acentos):")
        } else if (session.currentField === "phone") {
          await sendMessage(sock, chatId, "Por favor, proporciona tu número de teléfono:")
        } else if (session.currentField === "email") {
          await sendMessage(sock, chatId, "📧 Por favor, proporciona tu email registrado en Lealia:")
        } else if (session.currentField === "company") {
          await sendMessage(sock, chatId, "🏢 Por favor, proporciona tu sucursal de Lealia:")
        } else if (session.currentField === "problem") {
          await sendMessage(sock, chatId, "Por favor, describe el problema que estás experimentando:")
        } else {
          await sendMessage(sock, chatId, `Por favor, proporciona tu ${session.currentField}:`)
        }
      } else {
        // All fields collected, create the report
        console.log(`[REPORT] All fields collected, creating report`)
        try {
          // Extraer el número de teléfono del remitente
          const contactPhone = chatId.split("@")[0]
          session.reportData.contact_phone = contactPhone
          console.log(`[REPORT] Report data:`, session.reportData)

          // Usar withDatabaseFallback para crear el reporte
          const reportId = await withDatabaseFallback(
            async () => await createReport(session.reportData, sessionManager),
            "temporal-" + Date.now(), // ID temporal si falla la BD
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
  } catch (error) {
    console.error(`[ERROR] Error processing message for user ${chatId}:`, error)
    await sendMessage(
      sock,
      chatId,
      "Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo o contacta directamente con nuestro servicio al cliente.",
    )
  }
}
