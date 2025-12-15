-- =====================================================
-- ESQUEMA DE BASE DE DATOS PARA WEBHOOKS
-- Proyecto: Arquitectura Event-Driven con Webhooks
-- =====================================================

-- Tabla: webhook_subscriptions
-- Gestión de URLs suscritas a eventos
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  url VARCHAR(500) NOT NULL,
  secret VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  retry_config JSONB DEFAULT '{
    "max_attempts": 6,
    "backoff_type": "exponential",
    "initial_delay_ms": 60000
  }'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_triggered_at TIMESTAMP,
  CONSTRAINT unique_event_url UNIQUE(event_type, url)
);

-- Tabla: webhook_events
-- Registro de todos los eventos recibidos
CREATE TABLE IF NOT EXISTS webhook_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB,
  received_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- Tabla: webhook_deliveries
-- Auditoría de todos los intentos de entrega
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER REFERENCES webhook_subscriptions(id),
  event_id VARCHAR(255) REFERENCES webhook_events(event_id),
  attempt_number INTEGER NOT NULL,
  status_code INTEGER,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  delivered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  duration_ms INTEGER
);

-- Tabla: processed_webhooks
-- Control de idempotencia (deduplicación)
CREATE TABLE IF NOT EXISTS processed_webhooks (
  id SERIAL PRIMARY KEY,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  event_id VARCHAR(255),
  processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_idempotency_key ON webhook_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_delivered_at ON webhook_deliveries(delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_status ON webhook_deliveries(subscription_id, status);
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_expires ON processed_webhooks(expires_at);

-- Función para limpiar claves expiradas (ejecutar diariamente vía cron)
CREATE OR REPLACE FUNCTION cleanup_expired_webhooks()
RETURNS void AS $$
BEGIN
  DELETE FROM processed_webhooks WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comentarios descriptivos
COMMENT ON TABLE webhook_subscriptions IS 'Gestiona las URLs suscritas a eventos específicos';
COMMENT ON TABLE webhook_events IS 'Registro histórico de todos los eventos webhook recibidos';
COMMENT ON TABLE webhook_deliveries IS 'Auditoría completa de intentos de entrega de webhooks';
COMMENT ON TABLE processed_webhooks IS 'Control de idempotencia para prevenir procesamiento duplicado';
