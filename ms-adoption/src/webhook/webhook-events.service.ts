import { Controller, Logger, OnModuleInit } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { WebhookService, WebhookPayload } from './webhook.service';
import { WebhookSecurityService } from './webhook-security.service';
import { v4 as uuidv4 } from 'uuid';

@Controller()
export class WebhookEventsService implements OnModuleInit {
  private readonly logger = new Logger(WebhookEventsService.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly securityService: WebhookSecurityService,
  ) {}

  onModuleInit() {
    this.logger.log('🔔 Webhook Events Service iniciado');
    this.logger.log('   Escuchando eventos de RabbitMQ para enviar webhooks...');
  }

  /**
   * Escucha el evento 'adoption.created' desde RabbitMQ
   * y lo transforma en webhook externo
   */
  @EventPattern('adoption.created.webhook')
  async handleAdoptionCreatedWebhook(
    @Payload() data: any,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      this.logger.log('📥 Evento recibido: adoption.created.webhook');
      this.logger.log(`   Datos: ${JSON.stringify(data)}`);

      // Construir payload del webhook según estándar del taller
      const webhookPayload: WebhookPayload = {
        event: 'adoption.completed',
        version: '1.0',
        id: uuidv4(),
        idempotency_key: this.securityService.generateIdempotencyKey(
          'adoption.completed',
          data.adoption_id || data.animal_id,
        ),
        timestamp: new Date().toISOString(),
        data: {
          adoption_id: data.adoption_id || 'N/A',
          animal_id: data.animal_id,
          adopter_name: data.adopter_name || 'Unknown',
          adopted_at: new Date().toISOString(),
        },
        metadata: {
          source: 'ms-adoption',
          environment: process.env.NODE_ENV || 'development',
          correlation_id: data.correlation_id || uuidv4(),
        },
      };

      // Enviar webhook
      await this.webhookService.sendWebhook(webhookPayload);

      this.logger.log('✅ Webhook procesado exitosamente');
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error('❌ Error procesando webhook:', error.message);
      channel.ack(originalMsg); // ACK para evitar reenvíos infinitos
    }
  }
}
