# Bot de WhatsApp para RewardPoint

## Descripción

Este proyecto es un bot de WhatsApp diseñado para RewardPoint, una innovadora plataforma de recompensas que permite a las empresas motivar a sus empleados a través de un sistema de puntos canjeables. El bot proporciona soporte al cliente, maneja consultas, crea informes para seguimiento humano y realiza encuestas de satisfacción.

## Características

- Respuestas automatizadas utilizando la IA Gemini de Google
- Creación de informes para problemas que requieren atención humana
- Encuestas de satisfacción después de interacciones humanas
- Temporizador de inactividad con advertencias y cierre automático de sesión
- Integración con base de datos para almacenar sesiones de chat e informes
- Respuestas de respaldo cuando el servicio de IA no está disponible

## Requisitos previos

- Node.js (v16 o superior)
- MySQL (v5.7 o superior)
- Cuenta de WhatsApp para el bot
- Cuenta de Google Cloud para la API de Gemini AI

## Instalación

1. Clona el repositorio:
   ```
   git clone https://github.com/RobertoPantojaL/centiva_Chatbot_Whatsapp.git
   cd centiva_Chatbot_Whatsapp
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Configura las variables de entorno:
   Crea un archivo `.env` en el directorio raíz y añade las siguientes variables:
   ```
   DB_HOST=tu_host_de_base_de_datos
   DB_USER=tu_usuario_de_base_de_datos
   DB_PASSWORD=tu_contraseña_de_base_de_datos
   DB_NAME=u685273696_rewardpoint
   GEMINI_API_KEY=tu_clave_api_de_gemini
   ```

4. Configura la base de datos (ver sección "Configuración de la base de datos")

## Configuración de la base de datos

1. Accede a tu servidor MySQL.

2. Crea una nueva base de datos llamada `u685273696_rewardpoint`:
   ```sql
   CREATE DATABASE u685273696_rewardpoint;
   USE u685273696_rewardpoint;
   ```

3. Ejecuta el siguiente script SQL para crear las tablas necesarias:

   ```sql
   -- Tabla chat_sessions
   CREATE TABLE `chat_sessions` (
     `id` int(11) NOT NULL AUTO_INCREMENT,
     `chat_id` varchar(255) NOT NULL,
     `start_time` datetime NOT NULL,
     `duration` int(11) NOT NULL,
     `report_id` int(11) DEFAULT NULL,
     `conversation_history` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`conversation_history`)),
     `survey_responses` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`survey_responses`)),
     PRIMARY KEY (`id`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

   -- Tabla reports
   CREATE TABLE `reports` (
     `id` int(11) NOT NULL AUTO_INCREMENT,
     `name` varchar(100) NOT NULL,
     `company` varchar(100) NOT NULL,
     `phone` varchar(20) NOT NULL,
     `contact_phone` varchar(20) DEFAULT NULL,
     `email` varchar(100) NOT NULL,
     `problem` text NOT NULL,
     `classification` varchar(50) NOT NULL,
     `status` enum('Nuevo','En Progreso','Resuelto','Cerrado') NOT NULL DEFAULT 'Nuevo',
     `created_at` timestamp NULL DEFAULT current_timestamp(),
     `assigned_user_id` int(11) DEFAULT NULL,
     `resolution_date` datetime DEFAULT NULL,
     `priority` enum('Baja','Media','Alta','Crítica') NOT NULL DEFAULT 'Media',
     `resolution_notes` text DEFAULT NULL,
     `customer_feedback` text DEFAULT NULL,
     `attachment_url` varchar(255) DEFAULT NULL,
     `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
     PRIMARY KEY (`id`),
     KEY `assigned_user_id` (`assigned_user_id`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

   -- Nota: La tabla 'users' debe existir para la siguiente restricción
   ALTER TABLE `reports`
     ADD CONSTRAINT `reports_ibfk_1` FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
   ```

   Nota: Asegúrate de que la tabla `users` exista antes de ejecutar la última sentencia ALTER TABLE. Si no tienes una tabla de usuarios, puedes omitir esa línea por ahora.

4. Verifica que las tablas se hayan creado correctamente:
   ```sql
   SHOW TABLES;
   ```

   Deberías ver `chat_sessions` y `reports` en la lista de tablas.

## Configuración

1. Personaliza las respuestas y el comportamiento del bot modificando los archivos en el directorio `src/modules`.
2. Ajusta la configuración del temporizador de inactividad en `src/modules/chat-session.js` si es necesario.
3. Modifica las preguntas de la encuesta en `src/modules/survey-manager.js` según tus necesidades.

## Uso

Para iniciar el bot, ejecuta:

```
npm start
```

La primera vez que ejecutes el bot, generará un código QR en la consola. Escanea este código con tu cuenta de WhatsApp para vincularla al bot.

## Estructura del proyecto

- `src/`: Directorio principal del código fuente
  - `index.js`: Punto de entrada de la aplicación
  - `modules/`: Contiene los módulos de funcionalidad principal
  - `utils/`: Funciones de utilidad
  - `config/`: Archivos de configuración
- `auth_info_baileys/`: Información de sesión de WhatsApp (generada automáticamente)
- `database/`: Scripts SQL para la configuración de la base de datos

## Dependencias

- `@whiskeysockets/baileys`: API de WhatsApp Web
- `axios`: Cliente HTTP para realizar solicitudes
- `dotenv`: Gestión de variables de entorno
- `mysql2`: Cliente de base de datos MySQL
- `node-cache`: Biblioteca de caché

## Contribuir

1. Haz un fork del repositorio
2. Crea una nueva rama (`git checkout -b feature/CaracteristicaIncreible`)
3. Realiza tus cambios
4. Haz commit de tus cambios (`git commit -m 'Añadir alguna CaracteristicaIncreible'`)
5. Haz push a la rama (`git push origin feature/CaracteristicaIncreible`)
6. Abre un pull request

## Licencia

Este proyecto está licenciado bajo la Licencia MIT 

## Soporte

Para obtener soporte, por favor contacta al equipo de desarrollo de RewardPoint o abre un issue en el repositorio de GitHub.