# Taller 3 – Model Context Protocol (MCP)

> **Guía paso a paso EXACTA basada en el PDF oficial del Taller 3**  
Carrera: Software – Nivel Quinto  
Asignatura: Aplicación para el Servidor Web

---

## 1. Punto de Partida (OBLIGATORIO)

Antes de empezar, el proyecto **DEBE** cumplir lo siguiente:

- Usar el proyecto del **Taller 1 o Taller 2**
- Tener:
  - ✅ Al menos **2 entidades relacionadas** (Maestro – Movimiento)
  - ✅ CRUD REST funcional
  - ✅ Base de datos **SQLite** operativa

📌 **No se crea un backend nuevo**, se reutiliza el existente.

---

## 2. Arquitectura Final Requerida

Debes tener **3 capas**:

1. **Backend existente** (microservicio REST)
2. **MCP Server** (JSON-RPC + Tools)
3. **API Gateway con Gemini** (IA decide qué hacer)

---

## 3. Estructura de Carpetas (OBLIGATORIA)

```
proyecto-mcp/
├── apps/
│   ├── backend/                    # Microservicio existente
│   │   ├── src/
│   │   │   ├── entidad-1/
│   │   │   └── entidad-2/
│   │   └── data/*.db               # SQLite
│   │
│   ├── mcp-server/                 # NUEVO
│   │   ├── src/
│   │   │   ├── tools/
│   │   │   │   ├── registry.ts
│   │   │   │   ├── buscar-x.tool.ts
│   │   │   │   ├── validar-x.tool.ts
│   │   │   │   └── crear-x.tool.ts
│   │   │   ├── services/
│   │   │   │   └── backend-client.ts
│   │   │   └── server.ts
│   │   └── package.json
│   │
│   └── api-gateway/                # NUEVO
│       ├── src/
│       │   ├── gemini/
│       │   ├── mcp-client/
│       │   └── dominio/
│       └── package.json
│
└── README.md
```

---

## 4. MCP Server (TypeScript + Express)

📍 Puerto: **3001**

### 4.1 Qué debes implementar

Debes crear un servidor que implemente **JSON-RPC 2.0** y exponga **3 Tools**:

#### Tool 1 – BÚSQUEDA
- Función: Buscar registros
- Ejemplos:
  - `buscar_producto`
  - `buscar_libro`

#### Tool 2 – VALIDACIÓN
- Función: Validar reglas de negocio
- Ejemplos:
  - `validar_stock`
  - `validar_disponibilidad`

#### Tool 3 – ACCIÓN
- Función: Ejecutar operación final
- Ejemplos:
  - `crear_egreso`
  - `registrar_prestamo`

📌 **Cada Tool debe:**
- Tener **JSON Schema** (inputs bien definidos)
- Llamar al **backend REST existente**
- Retornar resultados claros

---

## 5. API Gateway con Gemini (NestJS)

📍 Puerto: **3000**

### 5.1 Función del Gateway

El API Gateway debe:

1. Recibir texto del usuario
2. Consultar los Tools disponibles del MCP Server
3. Enviar a **Gemini**:
   - El texto del usuario
   - La definición de los Tools
4. Permitir que **Gemini decida qué Tool ejecutar**
5. Ejecutar automáticamente los Tools decididos
6. Retornar una respuesta final al usuario

📌 **Usar Gemini con Function Calling**

---

## 6. Flujo de Ejecución (OBLIGATORIO)

Ejemplo (Biblioteca):

1. Usuario escribe:
   > "Quiero prestar el libro Clean Code a Juan Pérez"

2. API Gateway envía el mensaje a Gemini + Tools

3. Gemini decide ejecutar:
   - `buscar_libro('Clean Code')`
   - `validar_disponibilidad(libro_id)`
   - `registrar_prestamo(libro_id, 'Juan Pérez')`

4. MCP Server ejecuta los Tools en orden

5. Usuario recibe respuesta final

---

## 7. Tecnologías OBLIGATORIAS

| Componente | Tecnología | Puerto |
|---------|-----------|--------|
Backend | NestJS + TypeORM + SQLite | 3002 |
MCP Server | TypeScript + Express + JSON-RPC | 3001 |
API Gateway | NestJS + Gemini SDK | 3000 |
IA | Gemini 2.0 Flash | Cloud |

---

## 8. Entregables (TODO ES OBLIGATORIO)

Debes entregar:

1. ✅ Repositorio Git funcional
2. ✅ README.md con:
   - Instalación
   - Configuración
   - Ejecución
3. ✅ Video demostrativo (3–5 min)
4. ✅ Documentación de cada Tool:
   - Descripción
   - Parámetros
   - Ejemplos
5. ✅ Pruebas documentadas (Postman / Thunder Client)

---

## 9. Rúbrica (Cómo te califican)

| Criterio | Puntos |
|-------|-------|
MCP Server funcional | 25 |
API Gateway con Gemini | 25 |
Integración Backend | 15 |
Flujo completo | 15 |
Documentación | 10 |
Calidad del código | 10 |
**TOTAL** | **100** |

---

## 10. Cronograma Sugerido

### Sesión 1 (2h)
- Setup proyecto
- MCP Server con 1 Tool funcionando

### Sesión 2 (2h)
- 3 Tools completos
- API Gateway con Gemini

### Sesión 3 (2h)
- Integración completa
- Pruebas
- Video demo

---

> **"La IA no reemplaza al desarrollador, lo potencia. MCP es el puente."**

