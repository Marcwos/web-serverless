import { Controller, Post, Body, Get, HttpException, HttpStatus } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';
import { McpClientService } from '../mcp-client/mcp-client.service';
import { v4 as uuidv4 } from 'uuid';

interface ChatRequest {
  message: string;
  sessionId?: string; // Opcional - para mantener contexto de conversación
}

interface ChatResponse {
  response: string;
  sessionId: string; // Devolver para que el cliente lo use en siguientes mensajes
  tools_executed: Array<{
    tool: string;
    args: any;
    result: any;
  }>;
}

@Controller()
export class ChatController {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly mcpClientService: McpClientService,
  ) {}

  @Get('health')
  health() {
    return { 
      status: 'ok', 
      service: 'api-gateway',
      gemini: 'connected',
    };
  }

  @Post('chat')
  async chat(@Body() body: ChatRequest): Promise<ChatResponse> {
    // Generar o usar sessionId existente
    const sessionId = body.sessionId || uuidv4();
    
    console.log('\n════════════════════════════════════════════════════');
    console.log('💬 Nueva solicitud de chat');
    console.log(`   SessionId: ${sessionId}`);
    console.log('   Body recibido:', JSON.stringify(body));
    console.log(`   Mensaje: "${body?.message}"`);
    console.log('════════════════════════════════════════════════════');

    // Validar que el mensaje exista
    if (!body || !body.message || typeof body.message !== 'string') {
      throw new HttpException(
        {
          error: 'El campo "message" es requerido',
          ejemplo: { message: 'Hola, que animales hay disponibles?', sessionId: 'opcional-para-contexto' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const userMessage = body.message.trim();
    if (!userMessage) {
      throw new HttpException(
        { error: 'El mensaje no puede estar vacío' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. Obtener Tools del MCP Server
    const tools = await this.mcpClientService.getTools();
    console.log(`📋 Tools obtenidos: ${tools.map(t => t.name).join(', ')}`);

    // 2. Enviar mensaje a Gemini con los Tools y sessionId
    const geminiResult = await this.geminiService.chat(userMessage, tools, sessionId);

    const toolsExecuted: Array<{ tool: string; args: any; result: any }> = [];
    let animalsFound: any[] = [];

    // 3. Si Gemini decidió ejecutar tools
    if (geminiResult.functionCalls.length > 0) {
      console.log('\n🔄 Ejecutando Tools decididos por Gemini...');
      
      const toolResults: Array<{ name: string; result: any }> = [];

      for (const fc of geminiResult.functionCalls) {
        console.log(`\n   → Ejecutando: ${fc.name}`);
        
        try {
          const result = await this.mcpClientService.executeTool(fc.name, fc.args);
          
          toolResults.push({ name: fc.name, result });
          toolsExecuted.push({
            tool: fc.name,
            args: fc.args,
            result,
          });

          // Guardar animales encontrados para el contexto
          if (fc.name === 'buscar_animal' && result.animals) {
            animalsFound = result.animals;
          }

          console.log(`   ✅ Resultado:`, JSON.stringify(result).substring(0, 100));
        } catch (error: any) {
          console.error(`   ❌ Error: ${error.message}`);
          toolResults.push({ 
            name: fc.name, 
            result: { error: error.message } 
          });
        }
      }

      // 4. Enviar resultados a Gemini para respuesta final
      console.log('\n📤 Enviando resultados a Gemini para respuesta final...');
      const finalResponse = await this.geminiService.continueWithToolResults(
        body.message,
        tools,
        toolResults,
        sessionId,
      );

      // Actualizar contexto de conversación
      this.geminiService.updateConversation(sessionId, userMessage, finalResponse, animalsFound);

      console.log('\n════════════════════════════════════════════════════');
      console.log('✅ Respuesta final generada');
      console.log('════════════════════════════════════════════════════\n');

      return {
        response: finalResponse,
        sessionId,
        tools_executed: toolsExecuted,
      };
    }

    // Si no hay function calls, retornar respuesta directa
    // Actualizar contexto de conversación
    this.geminiService.updateConversation(sessionId, userMessage, geminiResult.response || '');

    console.log('\n════════════════════════════════════════════════════');
    console.log('✅ Respuesta directa (sin tools)');
    console.log('════════════════════════════════════════════════════\n');

    return {
      response: geminiResult.response || 'No pude procesar tu solicitud. ¿Podrías reformularla?',
      sessionId,
      tools_executed: [],
    };
  }
}
