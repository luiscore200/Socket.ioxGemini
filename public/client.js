"use strict";
// Conectar al servidor Socket.IO
const socket = io('http://localhost:3000');
// Manejar eventos de conexión
socket.on('connect', () => {
    console.log('Conectado al servidor');
});
socket.on('connect_error', (error) => {
    console.error('Error de conexión:', error);
    addMessage('Error de conexión con el servidor', false);
});
const messagesDiv = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
function addMessage(message, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    messageDiv.textContent = message;
    messagesDiv?.appendChild(messageDiv);
    if (messagesDiv) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}
sendButton?.addEventListener('click', () => {
    const message = messageInput?.value.trim();
    if (message) {
        addMessage(message, true);
        socket.emit('mensaje', { mensaje: message });
        if (messageInput) {
            messageInput.value = '';
        }
    }
});
messageInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendButton?.click();
    }
});
socket.on('respuesta', (data) => {
    addMessage(data.mensaje);
});
socket.on('error', (data) => {
    addMessage(data.mensaje);
});
//# sourceMappingURL=client.js.map