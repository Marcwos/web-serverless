import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log('═══════════════════════════════════════════════════');
  console.log('🚀 API Gateway con Gemini AI iniciado');
  console.log(`   Puerto: ${port}`);
  console.log(`   Chat:   POST http://localhost:${port}/chat`);
  console.log(`   Health: GET  http://localhost:${port}/health`);
  console.log('═══════════════════════════════════════════════════');
}
bootstrap();
