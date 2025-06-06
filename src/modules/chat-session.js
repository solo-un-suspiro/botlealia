export class ChatSession {
  constructor(phoneNumber) {
    this.phoneNumber = phoneNumber
    this.currentFlow = "greeting"
    this.currentStep = "initial"
    this.userData = {}
    this.orderData = {}
    this.surveyData = {
      isActive: false,
      currentQuestion: 0,
      responses: [],
    }
    this.isTransferred = false
    this.transferTime = null
    this.isInactive = false
    this.inactivityTimer = null
    this.warningTimer = null
    this.lastActivity = new Date()
    this.chatId = phoneNumber
    this.conversationHistory = []
    this.isCollectingReportData = false
    this.reportData = {}
    this.currentField = ""
    this.reportId = null
    this.isWaitingForHumanResponse = false
    this.isSurveyActive = false
    this.surveyResponses = []
    this.currentSurveyQuestion = 0
    this.startTime = Date.now()
    this.isTimerPaused = false
    this.hasWarned = false

    // Propiedades para el flujo de menú
    this.currentMenu = "MAIN_MENU"
    this.currentMenuOption = null
    this.menuState = {
      awaitingMenuSelection: true,
      awaitingUserData: false,
      userData: {},
      currentStep: "MAIN_MENU",
    }
    this.pendingEmails = []

    // Nuevas propiedades para mejorar la estabilidad
    this.messageCount = 0
    this.lastMessageTime = 0
    this.processingMessage = false

    // Nuevas propiedades para el logging de conversaciones
    this.conversationId = null
    this.isAbandoned = false
    this.abandonedAt = null

    // NUEVA PROPIEDAD: Para distinguir entre transferencia normal y atención desde contact center
    this.isHumanAgentActive = false
    this.humanAgentStartTime = null

    // Callbacks para el temporizador - SIEMPRE DEFINIDOS
    this.warningCallback = null
    this.endCallback = null
  }

  updateLastActivity() {
    this.lastActivity = Date.now()
    this.lastMessageTime = Date.now()
    this.messageCount++

    // Si la sesión estaba abandonada, ya no lo está
    if (this.isAbandoned) {
      this.isAbandoned = false
      this.abandonedAt = null
      console.log(`[SESSION] Session ${this.chatId} is no longer abandoned`)
    }

    this.resetInactivityTimer()
  }

  resetInactivityTimer() {
    // Limpiar timers existentes
    this.clearAllTimers()

    // No resetear timer si transferido a humano o pausado
    if (this.isTransferred || this.isTimerPaused) {
      console.log(`[TIMER] Timer not reset - transferred: ${this.isTransferred}, paused: ${this.isTimerPaused}`)
      return
    }

    // Solo resetear si tenemos callbacks configurados
    if (this.warningCallback && this.endCallback) {
      console.log(`[TIMER] Resetting inactivity timer with callbacks for user ${this.chatId}`)
      this.startInactivityTimer(this.warningCallback, this.endCallback)
    } else {
      console.log(`[TIMER] No callbacks configured for user ${this.chatId}, skipping timer reset`)
    }
  }

  clearAllTimers() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer)
      this.inactivityTimer = null
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer)
      this.warningTimer = null
    }
  }

  // Método simplificado - ya no se usa para el flujo principal
  handleInactivity() {
    if (this.isTransferred || this.isTimerPaused) {
      console.log(
        `[INACTIVITY] Skipping inactivity handling - transferred: ${this.isTransferred}, paused: ${this.isTimerPaused}`,
      )
      return
    }

    console.log(`[INACTIVITY] Marking user ${this.chatId} as inactive (legacy method)`)
    this.isInactive = true
    this.currentFlow = "inactivity_check"
  }

  // Nuevo método para marcar la sesión como abandonada
  markAsAbandoned() {
    console.log(`[SESSION] Marking session ${this.chatId} as abandoned`)
    this.isAbandoned = true
    this.abandonedAt = Date.now()
    this.isInactive = true
    this.currentFlow = "abandoned"
  }

  // Verificar si la sesión fue abandonada
  wasAbandoned() {
    return this.isAbandoned
  }

  // NUEVOS MÉTODOS PARA MANEJO DE AGENTE HUMANO DESDE CONTACT CENTER

  /**
   * Activa el modo de agente humano desde contact center
   */
  activateHumanAgent() {
    console.log(`[HUMAN_AGENT] Activating human agent mode for ${this.chatId}`)
    this.isHumanAgentActive = true
    this.humanAgentStartTime = Date.now()
    this.isTransferred = true
    this.isWaitingForHumanResponse = true
    this.pauseInactivityTimer()
  }

  /**
   * Desactiva el modo de agente humano
   */
  deactivateHumanAgent() {
    console.log(`[HUMAN_AGENT] Deactivating human agent mode for ${this.chatId}`)
    this.isHumanAgentActive = false
    this.humanAgentStartTime = null
    this.isTransferred = false
    this.isWaitingForHumanResponse = false

    // No reanudar automáticamente el timer aquí - se hará cuando se inicie la encuesta
  }

  /**
   * Verifica si hay un agente humano activo
   */
  isHumanAgentActiveNow() {
    return this.isHumanAgentActive && this.isTransferred
  }

  /**
   * Obtiene el tiempo que lleva activo el agente humano
   */
  getHumanAgentDuration() {
    if (!this.humanAgentStartTime) return 0
    return Date.now() - this.humanAgentStartTime
  }

  startInactivityTimer(warningCallback, endCallback) {
    this.clearAllTimers()

    if (this.isTimerPaused || this.isTransferred) {
      console.log(`[TIMER] Not starting timer - paused: ${this.isTimerPaused}, transferred: ${this.isTransferred}`)
      return
    }

    // Guardar los callbacks para uso posterior
    this.warningCallback = warningCallback
    this.endCallback = endCallback

    console.log(`[TIMER] Starting inactivity timer for user ${this.chatId} (2 minutes)`)

    // Debug: verificar que los callbacks son funciones válidas
    console.log(`[TIMER] 🔍 Debug - warningCallback type: ${typeof warningCallback}`)
    console.log(`[TIMER] 🔍 Debug - endCallback type: ${typeof endCallback}`)
    console.log(`[TIMER] 🔍 Debug - isTransferred: ${this.isTransferred}`)
    console.log(`[TIMER] 🔍 Debug - isTimerPaused: ${this.isTimerPaused}`)

    this.inactivityTimer = setTimeout(
      async () => {
        if (!this.isTransferred && !this.isTimerPaused) {
          console.log(`[TIMER] 🚨 INACTIVITY TIMEOUT TRIGGERED for user ${this.chatId}`)
          try {
            // Ejecutar callback de warning directamente
            console.log(`[TIMER] 📤 Executing warning callback...`)
            await warningCallback()
            console.log(`[TIMER] ✅ Warning callback executed successfully`)

            // Marcar como abandonada
            this.markAsAbandoned()

            // Configurar timer para auto-terminación después del mensaje de abandono
            console.log(`[TIMER] ⏰ Setting end timer (1 minute)...`)
            this.warningTimer = setTimeout(
              async () => {
                if (!this.isTransferred && !this.isTimerPaused) {
                  console.log(`[TIMER] 🔚 END TIMEOUT TRIGGERED for user ${this.chatId}`)
                  try {
                    console.log(`[TIMER] 📤 Executing end callback...`)
                    await endCallback()
                    console.log(`[TIMER] ✅ End callback executed successfully`)
                  } catch (error) {
                    console.error(`[TIMER] ❌ Error in end callback:`, error)
                  }
                }
              },
              1 * 60 * 1000, // 1 minuto después del mensaje de abandono
            )
          } catch (error) {
            console.error(`[TIMER] ❌ Error in warning callback:`, error)
          }
        } else {
          console.log(`[TIMER] ⏭️ Skipping timeout - transferred: ${this.isTransferred}, paused: ${this.isTimerPaused}`)
        }
      },
      2 * 60 * 1000, // 2 minutos para el mensaje de abandono
    )

    console.log(`[TIMER] ✅ Inactivity timer set successfully for user ${this.chatId}`)
  }

  pauseInactivityTimer() {
    console.log(`[TIMER] Pausing inactivity timer for user ${this.chatId}`)
    this.clearAllTimers()
    this.isTimerPaused = true
  }

  resumeInactivityTimer(warningCallback, endCallback) {
    console.log(`[TIMER] Resuming inactivity timer for user ${this.chatId}`)
    this.isTimerPaused = false
    this.hasWarned = false

    // Actualizar los callbacks
    this.warningCallback = warningCallback
    this.endCallback = endCallback

    this.startInactivityTimer(warningCallback, endCallback)
  }

  resetSurvey() {
    console.log(`[SURVEY] Resetting survey for user ${this.chatId}`)

    // Inicializar o reiniciar todas las propiedades relacionadas con la encuesta
    this.surveyResponses = []
    this.currentSurveyQuestion = 0
    this.isSurveyActive = true

    // Asegurar que otras propiedades estén correctamente configuradas
    this.isWaitingForHumanResponse = false

    // IMPORTANTE: Desactivar el modo de agente humano al iniciar la encuesta
    this.deactivateHumanAgent()

    // Registrar el estado actual para depuración
    console.log(
      `[SURVEY] Survey state after reset: active=${this.isSurveyActive}, question=${this.currentSurveyQuestion}, waitingForHuman=${this.isWaitingForHumanResponse}, humanAgent=${this.isHumanAgentActive}`,
    )

    return true
  }

  isValidSurveyResponse(response) {
    const num = Number.parseInt(response)
    return !isNaN(num) && num >= 1 && num <= 9
  }

  addSurveyResponse(response) {
    this.surveyResponses.push(Number.parseInt(response))
  }

  isLastSurveyQuestion(totalQuestions) {
    return this.currentSurveyQuestion >= totalQuestions - 1
  }

  // Métodos para el flujo de menú
  setMenuState(menu, awaitingSelection = true) {
    console.log(`[MENU] Setting menu state: ${menu}, awaiting selection: ${awaitingSelection}`)
    this.currentMenu = menu
    this.menuState.awaitingMenuSelection = awaitingSelection
    this.menuState.currentStep = menu
  }

  setUserDataCollection(field) {
    console.log(`[MENU] Setting user data collection for field: ${field}`)
    this.menuState.awaitingMenuSelection = false
    this.menuState.awaitingUserData = true
    this.menuState.currentDataField = field
  }

  addUserData(field, value) {
    console.log(`[MENU] Adding user data: ${field} = ${value}`)
    this.menuState.userData[field] = value
  }

  resetMenuState() {
    console.log(`[MENU] Resetting menu state for user ${this.chatId}`)
    this.currentMenu = "MAIN_MENU"
    this.currentMenuOption = null
    this.menuState = {
      awaitingMenuSelection: true,
      awaitingUserData: false,
      userData: {},
      currentStep: "MAIN_MENU",
    }
  }

  addPendingEmail(emailData) {
    this.pendingEmails.push(emailData)
  }

  clearUserData() {
    console.log(`[MENU] Clearing user data for user ${this.chatId}`)
    this.menuState.userData = {}
  }

  // Método para limpiar la sesión completamente
  cleanup() {
    console.log(`[SESSION] Cleaning up session for user ${this.chatId}`)
    this.clearAllTimers()
    this.processingMessage = false
    this.isInactive = false
    this.isTransferred = false
    this.isTimerPaused = false
    this.hasWarned = false
    this.isAbandoned = false
    this.abandonedAt = null
    this.warningCallback = null
    this.endCallback = null

    // Limpiar propiedades de agente humano
    this.isHumanAgentActive = false
    this.humanAgentStartTime = null
  }

  // Método para verificar si la sesión está en un estado válido
  isValidState() {
    const now = Date.now()
    const timeSinceLastActivity = now - this.lastActivity
    const maxInactiveTime = 30 * 60 * 1000 // 30 minutos

    if (timeSinceLastActivity > maxInactiveTime) {
      console.log(
        `[SESSION] Session for ${this.chatId} is stale (${Math.floor(timeSinceLastActivity / 60000)} minutes inactive)`,
      )
      return false
    }

    return true
  }
}
