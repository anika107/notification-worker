# Notification Worker

A production-ready Node.js notification service that queues and processes email, push, and SMS notifications asynchronously, with CPU-intensive work offloaded to worker thread pools.

## What it does

This project is a background job system for sending notifications. Instead of sending emails/pushes/SMS inline (which blocks your API), requests are:

1. **Received** by an Express API (`server.js`)
2. **Validated** with Zod schemas
3. **Persisted** to PostgreSQL with idempotency keys (so duplicate submissions are detected)
4. **Enqueued** to Redis via BullMQ
5. **Processed** by a background worker (`worker.js`) that sends the actual notification

The worker also handles CPU-heavy tasks (password hashing with `pbkdf2`, image resizing with `sharp`) inside [Piscina](https://github.com/bendrucker/piscina) worker thread pools so they never block the event loop.

## Features

| Feature | Description |
|---------|-------------|
| 📧 **Email** | Send email via Nodemailer (Mailtrap sandbox by default) |
| 📱 **Push** | Send push notifications |
| 💬 **SMS** | Send SMS messages |
| ⏰ **Scheduled / delayed** | Send notifications at a future time (`/notify/later`) |
| 🔁 **Idempotency** | `Idempotency-Key` header prevents duplicate processing |
| 🛡️ **API key auth** | Constant-time comparison on all API routes |
| 🚦 **Rate limiting** | Configurable requests-per-minute per IP |
| 🧵 **Worker thread pools** | Piscina pools for hashing (`hash-data`) and image resize (`resize-image`) |
| ☠️ **Dead Letter Queue** | Failed jobs (after retries) moved to a DLQ for inspection/retry |
| 📊 **Bull Board dashboard** | Queue monitoring at `/admin/queues` |
| ⏱️ **Cron schedules** | Recurring jobs (e.g. daily digest at 09:00 UTC) |
| 🐳 **Docker** | Dockerfile + docker-compose with Redis and PostgreSQL |
| ✅ **Graceful shutdown** | Handles `SIGINT` / `SIGTERM` and closes pools/connections cleanly |

## Project structure

```
notification-worker/
├── server.js              # Express API server (port 3000)
├── worker.js              # BullMQ worker that processes jobs
├── schedules.js           # Cron-based recurring job setup
├── watch-queue.js         # Queue depth / drain-rate monitor
├── add-many.js            # Utility to bulk-add test jobs
├── Dockerfile             # Multi-stage-ready Node image
├── docker-compose.yml     # API + worker + Redis + PostgreSQL
├── package.json           # Dependencies and npm scripts
├── .env                   # Runtime environment variables (gitignored)
├── .gitignore
├── .dockerignore
├── images/                # Source images for resize jobs
├── output/                # Resized image output (gitignored)
├── src/
│   ├── queue.js           # BullMQ notification queue
│   ├── dlq.js             # Dead letter queue
│   ├── connection.js      # Redis/ioredis connection
│   ├── db.js              # PostgreSQL pool + schema init
│   ├── auth.js            # API key middleware (x-api-key)
│   ├── dashboard-auth.js  # Basic auth for Bull Board UI
│   ├── validate.js        # Zod request validation middleware
│   ├── schemas.js         # Zod schemas (notify, hash, resize)
│   ├── email.js           # Nodemailer transport
│   ├── push.js            # Push notification sender
│   ├── sms.js             # SMS sender
│   ├── hash-pool.js       # Piscina pool for pbkdf2 hashing
│   ├── image-pool.js      # Piscina pool for sharp image resize
│   ├── tasks/
│   │   ├── hash-task.js   # Worker thread: pbkdf2 hash
│   │   ├── hash-worker.js
│   │   └── resize-task.js # Worker thread: sharp resize
│   └── schedules.js
└── scripts/
    ├── demo.js            # Event-loop blocking demo (main thread)
    ├── threads-demo.js    # Hash work offloaded to a thread
    ├── pool-demo.js       # Piscina pool concurrency demo
    ├── load-test.js       # Fire 30 /notify requests at once
    ├── add-many.js        # Bulk-add 5 email jobs
    ├── watch-queue.js     # Watch queue depth (also at root)
    ├── make-sample.js     # Generate a sample image
    └── test-db.js         # Check DB connectivity
```

## Prerequisites

- Node.js ≥ 20
- Redis ≥ 7
- PostgreSQL ≥ 16
- Docker & Docker Compose (optional, for the easiest setup)

## Quick start with Docker (recommended)

```bash
# Clone / open the project
cd notification-worker

# Copy the env file if you don't have one
cp .env .env.local   # .env already exists in this repo

# Start everything (API, worker, Redis, PostgreSQL)
docker compose up --build

# API is at http://localhost:3000
# Bull Board dashboard at http://localhost:3000/admin/queues
```

Stop with `docker compose down`.

## Manual setup (without Docker)

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env` and adjust as needed:

   ```bash
   cp .env .env.local
   ```

   Key variables:

   | Variable | Default | Description |
   |----------|---------|-------------|
   | `SMTP_USER` | — | Mailtrap/SMTP username |
   | `SMTP_PASS` | — | Mailtrap/SMTP password |
   | `PG_HOST` | `127.0.0.1` | PostgreSQL host |
   | `PG_PORT` | `5432` | PostgreSQL port |
   | `PG_USER` | `postgres` | PostgreSQL user |
   | `PG_PASSWORD` | `postgres` | PostgreSQL password |
   | `PG_DATABASE` | `notifications` | Database name |
   | `PG_POOL_MAX` | `10` | Max PG connections |
   | `REDIS_HOST` | `127.0.0.1` | Redis host |
   | `API_KEY` | — | Required API key for all API routes |
   | `RATE_LIMIT_MAX` | `100` | Requests per minute per IP |
   | `FAKE_SEND` | `false` | Skip real email/push/SMS (useful for local dev) |
   | `WORKER_CONCURRENCY` | `5` | Concurrent jobs per worker |
   | `HASH_MAX_THREADS` | `CPUs - 1` | Max hash worker threads |
   | `IMAGE_MAX_THREADS` | `2` | Max image resize threads |
   | `DASHBOARD_USER` | `admin` | Bull Board username |
   | `DASHBOARD_PASS` | — | Bull Board password |

3. **Start Redis and PostgreSQL** (make sure they're running)

4. **Run the API**

   ```bash
   npm start
   ```

5. **Run the worker** (in a separate terminal)

   ```bash
   npm run worker
   ```

## API reference

All API routes require the header `x-api-key: <your API key>`, except `/health` and `/admin/queues`.

### `GET /health`
Health check. Returns `{ status: "ok" }`.

### `POST /notify`
Send an email notification.

**Headers**
- `x-api-key` (required)
- `Idempotency-Key` (optional, max 200 chars) — prevents duplicate processing

**Body**
```json
{
  "to": "user@example.com",
  "subject": "Hello",
  "message": "Welcome!"
}
```

**Response**
```json
{ "status": "queued", "id": 42 }
```

If the idempotency key was already used:
```json
{ "status": "duplicate", "id": 42, "currentStatus": "sent" }
```

### `POST /notify/push`
Send a push notification.

**Body**
```json
{
  "userId": "123",
  "title": "New message",
  "body": "You have a new notification"
}
```

**Response:** `{ "status": "queued" }`

### `POST /notify/sms`
Send an SMS.

**Body**
```json
{
  "phone": "+15551234567",
  "message": "Your verification code is 123456"
}
```

**Response:** `{ "status": "queued" }`

### `POST /notify/later`
Schedule a push notification for later.

**Body**
```json
{
  "userId": "123",
  "title": "Reminder",
  "body": "Don't forget your meeting",
  "delayMs": 3600000
}
```

**Response:** `{ "status": "scheduled", "jobId": "reminder-123-171...` }`

### `DELETE /notify/later/:jobId`
Cancel a scheduled job.

### `GET /dlq`
List jobs in the Dead Letter Queue (waiting state).

### `POST /dlq/:id/retry`
Requeue a failed job from the DLQ back to the main queue.

### `POST /hash`
CPU-intensive password hashing (runs in a Piscina thread pool).

**Body**
```json
{
  "text": "password123",
  "iterations": 2000000
}
```

### `POST /resize`
Resize an image inside `./images` (runs in a Piscina thread pool). Path traversal is blocked — only files under `images/` are allowed.

**Body**
```json
{
  "file": "sample.jpg",
  "width": 400
}
```

## Queue dashboard

Bull Board is mounted at:

```
http://localhost:3000/admin/queues
```

It is protected by HTTP Basic Auth using `DASHBOARD_USER` / `DASHBOARD_PASS`. You can view job states (waiting, active, completed, failed), retry failed jobs, and inspect the DLQ.

## npm scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm start` | `node server.js` | Start the API server |
| `npm run worker` | `node worker.js` | Start the background job worker |
| `npm run queue:add-many` | `node scripts/add-many.js` | Add 5 test email jobs |
| `npm run queue:watch` | `node scripts/watch-queue.js` | Monitor queue depth and drain rate |
| `npm run load-test` | `node scripts/load-test.js` | Fire 30 concurrent /notify requests |
| `npm run db:check` | `node scripts/test-db.js` | Verify PostgreSQL connectivity |
| `npm run image:sample` | `node scripts/make-sample.js` | Generate a sample image for resize tests |
| `npm run demo:main-thread` | `node scripts/demo.js` | Show event-loop blocking on main thread |
| `npm run demo:thread` | `node scripts/threads-demo.js` | Show hash work offloaded to a thread |
| `npm run demo:pool` | `node scripts/pool-demo.js` | Show Piscina pool concurrency |

## Example workflow

```bash
# Terminal 1: start the API
npm start

# Terminal 2: start the worker
npm run worker

# Terminal 3: send a notification
curl -X POST http://localhost:3000/notify \
  -H "x-api-key: d9101e485486d7b131394762c0d8966e13073f2d2b5e152623fe390d33fcc7ae" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-1" \
  -d '{"to":"alice@example.com","subject":"Hello","message":"Welcome to the app!"}'

# Terminal 4: watch the queue drain
npm run queue:watch

# Open the dashboard
open http://localhost:3000/admin/queues
```

## How it works under the hood

1. **`server.js`** — Express app. Validates incoming requests, inserts a row into the `notifications` table (PostgreSQL), enqueues a BullMQ job, and returns `queued`. Also mounts Bull Board and the DLQ endpoints.
2. **`worker.js`** — BullMQ `Worker` listening on the `notifications` queue. Dispatches to `sendEmail`, `sendPush`, `sendSms`, `hash-data` (via Piscina), or `resize-image` (via Piscina) based on job name. On completion marks the notification `sent`; on exhaustion/permanent failure moves the job to the DLQ and marks it `dead`.
3. **`db.js`** — `pg` pool. Auto-creates the `notifications` table on startup with an `idempotency_key` unique index.
4. **`hash-pool.js` / `image-pool.js`** — Piscina pools that run `pbkdf2` and `sharp` in worker threads so CPU-heavy work never blocks the API or the main worker event loop.
5. **`schedules.js`** — Registers a BullMQ job scheduler (cron `0 9 * * * UTC`) for a daily digest push.

## Safety & design decisions

- **Idempotency keys** are enforced with a unique DB index. Retrying the same key returns the existing record instead of creating a duplicate notification.
- **Constant-time comparison** (`crypto.timingSafeEqual`) is used for API key and dashboard auth to prevent timing attacks.
- **Path traversal protection** in resize: resolved input paths must start under `images/`.
- **Unrecoverable errors** (missing fields, bad paths) are thrown as BullMQ `UnrecoverableError` so they are not retried and go straight to the DLQ.
- **Graceful shutdown** on `SIGINT`/`SIGTERM` closes the worker, destroys Piscina pools, quits Redis/Postgres connections, then exits.

## System Architecture

The service follows a **queue-based background job pattern**. The API never sends notifications directly — it persists the request and enqueues a job, while a separate worker process handles delivery asynchronously.

### High-level diagram

```mermaid
flowchart TD
    Client([Client / API Consumer]) -->|HTTP POST /notify| API[Express API server.js]
    API -->|1. Validate Zod schema| VALID[Request Validation]
    VALID -->|2. Insert row + idempotency check| DB[(PostgreSQL<br/>notifications table)]
    DB -->|Row returned| API
    API -->|3. Enqueue BullMQ job| Q[(Redis + BullMQ<br/>notifications queue)]
    Q -->|4. Consume / poll| Worker[BullMQ Worker worker.js]
    Worker -->|5a. CPU-heavy: hash / resize| Pool[Piscina Worker Thread Pools]
    Worker -->|5b. Send notification| External[Email / Push / SMS Providers]
    Worker -->|6. Update status| DB
    Worker -->|7. Failed after retries| DLQ[(Dead Letter Queue<br/>notifications-dlq)]
    Scheduler[Job Scheduler schedules.js] -.->|Cron: daily 09:00 UTC| Q
    Dashboard[Bull Board Dashboard<br/>/admin/queues] -.->|Monitor & retry| Q
    Dashboard -.->|Basic Auth| Dashboard
```

### Component responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Express API** (`server.js`) | Receives HTTP requests, validates input, writes to PostgreSQL, enqueues BullMQ jobs. Stateless and horizontally scalable. |
| **BullMQ Worker** (`worker.js`) | Long-running process that consumes jobs from Redis, dispatches to the correct handler (email / push / SMS / hash / resize), and handles retries + DLQ. |
| **PostgreSQL** (`src/db.js`) | Source of truth for notification records. Stores recipient, payload, status, idempotency key, and timestamps. Auto-creates schema on startup. |
| **Redis** | BullMQ job store and broker. Holds waiting/active/completed/failed job states. |
| **Piscina Thread Pools** (`hash-pool.js`, `image-pool.js`) | Offloads CPU-intensive work (pbkdf2 hashing, sharp image resize) to worker threads so the main event loop never blocks. |
| **Job Scheduler** (`schedules.js`) | Registers cron-based recurring jobs (e.g. daily digest at 09:00 UTC). |
| **Bull Board Dashboard** | Web UI to visualize queue depth, retry failed jobs, and inspect the DLQ. Protected by Basic Auth. |

---

## Request Lifecycle

Here is what happens when a client calls `POST /notify`:

1. **Auth** — `x-api-key` header is verified with constant-time comparison.
2. **Rate limit** — Request is checked against the per-IP window limit.
3. **Validation** — Body is validated against a Zod schema (`notifySchema`).
4. **Persist** — A row is inserted into `notifications` with an `idempotency_key`. If the key already exists, the existing record is returned (duplicate detection).
5. **Enqueue** — A BullMQ job (`send-email`) is pushed to Redis with a deterministic `jobId`.
6. **Respond** — API immediately returns `{ status: "queued", id }` to the client.
7. **Process** — The worker picks up the job, sends the email, then updates the notification status to `sent` (or moves to DLQ on permanent failure).

---

## Tech Stack & Rationale

| Technology | Role | Why it was chosen |
|------------|------|-------------------|
| **Node.js / Express** | API server | Fast, familiar, non-blocking I/O for HTTP handling. |
| **BullMQ + Redis** | Job queue | Persistent, retryable, priority-aware queues with built-in concurrency and delay scheduling. |
| **PostgreSQL (pg)** | Notification store | ACID transactions, unique idempotency index, JSONB payloads. |
| **Piscina** | Worker thread pools | Runs CPU-heavy `pbkdf2` and `sharp` in separate threads without blocking the event loop. |
| **Zod** | Request validation | Type-safe schema validation with clear error messages. |
| **Nodemailer** | Email transport | SMTP client with Mailtrap sandbox support for safe local testing. |
| **Bull Board** | Queue dashboard | Operational visibility into job states without building a custom admin UI. |
| **Docker / Compose** | Containerization | Reproducible local dev environment with Redis + PostgreSQL. |

---

## Database Schema

On startup, `src/db.js` runs this migration automatically:

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  type        TEXT NOT NULL,          -- email | push | sms
  recipient   TEXT,
  payload     JSONB,                  -- subject, message, etc.
  status      TEXT NOT NULL DEFAULT 'queued',
  error       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_idem_key
  ON notifications (idempotency_key);
```

**Status lifecycle:** `queued` → `retrying` (on transient failure) → `sent` (success) or `dead` (exhausted retries / unrecoverable error).

---

## Design Decisions & Trade-offs

| Decision | Reasoning | Trade-off |
|----------|-----------|-----------|
| **Async queue instead of inline sending** | Prevents slow SMTP/SMS providers from blocking the API. | Adds eventual consistency; client doesn't know immediately if delivery succeeded. |
| **Idempotency keys** | Guarantees at-least-once semantics without duplicate notifications. | Clients must generate and store unique keys. |
| **BullMQ over in-memory queue** | Jobs survive restarts; supports retries, delays, and DLQ. | Requires operating Redis. |
| **Piscina thread pools** | `pbkdf2` and `sharp` are CPU-bound and would block Node's single thread. | Extra memory for thread pools; slight serialization overhead. |
| **Fail-closed auth** | If `API_KEY` is missing, all routes return 500 instead of opening access. | Misconfigured env blocks the API until fixed. |
| **UnrecoverableError** | Missing fields or path-traversal attempts are not retried; they go straight to DLQ. | Requires correct error typing in job handlers. |
| **Graceful shutdown** | `SIGINT`/`SIGTERM` closes worker, pools, and DB connections before exit. | Slightly more complex process lifecycle. |

---

## Scalability & Production Considerations

- **Stateless API** — `server.js` stores no local state; you can run multiple replicas behind a load balancer.
- **Worker concurrency** — Tunable via `WORKER_CONCURRENCY`. Increase if workers are I/O-bound (waiting on SMTP/SMS).
- **Thread pools** — `HASH_MAX_THREADS` and `IMAGE_MAX_THREADS` cap CPU-heavy concurrency so the server doesn't overload.
- **Rate limiting** — `express-rate-limit` protects against brute-force and spam.
- **Redis single point of failure** — In production, use Redis Cluster or a managed Redis with failover.
- **Database connections** — `pg` Pool with `max` and `idleTimeoutMillis` prevents connection exhaustion.
- **Graceful shutdown** — Critical for zero-detployment deployments (Kubernetes `SIGTERM`).

---

## Security

- **API key auth** — `crypto.timingSafeEqual` prevents timing attacks on `x-api-key`.
- **Dashboard auth** — Basic Auth with hashed comparison; returns `401` + `WWW-Authenticate` header.
- **Path traversal protection** — Resized images are resolved inside `./images` only; `../../.env` style attacks are rejected.
- **Fail-closed** — Missing credentials refuse access rather than allowing it.
- **Input validation** — Zod schemas bound string lengths and reject malformed payloads.

---

## Future Improvements

- [ ] Add unit + integration tests (Jest / supertest)
- [ ] Add request tracing IDs and structured logging (Pino)
- [ ] Add Prometheus metrics for queue depth, job duration, error rate
- [ ] WebSocket / SSE endpoint for real-time delivery status
- [ ] Multi-channel fallback (email → push → SMS)
- [ ] Kubernetes manifests + Helm chart
- [ ] Scheduled digest aggregation (batch multiple notifications into one email)

---

## License

ISC