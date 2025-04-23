import { GeminiModel, GeminiResponse, CotizacionData, Material } from '../models/gemini';
import { Server, Socket } from 'socket.io';

interface ConversationContext {
  materiales: Material[];
  direccion: string;
  metodo_pago: string;
  ultimoMensaje?: string;
  history: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }[];
}

type SocketState = 'noWarning' | 'inWarning';

export class ChatService {
  private geminiModel: GeminiModel;
  private socketStates: Map<string, SocketState> = new Map();
  private timeouts: Map<string, NodeJS.Timeout[]> = new Map();
  private conversationContext: Map<string, ConversationContext> = new Map();

  constructor(geminiModel: GeminiModel) {
    this.geminiModel = geminiModel;
  }

  public handleNewConnection(socket: Socket): void {
    console.log('🟢 Usuario conectado:', socket.id);
    
    // Inicializar estado y contexto
    this.socketStates.set(socket.id, 'noWarning');
    this.timeouts.set(socket.id, []);
    this.conversationContext.set(socket.id, {
      materiales: [],
      direccion: "",
      metodo_pago: "",
      history: []
    });
    
    // Manejar mensajes del usuario
    socket.on('mensaje', async (data: { mensaje: string }) => {
      await this.handleMessage(socket, data);
    });

    // Manejar desconexión
    socket.on('disconnect', () => {
      console.log('🔴 Usuario desconectado:', socket.id);
      this.cleanupSocket(socket);
    });

    // Iniciar la conversación
    this.startConversation(socket);
  }

  private async startConversation(socket: Socket): Promise<void> {
    try {
      const response = await this.geminiModel.procesarMensaje({ 
        premisa: `Eres un asistente de cotizaciones. Tu objetivo es obtener información en este orden de prioridad:

1. MATERIALES:
   - Cuando el usuario mencione un material, tu PRIORIDAD es obtener la cantidad
   - Si no menciona cantidad, pregúntala específicamente
   - El formato debe ser: nombre(descripcion: "detalles", cantidad: "X")
   - Ejemplo: varilla(descripcion: "acero de 10 pulgadas", cantidad: "5")

IMPORTANTE:
- tener en cuenta si el usuario quiere adicionar, quitar, cambiar, algun material, deberas manejar el array de materiales, añadiento, borrando o modificando y retornandolo
en ese mismo formato, eres el gestor de crud de materiales.
-para eso debes estar pendiente de palabras clave como:agregar, cambiar, tambien, etc.

2. DIRECCIÓN:
   - Una vez que tengas los materiales, tu PRIORIDAD es obtener la dirección
   - Si no menciona dirección, pregúntala específicamente

3. MÉTODO DE PAGO:
   - Una vez que tengas dirección, tu PRIORIDAD es obtener el método de pago
   - Si no menciona método de pago, pregúntalo específicamente

4. CONFIRMACIÓN:
   - Cuando tengas los 3 datos, pregunta si es todo
   - Si el usuario indica que quiere cambiar algo, tu PRIORIDAD es obtener esa actualización
   - Después de actualizar, vuelve a preguntar si es todo
   - Considera como afirmativas respuestas como: "sí", "eso es todo", "listo", "correcto", etc.

Tu respuesta debe seguir EXACTAMENTE este formato:
\`\`\`json
{
  "data": {
    "materiales": [
      {
        "nombre": "nombre del material",
        "descripcion": "descripción detallada",
        "cantidad": "cantidad"
      }
    ],
    "direccion": "dirección de entrega",
    "metodo_pago": "método de pago"
  },
  "mensaje": "tu respuesta al usuario"
}
\`\`\``,
        data: {
          materiales: [],
          direccion: "",
          metodo_pago: ""
        },
        mensaje: "Hola, ¿en qué puedo ayudarte?"
      });
      this.addToHistory(socket.id, 'assistant', response.mensaje);
      socket.emit('respuesta', response);
      this.scheduleTimeout(socket);
    } catch (error) {
      console.error('Error al iniciar la conversación:', error);
      socket.emit('respuesta', { 
        data: {},
        mensaje: 'Hola, ¿en qué puedo ayudarte?'
      });
      this.scheduleTimeout(socket);
    }
  }

  private async handleMessage(socket: Socket, data: { mensaje: string }): Promise<void> {
    console.log('📨 Mensaje recibido:', data);
    
    // Limpiar timeouts existentes
    this.clearTimeouts(socket.id);
    
    // Obtener y actualizar contexto
    const context = this.conversationContext.get(socket.id)!;
    this.updateContext(context, data.mensaje);
    this.addToHistory(socket.id, 'user', data.mensaje);

    try {
      const input = {
        premisa: `Eres un asistente de cotizaciones. Tu objetivo es obtener información en este orden de prioridad:

1. MATERIALES:
   - Cuando el usuario mencione un material, tu PRIORIDAD es obtener la cantidad
   - Si no menciona cantidad, pregúntala específicamente
   - El formato debe ser: nombre(descripcion: "detalles", cantidad: "X")
   - Ejemplo: varilla(descripcion: "acero de 10 pulgadas", cantidad: "5")

   IMPORTANTE:
- tener en cuenta si el usuario quiere adicionar, quitar, cambiar, algun material, deberas manejar el array de materiales, añadiento, borrando o modificando y retornandolo
en ese mismo formato, eres el gestor de crud de materiales.
-para eso debes estar pendiente de palabras clave como:agregar, cambiar, tambien, etc.

2. DIRECCIÓN:
   - Una vez que tengas los materiales, tu PRIORIDAD es obtener la dirección
   - Si no menciona dirección, pregúntala específicamente

3. MÉTODO DE PAGO:
   - Una vez que tengas dirección, tu PRIORIDAD es obtener el método de pago
   - Si no menciona método de pago, pregúntalo específicamente

4. CONFIRMACIÓN:
   - Cuando tengas los 3 datos, pregunta si es todo
   - Si el usuario indica que quiere cambiar algo, tu PRIORIDAD es obtener esa actualización
   - Después de actualizar, vuelve a preguntar si es todo
   - Considera como afirmativas respuestas como: "sí", "eso es todo", "listo", "correcto", etc.

Tu respuesta debe seguir EXACTAMENTE este formato:
\`\`\`json
{
  "data": {
    "materiales": [
      {
        "nombre": "nombre del material",
        "descripcion": "descripción detallada",
        "cantidad": "cantidad"
      }
    ],
    "direccion": "dirección de entrega",
    "metodo_pago": "método de pago"
  },
  "mensaje": "tu respuesta al usuario"
}
\`\`\``,
        data: {
          materiales: context.materiales || [],
          direccion: context.direccion || "",
          metodo_pago: context.metodo_pago || ""
        },
        mensaje: data.mensaje
      };

      console.log('🤖 Input a la IA:', JSON.stringify(input, null, 2));

      const response = await this.geminiModel.procesarMensaje(input);

      console.log('🤖 Output de la IA:', JSON.stringify(response, null, 2));

      // Actualizar contexto con los datos devueltos por la IA
      if (response.data) {
        if (response.data.materiales) context.materiales = response.data.materiales;
        if (response.data.direccion) context.direccion = response.data.direccion;
        if (response.data.metodo_pago) context.metodo_pago = response.data.metodo_pago;
      }

      this.addToHistory(socket.id, 'assistant', response.mensaje);
      socket.emit('respuesta', response);
      
      // Resetear estado a noWarning
      this.socketStates.set(socket.id, 'noWarning');
      
      // Programar nuevo timeout
      this.scheduleTimeout(socket);
    } catch (error) {
      console.error('Error al procesar mensaje:', error);
      socket.emit('respuesta', { 
        data: {},
        mensaje: 'Lo siento, estoy teniendo problemas para procesar tu mensaje. ¿Podrías intentarlo de nuevo?'
      });
      this.scheduleTimeout(socket);
    }
  }

  private clearTimeouts(socketId: string): void {
    const socketTimeouts = this.timeouts.get(socketId);
    if (socketTimeouts) {
      socketTimeouts.forEach(timeout => clearTimeout(timeout));
      this.timeouts.set(socketId, []);
    }
  }

  private updateContext(context: ConversationContext, mensaje: string): void {
    context.ultimoMensaje = mensaje;
  }

  private addToHistory(socketId: string, role: 'user' | 'assistant', content: string): void {
    const context = this.conversationContext.get(socketId);
    if (context) {
      context.history.push({
        role,
        content,
        timestamp: new Date()
      });
    }
  }

  private cleanupSocket(socket: Socket): void {
    this.clearTimeouts(socket.id);
    this.socketStates.delete(socket.id);
    this.conversationContext.delete(socket.id);
  }

  private scheduleTimeout(socket: Socket): void {
    const socketTimeouts = this.timeouts.get(socket.id) || [];
    const currentState = this.socketStates.get(socket.id) || 'noWarning';

    const timeout = setTimeout(() => {
      if (currentState === 'noWarning') {
        // Primer timeout - enviar advertencia
        socket.emit('respuesta', { 
          mensaje: '¿Sigues ahí? ¿En qué puedo ayudarte?',
          cotizacionCompleta: false
        });
        this.socketStates.set(socket.id, 'inWarning');
        
        // Programar segundo timeout
        this.scheduleTimeout(socket);
      } else {
        // Segundo timeout - cerrar sesión
        socket.emit('respuesta', { 
          mensaje: 'No he recibido respuesta. Cerrando la sesión...',
          cotizacionCompleta: false
        });
        socket.disconnect();
      }
    }, 10000);

    socketTimeouts.push(timeout);
    this.timeouts.set(socket.id, socketTimeouts);
  }
} 