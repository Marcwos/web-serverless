import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { GeminiModule } from '../gemini/gemini.module';
import { McpClientModule } from '../mcp-client/mcp-client.module';

@Module({
  imports: [GeminiModule, McpClientModule],
  controllers: [ChatController],
})
export class ChatModule {}
