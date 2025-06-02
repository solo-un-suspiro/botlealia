import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

// Company information
const companyInfo =
  "Lealia es una plataforma que permite a los empleados canjear puntos por diversos productos y tarjetas de regalo."

export async function getGeminiResponse(prompt, conversationHistory) {
  const context = `Eres un asistente virtual amigable y profesional para Lealia. ${companyInfo} 
    Tu objetivo principal es ayudar a resolver los problemas, dudas o inquietudes del cliente de manera eficiente y empática.
    Enfócate en entender el problema del usuario y ofrecer soluciones concretas cuando sea posible.
    Si no puedes resolver el problema directamente, ofrece crear un reporte para que un agente de soporte lo contacte.
    Usa un tono conversacional y empático. Mantén el contexto de la conversación basándote en el historial proporcionado.
    IMPORTANTE: No inventes información sobre cuentas específicas, transacciones o datos comerciales. Si se te pide información que no tienes, explica que necesitas crear un reporte para que un agente de soporte pueda ayudar.
    Limítate a proporcionar soporte para los casos específicos sin inventar información adicional.`

  const fullPrompt = `${context}\n\nHistorial de la conversación:\n${conversationHistory.join("\n")}\n\nMensaje del usuario: ${prompt}\n\nResponde de manera natural, enfocándote en resolver el problema o duda del usuario.`

  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent",
      {
        contents: [{ parts: [{ text: fullPrompt }] }],
      },
      {
        params: {
          key: process.env.GEMINI_API_KEY,
        },
        headers: {
          "Content-Type": "application/json",
        },
      },
    )

    return response.data.candidates[0].content.parts[0].text
  } catch (error) {
    console.error("Error calling Gemini API:", error.response ? error.response.data : error.message)
    if (error.response && error.response.status === 429) {
      throw new Error("API_QUOTA_EXCEEDED")
    }
    throw error
  }
}

export async function getFallbackResponse(prompt) {
  // Implement a simple keyword-based response system as fallback
  const keywords = {
    hola: "¡Hola! Bienvenido a Lealia. ¿En qué puedo ayudarte hoy?",
    puntos: "En Lealia puedes acumular puntos. ¿Tienes alguna pregunta específica sobre tus puntos?",
    canjear:
      "Puedes canjear tus puntos por diversos productos y tarjetas de regalo en nuestra plataforma. ¿Necesitas ayuda para realizar un canje?",
    problema:
      "Lamento escuchar que tienes un problema. ¿Te gustaría que creara un reporte para que un agente de soporte te contacte?",
    gracias: "De nada. Estoy aquí para ayudarte. ¿Hay algo más en lo que pueda asistirte?",
    adios:
      "Gracias por contactar a Lealia. Si necesitas algo más, no dudes en volver a escribir. ¡Que tengas un excelente día!",
  }

  for (const [key, value] of Object.entries(keywords)) {
    if (prompt.toLowerCase().includes(key)) {
      return value
    }
  }

  return "Lo siento, no puedo proporcionar una respuesta detallada en este momento. ¿Te gustaría que creara un reporte para que un agente de soporte te contacte?"
}

export async function analyzeReportWithGemini(problem) {
  const prompt = `Analiza el siguiente problema reportado por un usuario de Lealia:

Problema: ${problem}

Basándote en esta información, determina:
1. Clasificación: ¿Qué tipo de problema es? (por ejemplo, técnico, facturación, cuenta, etc.)
2. Prioridad: En una escala de Baja, Media, Alta, o Crítica, ¿qué tan grave es este problema?

Proporciona tu análisis en formato JSON con las claves "classification" y "priority".`

  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent",
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      {
        params: {
          key: process.env.GEMINI_API_KEY,
        },
        headers: {
          "Content-Type": "application/json",
        },
      },
    )

    const analysisText = response.data.candidates[0].content.parts[0].text
    try {
      const analysisJson = JSON.parse(analysisText)
      return analysisJson
    } catch (parseError) {
      console.error("Error parsing Gemini response:", parseError)
      return { classification: "Otro", priority: "Media" }
    }
  } catch (error) {
    console.error("Error analyzing report with Gemini:", error)
    return { classification: "Otro", priority: "Media" }
  }
}
