import { GeminiModel } from '../models/gemini';
import {  Socket } from 'socket.io';

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

        const context = `Información actual del cliente:
        Materiales: [],
        Dirección: "",
        Método de pago: ""
        
        Mensaje del cliente: "Hola, ¿en qué puedo ayudarte?"`;

      const response = await this.geminiModel.procesarMensaje({ 
        premisa_base:premisa_base,
        premisa:premisa_init,
        data: context
      });

      const parsedResponse = await this.parsedResponse(response);

      this.addToHistory(socket.id, 'assistant',  parsedResponse.mensaje);
      socket.emit('respuesta', parsedResponse);
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
    const prev_context = this.conversationContext.get(socket.id)!;
    this.updateContext(prev_context, data.mensaje);
    this.addToHistory(socket.id, 'user', data.mensaje);

    try {


        const context = `Información actual del cliente:
        Materiales: ${JSON.stringify(prev_context.materiales)},
        Dirección: ${prev_context.direccion},
        Método de pago: ${prev_context.metodo_pago},
        
        Mensaje del cliente: ${data.mensaje}`;

      const input = {
        premisa_base:premisa_base,
        premisa:premisa_nudo,
        data: context
      };

      console.log('🤖 Input a la IA:', JSON.stringify(input, null, 2));

      const response = await this.geminiModel.procesarMensaje(input);

      console.log('🤖 Output de la IA:', JSON.stringify(response, null, 2));

      // Actualizar contexto con los datos devueltos por la IA

      const parsedResponse = await this.parsedResponse(response);

      if (parsedResponse.data) {
        if (parsedResponse.data.materiales) prev_context.materiales = parsedResponse.data.materiales;
        if (parsedResponse.data.direccion) prev_context.direccion = parsedResponse.data.direccion;
        if (parsedResponse.data.metodo_pago) prev_context.metodo_pago = parsedResponse.data.metodo_pago;
      }

      this.addToHistory(socket.id, 'assistant', parsedResponse.mensaje);
      socket.emit('respuesta', parsedResponse);
      
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
    }, 30000);

    socketTimeouts.push(timeout);
    this.timeouts.set(socket.id, socketTimeouts);
  }


  private async parsedResponse(text:string):Promise<any>{
    
      // Intentar extraer la respuesta en formato JSON
      try {
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        }
        // Si no encuentra el formato JSON, devolver la respuesta como mensaje
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
\`\`\``;