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
export interface Material {
  tipo: string;
  descripcion: string;
  cantidad: string;
}

export interface CotizacionData {
  materiales: Material[];
  direccion: string;
  metodo_pago: string;
}

export interface GeminiInput {
  premisa: string;
  data: CotizacionData;
  mensaje: string;
}

export interface GeminiResponse {
  data: Partial<CotizacionData>;
  mensaje: string;
}

// Clase para manejar las interacciones con Gemini
export class GeminiModel {
  private model: any;
  private premisaBase: string;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-lite",
      safetySettings: safetySettings
    });

    this.premisaBase = `Eres un asistente de cotizaciones amable y conversacional. 
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
  }

  // Procesa un mensaje y genera una respuesta
  async procesarMensaje(input: GeminiInput): Promise<GeminiResponse> {
    try {
      // Combinar la premisa base con la premisa específica del mensaje
      const premisaCompleta = `${this.premisaBase}\n\n${input.premisa}`;

      // Preparar el contexto para Gemini
      const context = `Información actual del cliente:
        Materiales: ${JSON.stringify(input.data.materiales)}
        Dirección: ${input.data.direccion || 'No especificada'}
        Método de pago: ${input.data.metodo_pago || 'No especificado'}
        
        Mensaje del cliente: ${input.mensaje}`;

      // Generar respuesta
      const result = await this.model.generateContent({
        contents: [{
          role: "user",
          parts: [{ text: `${premisaCompleta}\n\n${context}` }]
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
    } catch (error: any) {
      console.error('Error al procesar el mensaje con Gemini:', error);
      throw error;
    }
  }
} 