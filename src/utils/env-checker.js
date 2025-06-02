export function checkEnvVariables() {
  console.log("Verificando variables de entorno...")

  // Check if .env file exists
  try {
    const fs = require("fs")
    const path = require("path")
    const envPath = path.resolve(process.cwd(), ".env")

    if (fs.existsSync(envPath)) {
      console.log(`Archivo .env encontrado en: ${envPath}`)

      // Read .env file to check which variables are defined
      const envContent = fs.readFileSync(envPath, "utf8")
      const envVars = envContent
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"))
        .map((line) => line.split("=")[0].trim())

      console.log(`Variables encontradas en .env: ${envVars.join(", ")}`)
    } else {
      console.log("Archivo .env no encontrado. Verificando variables de entorno del sistema.")
    }
  } catch (error) {
    console.log("Error al verificar el archivo .env:", error.message)
  }

  const requiredVars = ["GEMINI_API_KEY", "USER_DB_HOST", "USER_DB_USER", "USER_DB_PASSWORD", "USER_DB_NAME"]

  console.log("\nVerificando variables de entorno cargadas:")

  // Check each variable and print its value (partially masked for sensitive data)
  for (const varName of [...requiredVars, "DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]) {
    const value = process.env[varName]
    if (value) {
      // Mask sensitive values
      let displayValue = value
      if (varName.includes("KEY") || varName.includes("PASSWORD")) {
        displayValue = value.substring(0, 3) + "..." + value.substring(value.length - 3)
      }
      console.log(`✓ ${varName}: ${displayValue}`)
    } else if (requiredVars.includes(varName)) {
      console.log(`✗ ${varName}: No configurado (requerido)`)
    } else {
      console.log(`- ${varName}: No configurado (opcional)`)
    }
  }

  const missingVars = requiredVars.filter((varName) => !process.env[varName])

  if (missingVars.length > 0) {
    console.error("\nFaltan variables de entorno requeridas:")
    missingVars.forEach((varName) => {
      console.error(`- ${varName}`)
    })
    console.error("\nPor favor, crea un archivo .env con las variables requeridas.")
    process.exit(1)
  }

  console.log("\n✓ Todas las variables de entorno requeridas están configuradas")
}
