import { Controller, Inject, Post, Body } from '@nestjs/common';
import {
  EventPattern,
  Payload,
  Ctx,
  RmqContext,
  ClientProxy,
} from '@nestjs/microservices';
import { IdempotencyGuard } from '../idempotency/idempotency.guard';
import { AdoptionService } from './adoption.service';

@Controller('adoptions')
export class AdoptionController {
  constructor(
    private readonly idempotencyGuard: IdempotencyGuard,
    private readonly adoptionService: AdoptionService,
    @Inject('ANIMAL_SERVICE') private readonly animalClient: ClientProxy,
    @Inject('WEBHOOK_SERVICE') private readonly webhookClient: ClientProxy,
  ) {}

  @Post()
  async createAdoption(@Body() body: { animal_id: string; adopter_name: string }) {
    const adoption = await this.adoptionService.createAdoption(body);
    this.animalClient.emit('adoption.created', { animal_id: body.animal_id });
    
    // Emitir webhook a la misma queue para que WebhookEventsService lo procese
    this.webhookClient.emit('adoption.created.webhook', {
      ...body,
      adoption_id: adoption.id,
      correlation_id: adoption.id,
    });
    
    return adoption;
  }

  @EventPattern('adoption.request')
  async handle(@Payload() payload: any, @Ctx() context: RmqContext) {
    console.log('📥 Procesando adoption.request...');
    
    const channel = context.getChannelRef();
    const msg = context.getMessage();

    await this.idempotencyGuard.run(payload.message_id, async () => {
      const adoption = await this.adoptionService.createAdoption(payload.data);
      
      // Emitir evento a ms-animal
      this.animalClient.emit('adoption.created', payload.data);
      
      // Emitir evento para webhook (a adoption_queue)
      this.webhookClient.emit('adoption.created.webhook', {
        ...payload.data,
        adoption_id: adoption?.id || payload.message_id,
        correlation_id: payload.message_id,
      });
      
      console.log('✅ Adopción creada y eventos emitidos (animal + webhook)');
    });

    channel.ack(msg);
  }
}
