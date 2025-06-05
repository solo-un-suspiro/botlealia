-- Tabla para almacenar todas las conversaciones completas
CREATE TABLE IF NOT EXISTS conversation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    message_type ENUM('bot', 'user') NOT NULL,
    message_content TEXT NOT NULL,
    message_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(255),
    message_order INT DEFAULT 0,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_chat_id (chat_id),
    INDEX idx_timestamp (message_timestamp)
);

-- Tabla para mensajes fuera de horario
CREATE TABLE IF NOT EXISTS out_of_hours_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    INDEX idx_phone_number (phone_number),
    INDEX idx_received_at (received_at)
);

-- Tabla para estadísticas de conversaciones
CREATE TABLE IF NOT EXISTS conversation_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL UNIQUE,
    chat_id VARCHAR(255) NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    total_messages INT DEFAULT 0,
    bot_messages INT DEFAULT 0,
    user_messages INT DEFAULT 0,
    duration_seconds INT DEFAULT 0,
    ended_by ENUM('user', 'inactivity', 'system') DEFAULT 'system',
    survey_completed BOOLEAN DEFAULT FALSE,
    human_transfer BOOLEAN DEFAULT FALSE,
    INDEX idx_chat_id (chat_id),
    INDEX idx_start_time (start_time)
);
