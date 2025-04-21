require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configuración de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Manejo de conexiones Socket.IO
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  socket.on('mensaje', async (data) => {
    try {
      // Enviar mensaje a ChatGPT
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Eres un asistente amable y servicial." },
          { role: "user", content: data.mensaje }
        ],
        max_tokens: 150
      });

      // Enviar respuesta al cliente
      socket.emit('respuesta', {
        mensaje: completion.choices[0].message.content
      });
    } catch (error) {
      console.error('Error al procesar el mensaje:', error);
      socket.emit('error', {
        mensaje: 'Lo siento, hubo un error al procesar tu mensaje.'
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
}); 