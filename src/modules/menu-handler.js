import { MENU_OPTIONS } from "../config/constants.js"
import { sendMessage } from "../index.js"
import { createHumanSupportReport, checkOrderStatusFromAPI } from "./user-service.js"

export async function handleMainMenu(sock, chatId, option, session) {
  console.log(`[MENU] User selected main menu option: ${option}`)
  switch (option) {
    case "1": // Olvidé Usuario o Contraseña
      console.log(`[MENU] User ${chatId} requesting password reset`)
      await sendMessage(
        sock,
        chatId,
        "🔐 *¿Necesitas cambiar tu contraseña?* Sigue estos pasos:\n\n1️⃣ Ingresa al portal: https://tienda.lealia.com.mx/iniciar-sesion\n\n2️⃣ Da clic en *\"¿Olvidaste tu contraseña?\"*\n\n3️⃣ Ingresa tu número de teléfono. Te enviaremos un *código de recuperación* a tu WhatsApp 📲\n\n4️⃣ Ingresa el código recibido y escribe tu *nueva contraseña* 🔑\n\n5️⃣ ¡Listo! Ya puedes iniciar sesión en tu portal, buscar tus productos y realizar tus compras 🛒✨",
      )
      await showClosingMenu(sock, chatId, session)
      break
    case "2": // Problemas con mi pedido
      console.log(`[MENU] Starting order problems flow for user ${chatId}`)
      await sendMessage(
        sock,
        chatId,
        "¿Qué problema tienes con tu pedido?\n\n" + MENU_OPTIONS.ORDER_PROBLEMS.join("\n"),
      )
      session.setMenuState("ORDER_PROBLEMS")
      break
    case "3": // Realizar un pedido especial (NUEVO)
      console.log(`[MENU] User ${chatId} requesting special order`)
      await sendMessage(
        sock,
        chatId,
        "🛒✨ *¡Excelente!* Puedes realizar tu *pedido especial* directamente en nuestro portal especializado:\n\n🔗 https://tienda.lealia.com.mx/pedidos-especiales\n\n🛍️ *Tiendas disponibles para pedidos especiales:*\nLiverpool, Sam's Club, Walmart, Costco o tiendas de marcas reconocidas.\n\n📌 *Importante:*\nIngresa *todos tus datos completos* para realizar tu compra correctamente.\nColoca el *código postal de entrega (Sucursal Nostos)* al buscar disponibilidad del producto.\n\n⚠️ *Nota:*\nLos pedidos de supermercado *no se realizan* en esta sección.\nPara eso, puedes adquirir una *Gift Card* de:\n• Walmart Cashi\n• Soriana\n• Chedraui\nDesde el apartado de *Gift Cards*.\n\n💡 Si necesitas ayuda navegando el portal o tienes dudas sobre algún producto especial, ¡no dudes en contactarnos!",
      )
      await showClosingMenu(sock, chatId, session)
      break
    case "4": // Duda de mi carga de puntos (antes era 3)
      console.log(`[MENU] Starting points questions flow for user ${chatId}`)
      await sendMessage(
        sock,
        chatId,
        "¿Qué duda tienes sobre tu carga de puntos?\n\n" + MENU_OPTIONS.COIN_ISSUES.join("\n"),
      )
      session.setMenuState("COIN_ISSUES")
      break
    case "5": // Problemas con mi portal (antes era 4)
      console.log(`[MENU] Starting portal problems flow for user ${chatId}`)
      await sendMessage(
        sock,
        chatId,
        "¿Qué problema tienes con el portal?\n\n" + MENU_OPTIONS.PORTAL_PROBLEMS.join("\n"),
      )
      session.setMenuState("PORTAL_PROBLEMS")
      break
    case "6": // Dirección de entrega (antes era 5)
      console.log(`[MENU] Starting delivery address flow for user ${chatId}`)
      await sendMessage(
        sock,
        chatId,
        "📍 Todos los productos se envían a tu sucursal. En caso de que la sucursal haya cambiado de domicilio debes mandar un correo a *mescobar@centiva.mx con copia a acoronel@centiva.mx y amarrieta@centiva.mx* indicando tu RFC, SUCURSAL y dirección completa de la nueva sucursal, de igual manera indicando brevemente el motivo por el cual solicitas que se envíe ahí.",
      )
      await showClosingMenu(sock, chatId, session)
      break
    case "7": // Consultar Saldo (antes era 6)
      console.log(`[MENU] Starting balance check flow for user ${chatId}`)
      await sendMessage(sock, chatId, "Con gusto te apoyamos. ¿Me confirmas RFC a 10 dígitos? Por favor.")
      session.clearUserData()
      session.setUserDataCollection("rfc")
      session.menuState.currentStep = "CHECK_BALANCE_RFC"
      break
    case "8": // Terminar sesión (antes era 7)
      console.log(`[MENU] User ${chatId} ending session`)
      await endSession(sock, chatId, session)
      break
    case "hola": // Volver al menú principal
      console.log(`[MENU] User ${chatId} returning to main menu`)
      await showMainMenu(sock, chatId, session)
      break
    case "Hola": // Volver al menú principal
      console.log(`[MENU] User ${chatId} returning to main menu`)
      await showMainMenu(sock, chatId, session)
      break
    default:
      console.log(`[MENU] User ${chatId} selected invalid option: ${option}`)
      await sendMessage(
        sock,
        chatId,
        "Opción no válida. Por favor, selecciona una opción del menú:\n\n" + MENU_OPTIONS.MAIN_MENU.join("\n"),
      )
      break
  }
}

export async function endSession(sock, chatId, session) {
  console.log(`[SESSION] Ending session for user ${chatId}`)
  await sendMessage(sock, chatId, "👋 Gracias por contactar a Lealia. ¡Hasta luego!")
  session.clearUserData()
  session.resetMenuState()
}

export async function handleOrderProblems(sock, chatId, option, session) {
  console.log(`[ORDER] User selected order problem option: ${option}`)
  switch (option) {
    case "1": // Llegó dañado
      console.log(`[ORDER] User ${chatId} reporting damaged product`)
      await sendMessage(
        sock,
        chatId,
        'Buen día, con gusto te apoyamos. En este caso es necesario que envíes un correo electrónico a la dirección amarrieta@centiva.mx con copia a khuitron@centiva.mx los siguientes datos: "Asunto: Garantía" Breve explicación del motivo de la Garantía. Nombre completo: Número celular: Sucursal: Número de pedido: Explicación de la solicitud de garantía: Número de serie: IMEI (En caso de ser un celular): Evidencias 4 fotografías (Frente, Atrás y ambos laterales), y Video.',
      )
      await showClosingMenu(sock, chatId, session)
      break
    case "2": // Tiempo de entrega
      console.log(`[ORDER] User ${chatId} checking delivery time`)
      await sendMessage(sock, chatId, "Por favor, proporciona tu RFC:")
      session.clearUserData()
      session.setUserDataCollection("rfc")
      session.menuState.currentStep = "ORDER_DELIVERY_RFC"
      break
    case "3": // Problema de funcionamiento
      console.log(`[ORDER] User ${chatId} reporting functionality problem`)
      await sendMessage(
        sock,
        chatId,
        'Buen día, con gusto te apoyamos. En este caso es necesario que envíes un correo electrónico a la dirección amarrieta@centiva.mx con copia a khuitron@centiva.mx los siguientes datos: "Asunto: Garantía" Breve explicación del motivo de la Garantía. Nombre completo: Número celular: Número de pedido: Explicación de la solicitud de garantía: Número de serie: IMEI (En caso de ser un celular): Evidencias 4 fotografías (Frente, Atrás y ambos laterales), y Video.',
      )
      await showClosingMenu(sock, chatId, session)
      break
    case "4": // Cancelación o reembolso
      console.log(`[ORDER] User ${chatId} requesting cancellation/refund`)
      await sendMessage(
        sock,
        chatId,
        'Buen día, con gusto te apoyamos. En este caso es necesario que envíes un correo electrónico a la dirección amarrieta@centiva.mx con los siguientes datos: "Asunto: Cancelación", RFC, Nombre completo, Orden de Compra, Sucursal y Breve explicación del motivo de la cancelación. Por favor.',
      )
      await showClosingMenu(sock, chatId, session)
      break
    case "5": // Volver al menú principal
      console.log(`[ORDER] User ${chatId} returning to main menu`)
      await showMainMenu(sock, chatId, session)
      break
    default:
      console.log(`[ORDER] User ${chatId} selected invalid option: ${option}`)
      await sendMessage(
        sock,
        chatId,
        "Opción no válida. Por favor, selecciona una opción del menú:\n\n" + MENU_OPTIONS.ORDER_PROBLEMS.join("\n"),
      )
      break
  }
}

export async function handleCoinIssues(sock, chatId, option, session) {
  console.log(`[COINS] User selected coin issue option: ${option}`)
  switch (option) {
    case "1": // Las monedas que tengo no coinciden
      console.log(`[COINS] User ${chatId} reporting coin discrepancy`)
      await sendMessage(
        sock,
        chatId,
        "En seguida te compartimos las reglas. En caso de que continúes con dudas sobre tu carga, debes enviar un correo a *mescobar@centiva.mx* solicitando la aclaración de tus monedas. Por favor.\n\n¿Hay algo más en lo que te podamos ayudar?\n\n" +
          MENU_OPTIONS.CLOSING_MENU.join("\n"),
      )
      session.setMenuState("CLOSING_MENU")
      break
    case "2": // No tengo monedas correspondientes al mes
      console.log(`[COINS] User ${chatId} reporting missing monthly coins`)
      await sendMessage(
        sock,
        chatId,
        "Buen día, de momento nos encontramos en espera de que corporativo nos indique la dispersión mensual para la carga de monedas. En cuanto sean cargadas a tu portal con gusto te notificamos por este medio. Por favor.",
      )
      await showClosingMenu(sock, chatId, session)
      break
    case "3": // Volver al menú principal
      console.log(`[COINS] User ${chatId} returning to main menu`)
      await showMainMenu(sock, chatId, session)
      break
    default:
      console.log(`[COINS] User ${chatId} selected invalid option: ${option}`)
      await sendMessage(
        sock,
        chatId,
        "Opción no válida. Por favor, selecciona una opción del menú:\n\n" + MENU_OPTIONS.COIN_ISSUES.join("\n"),
      )
      break
  }
}

export async function handlePortalProblems(sock, chatId, option, session) {
  console.log(`[PORTAL] User selected portal problem option: ${option}`)
  switch (option) {
    case "1": // No puedo accesar con mis credenciales
      console.log(`[PORTAL] User ${chatId} reporting access problems`)
      console.log(`[MENU] User ${chatId} requesting password reset`)
      await sendMessage(
        sock,
        chatId,
        "🔐 *¿Necesitas cambiar tu contraseña?* Sigue estos pasos:\n\n1️⃣ Ingresa al portal: https://tienda.lealia.com.mx/iniciar-sesion\n\n2️⃣ Da clic en *\"¿Olvidaste tu contraseña?\"*\n\n3️⃣ Ingresa tu número de teléfono. Te enviaremos un *código de recuperación* a tu WhatsApp 📲\n\n4️⃣ Ingresa el código recibido y escribe tu *nueva contraseña* 🔑\n\n5️⃣ ¡Listo! Ya puedes iniciar sesión en tu portal, buscar tus productos y realizar tus compras 🛒✨",
      )
      await showClosingMenu(sock, chatId, session)
      break
    case "2": // No puedo realizar pedido
      console.log(`[PORTAL] User ${chatId} reporting order creation problems`)
      await sendMessage(sock, chatId, "Con gusto te apoyamos. ¿Me confirmas RFC? Por favor.")
      session.clearUserData()
      session.setUserDataCollection("rfc")
      session.menuState.currentStep = "PORTAL_ORDER_RFC"
      break
    case "3": // No tengo puntos cargados
      console.log(`[PORTAL] User ${chatId} reporting missing points`)
      await sendMessage(sock, chatId, "Con gusto te apoyamos. ¿Me confirmas RFC? por favor.")
      session.clearUserData()
      session.setUserDataCollection("rfc")
      session.menuState.currentStep = "PORTAL_POINTS_RFC"
      break
    case "4": // Volver al menú principal
      console.log(`[PORTAL] User ${chatId} returning to main menu`)
      await showMainMenu(sock, chatId, session)
      break
    default:
      console.log(`[PORTAL] User ${chatId} selected invalid option: ${option}`)
      await sendMessage(
        sock,
        chatId,
        "Opción no válida. Por favor, selecciona una opción del menú:\n\n" + MENU_OPTIONS.PORTAL_PROBLEMS.join("\n"),
      )
      break
  }
}

export async function handleClosingMenu(sock, chatId, option, session) {
  console.log(`[CLOSING] User selected closing menu option: ${option}`)
  switch (option) {
    case "1": // Sí, necesito más ayuda
      console.log(`[CLOSING] User ${chatId} requesting human support`)
      await initiateHumanSupport(sock, chatId, session)
      break
    case "2": // No, gracias
      console.log(`[CLOSING] User ${chatId} ending conversation, starting survey`)
      await sendMessage(sock, chatId, "Seguimos a tus órdenes. ¡Excelente día!")
      session.isSurveyActive = true
      session.resetSurvey()
      break
    default:
      console.log(`[CLOSING] User ${chatId} selected invalid option: ${option}`)
      await sendMessage(
        sock,
        chatId,
        "Opción no válida. Por favor, selecciona una opción:\n\n" + MENU_OPTIONS.CLOSING_MENU.join("\n"),
      )
      break
  }
}

export async function handleUserDataCollection(sock, chatId, message, session) {
  const currentField = session.menuState.currentDataField
  const currentStep = session.menuState.currentStep

  console.log(`[DATA] Collecting ${currentField} for user ${chatId} in step ${currentStep}`)
  console.log(`[DATA] User provided value: ${message}`)

  session.addUserData(currentField, message)
  console.log(`[DATA] Updated user data:`, session.menuState.userData)

  switch (currentStep) {
    case "USER_PASSWORD_RFC":
      await handleUserPasswordFlow(sock, chatId, session, message)
      break
    case "ORDER_DELIVERY_RFC":
      await handleOrderDeliveryFlow(sock, chatId, session, message)
      break
    case "PORTAL_ACCESS_RFC":
      await handlePortalAccessFlow(sock, chatId, session, message)
      break
    case "PORTAL_ORDER_RFC":
      await handlePortalOrderFlow(sock, chatId, session, message)
      break
    case "PORTAL_POINTS_RFC":
      await handlePortalPointsFlow(sock, chatId, session, message)
      break
    case "CHECK_BALANCE_RFC":
      await handleCheckBalanceFlow(sock, chatId, session, message)
      break
    default:
      console.log(`[DATA] Unknown step ${currentStep}, returning to main menu`)
      await showMainMenu(sock, chatId, session)
      break
  }
}

async function handleUserPasswordFlow(sock, chatId, session, message) {
  console.log(`[PASSWORD] Processing password flow step: ${session.menuState.currentDataField}`)

  if (session.menuState.currentDataField === "rfc") {
    console.log(`[PASSWORD] RFC collected: ${message}, requesting name`)
    await sendMessage(sock, chatId, "Por favor, proporciona tu nombre completo (sin acentos):")
    session.setUserDataCollection("nombre")
    return
  }

  if (session.menuState.currentDataField === "nombre") {
    console.log(`[PASSWORD] Name collected: ${message}, requesting email`)
    await sendMessage(sock, chatId, "Por favor, proporciona tu email registrado:")
    session.setUserDataCollection("email")
    return
  }

  if (session.menuState.currentDataField === "email") {
    console.log(`[PASSWORD] Email collected: ${message}, asking about password change`)
    await sendMessage(sock, chatId, "¿Deseas cambiar tu contraseña?\n\n1. Sí\n2. No")
    session.setUserDataCollection("password_change")
    return
  }

  if (session.menuState.currentDataField === "password_change") {
    console.log(`[PASSWORD] Password change response: ${message}`)
    if (message === "1" || message.toLowerCase().includes("sí") || message.toLowerCase().includes("si")) {
      console.log(`[PASSWORD] User wants to change password, requesting new password`)
      await sendMessage(sock, chatId, "Por favor, proporciona tu nueva contraseña:")
      session.setUserDataCollection("new_password")
      return
    } else if (message === "2" || message.toLowerCase().includes("no")) {
      console.log(`[PASSWORD] User doesn't want to change password, transferring to human agent`)
      await initiateHumanSupport(sock, chatId, session)
      return
    } else {
      console.log(`[PASSWORD] Invalid response for password change: ${message}`)
      await sendMessage(sock, chatId, "Por favor, responde con:\n1. Sí\n2. No")
      return
    }
  }

  if (session.menuState.currentDataField === "new_password") {
    console.log(`[PASSWORD] New password provided, processing password change`)
    await processPasswordChange(sock, chatId, session)
  }
}

async function handleOrderDeliveryFlow(sock, chatId, session, message) {
  console.log(`[ORDER_DELIVERY] Processing order delivery flow step: ${session.menuState.currentDataField}`)

  if (session.menuState.currentDataField === "rfc") {
    console.log(`[ORDER_DELIVERY] RFC collected: ${message}, requesting order number`)
    await sendMessage(sock, chatId, "Por favor, proporciona el número de orden de compra (OC):")
    session.setUserDataCollection("oc")
    return
  }

  if (session.menuState.currentDataField === "oc") {
    console.log(`[ORDER_DELIVERY] Order number collected: ${message}, checking order status via API`)
    const orderNumber = message.trim()

    console.log(`[ORDER_DELIVERY] Calling API for order number: ${orderNumber}`)
    const orderStatus = await checkOrderStatusFromAPI(orderNumber)
    console.log(`[ORDER_DELIVERY] API response:`, orderStatus)

    if (orderStatus && orderStatus.found) {
      console.log(`[ORDER_DELIVERY] Order found, providing tracking information`)

      // Format the response based on order status
      let responseMessage = `Buen día, aquí tienes la información de tu pedido *${orderStatus.orderNumber}*:\n\n`
      responseMessage += `📦 *Producto:* ${orderStatus.product}\n`
      responseMessage += `👤 *Cliente:* ${orderStatus.customerName}\n`
      responseMessage += `📅 *Fecha del pedido:* ${orderStatus.orderDate}\n`
      responseMessage += `💰 *Total:* $${orderStatus.total}\n`
      responseMessage += `📋 *Estado:* ${orderStatus.status}\n`

      if (orderStatus.trackingNumber) {
        responseMessage += `🚚 *Número de guía:* ${orderStatus.trackingNumber}\n`
      }

      if (orderStatus.trackingUrl) {
        responseMessage += `🔗 *Rastrear pedido:* ${orderStatus.trackingUrl}\n`
      }

      if (orderStatus.estimatedDelivery) {
        responseMessage += `📅 *Fecha estimada de entrega:* ${orderStatus.estimatedDelivery}\n`
      }

      responseMessage += `\n*¿Nos podrías confirmar la recepción de tu pedido en cuanto lo tengas? Por favor.*`

      await sendMessage(sock, chatId, responseMessage)
    } else {
      console.log(`[ORDER_DELIVERY] Order not found, transferring to human agent`)
      await sendMessage(
        sock,
        chatId,
        "🔍 No hemos podido encontrar información sobre tu pedido en Lealia. Te transferiremos con un ejecutivo especializado para que te ayude a localizarlo.",
      )
      await initiateHumanSupport(sock, chatId, session)
      return
    }

    await showClosingMenu(sock, chatId, session)
  }
}

async function handlePortalAccessFlow(sock, chatId, session, message) {
  console.log(`[PORTAL_ACCESS] Processing portal access flow step: ${session.menuState.currentDataField}`)

  if (session.menuState.currentDataField === "rfc") {
    console.log(`[PORTAL_ACCESS] RFC collected: ${message}, requesting name`)
    await sendMessage(sock, chatId, "Por favor, proporciona tu nombre completo (sin acentos):")
    session.setUserDataCollection("nombre")
    return
  }

  if (session.menuState.currentDataField === "nombre") {
    console.log(`[PORTAL_ACCESS] Name collected: ${message}, requesting email`)
    await sendMessage(sock, chatId, "Por favor, proporciona tu email registrado:")
    session.setUserDataCollection("email")
    return
  }

  if (session.menuState.currentDataField === "email") {
    console.log(`[PORTAL_ACCESS] Email collected: ${message}, asking about password change`)
    await sendMessage(sock, chatId, "¿Deseas cambiar tu contraseña?\n\n1. Sí\n2. No")
    session.setUserDataCollection("password_change")
    return
  }

  if (session.menuState.currentDataField === "password_change") {
    console.log(`[PORTAL_ACCESS] Password change response: ${message}`)
    if (message === "1" || message.toLowerCase().includes("sí") || message.toLowerCase().includes("si")) {
      console.log(`[PORTAL_ACCESS] User wants to change password, requesting new password`)
      await sendMessage(sock, chatId, "Por favor, proporciona tu nueva contraseña:")
      session.setUserDataCollection("new_password")
      return
    } else if (message === "2" || message.toLowerCase().includes("no")) {
      console.log(`[PORTAL_ACCESS] User doesn't want to change password, transferring to human agent`)
      await initiateHumanSupport(sock, chatId, session)
      return
    } else {
      console.log(`[PORTAL_ACCESS] Invalid response for password change: ${message}`)
      await sendMessage(sock, chatId, "Por favor, responde con:\n1. Sí\n2. No")
      return
    }
  }

  if (session.menuState.currentDataField === "new_password") {
    console.log(`[PORTAL_ACCESS] New password provided, processing password change`)
    await processPasswordChange(sock, chatId, session)
  }
}

async function handlePortalOrderFlow(sock, chatId, session, message) {
  console.log(`[PORTAL_ORDER] Processing portal order flow step: ${session.menuState.currentDataField}`)

  if (session.menuState.currentDataField === "rfc") {
    console.log(`[PORTAL_ORDER] RFC collected: ${message}, requesting name`)
    await sendMessage(sock, chatId, "Por favor, proporciona tu nombre completo:")
    session.setUserDataCollection("nombre")
    return
  }

  if (session.menuState.currentDataField === "nombre") {
    console.log(`[PORTAL_ORDER] Name collected: ${message}, requesting branch`)
    await sendMessage(sock, chatId, "Por favor, proporciona tu sucursal:")
    session.setUserDataCollection("sucursal")
    return
  }

  if (session.menuState.currentDataField === "sucursal") {
    console.log(`[PORTAL_ORDER] Branch collected: ${message}, requesting email`)
    await sendMessage(sock, chatId, "Por favor, proporciona tu email:")
    session.setUserDataCollection("email")
    return
  }

  if (session.menuState.currentDataField === "email") {
    console.log(`[PORTAL_ORDER] Email collected: ${message}, requesting screenshot`)
    await sendMessage(sock, chatId, "Por favor, envía una captura de pantalla del problema que estás experimentando:")
    session.setUserDataCollection("captura")
    return
  }

  if (session.menuState.currentDataField === "captura") {
    console.log(`[PORTAL_ORDER] Screenshot received, transferring to human agent`)
    await sendMessage(
      sock,
      chatId,
      "Gracias por proporcionar la información. Te pasaremos con un agente para resolver tu problema.",
    )
    await initiateHumanSupport(sock, chatId, session)
  }
}

async function handlePortalPointsFlow(sock, chatId, session, message) {
  console.log(`[PORTAL_POINTS] Processing portal points flow step: ${session.menuState.currentDataField}`)

  if (session.menuState.currentDataField === "rfc") {
    console.log(`[PORTAL_POINTS] RFC collected: ${message}, requesting name`)
    await sendMessage(sock, chatId, "Por favor, proporciona tu nombre completo:")
    session.setUserDataCollection("nombre")
    return
  }

  if (session.menuState.currentDataField === "nombre") {
    console.log(`[PORTAL_POINTS] Name collected: ${message}, requesting branch`)
    await sendMessage(sock, chatId, "Por favor, proporciona tu sucursal:")
    session.setUserDataCollection("sucursal")
    return
  }

  if (session.menuState.currentDataField === "sucursal") {
    console.log(`[PORTAL_POINTS] Branch collected: ${message}, requesting email`)
    await sendMessage(sock, chatId, "Por favor, proporciona tu email:")
    session.setUserDataCollection("email")
    return
  }

  if (session.menuState.currentDataField === "email") {
    console.log(`[PORTAL_POINTS] Email collected: ${message}, transferring to human agent`)
    await sendMessage(
      sock,
      chatId,
      "Gracias por proporcionar la información. Te pasaremos con un agente para resolver tu problema con los puntos cargados.",
    )
    await initiateHumanSupport(sock, chatId, session)
  }
}

async function handleCheckBalanceFlow(sock, chatId, session, message) {
  console.log(`[BALANCE] Processing balance check flow step: ${session.menuState.currentDataField}`)

  if (session.menuState.currentDataField === "rfc") {
    console.log(`[BALANCE] RFC collected: ${message}, requesting name`)
    await sendMessage(sock, chatId, "Por favor, proporciona tu nombre completo (sin acentos):")
    session.setUserDataCollection("nombre")
    return
  }

  if (session.menuState.currentDataField === "nombre") {
    console.log(`[BALANCE] Name collected: ${message}, requesting email`)
    await sendMessage(sock, chatId, "Por favor, proporciona tu email registrado:")
    session.setUserDataCollection("email")
    return
  }

  if (session.menuState.currentDataField === "email") {
    console.log(`[BALANCE] Email collected: ${message}, processing balance check`)
    await processBalanceCheck(sock, chatId, session)
  }
}

async function processPasswordChange(sock, chatId, session) {
  try {
    const userData = session.menuState.userData
    console.log(`[API] Validating user credentials for password change:`, {
      rfc: userData.rfc,
      name: userData.nombre,
      email: userData.email,
    })

    const validation = await validateUserCredentials(userData.rfc, userData.nombre, userData.email)
    console.log(`[API] User validation result:`, validation)

    if (validation && validation.acceso === "correcto") {
      console.log(`[API] User validated successfully, updating password for userIdApi: ${validation.userIdApi}`)
      const updateResult = await updateUserPassword(validation.userIdApi, userData.new_password)
      console.log(`[API] Password update result:`, updateResult)

      if (updateResult) {
        console.log(`[PASSWORD] Password updated successfully`)
        await sendMessage(
          sock,
          chatId,
          "✅ ¡Tu contraseña de Lealia ha sido actualizada exitosamente!\n\nYa puedes acceder al portal con tu nueva contraseña. Si tienes algún problema, no dudes en contactarnos.",
        )
        await showClosingMenu(sock, chatId, session)
      } else {
        console.log(`[PASSWORD] Password update failed`)
        await sendMessage(
          sock,
          chatId,
          "⚠️ Hubo un error al actualizar tu contraseña en Lealia. Te transferiremos con un agente especializado para ayudarte a resolver este problema.",
        )
        await initiateHumanSupport(sock, chatId, session)
      }
    } else {
      console.log(`[PASSWORD] User validation failed`)
      await sendMessage(
        sock,
        chatId,
        "⚠️ No pudimos validar tus datos en el sistema de Lealia. Te transferiremos con un agente especializado para verificar tu información y ayudarte.",
      )
      await initiateHumanSupport(sock, chatId, session)
    }
  } catch (error) {
    console.error(`[PASSWORD] Error processing password change:`, error)
    await sendMessage(
      sock,
      chatId,
      "⚠️ Ocurrió un error técnico en el sistema de Lealia. Te transferiremos con un agente especializado para ayudarte.",
    )
    await initiateHumanSupport(sock, chatId, session)
  }
}

async function processBalanceCheck(sock, chatId, session) {
  try {
    const userData = session.menuState.userData
    console.log(`[API] Validating user credentials for balance check:`, {
      rfc: userData.rfc,
      name: userData.nombre,
      email: userData.email,
    })

    const validation = await validateUserCredentials(userData.rfc, userData.nombre, userData.email)
    console.log(`[API] User validation result:`, validation)

    if (validation && validation.acceso === "correcto") {
      console.log(`[API] User validated successfully, checking balance for userIdApi: ${validation.userIdApi}`)
      const balanceData = await getUserBalance(validation.userIdApi, validation.tokenApi)
      console.log(`[API] Balance check result:`, balanceData)

      if (balanceData && (balanceData.success === 1 || balanceData.success === true)) {
        const balance = balanceData.balance || 0
        console.log(`[BALANCE] Balance retrieved successfully: ${balance}`)
        await sendMessage(
          sock,
          chatId,
          `💰 Tu saldo actual en Lealia es: $${balance.toLocaleString()} puntos\n\n¿Deseas realizar alguna otra consulta?`,
        )
        await showClosingMenu(sock, chatId, session)
      } else {
        console.log(`[BALANCE] Balance check failed`)
        await sendMessage(
          sock,
          chatId,
          "⚠️ No pudimos consultar tu saldo en Lealia en este momento. Te transferiremos con un agente especializado para ayudarte.",
        )
        await initiateHumanSupport(sock, chatId, session)
      }
    } else {
      console.log(`[BALANCE] User validation failed`)
      await sendMessage(
        sock,
        chatId,
        "⚠️ No pudimos validar tus datos en el sistema de Lealia. Te transferiremos con un agente especializado para verificar tu información y ayudarte.",
      )
      await initiateHumanSupport(sock, chatId, session)
    }
  } catch (error) {
    console.error(`[BALANCE] Error checking balance:`, error)
    await sendMessage(
      sock,
      chatId,
      "⚠️ Ocurrió un error técnico en el sistema de Lealia. Te transferiremos con un agente especializado para ayudarte.",
    )
    await initiateHumanSupport(sock, chatId, session)
  }
}

async function validateUserCredentials(rfc, fullName, email) {
  try {
    console.log(`[API] Calling user validation API with:`, { rfc, fullName, email })
    const url = new URL("https://www.giftcards.lealia.com.mx/api/get_confirm_user.php")
    url.searchParams.append("rfc", rfc)
    url.searchParams.append("full_name", fullName)
    url.searchParams.append("email", email)

    console.log(`[API] User validation API URL: ${url.toString()}`)
    const response = await fetch(url)
    const data = await response.json()
    console.log(`[API] User validation API response:`, data)
    return data
  } catch (error) {
    console.error(`[API] Error validating user credentials:`, error)
    return null
  }
}

async function updateUserPassword(userIdApi, newPassword) {
  try {
    console.log(`[API] Calling password update API for userIdApi: ${userIdApi}`)
    const response = await fetch("https://tienda.lealia.com.mx/wp-json/custom/v1/update-password/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userIdApi,
        new_password: newPassword,
      }),
    })

    const result = await response.text()
    console.log(`[API] Password update API response:`, result)
    return result
  } catch (error) {
    console.error(`[API] Error updating password:`, error)
    return null
  }
}

async function getUserBalance(userIdApi, tokenApi) {
  try {
    console.log(`[API] Calling balance check API for userIdApi: ${userIdApi}`)
    const url = new URL("https://tienda.lealia.com.mx/wp-json/miapi/v1/saldo-wallet")
    url.searchParams.append("userIdApi", userIdApi)
    url.searchParams.append("tokenApi", 12345)

    console.log(`[API] Balance check API URL: ${url.toString()}`)
    const response = await fetch(url)
    const data = await response.json()
    console.log(`[API] Balance check API response:`, data)
    return data
  } catch (error) {
    console.error(`[API] Error getting user balance:`, error)
    return null
  }
}

// Función simplificada - ya no necesita parámetros adicionales
export async function showMainMenu(sock, chatId, session) {
  console.log(`[MENU] Showing main menu to user ${chatId}`)
  await sendMessage(
    sock,
    chatId,
    "👋 ¡Bienvenido a Lealia! ¿En qué podemos ayudarte hoy?\n\n" +
      "1️⃣ Olvidé Usuario o Contraseña\n" +
      "2️⃣ Problemas con mi pedido\n" +
      "3️⃣ Realizar un pedido especial\n" +
      "4️⃣ Duda de mi carga de puntos\n" +
      "5️⃣ Problemas con mi portal\n" +
      "6️⃣ Dirección de entrega\n" +
      "7️⃣ Consultar Saldo\n" +
      "8️⃣ Terminar sesión\n\n" +
      "Por favor, selecciona una opción del menú:",
  )
  session.setMenuState("MAIN_MENU")
  session.resetMenuState()

  // Configurar temporizador de inactividad para el menú principal
  console.log(`[MENU] 🔧 Setting up inactivity timer for main menu`)

  const warningCallback = async () => {
    console.log(`[MENU_INACTIVITY] ⚠️ User ${chatId} inactive in main menu`)
    const abandonMsg =
      "Creo que has abandonado el chat ☹️, esta conversación se cerrará por inactividad.\n\nSi deseas continuar con el seguimiento vuelve a contactar por favor."

    await sendMessage(sock, chatId, abandonMsg)
    console.log(`[MENU_INACTIVITY] ✅ Abandon message sent and automatically logged`)

    session.markAsAbandoned()
  }

  const endCallback = async () => {
    console.log(`[MENU_INACTIVITY] 🔚 Ending session for inactive user ${chatId}`)
    // No enviar mensaje adicional, ya se envió el de abandono
  }

  session.startInactivityTimer(warningCallback, endCallback)
  console.log(`[MENU] ✅ Inactivity timer configured for main menu`)
}

export async function initiateHumanSupport(sock, chatId, session) {
  console.log(`[HUMAN] Initiating human support for user ${chatId}`)
  const reportData = {
    name: session.menuState.userData.nombre || "No proporcionado",
    company: "Lealia",
    phone: session.menuState.userData.telefono || "No proporcionado",
    email: session.menuState.userData.email || "No proporcionado",
    problem: `Solicitud de atención humana desde el menú: ${session.currentMenu}`,
    contact_phone: chatId.split("@")[0],
    classification: "Soporte",
    priority: "Media",
  }

  console.log(`[HUMAN] Creating human support report with data:`, reportData)

  try {
    const reportId = await createHumanSupportReport(reportData)
    console.log(`[HUMAN] Human support report created with ID: ${reportId}`)

    await sendMessage(
      sock,
      chatId,
      "👨‍💼 Hemos transferido tu consulta a un ejecutivo de Lealia. Por favor, espera un momento mientras te atendemos personalmente. ¡Gracias por tu paciencia!",
    )

    session.isWaitingForHumanResponse = true
    session.pauseInactivityTimer()
    console.log(`[HUMAN] User ${chatId} transferred to human agent, inactivity timer paused`)
  } catch (error) {
    console.error(`[HUMAN] Error creating human support report:`, error)
    await sendMessage(
      sock,
      chatId,
      "⚠️ Lo sentimos, ha ocurrido un error al procesar tu solicitud en Lealia. Por favor, intenta de nuevo más tarde o contáctanos directamente al correo soporte@lealia.com.mx",
    )
    await showMainMenu(sock, chatId, session)
  }
}

export async function showClosingMenu(sock, chatId, session) {
  console.log(`[CLOSING] Showing closing menu to user ${chatId}`)
  await sendMessage(
    sock,
    chatId,
    "✨ ¿Hay algo más en lo que te podamos ayudar?\n\n" + "1️⃣ Sí, necesito más ayuda\n" + "2️⃣ No, gracias",
  )
  session.setMenuState("CLOSING_MENU")
}

export async function handleMenuInput(sock, chatId, message, session) {
  console.log(`[INPUT] Processing menu input from user ${chatId}: ${message}`)
  session.updateLastActivity()

  if (session.menuState.awaitingUserData) {
    console.log(`[INPUT] User ${chatId} is providing data: ${message}`)
    await handleUserDataCollection(sock, chatId, message, session)
    return true
  }

  if (session.menuState.awaitingMenuSelection) {
    console.log(`[INPUT] User ${chatId} is selecting menu option: ${message} in menu ${session.currentMenu}`)
    switch (session.currentMenu) {
      case "MAIN_MENU":
        await handleMainMenu(sock, chatId, message, session)
        break
      case "ORDER_PROBLEMS":
        await handleOrderProblems(sock, chatId, message, session)
        break
      case "COIN_ISSUES":
        await handleCoinIssues(sock, chatId, message, session)
        break
      case "PORTAL_PROBLEMS":
        await handlePortalProblems(sock, chatId, message, session)
        break
      case "CLOSING_MENU":
        await handleClosingMenu(sock, chatId, message, session)
        break
      default:
        console.log(`[INPUT] Unknown menu ${session.currentMenu}, showing main menu`)
        await showMainMenu(sock, chatId, session)
    }
    return true
  }

  console.log(`[INPUT] No menu or data collection active, returning false`)
  return false
}
