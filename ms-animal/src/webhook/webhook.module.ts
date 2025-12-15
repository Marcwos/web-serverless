import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WebhookService } from './webhook.service';
import { WebhookSecurityService } from './webhook-security.service';
import { WebhookEventsService } from './webhook-events.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [WebhookEventsService],
  providers: [WebhookService, WebhookSecurityService, WebhookEventsService],
  exports: [WebhookService, WebhookSecurityService],
})
export class WebhookModule {}
