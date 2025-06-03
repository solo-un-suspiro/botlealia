// Utilidad para manejar horarios de atención
export class BusinessHours {
  constructor() {
    this.timezone = "America/Mexico_City"
    this.schedule = {
      // Lunes a Jueves: 08:00 - 17:00
      1: { start: 8, end: 17 }, // Lunes
      2: { start: 8, end: 17 }, // Martes
      3: { start: 8, end: 17 }, // Miércoles
      4: { start: 8, end: 17 }, // Jueves
      // Viernes: 08:00 - 15:00
      5: { start: 8, end: 15 }, // Viernes
      // Fin de semana: cerrado
      6: null, // Sábado
      0: null, // Domingo
    }
  }

  isBusinessHours() {
    try {
      const now = new Date()
      const mexicoTime = new Date(now.toLocaleString("en-US", { timeZone: this.timezone }))

      const dayOfWeek = mexicoTime.getDay() // 0 = Domingo, 1 = Lunes, etc.
      const currentHour = mexicoTime.getHours()
      const currentMinute = mexicoTime.getMinutes()
      const currentTime = currentHour + currentMinute / 60

      console.log(`[BUSINESS_HOURS] Current Mexico time: ${mexicoTime.toLocaleString()}`)
      console.log(`[BUSINESS_HOURS] Day: ${dayOfWeek}, Hour: ${currentHour}:${currentMinute}`)

      const todaySchedule = this.schedule[dayOfWeek]

      if (!todaySchedule) {
        console.log(`[BUSINESS_HOURS] Closed today (weekend)`)
        return false
      }

      const isOpen = currentTime >= todaySchedule.start && currentTime < todaySchedule.end
      console.log(
        `[BUSINESS_HOURS] Schedule: ${todaySchedule.start}:00 - ${todaySchedule.end}:00, Currently open: ${isOpen}`,
      )

      return isOpen
    } catch (error) {
      console.error("[BUSINESS_HOURS] Error checking business hours:", error)
      // En caso de error, asumir que está abierto para no bloquear el servicio
      return true
    }
  }

  getOutOfHoursMessage() {
    return `Gracias por tu mensaje. En este momento no podemos responder, pero lo haremos lo antes posible.🥺🤞🏼

Te recordamos qué nuestro horario 🕐 de atención es de Lunes a Jueves 08:00 a.m a 05:00 p.m y Viernes 08:00 a.m a 03:00 p.m.`
  }

  getNextBusinessDay() {
    const now = new Date()
    const mexicoTime = new Date(now.toLocaleString("en-US", { timeZone: this.timezone }))

    const nextDay = new Date(mexicoTime)
    nextDay.setDate(nextDay.getDate() + 1)

    // Buscar el próximo día hábil
    while (!this.schedule[nextDay.getDay()]) {
      nextDay.setDate(nextDay.getDate() + 1)
    }

    return nextDay
  }
}
