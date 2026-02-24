# NutroVia — Plataforma de Nutrición & Entrenamiento

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue) ![Stripe](https://img.shields.io/badge/Stripe-Integrado-purple)

Aplicación web profesional de nutrición y entrenamiento personalizado con planes generados por motor científico (Harris-Benedict), suscripción de 60 €/mes con 30 días de prueba gratuita y 15 días de ventana de cancelación.

---

## 🚀 Puesta en marcha rápida

### 1. Requisitos previos
- [Node.js 18+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para PostgreSQL)
- Cuenta de [Stripe](https://stripe.com/) (modo test para desarrollo)

### 2. Clonar y configurar

```bash
git clone <url-del-repo>
```

> ⚠️ **Windows — Ruta larga:** `npm install` puede quedarse colgado en el paso `idealTree` si la ruta del proyecto es muy larga. Si te ocurre, copia el proyecto a una ruta corta:
> ```powershell
> Copy-Item -Recurse ".\Aplicacion_web_nutricion_y_entrenamiento_nutrovia" "C:\nutrovia"
> cd C:\nutrovia
> ```

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
copy .env.example .env
```

Edita `.env` y configura al menos:
- `JWT_SECRET` — cualquier cadena aleatoria larga
- `STRIPE_SECRET_KEY` y `STRIPE_PUBLISHABLE_KEY` — de tu [dashboard de Stripe](https://dashboard.stripe.com/apikeys) (modo test)

> **Nota:** Si no tienes claves de Stripe aún, la app arrancará pero mostrará un error `StripeAuthenticationError` al intentar registrar usuarios. Las demás funcionalidades (landing, login, etc.) seguirán funcionando.

### 3. Levantar la base de datos (Docker)

Abre **Docker Desktop** y luego:

```bash
docker-compose up -d
```

Esto levanta PostgreSQL y ejecuta automáticamente `schema.sql` y `seed.sql`.

Para parar la base de datos:
```bash
docker-compose down
```

### 4. Arrancar el servidor

```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

La app estará disponible en: **http://localhost:3000**

---

## 📁 Estructura del proyecto

```
├── server.js                 # Punto de entrada Express
├── docker-compose.yml        # PostgreSQL via Docker
├── .env.example              # Plantilla de variables de entorno
│
├── db/
│   ├── schema.sql            # Tablas de la BD
│   ├── seed.sql              # Datos iniciales
│   └── db.js                 # Pool de conexiones
│
├── routes/
│   ├── auth.js               # Registro / Login
│   ├── questionnaire.js      # Cuestionario → Plan
│   ├── subscription.js       # Ciclo de vida suscripción
│   ├── plans.js              # Consulta plan del usuario
│   └── webhook.js            # Eventos Stripe
│
├── controllers/
│   └── planEngine.js         # Motor de planes personalizados
│
├── services/
│   ├── stripeService.js      # Integración Stripe
│   └── emailService.js       # Emails de notificación
│
├── middleware/
│   └── auth.js               # JWT middleware
│
├── jobs/
│   └── cronJobs.js           # Tareas diarias (recordatorios)
│
└── public/                   # Frontend
    ├── index.html            # Landing page
    ├── questionnaire.html    # Cuestionario multi-paso
    ├── dashboard.html        # Panel del usuario
    ├── login.html            # Login
    ├── css/styles.css        # Estilos premium
    └── js/
        ├── main.js           # Landing JS
        ├── questionnaire.js  # Cuestionario JS
        ├── dashboard.js      # Dashboard JS
        └── login.js          # Login JS
```

---

## 💳 Configurar Stripe (pagos)

### Claves de test

1. Ve a [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
2. Copia `Publishable key` → `STRIPE_PUBLISHABLE_KEY` en `.env`
3. Copia `Secret key` → `STRIPE_SECRET_KEY` en `.env`

### Webhook local (para desarrollo)

```bash
# Instalar Stripe CLI
# https://stripe.com/docs/stripe-cli

stripe login
stripe listen --forward-to localhost:3000/api/webhook/stripe
# Copia el webhook signing secret → STRIPE_WEBHOOK_SECRET en .env
```

### Tarjeta de prueba
```
Número:  4242 4242 4242 4242
Fecha:   Cualquier fecha futura
CVC:     Cualquier 3 dígitos
```

---

## 📧 Configurar emails (SMTP)

### Gmail (recomendado para desarrollo)

1. Ve a tu cuenta de Google → Seguridad → [Contraseñas de aplicaciones](https://myaccount.google.com/apppasswords)
2. Genera una contraseña para "Correo"
3. En `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=tu@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx  # La contraseña de app generada
   ```

---

## 🐛 Problemas conocidos

| Problema | Causa | Solución |
|----------|-------|----------|
| `npm install` se queda colgado en `idealTree` | Ruta del proyecto demasiado larga en Windows (límite 260 caracteres) | Copiar el proyecto a una ruta corta como `C:\nutrovia` |
| `StripeAuthenticationError: Invalid API Key` | Claves de Stripe en `.env` son las de ejemplo | Sustituir por claves reales de [Stripe Dashboard](https://dashboard.stripe.com/apikeys) (modo test) |
| `docker-compose` da warning de `version` | El atributo `version` en `docker-compose.yml` está obsoleto | Se puede ignorar o eliminar la línea `version: '3.9'` del archivo |

---

## 🌐 Despliegue a producción

### Variables de entorno adicionales para producción

```env
NODE_ENV=production
APP_URL=https://tudominio.es
DATABASE_URL=postgresql://user:pass@host:5432/nutrovia_db
```

### Opciones recomendadas
- **Backend**: [Railway](https://railway.app/), [Render](https://render.com/), VPS (DigitalOcean/Hetzner)
- **BD**: Railway PostgreSQL, Supabase, o tu propio servidor
- **Dominio + SSL**: Cloudflare, Namecheap

---

## 🔧 API Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/register` | Registro de usuario | ❌ |
| POST | `/api/auth/login` | Login → JWT | ❌ |
| GET | `/api/auth/me` | Perfil del usuario | ✅ |
| POST | `/api/questionnaire` | Enviar cuestionario | ✅ |
| GET | `/api/plan` | Obtener plan personalizado | ✅ |
| POST | `/api/subscription/setup-intent` | Crear SetupIntent Stripe | ✅ |
| POST | `/api/subscription/start` | Activar prueba gratuita | ✅ |
| GET | `/api/subscription/status` | Estado de suscripción | ✅ |
| POST | `/api/subscription/cancel` | Cancelar suscripción | ✅ |
| POST | `/api/webhook/stripe` | Webhook de Stripe | ❌ |

---

## 📊 Flujo de suscripción

```
Día 0   → Usuario se registra + tarjeta guardada (sin cobro)
Día 30  → Email: "Prueba terminada, tienes 15 días para cancelar"
Día 44  → Email: "Mañana se activa tu suscripción"
Día 45  → Si no cancela → suscripción activa → Stripe cobra 60 €
Día 75+ → Cobro recurrente cada mes, el día del mes de inscripción
```
