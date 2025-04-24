import { Socket, Server } from 'socket.io';
import { ISocketController } from '../types/socket.interface';
import { GeminiModel } from '../models/gemini.model';

interface ConversationContext {
  materiales: any[];
  direccion: string;
  metodo_pago: string;
  ultimoMensaje?: string;
  history: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }[];
}

export interface CotizacionData {
  materiales: Material[];
  direccion: string;
  metodo_pago: string;
}

export interface GeminiResponse {
  data: Partial<CotizacionData>;
  mensaje: string;
}

export interface Material {
  nombre: string;
  descripcion: string;
  cantidad: string;
}

type SocketState = 'noWarning' | 'inWarning';

export class ChatBotService implements ISocketController {
  private geminiModel: GeminiModel;
  private socketStates: Map<string, SocketState> = new Map();
  private timeouts: Map<string, NodeJS.Timeout[]> = new Map();
  private conversationContext: Map<string, ConversationContext> = new Map();

  constructor(private socket: Socket, private io: Server, geminiModel: GeminiModel) {
    this.geminiModel = geminiModel;
  }

  public register(): void {
    console.log('🟢 Bot conectado:', this.socket.id);
    
    // Inicializar estado y contexto
    this.socketStates.set(this.socket.id, 'noWarning');
    this.timeouts.set(this.socket.id, []);
    this.conversationContext.set(this.socket.id, {
      materiales: [],
      direccion: "",
      metodo_pago: "",
      history: []
    });
    
    // Manejar mensajes del usuario desde front-end
    this.socket.on('chatbot:mensaje', async (data: { mensaje: string }) => {
      console.log('📨 Mensaje recibido por el bot:', data.mensaje);
      await this.handleMessage(data.mensaje);
    });

    // Manejar desconexión
    this.socket.on('disconnect', () => {
      console.log('🔴 Bot desconectado:', this.socket.id);
      this.cleanupSocket();
    });

    // Iniciar la conversación
    this.startConversation();
  }

  private async startConversation(): Promise<void> {
    try {
      const context = `Información actual del cliente:
        Materiales: [],
        Dirección: "",
        Método de pago: ""
        
        Mensaje del cliente: "Hola, ¿en qué puedo ayudarte?"`;

      const response = await this.geminiModel.procesarMensaje({ 
        premisa_base: premisa_base,
        premisa: premisa_init,
        data: context
      });

      const parsedResponse = await this.parsedResponse(response);

      this.addToHistory('assistant', parsedResponse.mensaje);
      this.socket.emit('chatbot:respuesta', parsedResponse);
      this.scheduleTimeout();
    } catch (error) {
      console.error('Error al iniciar la conversación:', error);
      this.socket.emit('chatbot:respuesta', { 
        data: {},
        mensaje: 'Hola, ¿en qué puedo ayudarte?'
      });
      this.scheduleTimeout();
    }
  }

  private async handleMessage(mensaje: string): Promise<void> {
    console.log('📨 Procesando mensaje en handleMessage:', mensaje);
    
    // Limpiar timeouts existentes
    this.clearTimeouts();
    
    // Obtener y actualizar contexto
    const prev_context = this.conversationContext.get(this.socket.id)!;
    this.updateContext(prev_context, mensaje);
    this.addToHistory('user', mensaje);

    try {
      const context = `Información actual del cliente:
        Materiales: ${JSON.stringify(prev_context.materiales)},
        Dirección: ${prev_context.direccion},
        Método de pago: ${prev_context.metodo_pago},
        
        Mensaje del cliente: ${mensaje}`;

      const input = {
        premisa_base: premisa_base,
        premisa: premisa_nudo,
        data: context
      };

      console.log('🤖 Input a la IA:', JSON.stringify(input, null, 2));

      const response = await this.geminiModel.procesarMensaje(input);

      console.log('🤖 Output de la IA:', JSON.stringify(response, null, 2));

      const parsedResponse = await this.parsedResponse(response);

      if (parsedResponse.data) {
        if (parsedResponse.data.materiales) prev_context.materiales = parsedResponse.data.materiales;
        if (parsedResponse.data.direccion) prev_context.direccion = parsedResponse.data.direccion;
        if (parsedResponse.data.metodo_pago) prev_context.metodo_pago = parsedResponse.data.metodo_pago;
      }

      this.addToHistory('assistant', parsedResponse.mensaje);

      // Enviar respuesta al emisor
      this.socket.emit('chatbot:respuesta', parsedResponse);
      
      // Resetear estado a noWarning
      this.socketStates.set(this.socket.id, 'noWarning');
      
      // Programar nuevo timeout
      this.scheduleTimeout();
    } catch (error) {
      console.error('Error al procesar mensaje:', error);
      this.socket.emit('chatbot:respuesta', {
        mensaje: 'Lo siento, hubo un error al procesar tu mensaje.',
        cotizacionCompleta: false
      });
    }
  }

  private clearTimeouts(): void {
    const socketTimeouts = this.timeouts.get(this.socket.id);
    if (socketTimeouts) {
      socketTimeouts.forEach(timeout => clearTimeout(timeout));
      this.timeouts.set(this.socket.id, []);
    }
  }

  private updateContext(context: ConversationContext, mensaje: string): void {
    context.ultimoMensaje = mensaje;
  }

  private addToHistory(role: 'user' | 'assistant', content: string): void {
    const context = this.conversationContext.get(this.socket.id);
    if (context) {
      context.history.push({
        role,
        content,
        timestamp: new Date()
      });
    }
  }

  private cleanupSocket(): void {
    this.clearTimeouts();
    this.socketStates.delete(this.socket.id);
    this.conversationContext.delete(this.socket.id);
  }

  private scheduleTimeout(): void {
    const socketTimeouts = this.timeouts.get(this.socket.id) || [];
    const currentState = this.socketStates.get(this.socket.id) || 'noWarning';

    console.log(`⏰ Programando timeout para ${this.socket.id} en estado ${currentState}`);

    const timeout = setTimeout(() => {
      console.log(`⏰ Timeout ejecutado para ${this.socket.id} en estado ${currentState}`);
      
      if (currentState === 'noWarning') {
        // Primer timeout - enviar advertencia
        console.log('⚠️ Enviando advertencia de inactividad');
        this.socket.emit('chatbot:respuesta', { 
          mensaje: '¿Sigues ahí? ¿En qué puedo ayudarte?',
          cotizacionCompleta: false
        });
        this.socketStates.set(this.socket.id, 'inWarning');
        
        // Programar segundo timeout
        this.scheduleTimeout();
      } else {
        // Segundo timeout - cerrar sesión
        console.log('🔴 Cerrando sesión por inactividad');
        this.socket.emit('chatbot:respuesta', { 
          mensaje: 'No he recibido respuesta. Cerrando la sesión...',
          cotizacionCompleta: false
        });
        this.socket.disconnect();
      }
    }, 30000); // 30 segundos

    socketTimeouts.push(timeout);
    this.timeouts.set(this.socket.id, socketTimeouts);
  }

  private async parsedResponse(text: string): Promise<any> {
    try {
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      return {
        data: {},
        mensaje: text
      };
    } catch (error) {
      console.error('Error al parsear la respuesta JSON:', error);
      return {
        data: {},
        mensaje: text
      };
    }
  }
}

const premisa_base:string =  `Eres un asistente de cotizaciones amable y conversacional. 
Tu objetivo es obtener esta información del cliente de manera natural:
- Materiales que necesita (tipo, descripción y cantidad)
- Dirección de entrega
- Método de pago preferido

Debes mantener un tono amable y conversacional.
Si falta información, guía suavemente al cliente para obtenerla.
Si ya tienes toda la información, genera un resumen amable.
NO preguntes por información que ya tengamos.

IMPORTANTE: Tu respuesta debe seguir EXACTAMENTE este formato:
\`\`\`json
{
  "data": {
    "materiales": [
      {
        "tipo": "tipo del material",
        "descripcion": "descripción detallada",
        "cantidad": "cantidad"
      }
    ],
    "direccion": "dirección de entrega",
    "metodo_pago": "método de pago"
  },
  "mensaje": "tu respuesta al usuario"
}
\`\`\`

En el campo "data" solo debes incluir los datos que hayan sido actualizados o confirmados en el mensaje actual.
El campo "mensaje" debe contener tu respuesta natural al usuario.`;

const premisa_init:string= `Eres un asistente de cotizaciones. Tu objetivo es obtener información en este orden de prioridad:

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
   - Considera como afirmativas respuestas como: "sí", "eso es todo", "listo", "correcto", o cualquier expresion de forma coloquial o informal que 
   deduzcas que es afirmativa.
  - una vez deduzcas que el usuario a confirmado que todo esta bien le generaras un resumen de la cotizacion automaticamente.

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
\`\`\``;

const premisa_nudo:string=  `Eres un asistente de cotizaciones. Tu objetivo es obtener información en este orden de prioridad:

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
  - Considera como afirmativas respuestas como: "sí", "eso es todo", "listo", "correcto", o cualquier expresion de forma coloquial o informal que 
   deduzcas que es afirmativa.
  - una vez deduzcas que el usuario a confirmado que todo esta bien le generaras un resumen de la cotizacion automaticamente.


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
\`\`\``;