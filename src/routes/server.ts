import { Router } from 'express';
import { SocketModel } from '../models/socket';
import { Server } from 'socket.io';

export class ServerRoutes {
  private router: Router;
  private socketModel: SocketModel;
  private io: Server;

  constructor(socketModel: SocketModel, io: Server) {
    this.router = Router();
    this.socketModel = socketModel;
    this.io = io;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get('/', (req, res) => {
      res.sendFile('index.html', { root: 'public' });
    });
  }

  public getRouter(): Router {
    return this.router;
  }
} 