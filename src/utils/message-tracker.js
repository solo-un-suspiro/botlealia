/**
 * Utilidad para rastrear mensajes enviados por el bot y verificar su origen
 */
class MessageTracker {
  constructor() {
    // Almacena los IDs de mensajes enviados por el bot
    this.sentMessageIds = new Set()

    // Almacena los IDs de mensajes enviados por humanos
    this.humanMessageIds = new Set()

    // Límite para evitar crecimiento excesivo
    this.maxTrackedMessages = 1000

    // Para depuración
    this.stats = {
      botMessages: 0,
      humanMessages: 0,
      unidentifiedMessages: 0,
    }
  }

  /**
   * Registra un mensaje enviado por el bot
   * @param {string} messageId - ID único del mensaje
   */
  trackBotMessage(messageId) {
    if (!messageId) return

    this.sentMessageIds.add(messageId)
    this.stats.botMessages++

    // Limpieza si es necesario
    this._cleanupIfNeeded()

    console.log(`[TRACKER] Bot message tracked: ${messageId}`)
  }

  /**
   * Registra un mensaje enviado por un humano
   * @param {string} messageId - ID único del mensaje
   */
  trackHumanMessage(messageId) {
    if (!messageId) return

    this.humanMessageIds.add(messageId)
    this.stats.humanMessages++

    // Limpieza si es necesario
    this._cleanupIfNeeded()

    console.log(`[TRACKER] Human message tracked: ${messageId}`)
  }

  /**
   * Verifica si un mensaje fue enviado por el bot
   * @param {string} messageId - ID del mensaje a verificar
   * @returns {boolean} - true si el mensaje fue enviado por el bot
   */
  isBotMessage(messageId) {
    if (!messageId) {
      this.stats.unidentifiedMessages++
      return false
    }

    return this.sentMessageIds.has(messageId)
  }

  /**
   * Verifica si un mensaje fue enviado por un humano
   * @param {string} messageId - ID del mensaje a verificar
   * @returns {boolean} - true si el mensaje fue enviado por un humano
   */
  isHumanMessage(messageId) {
    if (!messageId) {
      this.stats.unidentifiedMessages++
      return false
    }

    // Si está en la lista de mensajes humanos o no está en la lista de mensajes del bot
    return this.humanMessageIds.has(messageId) || !this.sentMessageIds.has(messageId)
  }

  /**
   * Determina el origen más probable de un mensaje
   * @param {Object} msg - Objeto de mensaje completo
   * @returns {string} - 'bot', 'human' o 'unknown'
   */
  getMessageOrigin(msg) {
    if (!msg || !msg.key) return "unknown"

    const messageId = msg.key.id

    // Si está en nuestro registro de mensajes del bot
    if (this.sentMessageIds.has(messageId)) {
      return "bot"
    }

    // Si está en nuestro registro de mensajes humanos
    if (this.humanMessageIds.has(messageId)) {
      return "human"
    }

    // Si el mensaje tiene la marca fromMe pero no está en nuestro registro
    if (msg.key.fromMe) {
      // Podría ser un mensaje del bot que no rastreamos correctamente
      return "likely-bot"
    }

    // Si no tiene la marca fromMe y no está en nuestro registro
    return "likely-human"
  }

  /**
   * Limpia los registros si superan el límite
   * @private
   */
  _cleanupIfNeeded() {
    if (this.sentMessageIds.size > this.maxTrackedMessages) {
      // Convertir a array, eliminar los primeros elementos (más antiguos)
      const botArray = Array.from(this.sentMessageIds)
      this.sentMessageIds = new Set(botArray.slice(botArray.length / 2))

      console.log(
        `[TRACKER] Cleaned bot message tracker. Before: ${botArray.length}, After: ${this.sentMessageIds.size}`,
      )
    }

    if (this.humanMessageIds.size > this.maxTrackedMessages) {
      // Convertir a array, eliminar los primeros elementos (más antiguos)
      const humanArray = Array.from(this.humanMessageIds)
      this.humanMessageIds = new Set(humanArray.slice(humanArray.length / 2))

      console.log(
        `[TRACKER] Cleaned human message tracker. Before: ${humanArray.length}, After: ${this.humanMessageIds.size}`,
      )
    }
  }

  /**
   * Obtiene estadísticas del rastreador
   * @returns {Object} - Estadísticas
   */
  getStats() {
    return {
      ...this.stats,
      trackedBotMessages: this.sentMessageIds.size,
      trackedHumanMessages: this.humanMessageIds.size,
    }
  }
}

// Exportar una instancia única para toda la aplicación
export const messageTracker = new MessageTracker()
