// Implementación de un mecanismo de fallback para operaciones de base de datos
// Esta función permite que el bot siga funcionando incluso si la base de datos falla
export async function withDatabaseFallback(operation, fallbackValue = null) {
    try {
      return await operation()
    } catch (error) {
      console.error("Error en operación de base de datos, usando fallback:", error.message)
      return fallbackValue
    }
  }
  
  