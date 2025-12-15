import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdoptionController } from './adoption/adoption.controller';
import { AdoptionService } from './adoption/adoption.service';
import { Adoption } from './adoption/adoption.entity';
import { IdempotencyGuard } from './idempotency/idempotency.guard';
import { RedisModule } from './redis/redis.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RedisModule,
    WebhookModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5433,
      username: 'pguser',
      password: 'pgpass',
      database: 'adoption_db',
      entities: [Adoption],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Adoption]),
    ClientsModule.register([
      {
        name: 'ANIMAL_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://guest:guest@localhost:5672'],
          queue: 'animal_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'WEBHOOK_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://guest:guest@localhost:5672'],
          queue: 'adoption_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [AppController, AdoptionController],
  providers: [AppService, AdoptionService, IdempotencyGuard],
})
export class AppModule {}
