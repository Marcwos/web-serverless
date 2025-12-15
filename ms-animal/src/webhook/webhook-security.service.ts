import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class WebhookSecurityService {
  /**
   * Genera una firma HMAC-SHA256 para el payload
   * @param payload - Objeto a firmar
   * @param secret - Secret compartido
   * @returns Firma en formato sha256=HASH
   */
  generateSignature(payload: any, secret: string): string {
    // 1. Serializar payload a JSON string (sin espacios para consistencia)
    const payloadString = JSON.stringify(payload);

    // 2. Crear HMAC con SHA256
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');

    // 3. Retornar con prefijo estándar
    return `sha256=${hmac}`;
  }

  /**
   * Genera un timestamp Unix actual
   * @returns Timestamp en segundos
   */
  generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  /**
   * Genera un idempotency key único basado en el evento
   * Formato: {event_type}:{entity_id}:{date}
   * @param eventType - Tipo de evento (ej: 'animal.registered')
   * @param entityId - ID de la entidad relacionada
   * @returns Clave de idempotencia única
   */
  generateIdempotencyKey(eventType: string, entityId: string): string {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return `${eventType}:${entityId}:${date}`;
  }
}
