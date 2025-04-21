import { Server, Socket } from 'socket.io';
import { GeminiModel } from './gemini';

export class SocketModel {
  private io: Server;
  private geminiModel: GeminiModel;
  private readonly TIMEOUT = 5000; // 5 segundos para pruebas

  constructor(io: Server, geminiModel: GeminiModel) {
    this.io = io;
    this.geminiModel = geminiModel;
  }

  public initialize(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log('🔵 Usuario conectado:', socket.id);
      
      // Iniciar el proceso de timeout
      this.startTimeoutProcess(socket);

      // Escuchar mensajes del cliente
      socket.on('mensaje', async (data) => {
        try {
          console.log('📨 Mensaje recibido:', data);
          
          // Reiniciar el proceso de timeout
          this.resetTimeoutProcess(socket);

          const respuesta = await this.geminiModel.procesarMensaje(data);
          socket.emit('respuesta', respuesta);
        } catch (error) {
          console.error('❌ Error:', error);
          socket.emit('error', { mensaje: 'Error al procesar el mensaje' });
        }
      });

      // Manejar desconexión
      socket.on('disconnect', () => {
        console.log('🔴 Usuario desconectado:', socket.id);
      });
    });
  }

  public startTimeoutProcess(socket: Socket): void {
    console.log('⏱️ Iniciando proceso de timeout para:', socket.id);
    
    // Timer de advertencia
    const warningTimer = setTimeout(() => {
      console.log('⚠️ Enviando advertencia a:', socket.id);
      socket.emit('respuesta', {
        mensaje: '¿Sigues ahí? Si no respondes en 5 segundos, la sesión se cerrará automáticamente.'
      });

      // Timer de desconexión
      const disconnectTimer = setTimeout(() => {
        console.log('🚫 Desconectando a:', socket.id);
        socket.emit('respuesta', {
          mensaje: 'Gracias por usar nuestros servicios. Estaremos atentos para tu próxima cotización.'
        });
        socket.disconnect(true);
      }, this.TIMEOUT);

      // Guardar el timer en el socket para poder limpiarlo
      socket.data.disconnectTimer = disconnectTimer;
    }, this.TIMEOUT);

    // Guardar el timer en el socket para poder limpiarlo
    socket.data.warningTimer = warningTimer;
  }

  public resetTimeoutProcess(socket: Socket): void {
    console.log('🔄 Reseteando proceso de timeout para:', socket.id);
    
    // Limpiar timers existentes
    if (socket.data.warningTimer) {
      clearTimeout(socket.data.warningTimer);
    }
    if (socket.data.disconnectTimer) {
      clearTimeout(socket.data.disconnectTimer);
    }

    // Iniciar nuevo proceso de timeout
    this.startTimeoutProcess(socket);
  }
} 