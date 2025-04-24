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



export interface GeminiInput {
  premisa_base: string;
  premisa: string;
  data: string;
//  mensaje: string;
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

  // Procesa un mensaje y genera una respuesta
  async procesarMensaje(input: GeminiInput): Promise<string> {
    try {
      // Combinar la premisa base con la premisa específica
      const premisaCompleta = `${input.premisa_base}\n\n${input.premisa}`;

      // Preparar el contexto para Gemini
      const context = input.data;

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

      return text;

    } catch (error: any) {
      console.error('Error al procesar el mensaje con Gemini:', error);
      throw error;
    }
  }
} 