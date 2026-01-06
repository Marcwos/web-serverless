import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface Tool {
  name: string;
  description: string;
  parameters: any;
}

@Injectable()
export class McpClientService {
  private readonly mcpServerUrl: string;

  constructor(private configService: ConfigService) {
    this.mcpServerUrl = this.configService.get<string>('MCP_SERVER_URL') || 'http://localhost:3003';
  }

  // Obtener lista de Tools disponibles del MCP Server
  async getTools(): Promise<Tool[]> {
    try {
      const response = await axios.get(`${this.mcpServerUrl}/tools`);
      return response.data.tools;
    } catch (error: any) {
      console.error('❌ Error obteniendo tools del MCP Server:', error.message);
      throw new Error('No se pudo conectar con el MCP Server');
    }
  }

  // Ejecutar un Tool via JSON-RPC
  async executeTool(toolName: string, args: any): Promise<any> {
    try {
      console.log(`\n🔧 Ejecutando tool via MCP: ${toolName}`);
      console.log(`   Args:`, JSON.stringify(args));

      const response = await axios.post(`${this.mcpServerUrl}/rpc`, {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
        id: Date.now(),
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      // Parsear el resultado del content
      const content = response.data.result?.content?.[0]?.text;
      if (content) {
        return JSON.parse(content);
      }

      return response.data.result;
    } catch (error: any) {
      console.error(`❌ Error ejecutando tool ${toolName}:`, error.message);
      throw error;
    }
  }

  // Convertir Tools del MCP al formato de Gemini Function Calling
  convertToolsToGeminiFormat(tools: Tool[]): any[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
}
