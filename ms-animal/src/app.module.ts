import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Animal } from './animal/animal.entity';
import { AnimalConsumer } from './animal/animal.consumert';
import { AnimalService } from './animal/animal.service';
import { AnimalController } from './animal/animal.controller';
import { WebhookModule } from './webhook/webhook.module';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    WebhookModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5434,
      username: 'pguser',
      password: 'pgpass',
      database: 'animal_db',
      entities: [Animal],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Animal]),
    ClientsModule.register([
      {
        name: 'WEBHOOK_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://guest:guest@localhost:5672'],
          queue: 'animal_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [AppController, AnimalConsumer, AnimalController],
  providers: [AppService, AnimalService],
})
export class AppModule {}
