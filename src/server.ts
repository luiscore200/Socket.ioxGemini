import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SocketService } from './models/socket.model';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Ruta raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Inicializar Socket.IO
new SocketService(io).initialize();

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
}); 