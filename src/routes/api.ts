import { Router } from 'express';
import { GeminiModel } from '../models/gemini';
import { Server } from 'socket.io';

export class ApiRoutes {
  private router: Router;
  private geminiModel: GeminiModel;
  private io: Server;

  constructor(geminiModel: GeminiModel, io: Server) {
    this.router = Router();
    this.geminiModel = geminiModel;
    this.io = io;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post('/chat', async (req, res) => {
      try {
        const { mensaje, socketId } = req.body;
        const response = await this.geminiModel.procesarMensaje({ mensaje });
        
        // Emitir el mensaje al socket específico si se proporciona un socketId
        if (socketId) {
          this.io.to(socketId).emit('respuesta', response);
        } else {
          // Si no hay socketId, emitir a todos los clientes
          this.io.emit('respuesta', response);
        }
        
        res.json(response);
      } catch (error) {
        console.error('Error en la ruta /chat:', error);
        res.status(500).json({ error: 'Error al procesar el mensaje' });
      }
    });
  }

  public getRouter(): Router {
    return this.router;
  }
} 