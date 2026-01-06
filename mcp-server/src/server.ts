import express, { Request, Response } from 'express';
import cors from 'cors';
import { getToolsDefinitions, getToolByName } from './tools/registry';

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json());

// ============ JSON-RPC 2.0 Types ============
interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: string | number;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

// ============ ENDPOINTS ============

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'mcp-server', port: PORT });
});

// GET /tools - Listar Tools disponibles (para el API Gateway)
app.get('/tools', (_req: Request, res: Response) => {
  const tools = getToolsDefinitions();
  console.log('📋 Listando tools disponibles');
  res.json({ tools });
});

// POST /rpc - Endpoint JSON-RPC 2.0
app.post('/rpc', async (req: Request, res: Response) => {
  const request: JsonRpcRequest = req.body;
  
  console.log('\n════════════════════════════════════════');
  console.log('📥 JSON-RPC Request recibido');
  console.log(`   Method: ${request.method}`);
  console.log(`   Params:`, JSON.stringify(request.params, null, 2));
  console.log('════════════════════════════════════════');

  // Validar formato JSON-RPC
  if (request.jsonrpc !== '2.0') {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request: jsonrpc must be "2.0"',
      },
      id: request.id || null,
    };
    return res.json(response);
  }

  // Método especial: listar tools
  if (request.method === 'tools/list') {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      result: { tools: getToolsDefinitions() },
      id: request.id,
    };
    return res.json(response);
  }

  // Método especial: ejecutar tool
  if (request.method === 'tools/call') {
    const { name, arguments: args } = request.params || {};
    
    const tool = getToolByName(name);
    
    if (!tool) {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Tool not found: ${name}`,
        },
        id: request.id,
      };
      return res.json(response);
    }

    try {
      const result = await tool.execute(args || {});
      
      console.log('✅ Tool ejecutado exitosamente');
      console.log('   Resultado:', JSON.stringify(result, null, 2));
      
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        },
        id: request.id,
      };
      return res.json(response);
    } catch (error: any) {
      console.error('❌ Error ejecutando tool:', error.message);
      
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error.message,
        },
        id: request.id,
      };
      return res.json(response);
    }
  }

  // Método no reconocido
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: `Method not found: ${request.method}`,
    },
    id: request.id,
  };
  return res.json(response);
});

// ============ START SERVER ============
app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════');
  console.log('🚀 MCP Server iniciado');
  console.log(`   Puerto: ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Tools:  http://localhost:${PORT}/tools`);
  console.log(`   RPC:    http://localhost:${PORT}/rpc`);
  console.log('═══════════════════════════════════════════════════');
  console.log('📋 Tools disponibles:');
  getToolsDefinitions().forEach((t) => {
    console.log(`   - ${t.name}: ${t.description.substring(0, 50)}...`);
  });
  console.log('═══════════════════════════════════════════════════\n');
});
