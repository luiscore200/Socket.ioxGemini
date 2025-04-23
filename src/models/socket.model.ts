import { Server, Socket } from "socket.io";
import { ISocketController } from "../types/socket.interface";
import { ChatController } from "../services/chat.service";



//import { ChatController } from "./controllers/chat.controller";

export class SocketService {
  constructor(private io: Server) {}

  public initialize() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🟢 Socket conectado: ${socket.id}`);

      const controllers: ISocketController[] = [
      new ChatController(socket,this.io),
        // Aquí puedes agregar más controladores en el futuro
      ];

      controllers.forEach(controller => controller.register());

      socket.on('disconnect', () => {
        console.log(`🔴 Socket desconectado: ${socket.id}`);
      });
    });
  }
}