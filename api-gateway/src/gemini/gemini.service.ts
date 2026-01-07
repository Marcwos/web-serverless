import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ConversationMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface ConversationContext {
  history: ConversationMessage[];
  lastAnimals?: any[]; // Guardar los últimos animales mostrados
  lastAnimalMentioned?: { id: string; nombre: string }; // Último animal mencionado
  createdAt: Date;
}

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  
  // Almacén de conversaciones en memoria (en producción usar Redis)
  private conversations: Map<string, ConversationContext> = new Map();

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no configurada');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // Limpiar conversaciones antiguas cada 30 minutos
    setInterval(() => this.cleanOldConversations(), 30 * 60 * 1000);
  }

  private cleanOldConversations() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [sessionId, context] of this.conversations) {
      if (context.createdAt < oneHourAgo) {
        this.conversations.delete(sessionId);
      }
    }
  }

  getOrCreateConversation(sessionId: string): ConversationContext {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, {
        history: [],
        createdAt: new Date(),
      });
    }
    return this.conversations.get(sessionId)!;
  }

  updateConversation(sessionId: string, userMessage: string, modelResponse: string, animals?: any[]) {
    const context = this.getOrCreateConversation(sessionId);
    
    context.history.push({ role: 'user', parts: [{ text: userMessage }] });
    context.history.push({ role: 'model', parts: [{ text: modelResponse }] });
    
    // Guardar los animales si se buscaron
    if (animals && animals.length > 0) {
      context.lastAnimals = animals;
      // Si solo hay un animal disponible, guardarlo como el último mencionado
      const disponibles = animals.filter(a => a.disponible);
      if (disponibles.length > 0) {
        context.lastAnimalMentioned = { 
          id: disponibles[0].id, 
          nombre: disponibles[0].nombre 
        };
      }
    }
    
    // Mantener solo las últimas 10 interacciones
    if (context.history.length > 20) {
      context.history = context.history.slice(-20);
    }
  }

  getContextInfo(sessionId: string): string {
    const context = this.getOrCreateConversation(sessionId);
    let info = '';
    
    if (context.lastAnimals && context.lastAnimals.length > 0) {
      info += `\n\nCONTEXTO DE CONVERSACIÓN - Animales que conoces de búsquedas anteriores:\n`;
      info += `(USA ESTOS IDs cuando el usuario mencione un animal por nombre)\n\n`;
      
      const disponibles = context.lastAnimals.filter(a => a.disponible);
      const noDisponibles = context.lastAnimals.filter(a => !a.disponible);
      
      if (disponibles.length > 0) {
        info += `✅ DISPONIBLES PARA ADOPCIÓN:\n`;
        disponibles.forEach(a => {
          info += `   - Nombre: "${a.nombre}" | Especie: ${a.especie} | ID: ${a.id}\n`;
        });
      }
      
      if (noDisponibles.length > 0) {
        info += `\n❌ NO DISPONIBLES (ya adoptados):\n`;
        noDisponibles.forEach(a => {
          info += `   - Nombre: "${a.nombre}" | Especie: ${a.especie} | ID: ${a.id}\n`;
        });
      }
      
      info += `\nINSTRUCCIONES:
- Si el usuario dice un NOMBRE de animal (ej: "quiero adoptar a Picoro"), busca ese nombre en la lista y usa su ID.
- Si el usuario dice "sí", "ese", "ese mismo", se refiere al último animal que le mencionaste.
- SIEMPRE usa el ID de la lista, NUNCA pidas el ID al usuario.`;
    }
    
    return info;
  }

  // Iniciar chat con Function Calling
  async chat(userMessage: string, tools: any[], sessionId?: string): Promise<{ 
    response: string; 
    functionCalls: Array<{ name: string; args: any }>;
  }> {
    const sid = sessionId || 'default';
    const context = this.getOrCreateConversation(sid);
    const contextInfo = this.getContextInfo(sid);
    
    console.log('\n🤖 Enviando mensaje a Gemini...');
    console.log(`   SessionId: ${sid}`);
    console.log(`   Mensaje: "${userMessage}"`);
    console.log(`   Tools disponibles: ${tools.map(t => t.name).join(', ')}`);
    console.log(`   Historial previo: ${context.history.length} mensajes`);
    if (contextInfo) {
      console.log(`   Contexto previo: Sí (animales en memoria)`);
    }

    // Convertir tools al formato de Gemini
    const geminiTools = this.convertToGeminiTools(tools);

    // Crear modelo con tools
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: geminiTools,
      systemInstruction: `Eres un asistente para un sistema de adopción de animales. 
Tu trabajo es ayudar a los usuarios a:
1. Buscar animales disponibles para adopción
2. Verificar si un animal específico está disponible
3. Registrar adopciones

REGLAS CRÍTICAS:
1. NUNCA pidas el ID del animal al usuario. Usa el ID del contexto de la conversación.
2. Si el usuario menciona un NOMBRE de animal (ej: "quiero adoptar a Picoro"), busca ese nombre en el contexto y usa su ID.
3. Si el usuario dice "sí", "ese", "adoptalo" sin nombre, usa el último animal que mencionaste.
4. Cuando tengas el nombre del adoptante Y el animal identificado, usa registrar_adopcion directamente.

FLUJO PARA ADOPCIÓN:
- Si el animal está en el contexto: usa validar_disponibilidad con su ID, luego registrar_adopcion
- Si el animal NO está en el contexto: usa buscar_animal primero para obtener su ID
${contextInfo}

Responde siempre en español de manera amigable y clara.`,
    });

    try {
      // USAR CHAT CON HISTORIAL en lugar de generateContent
      const chat = model.startChat({
        history: context.history,
      });

      const result = await chat.sendMessage(userMessage);
      const response = result.response;
      
      // Verificar si hay function calls
      const functionCalls: Array<{ name: string; args: any }> = [];
      
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.functionCall) {
            functionCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args,
            });
          }
        }
      }

      // Obtener texto de respuesta si existe
      let textResponse = '';
      try {
        textResponse = response.text() || '';
      } catch (e) {
        // No hay texto, solo function calls
      }

      console.log(`   Function Calls: ${functionCalls.length}`);
      if (functionCalls.length > 0) {
        functionCalls.forEach(fc => {
          console.log(`     - ${fc.name}(${JSON.stringify(fc.args)})`);
        });
      }

      return {
        response: textResponse,
        functionCalls,
      };
    } catch (error: any) {
      console.error('❌ Error en Gemini:', error.message);
      throw error;
    }
  }

  // Continuar conversación con resultados de tools
  async continueWithToolResults(
    userMessage: string, 
    tools: any[],
    toolResults: Array<{ name: string; result: any }>,
    sessionId?: string
  ): Promise<string> {
    console.log('\n🤖 Continuando conversación con resultados de tools...');
    
    const sid = sessionId || 'default';
    const context = this.getOrCreateConversation(sid);
    const contextInfo = this.getContextInfo(sid);

    const geminiTools = this.convertToGeminiTools(tools);

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: geminiTools,
      systemInstruction: `Eres un asistente para un sistema de adopción de animales.
Responde siempre en español de manera amigable y clara.
Usa los resultados de las herramientas para dar una respuesta completa al usuario.
${contextInfo}`,
    });

    // Construir el historial de la conversación CON EL HISTORIAL PREVIO
    const chat = model.startChat({
      history: context.history,
    });

    // Enviar mensaje original
    await chat.sendMessage(userMessage);

    // Enviar resultados de tools como respuesta de función
    const functionResponseParts = toolResults.map(tr => ({
      functionResponse: {
        name: tr.name,
        response: tr.result,
      },
    }));

    const result = await chat.sendMessage(functionResponseParts);
    
    return result.response.text();
  }

  private convertToGeminiTools(tools: any[]): any[] {
    return [{
      functionDeclarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'OBJECT',
          properties: this.convertProperties(tool.parameters?.properties || {}),
          required: tool.parameters?.required || [],
        },
      })),
    }];
  }

  private convertProperties(properties: any): any {
    const result: any = {};
    for (const [key, value] of Object.entries(properties)) {
      const prop = value as any;
      result[key] = {
        type: this.mapType(prop.type),
        description: prop.description,
      };
    }
    return result;
  }

  private mapType(type: string): string {
    switch (type) {
      case 'string':
        return 'STRING';
      case 'number':
        return 'NUMBER';
      case 'boolean':
        return 'BOOLEAN';
      case 'array':
        return 'ARRAY';
      default:
        return 'STRING';
    }
  }
}
