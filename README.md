# 🐾 Sistema de Microservicios con Webhooks y Serverless

## 📋 Arquitectura Event-Driven con Webhooks

Sistema de gestión de adopción de animales implementado con:
- **Microservicios** (NestJS)
- **RabbitMQ** (Mensajería asíncrona)
- **Redis** (Idempotencia y cache)
- **Webhooks** (Notificaciones en tiempo real)
- **Supabase Edge Functions** (Serverless computing)
- **Telegram Bot** (Notificaciones externas)

---

## 🏗️ Arquitectura del Sistema

```
[Cliente HTTP]
     ↓
[API Gateway :3000]
     ↓ RabbitMQ
     ├──→ [ms-animal :3001] ──→ PostgreSQL (animal_db)
     │         ↓ Webhook HTTP POST
     │         (HMAC-SHA256 Signature)
     │         ↓
     └──→ [ms-adoption :3002] ──→ PostgreSQL (adoption_db)
               ↓ Webhook HTTP POST         ↓ Redis (Idempotency)
               (HMAC-SHA256 Signature)
               ↓
        ┌──────┴──────┐
        ↓             ↓
[Edge Function 1] [Edge Function 2]
(Event Logger)    (Telegram Notifier)
        ↓             ↓
   [PostgreSQL]   [Telegram Bot]
   (Supabase)
```

---

## 🚀 Inicio Rápido

### 1. Prerrequisitos

- Node.js (v18+)
- Docker & Docker Compose
- Supabase CLI
- Cuenta en Supabase
- Bot de Telegram (opcional)

### 2. Levantar Infraestructura

```powershell
# Levantar servicios Docker
docker-compose up -d

# Verificar servicios
docker ps
```

### 3. Instalar Dependencias

```powershell
# Gateway
cd ms-gateway
npm install

# Animal
cd ../ms-animal
npm install

# Adoption
cd ../ms-adoption
npm install
```

### 4. Iniciar Microservicios

Abre **3 terminales**:

```powershell
# Terminal 1
cd ms-gateway
npm run start:dev

# Terminal 2
cd ms-animal
npm run start:dev

# Terminal 3
cd ms-adoption
npm run start:dev
```

---

## 🧪 Pruebas Rápidas

### Crear Animal

```powershell
curl -X POST http://localhost:3000/animals `
  -H "Content-Type: application/json" `
  -d '{"name":"Firulais","species":"Dog"}'
```

**Resultado esperado:**
- ✅ Animal creado en base de datos
- ✅ Webhook enviado a Edge Functions
- ✅ Notificación recibida en Telegram

### Crear Adopción

```powershell
curl -X POST http://localhost:3000/adoptions `
  -H "Content-Type: application/json" `
  -d '{"animal_id":"<animal-id>","adopter_name":"Juan Perez"}'
```

### Probar Idempotencia

```powershell
# Ejecutar 3 veces el mismo comando
for ($i=1; $i -le 3; $i++) {
  curl -X POST http://localhost:3000/animals `
    -H "Content-Type: application/json" `
    -d '{"name":"Rex","species":"Cat"}'
  Start-Sleep -Seconds 2
}
```

**Verificar:**
- Solo 1 animal creado
- Solo 1 webhook en Supabase
- Solo 1 notificación en Telegram

---

## 📊 URLs Importantes

- **RabbitMQ Management:** http://localhost:15672 (guest/guest)
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Edge Function 1:** https://ovibmkajyvhzeoxtxxxh.supabase.co/functions/v1/webhook-event-logger
- **Edge Function 2:** https://ovibmkajyvhzeoxtxxxh.supabase.co/functions/v1/webhook-external-notifier

---

## 🛡️ Estrategia Avanzada: Idempotent Consumer

### Problema Resuelto

RabbitMQ garantiza "At-least-once delivery". Si la red falla antes del ACK, el mensaje se duplica.

### Solución

1. **Idempotency Key:** `{event_type}:{entity_id}:{date}`
2. **PostgreSQL Store:** Tabla `processed_webhooks` con UNIQUE constraint
3. **Atomic Check:** Verificación antes de procesar
4. **TTL:** Limpieza automática después de 7 días

---

## 📁 Estructura del Proyecto

```
practicaweb-resilencia/
├── docker-compose.yml
├── README.md
├── supabase/
│   ├── schema.sql
│   └── functions/
│       ├── webhook-event-logger/
│       └── webhook-external-notifier/
├── ms-gateway/          # Puerto 3000
├── ms-animal/           # Puerto 3001 + Webhooks
└── ms-adoption/         # Puerto 3002 + Webhooks + Redis
```

---

## 📚 Documentación Adicional

- [SETUP_SUPABASE.md](SETUP_SUPABASE.md) - Configuración de Edge Functions
- [README.old.md](README.old.md) - Documentación anterior del proyecto

---

## 🎓 Proyecto Académico

**Universidad:** ULEAM - Facultad de Ciencias Informáticas  
**Carrera:** Software  
**Asignatura:** Aplicación para el Servidor Web  
**Docente:** Ing. John Cevallos  
**Taller:** 2p-2 - Arquitectura Event-Driven con Webhooks y Serverless  
**Fecha:** 15 de Diciembre 2025
