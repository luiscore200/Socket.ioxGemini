import { Server, Socket } from 'socket.io';

export class SocketModel {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  public initialize(connectionHandler: (socket: Socket) => void): void {
    this.io.on('connection', connectionHandler);
  }

  public emit(socket: Socket, event: string, data: any): void {
    socket.emit(event, data);
  }

  public on(socket: Socket, event: string, handler: (data: any) => void): void {
    socket.on(event, handler);
  }

  public disconnect(socket: Socket): void {
    socket.disconnect();
  }
} 


