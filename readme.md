# ConduitPay Conditional Transfers

This document describes the architecture decisions made for a backend that allows users to create **conditional transfer orders**.  
Orders are executed only when a target exchange rate condition is met. The system integrates with the **ConduitPay API** for quotes and transaction creation, ensuring **idempotency** and reliability.

---

## Database

An external database hosted on **PostgreSQL** stores the internal state of the server.

### Tables

- **orders**
  - `order_id`
  - `from_currency`
  - `to_currency`
  - `amount`
  - `target_rate`
  - `direction`
  - `expires_at`
  - `status`
  - `attempts`
  - `last_attempted_at`
  - `idempotency_key` (unique)

- **transactions**
  - `tx_id`
  - `order_id`
  - `conduit_transaction_id`
  - `status`
  - `quote_rate`
  - `raw_response`

---

## Technology Stack

- **Language**: TypeScript  
- **Runtime**: Node.js  
- **Framework**: NestJS  
- **Database**: PostgreSQL  
- **Cache/Locking**: Redis  
- **Queue Broker**: Google PubSub

The system is built with **feature-based modular design**, organizing code and assets around specific functionalities for scalability and maintainability.

### Created Modules

- **App Module**  
- **Orders Module**  
- **Transactions Module**  
- **Auth Module**  
- **Worker Module**  
- **Metrics Module**

---

## Redis Setup

- `order:cache:{order_id}` → order state (TTL ~ 30s) 
- `order:rate:{order_id}` → order rate to throttle requests to API (TTL ~ 60s) 
- `user:{user_id}` → user data (TTL ~ 3600s )
- `order:lock:{order_id}` → distributed lock (short TTL)  
- `idempotency:{key}` → prevents duplicate transaction execution  

---

## API Endpoints

- `POST /orders`  
  Create order → persist to DB, cache, publish message  

- `GET /orders/{id}`  
  Fetch order (Redis first, fallback DB)  

- `POST /orders/{id}/cancel`  
  Cancel an order  

---

## Pub/Sub Flow

1. On order creation, publish `OrderCheckMessage { order_id }`  
2. Worker consumes messages  
3. Worker acquires Redis lock → fetch order state  
4. If expired/cancelled → update + ack   
5. Else → fetch rate from ConduitPay Quote API  
6. If condition met →  
   - Call **Create Transaction** with `idempotency_key`  
   - Update DB + cache → ack  
7. If condition not met → requeue  
8. If validation error → nanck  

---

## Reliability

- Lock when starting transfer with **Redis** to avoid duplicate processing.  
- If error is caused by an **invalid payload**, remove the message from the queue to prevent retries.  


### Low Latency

- Store frequently accessed data (e.g., **orders** and **user details**) in **Redis cache** to reduce database load and improve response times.  
- Store **exchange rates** in cache for **60 seconds** to avoid API throttling and redundant external calls.  


### Idempotency
- Every ConduitPay call uses `idempotency_key`  
- Store results in DB + Redis (`idempotency:{key}`)  
- Retries always check Redis first before calling ConduitPay  

### Retry
- Transient errors → exponential backoff (1m → 2m → 4m)  
- Permanent errors → mark FAILED  

### Low Latency
- Store db 
- Transient errors → exponential backoff (1m → 2m → 4m)  
- Permanent errors → mark FAILED  
---

## Observability

- **Metrics (Prometheus)**  
  - Orders created / executed / expired / failed  
  - Worker attempts per minute  
  - API latency & error rates  

- **Structured Logs (JSON)**  
  - Includes `order_id`, status, and event type  

---

## Demo Script

**Endpoint:**  
`POST /conditional-transfers/`

**Payload:**  
```json
{
  "from_currency": "USDT",
  "to_currency": "USDC",
  "from_network": "ethereum",
  "to_network": "ethereum",
  "amount": "20.00",
  "target_rate": "0.9200000000",
  "direction": ">=",
  "idempotency_key": "idem-12351-unique-key",
  "user_id": "f8a3e3a9-5678-41e9-8123-abcdef987654",
  "expires_at": "2025-09-20T10:00:00Z"
}
```

## Future improvements

- Add prometheus metrics
- Validate input on create order creating quote with Conduit API 
- 


