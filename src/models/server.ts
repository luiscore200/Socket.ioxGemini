import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SocketModel } from './socket';
import { GeminiModel } from './gemini';
import { ApiRoutes } from '../routes/api';
import { ServerRoutes } from '../routes/server';
import dotenv from 'dotenv';
import cors from 'cors';

export class ServerModel {
  private app: express.Application;
  private httpServer: any;
  private io: Server;
  private socketModel: SocketModel;
  private geminiModel: GeminiModel;
  private apiRoutes: ApiRoutes;
  private serverRoutes: ServerRoutes;

  constructor() {
    // Cargar variables de entorno
    dotenv.config();

    // Inicializar Express
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));

    // Crear servidor HTTP
    this.httpServer = createServer(this.app);

    // Inicializar Socket.IO
    this.io = new Server(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // Inicializar modelos
    this.geminiModel = new GeminiModel(process.env.GEMINI_API_KEY || '');
    this.socketModel = new SocketModel(this.io, this.geminiModel);

    // Inicializar rutas
    this.apiRoutes = new ApiRoutes(this.geminiModel, this.io);
    this.serverRoutes = new ServerRoutes(this.socketModel, this.io);

    // Configurar rutas
    this.app.use('/api', this.apiRoutes.getRouter());
    this.app.use('/', this.serverRoutes.getRouter());
  }

  // Inicializar el servidor
  public async initialize(): Promise<void> {
    try {
      // Inicializar Socket.IO
      this.socketModel.initialize();

      // Iniciar servidor
      const PORT = process.env.PORT || 3000;
      this.httpServer.listen(PORT, () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
      });

    } catch (error) {
      console.error('Error al inicializar el servidor:', error);
      process.exit(1);
    }
  }
} 