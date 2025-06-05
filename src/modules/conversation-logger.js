import { withDatabaseFallback } from "../utils/database-utils.js"

export class ConversationLogger {
  constructor(sessionManager) {
    this.sessionManager = sessionManager
    this.conversationStats = new Map() // Cache local para estadísticas
  }

  /**
   * Genera un ID único para la conversación
   * @param {string} chatId - ID del chat
   * @returns {string} - ID único de conversación
   */
  generateConversationId(chatId) {
    const timestamp = Date.now()
    const phoneNumber = chatId.split("@")[0]
    return `conv_${phoneNumber}_${timestamp}`
  }

  /**
   * Inicia el seguimiento de una nueva conversación
   * @param {string} chatId - ID del chat
   * @returns {string} - ID de la conversación
   */
  async startConversation(chatId) {
    const conversationId = this.generateConversationId(chatId)

    console.log(`[CONV_LOG] Starting conversation tracking: ${conversationId}`)

    // Inicializar estadísticas locales
    this.conversationStats.set(conversationId, {
      chatId,
      startTime: new Date(),
      totalMessages: 0,
      botMessages: 0,
      userMessages: 0,
      messageOrder: 0,
    })

    try {
      // Crear registro en la base de datos
      await withDatabaseFallback(async () => {
        const query = `
          INSERT INTO conversation_stats 
          (conversation_id, chat_id, start_time, total_messages, bot_messages, user_messages)
          VALUES (?, ?, NOW(), 0, 0, 0)
        `
        await this.sessionManager.executeQuery(query, [conversationId, chatId])
      })

      console.log(`[CONV_LOG] Conversation stats initialized: ${conversationId}`)
    } catch (error) {
      console.error(`[CONV_LOG] Error initializing conversation stats:`, error)
    }

    return conversationId
  }

  /**
   * Registra un mensaje en la conversación
   * @param {string} conversationId - ID de la conversación
   * @param {string} chatId - ID del chat
   * @param {string} messageType - 'bot' o 'user'
   * @param {string} messageContent - Contenido del mensaje
   * @param {string} sessionId - ID de la sesión (opcional)
   */
  async logMessage(conversationId, chatId, messageType, messageContent, sessionId = null) {
    try {
      // Actualizar estadísticas locales
      const stats = this.conversationStats.get(conversationId)
      if (stats) {
        stats.totalMessages++
        stats.messageOrder++
        if (messageType === "bot") {
          stats.botMessages++
        } else {
          stats.userMessages++
        }
      }

      console.log(`[CONV_LOG] Logging ${messageType} message for conversation ${conversationId}`)

      // Guardar en la base de datos
      await withDatabaseFallback(async () => {
        const query = `
          INSERT INTO conversation_logs 
          (conversation_id, chat_id, message_type, message_content, session_id, message_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        const messageOrder = stats ? stats.messageOrder : 0
        await this.sessionManager.executeQuery(query, [
          conversationId,
          chatId,
          messageType,
          messageContent.substring(0, 4000), // Limitar longitud
          sessionId,
          messageOrder,
        ])

        // Actualizar estadísticas en la base de datos
        const updateStatsQuery = `
          UPDATE conversation_stats 
          SET total_messages = ?, bot_messages = ?, user_messages = ?
          WHERE conversation_id = ?
        `
        if (stats) {
          await this.sessionManager.executeQuery(updateStatsQuery, [
            stats.totalMessages,
            stats.botMessages,
            stats.userMessages,
            conversationId,
          ])
        }
      })
    } catch (error) {
      console.error(`[CONV_LOG] Error logging message:`, error)
    }
  }

  /**
   * Finaliza una conversación
   * @param {string} conversationId - ID de la conversación
   * @param {string} endedBy - Quién terminó la conversación ('user', 'inactivity', 'system')
   * @param {boolean} surveyCompleted - Si se completó la encuesta
   * @param {boolean} humanTransfer - Si hubo transferencia a humano
   */
  async endConversation(conversationId, endedBy = "system", surveyCompleted = false, humanTransfer = false) {
    try {
      console.log(`[CONV_LOG] Ending conversation ${conversationId}, ended by: ${endedBy}`)

      const stats = this.conversationStats.get(conversationId)
      let durationSeconds = 0

      if (stats) {
        const endTime = new Date()
        durationSeconds = Math.floor((endTime - stats.startTime) / 1000)
      }

      await withDatabaseFallback(async () => {
        const query = `
          UPDATE conversation_stats 
          SET end_time = NOW(), 
              duration_seconds = ?,
              ended_by = ?,
              survey_completed = ?,
              human_transfer = ?
          WHERE conversation_id = ?
        `
        await this.sessionManager.executeQuery(query, [
          durationSeconds,
          endedBy,
          surveyCompleted,
          humanTransfer,
          conversationId,
        ])
      })

      // Limpiar del cache local
      this.conversationStats.delete(conversationId)

      console.log(`[CONV_LOG] Conversation ${conversationId} ended successfully`)
    } catch (error) {
      console.error(`[CONV_LOG] Error ending conversation:`, error)
    }
  }

  /**
   * Registra un mensaje fuera de horario
   * @param {string} phoneNumber - Número de teléfono
   * @param {string} messageContent - Contenido del mensaje
   */
  async logOutOfHoursMessage(phoneNumber, messageContent) {
    try {
      console.log(`[OUT_OF_HOURS] Logging message from ${phoneNumber}`)

      await withDatabaseFallback(async () => {
        const query = `
          INSERT INTO out_of_hours_messages 
          (phone_number, message_content, received_at)
          VALUES (?, ?, NOW())
        `
        await this.sessionManager.executeQuery(query, [
          phoneNumber,
          messageContent.substring(0, 1000), // Limitar longitud
        ])
      })

      console.log(`[OUT_OF_HOURS] Out of hours message logged for ${phoneNumber}`)
    } catch (error) {
      console.error(`[OUT_OF_HOURS] Error logging out of hours message:`, error)
    }
  }

  /**
   * Obtiene estadísticas de una conversación
   * @param {string} conversationId - ID de la conversación
   * @returns {Object} - Estadísticas de la conversación
   */
  async getConversationStats(conversationId) {
    try {
      const result = await withDatabaseFallback(async () => {
        const query = `
          SELECT * FROM conversation_stats 
          WHERE conversation_id = ?
        `
        return await this.sessionManager.executeQuery(query, [conversationId])
      })

      return result && result.length > 0 ? result[0] : null
    } catch (error) {
      console.error(`[CONV_LOG] Error getting conversation stats:`, error)
      return null
    }
  }
}
