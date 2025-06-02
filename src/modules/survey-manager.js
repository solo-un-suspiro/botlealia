export class SurveyManager {
    constructor() {
      this.questions = [
        "¿Qué tan satisfecho estás con la atención recibida?",
        "¿Qué tan rápido fue resuelto tu problema?",
        "¿Qué tan claro fue el agente en sus explicaciones?",
        "¿Qué tan fácil fue usar nuestro servicio de atención al cliente?",
        "¿Qué probabilidad hay de que recomiendes nuestro servicio a otros?",
      ]
    }
  
    getQuestion(index) {
      if (index >= 0 && index < this.questions.length) {
        return this.questions[index]
      }
      return "Pregunta no disponible"
    }
  
    isValidResponse(response) {
      const num = Number.parseInt(response)
      return !isNaN(num) && num >= 1 && num <= 9
    }
  
    getTotalQuestions() {
      return this.questions.length
    }
  }
  
  