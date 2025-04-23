import { Socket, Server } from "socket.io";
import { GeminiModel } from '../models/gemini.model';
import { RoomManager } from "../models/room.model";
import { ISocketController } from "../types/socket.interface";

export class ChatController implements ISocketController {
  constructor(private socket: Socket, private io: Server) {}

  public register(): void {
    this.socket.on("chat:join", (roomId: string) => {
      RoomManager.join(this.socket, roomId);
    });

    this.socket.on("chat:message", ({ roomId, message, sender }) => {
      RoomManager.emit(this.io, roomId, "chat:message", {
        sender,
        message,
        timestamp: Date.now(),
      });
    });

    this.socket.on("chat:leave", (roomId: string) => {
      RoomManager.leave(this.socket, roomId);
    });
  }
}
