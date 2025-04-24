document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado');
    
    // Conectar al servidor Socket.IO
    const socket = io('http://localhost:3000');
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    console.log('Elementos del DOM:', {
        chatMessages,
        messageInput,
        sendButton
    });

    // Función para agregar mensajes al chat
    function addMessage(message, isUser = false) {
        console.log('Agregando mensaje:', { message, isUser });
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        messageDiv.textContent = message;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Escuchar mensajes del servidor
    socket.on('chatbot:respuesta', (data) => {
        console.log('Mensaje recibido del servidor:', data);
        if (data && data.mensaje) {
            addMessage(data.mensaje);
        } else {
            console.error('Datos de mensaje inválidos:', data);
        }
    });

    // Escuchar errores
    socket.on('error', (data) => {
        console.error('Error recibido:', data);
        addMessage(`Error: ${data.mensaje}`);
    });

    // Manejar envío de mensajes
    function sendMessage() {
        const text = messageInput.value.trim();
        if (text) {
            console.log('Enviando mensaje:', text);
            // Enviar mensaje al servidor
            socket.emit('chatbot:mensaje', { mensaje: text });
            
            // Mostrar mensaje en el chat
            addMessage(text, true);
            
            // Limpiar input
            messageInput.value = '';
        }
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Manejar conexión/desconexión
    socket.on('connect', () => {
        console.log('Conectado al servidor');
        // No mostramos mensaje de conexión, esperamos el saludo de Gemini
    });

    socket.on('disconnect', () => {
        console.log('Desconectado del servidor');
        addMessage('Desconectado del servidor');
    });

    // Log para verificar que el script se cargó
    console.log('Script app.js cargado correctamente');
}); 