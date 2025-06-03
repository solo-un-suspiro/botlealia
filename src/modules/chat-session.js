export class ImprovedChatSession {
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
  }

  updateLastActivity() {
    this.lastActivity = Date.now()
    this.lastMessageTime = Date.now()
    this.messageCount++
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

    console.log(`[TIMER] Resetting inactivity timer for user ${this.chatId}`)
    this.inactivityTimer = setTimeout(
      () => {
        this.handleInactivity()
      },
      2 * 60 * 1000,
    ) // 2 minutos
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

  handleInactivity() {
    if (this.isTransferred || this.isTimerPaused) {
      console.log(
        `[INACTIVITY] Skipping inactivity handling - transferred: ${this.isTransferred}, paused: ${this.isTimerPaused}`,
      )
      return
    }

    console.log(`[INACTIVITY] Marking user ${this.chatId} as inactive`)
    this.isInactive = true
    this.currentFlow = "inactivity_check"
  }

  startInactivityTimer(warningCallback, endCallback) {
    this.clearAllTimers()

    if (this.isTimerPaused || this.isTransferred) {
      console.log(`[TIMER] Not starting timer - paused: ${this.isTimerPaused}, transferred: ${this.isTransferred}`)
      return
    }

    console.log(`[TIMER] Starting inactivity timer for user ${this.chatId}`)

    this.inactivityTimer = setTimeout(
      async () => {
        if (!this.hasWarned && !this.isTransferred && !this.isTimerPaused) {
          console.log(`[TIMER] Inactivity warning triggered for user ${this.chatId}`)
          try {
            await warningCallback()
            this.hasWarned = true
            this.currentFlow = "inactivity_check"
            this.currentStep = "awaiting_response"

            // Timer para auto-terminación
            this.warningTimer = setTimeout(
              async () => {
                if (!this.isTransferred && !this.isTimerPaused) {
                  console.log(`[TIMER] Auto-terminating session for user ${this.chatId} due to continued inactivity`)
                  try {
                    await endCallback()
                  } catch (error) {
                    console.error(`[TIMER] Error in end callback:`, error)
                  }
                }
              },
              2 * 60 * 1000,
            ) // 2 minutos después del warning
          } catch (error) {
            console.error(`[TIMER] Error in warning callback:`, error)
          }
        }
      },
      2 * 60 * 1000,
    ) // 2 minutos para warning inicial
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
    this.startInactivityTimer(warningCallback, endCallback)
  }

  resetSurvey() {
    console.log(`[SURVEY] Resetting survey for user ${this.chatId}`)
    this.surveyResponses = []
    this.currentSurveyQuestion = 0
    this.isSurveyActive = true
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
