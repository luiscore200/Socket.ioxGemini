import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Configuración de seguridad
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// Interfaces
export interface CotizacionData {
  mensaje: string;
  material?: string;
  direccion?: string;
  metodoPago?: string;
}

export interface GeminiResponse {
  mensaje: string;
  material?: string;
  direccion?: string;
  metodoPago?: string;
  cotizacionCompleta: boolean;
}

// Clase para manejar las interacciones con Gemini
export class GeminiModel {
  private model: any;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-lite",
      safetySettings: safetySettings
    });
  }

  // Extrae información relevante del mensaje
  private extraerInformacion(mensaje: string, data: CotizacionData): CotizacionData {
    const lowerMessage = mensaje.toLowerCase();
    
    // Extraer material si no está definido
    if (!data.material && (
      lowerMessage.includes('acero') || 
      lowerMessage.includes('aluminio') || 
      lowerMessage.includes('hierro') ||
      lowerMessage.includes('varilla')
    )) {
      data.material = mensaje;
    }
    
    // Extraer dirección si no está definida
    if (!data.direccion && (
      lowerMessage.includes('calle') || 
      lowerMessage.includes('avenida') || 
      lowerMessage.includes('carrera') ||
      lowerMessage.includes('dirección') ||
      lowerMessage.includes('direccion') ||
      lowerMessage.includes('entrega')
    )) {
      data.direccion = mensaje;
    }
    
    // Extraer método de pago si no está definido
    if (!data.metodoPago && (
      lowerMessage.includes('tarjeta') || 
      lowerMessage.includes('efectivo') || 
      lowerMessage.includes('transferencia') ||
      lowerMessage.includes('depósito') ||
      lowerMessage.includes('deposito') ||
      lowerMessage.includes('pago')
    )) {
      data.metodoPago = mensaje;
    }

    return data;
  }

  // Verifica si tenemos toda la información necesaria
  private tieneTodaLaInformacion(data: CotizacionData): boolean {
    return !!data.material && !!data.direccion && !!data.metodoPago;
  }

  // Genera un resumen de la cotización
  private generarResumen(data: CotizacionData): string {
    return `¡Perfecto! Aquí está el resumen de tu cotización:\n\n` +
           `Material: ${data.material}\n` +
           `Dirección: ${data.direccion}\n` +
           `Método de pago: ${data.metodoPago}\n\n` +
           `¿Hay algo más que te gustaría saber o modificar?`;
  }

  // Procesa un mensaje y genera una respuesta
  async procesarMensaje(data: CotizacionData): Promise<GeminiResponse> {
    try {
      const dataActualizada = this.extraerInformacion(data.mensaje, data);

      // Preparar el contexto para Gemini
      const context = `Eres un asistente de cotizaciones amable y conversacional. 
        Tu objetivo es obtener esta información del cliente de manera natural:
        - Material que necesita
        - Dirección de entrega
        - Método de pago preferido
        
        Información actual del cliente:
        ${dataActualizada.material ? `Material: ${dataActualizada.material}` : 'Material: No especificado'}
        ${dataActualizada.direccion ? `Dirección: ${dataActualizada.direccion}` : 'Dirección: No especificada'}
        ${dataActualizada.metodoPago ? `Método de pago: ${dataActualizada.metodoPago}` : 'Método de pago: No especificado'}
        
        Si el cliente menciona alguna de estas informaciones, actualízala en tu respuesta.
        Mantén un tono amable y conversacional.
        Si falta información, guía suavemente al cliente para obtenerla.
        Si ya tienes toda la información, genera un resumen amable.
        NO preguntes por información que ya tengamos.`;

      // Generar respuesta
      const result = await this.model.generateContent({
        contents: [{
          role: "user",
          parts: [{ text: `${context}\n\nCliente: ${data.mensaje}` }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      });

      const response = await result.response;
      const text = response.text();

      return {
        mensaje: this.tieneTodaLaInformacion(dataActualizada) ? this.generarResumen(dataActualizada) : text,
        material: dataActualizada.material,
        direccion: dataActualizada.direccion,
        metodoPago: dataActualizada.metodoPago,
        cotizacionCompleta: this.tieneTodaLaInformacion(dataActualizada)
      };
    } catch (error: any) {
      console.error('Error al procesar el mensaje con Gemini:', error);
      throw error;
    }
  }
} 