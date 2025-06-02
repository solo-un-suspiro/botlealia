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
    this.lastActivity = new Date()
    this.resetInactivityTimer()
    this.chatId = phoneNumber // Use phoneNumber as chatId
    this.conversationHistory = []
    this.isCollectingReportData = false
    this.reportData = {}
    this.currentField = ""
    this.lastActivity = Date.now()
    this.reportId = null
    this.isWaitingForHumanResponse = false
    this.isSurveyActive = false
    this.surveyResponses = []
    this.currentSurveyQuestion = 0
    this.startTime = Date.now()
    this.warningTimer = null
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
  }

  updateLastActivity() {
    this.lastActivity = Date.now()
    this.resetInactivityTimer()
  }

  resetInactivityTimer() {
    // Don't reset timer if transferred to human agent
    if (this.isTransferred) {
      return
    }

    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer)
    }

    this.inactivityTimer = setTimeout(
      () => {
        this.handleInactivity()
      },
      2 * 60 * 1000,
    ) // 2 minutes
  }

  // Add method to handle inactivity
  handleInactivity() {
    if (this.isTransferred) {
      return // Don't handle inactivity if transferred
    }

    console.log(`[INACTIVITY] Marking user ${this.chatId} as inactive`)
    this.isInactive = true
    this.currentFlow = "inactivity_check"
    // The message handler will check this flag and send appropriate message
  }

  startInactivityTimer(warningCallback, endCallback) {
    this.resetInactivityTimer()
    if (!this.isTimerPaused) {
      console.log(`[TIMER] Starting inactivity timer for user ${this.chatId}`)
      this.inactivityTimer = setTimeout(
        () => {
          if (!this.hasWarned) {
            console.log(`[TIMER] Inactivity warning triggered for user ${this.chatId}`)
            warningCallback()
            this.hasWarned = true
            this.currentFlow = "inactivity_check"
            this.currentStep = "awaiting_response"

            // Set a second timer for auto-termination if no response
            this.warningTimer = setTimeout(
              () => {
                console.log(`[TIMER] Auto-terminating session for user ${this.chatId} due to continued inactivity`)
                endCallback()
              },
              2 * 60 * 1000,
            ) // 2 minutes after warning
          }
        },
        2 * 60 * 1000,
      ) // 2 minutes for initial warning
    }
  }

  pauseInactivityTimer() {
    this.resetInactivityTimer()
    this.isTimerPaused = true
  }

  resumeInactivityTimer(warningCallback, endCallback) {
    this.isTimerPaused = false
    this.startInactivityTimer(warningCallback, endCallback)
  }

  resetSurvey() {
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
    this.currentMenu = menu
    this.menuState.awaitingMenuSelection = awaitingSelection
    this.menuState.currentStep = menu
  }

  setUserDataCollection(field) {
    this.menuState.awaitingMenuSelection = false
    this.menuState.awaitingUserData = true
    this.menuState.currentDataField = field
  }

  addUserData(field, value) {
    this.menuState.userData[field] = value
  }

  resetMenuState() {
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
    this.menuState.userData = {}
  }
}
