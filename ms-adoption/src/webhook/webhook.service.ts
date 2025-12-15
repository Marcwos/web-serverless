import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { WebhookSecurityService } from './webhook-security.service';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

export interface WebhookPayload {
  event: string;
  version: string;
  id: string;
  idempotency_key: string;
  timestamp: string;
  data: any;
  metadata?: {
    source: string;
    environment: string;
    correlation_id: string;
  };
}

@Injectable()
export class WebhookService implements OnModuleInit {
  private readonly logger = new Logger(WebhookService.name);
  private secret: string;
  private supabaseAnonKey: string;
  private webhookUrls: string[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly securityService: WebhookSecurityService,
  ) {}

  onModuleInit() {
    // Cargar configuración desde ConfigService
    this.secret = this.configService.get<string>('WEBHOOK_SECRET', '');
    this.supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY', '');
    
    const url1 = this.configService.get<string>('WEBHOOK_EDGE_FUNCTION_1', '');
    const url2 = this.configService.get<string>('WEBHOOK_EDGE_FUNCTION_2', '');
    
    this.webhookUrls = [url1, url2].filter(url => url && url.length > 0);

    // Log de configuración al iniciar
    this.logger.log('🔧 Webhook Service configurado:');
    this.logger.log(`   Secret: ${this.secret ? '✅ Configurado' : '❌ No configurado'}`);
    this.logger.log(`   Supabase Key: ${this.supabaseAnonKey ? '✅ Configurado' : '❌ No configurado'}`);
    this.logger.log(`   URLs configuradas: ${this.webhookUrls.length}`);
    this.webhookUrls.forEach((url, i) => {
      this.logger.log(`   [${i + 1}] ${this.truncateUrl(url)}`);
    });
  }

  /**
   * Envía un webhook a todas las URLs registradas
   * @param payload - Payload del webhook
   */
  async sendWebhook(payload: WebhookPayload): Promise<void> {
    if (!this.secret) {
      this.logger.error('❌ WEBHOOK_SECRET no está configurado');
      return;
    }

    if (this.webhookUrls.length === 0) {
      this.logger.warn('⚠️ No hay URLs de webhook configuradas');
      return;
    }

    this.logger.log(`📤 Enviando webhook: ${payload.event} [ID: ${payload.id}]`);

    // Enviar a todas las URLs en paralelo
    const promises = this.webhookUrls.map((url) =>
      this.sendToUrl(url, payload, this.secret)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Envía el webhook a una URL específica con retry logic
   * @param url - URL destino
   * @param payload - Payload del webhook
   * @param secret - Secret para firma HMAC
   */
  private async sendToUrl(
    url: string,
    payload: WebhookPayload,
    secret: string,
  ): Promise<void> {
    const maxAttempts = 3;
    const delays = [0, 5000, 15000]; // 0s, 5s, 15s

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Generar firma y timestamp
        const signature = this.securityService.generateSignature(payload, secret);
        const timestamp = this.securityService.generateTimestamp();

        this.logger.log(
          `   → Intento ${attempt}/${maxAttempts} a ${this.truncateUrl(url)}`
        );

        // Realizar request HTTP POST
        const startTime = Date.now();
        const response = await firstValueFrom(
          this.httpService.post(url, payload, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.supabaseAnonKey}`,
              'X-Webhook-Signature': signature,
              'X-Webhook-Timestamp': timestamp,
            },
            timeout: 10000, // 10 segundos
          })
        );

        const duration = Date.now() - startTime;

        this.logger.log(
          `   ✅ Webhook enviado exitosamente (${response.status}) - ${duration}ms`
        );

        return; // Éxito, salir del loop
      } catch (error) {
        const duration = Date.now() - Date.now();
        const isLastAttempt = attempt === maxAttempts;

        if (error instanceof AxiosError) {
          this.logger.error(
            `   ❌ Intento ${attempt}/${maxAttempts} falló: ${error.message} (${error.response?.status || 'N/A'})`
          );
        } else {
          this.logger.error(
            `   ❌ Intento ${attempt}/${maxAttempts} falló: ${error.message}`
          );
        }

        if (isLastAttempt) {
          this.logger.error(
            `   🚨 Webhook falló después de ${maxAttempts} intentos para ${this.truncateUrl(url)}`
          );
          return;
        }

        // Esperar antes del siguiente intento (exponential backoff)
        const delay = delays[attempt];
        if (delay > 0) {
          this.logger.log(`   ⏳ Reintentando en ${delay / 1000}s...`);
          await this.sleep(delay);
        }
      }
    }
  }

  /**
   * Helper para truncar URLs largas en logs
   */
  private truncateUrl(url: string): string {
    if (url.length <= 50) return url;
    return url.substring(0, 47) + '...';
  }

  /**
   * Helper para delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
