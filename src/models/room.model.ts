import { Socket, Server } from "socket.io";

export class RoomManager {
  static join(socket: Socket, room: string) {
    socket.join(room);
    console.log(`📥 ${socket.id} joined room: ${room}`);
  }

  static leave(socket: Socket, room: string) {
    socket.leave(room);
    console.log(`📤 ${socket.id} left room: ${room}`);
  }

  static emit(io: Server, room: string, event: string, data: any) {
    io.to(room).emit(event, data);
    console.log(`📢 Emit in room ${room} -> ${event}`);
  }
}
