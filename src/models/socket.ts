import { Server, Socket } from 'socket.io';
import { GeminiModel } from './gemini';

interface ConversationContext {
  material?: string;
  direccion?: string;
  metodoPago?: string;
  ultimoMensaje?: string;
}

type SocketState = 'noWarning' | 'inWarning';

export class SocketModel {
  private io: Server;
  private geminiModel: GeminiModel;
  private socketStates: Map<string, SocketState> = new Map();
  private timeouts: Map<string, NodeJS.Timeout[]> = new Map();
  private messageHandlers: Map<string, (data: { mensaje: string }) => void> = new Map();
  private conversationContext: Map<string, ConversationContext> = new Map();

  constructor(io: Server, geminiModel: GeminiModel) {
    this.io = io;
    this.geminiModel = geminiModel;
  }

  public initialize(): void {
    this.io.on('connection', async (socket: Socket) => {
      console.log('🟢 Usuario conectado:', socket.id);
      
      // Inicializar estado y contexto
      this.socketStates.set(socket.id, 'noWarning');
      this.timeouts.set(socket.id, []);
      this.conversationContext.set(socket.id, {});
      
      try {
        const initialResponse = await this.geminiModel.procesarMensaje({ 
          mensaje: "Saluda al usuario y pregúntale en qué puedes ayudarle"
        });
        socket.emit('respuesta', initialResponse);
        
        // Iniciar el ciclo de mensajes
        this.startMessageCycle(socket);
      } catch (error) {
        console.error('Error al iniciar la conversación:', error);
        socket.emit('respuesta', { mensaje: 'Hola, ¿en qué puedo ayudarte?' });
        this.startMessageCycle(socket);
      }

      socket.on('disconnect', () => {
        console.log('🔴 Usuario desconectado:', socket.id);
        this.cleanupSocket(socket);
      });
    });
  }

  private cleanupSocket(socket: Socket): void {
    // Limpiar timeouts
    const socketTimeouts = this.timeouts.get(socket.id);
    if (socketTimeouts) {
      socketTimeouts.forEach(timeout => clearTimeout(timeout));
      this.timeouts.delete(socket.id);
    }

    // Limpiar handler
    const handler = this.messageHandlers.get(socket.id);
    if (handler) {
      socket.removeListener('mensaje', handler);
      this.messageHandlers.delete(socket.id);
    }

    // Limpiar estado y contexto
    this.socketStates.delete(socket.id);
    this.conversationContext.delete(socket.id);
  }

  private async procesarMensajeConReintentos(data: { mensaje: string }, context: ConversationContext, maxReintentos: number = 3): Promise<{ mensaje: string }> {
    let intentos = 0;
    let ultimoError = null;

    while (intentos < maxReintentos) {
      try {
        let prompt = "Responde al siguiente mensaje de manera natural y conversacional, manteniendo el contexto de la conversación. ";
        prompt += `Contexto actual: `;
        if (context.material) prompt += `Material: ${context.material}. `;
        if (context.direccion) prompt += `Dirección: ${context.direccion}. `;
        if (context.metodoPago) prompt += `Método de pago: ${context.metodoPago}. `;
        prompt += `Mensaje del usuario: "${data.mensaje}"`;

        return await this.geminiModel.procesarMensaje({ mensaje: prompt });
      } catch (error) {
        console.error(`Error al procesar mensaje (intento ${intentos + 1}):`, error);
        ultimoError = error;
        
        if (error instanceof Error && 'status' in error && error.status === 503) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (intentos + 1)));
        } else {
          break;
        }
        
        intentos++;
      }
    }

    console.error('Todos los intentos fallaron:', ultimoError);
    return { mensaje: 'Lo siento, estoy teniendo problemas para procesar tu mensaje. ¿Podrías intentarlo de nuevo?' };
  }

  private async startMessageCycle(socket: Socket): Promise<void> {
    try {
      // Limpiar timeouts anteriores
      const socketTimeouts = this.timeouts.get(socket.id);
      if (socketTimeouts) {
        socketTimeouts.forEach(timeout => clearTimeout(timeout));
        this.timeouts.set(socket.id, []);
      }

      const context = this.conversationContext.get(socket.id) || {};

      // Función para manejar mensajes del usuario
      const messageHandler = async (data: { mensaje: string }) => {
        console.log('📨 Mensaje recibido:', data);
        
        // Limpiar timeouts existentes
        const socketTimeouts = this.timeouts.get(socket.id);
        if (socketTimeouts) {
          socketTimeouts.forEach(timeout => clearTimeout(timeout));
          this.timeouts.set(socket.id, []);
        }

        // Actualizar contexto
        const userMessage = data.mensaje.toLowerCase();
        if (userMessage.includes('cotizar') || userMessage.includes('cotización')) {
          context.material = undefined;
          context.direccion = undefined;
          context.metodoPago = undefined;
        } else if (userMessage.includes('acero') || userMessage.includes('material')) {
          context.material = data.mensaje;
        } else if (userMessage.includes('calle') || userMessage.includes('dirección') || userMessage.includes('direccion')) {
          context.direccion = data.mensaje;
        } else if (userMessage.includes('tarjeta') || userMessage.includes('pago') || userMessage.includes('credito') || userMessage.includes('crédito')) {
          context.metodoPago = data.mensaje;
        }
        context.ultimoMensaje = data.mensaje;

        // Procesar mensaje y enviar respuesta
        try {
          const respuesta = await this.procesarMensajeConReintentos(data, context);
          socket.emit('respuesta', respuesta);
          
          // Resetear estado a noWarning
          this.socketStates.set(socket.id, 'noWarning');
          
          // Programar nuevo timeout
          this.scheduleTimeout(socket);
        } catch (error) {
          console.error('Error al procesar mensaje:', error);
          socket.emit('respuesta', { mensaje: 'Lo siento, estoy teniendo problemas para procesar tu mensaje. ¿Podrías intentarlo de nuevo?' });
        }
      };

      // Registrar el handler
      this.messageHandlers.set(socket.id, messageHandler);
      socket.on('mensaje', messageHandler);

      // Programar primer timeout
      this.scheduleTimeout(socket);

    } catch (error) {
      console.error('Error en el ciclo de mensajes:', error);
      socket.emit('respuesta', { mensaje: 'Lo siento, estoy teniendo problemas. ¿Podrías intentarlo de nuevo?' });
    }
  }

  private scheduleTimeout(socket: Socket): void {
    const socketTimeouts = this.timeouts.get(socket.id) || [];
    const currentState = this.socketStates.get(socket.id) || 'noWarning';

    const timeout = setTimeout(() => {
      if (currentState === 'noWarning') {
        // Primer timeout - enviar advertencia
        socket.emit('respuesta', { mensaje: '¿Sigues ahí? ¿En qué puedo ayudarte?' });
        this.socketStates.set(socket.id, 'inWarning');
        
        // Programar segundo timeout
        this.scheduleTimeout(socket);
      } else {
        // Segundo timeout - cerrar sesión
        socket.emit('respuesta', { mensaje: 'No he recibido respuesta. Cerrando la sesión...' });
        socket.disconnect();
      }
    }, 5000);

    socketTimeouts.push(timeout);
    this.timeouts.set(socket.id, socketTimeouts);
  }
} 


