# TicketHub — Event Ticketing System Design

## Part 1: Requirements

### Functional Requirements
1. **User Management:** Register, log in, view profile.
2. **Event Browsing:** Browse events by date, category, and location.
3. **Seat Selection:** View a seat map for an event and pick individual seats.
4. **Seat Holding:** Hold selected seats for 10 minutes while paying.
5. **Ticket Purchase:** Pay for held seats and receive digital tickets with QR codes.
6. **Ticket History:** View past purchases and re-download tickets.

### Non-Functional Requirements
1. **Correctness (no double booking).** The single hardest constraint: a given seat may be sold to exactly one buyer, ever, even when 200,000 people click "buy" on the same seat in the same second. Seat inventory is **strongly consistent**; everything else (browsing, ticket history) may be eventually consistent.
2. **Speed.** Seat map renders and hold confirmation complete in under 2 seconds at normal load. During a big sale the site must stay responsive (under 5 seconds) rather than collapse.
3. **Fairness.** Bots and scripts must not monopolize inventory. Admission to the purchase flow is first-come-first-served via a queue, and rate limits plus bot checks gate the hold endpoint.
4. **Availability: 99.9%.** The browsing experience stays up even if the purchase path is throttled. Better to sell nothing than to sell the same seat twice.
5. **Scalability.** Absorb a 4x traffic spike (50k → 200k users) within 10 minutes via horizontal scaling of stateless app servers.

---

## Part 2: Load Estimates

### Normal Day
| Metric | Value |
|---|---|
| Registered users | 2,000,000 |
| Daily active visitors | 50,000 |
| Pages per visitor | 10 |
| Page views/day | 500,000 |
| **Average page views/sec** | **~5.8** (500,000 ÷ 86,400) |
| Peak-hour multiplier (~10x average) | ~58 reads/sec |
| Tickets sold/day | 5,000 |
| **Average purchases/sec** | **~0.06** (5,000 ÷ 86,400) |
| Storage/year (100 bytes/record) | ~183 MB |

The important read: **writes are trivial** at rest. Roughly one purchase every 17 seconds. Nothing about a normal day stresses the database. All the difficulty lives in the peak.

### Big Sale (popular concert)
| Metric | Value |
|---|---|
| Buyers attempting | 200,000 |
| Seats available | 20,000 |
| Window | 10 minutes (600 s) |
| **New connection attempts/sec** | **~333** (200,000 ÷ 600) |
| **Hold attempts/sec** | **~333** worst case |
| **Max confirmed sales/sec** | **~33** (20,000 ÷ 600) |
| Buyers who will not get a seat | 180,000 (**90% failure rate**) |

Real arrivals are not evenly spread — most crowd the first 60 seconds, so instantaneous hold attempts could reach several thousand/sec before the waiting room drains them.

### Comparison
| | Normal | Big sale | Multiplier |
|---|---|---|---|
| Read requests/sec | ~5.8 | ~333+ | **~58x** |
| Write attempts/sec | ~0.06 | ~333 | **~5,700x** |
| Successful writes/sec | ~0.06 | ~33 | **~570x** |

Two conclusions drive the design:
- **Reads scale 58x** → solved cheaply with caching and replicas.
- **Write attempts scale 5,700x but only 33/sec can possibly succeed.** So the goal is not "make the database faster." It is to **shed 99% of write attempts before they reach the database**, which is why a waiting room is mandatory rather than optional.

Storage is negligible either way (~183 MB/year), so no sharding or partitioning for capacity reasons.

---

## Part 3: API Design

| Method | Path | Description | Success |
|---|---|---|---|
| GET | `/api/events` | List upcoming events (paginated, filter by date/category/location) | 200 |
| GET | `/api/events/{id}` | Event details incl. `on_sale_at` | 200 |
| GET | `/api/events/{id}/seats` | Seat map with availability | 200 |
| POST | `/api/queue` | Join waiting room; returns position + admission token | 202 |
| POST | `/api/seats/{id}/hold` | Hold one seat for 10 min | 201 |
| POST | `/api/orders` | Confirm order + charge payment | 201 |
| GET | `/api/users/{id}/tickets` | Ticket history + download links | 200 |

### Key examples

**GET /api/events/101/seats** → 200
```json
{
  "event_id": 101,
  "seat_map_version": "sha:9f2c1a",
  "seats": [
    { "seat_id": 1001, "section": "A", "row": "5", "seat": "12",
      "price": 75.00, "status": "available" },
    { "seat_id": 1002, "section": "A", "row": "5", "seat": "13",
      "price": 75.00, "status": "held", "expires_at": "2026-11-02T19:35:00Z" }
  ]
}
```
Note: availability here is a **hint, not a reservation**. Even perfectly fresh data cannot close the gap between rendering the map and clicking, so a stale "available" simply becomes a 409 at hold time. That asymmetry is what lets this endpoint be aggressively cached.

**POST /api/seats/1001/hold** (auth required; `Idempotency-Key` header required) → 201
```json
{ "seat_id": 1001, "hold_id": "h_8812", "expires_at": "2026-11-02T19:40:00Z" }
```
→ 409 if taken: `{ "error": "seat_taken", "seat_id": 1001, "alternatives": [1003, 1004] }`

**POST /api/orders** (`Idempotency-Key: 7d1e...` required)
```json
{ "seat_ids": [1001, 1003], "payment_method_id": "pm_123" }
```
→ 201
```json
{
  "order_id": 5001, "total": 150.00, "status": "confirmed",
  "tickets": [
    { "seat_id": 1001, "qr_code": "TH-9K2M-XQ41", "price": 75.00 },
    { "seat_id": 1003, "qr_code": "TH-7B8N-ZR03", "price": 75.00 }
  ]
}
```
The idempotency key makes a retried request after a network timeout return the *same* order instead of charging twice.

### Error codes
| Status | Meaning | Body example |
|---|---|---|
| 400 | Invalid input | `{"error":"seat_ids is required"}` |
| 401/403 | Not authenticated / no admission token | `{"error":"admission_token_required"}` |
| 404 | Event or seat missing | `{"error":"seat 9999 not found"}` |
| 409 | Seat already held or sold | `{"error":"seat_taken","seat_id":1001}` |
| 410 | Hold expired | `{"error":"hold_expired","hold_id":"h_8812"}` |
| 429 | Rate limited / bot-like | `{"error":"slow_down","retry_after":30}` |
| 500 | Unexpected failure | `{"error":"internal","request_id":"req_44"}` |

---

## Part 4: Data Model

Five tables (four required + `holds` as an audit trail).

**users** — `id` PK, `username` UNIQUE NOT NULL, `email` UNIQUE NOT NULL, `password_hash` NOT NULL, `created_at`.

**events** — `id` PK, `name`, `venue`, `event_date_time`, `on_sale_at` (when tickets become purchasable), `category`, `city`, `total_seats`, `sales_mode ENUM('open','queued')`.

**seats** — the correctness-critical table:
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `event_id` | INTEGER FK → events | ON DELETE CASCADE |
| `section`,`row`,`seat_number` | VARCHAR(10) | NOT NULL |
| `price` | DECIMAL(10,2) | NOT NULL |
| `status` | ENUM('available','held','sold') | DEFAULT 'available' |
| `held_by_user_id` | INTEGER FK → users | NULL, ON DELETE SET NULL |
| `held_until` | DATETIME | NULL |
| `version` | INTEGER | optimistic-locking counter |

Constraints: `UNIQUE (event_id, section, row, seat_number)` prevents duplicate seat definitions. The active hold lives **on the seat row itself**, so AVAILABLE → HELD is one atomic statement.

**orders** — `id` PK, `user_id` FK, `total_amount DECIMAL(10,2)`, `status ENUM('pending','confirmed','cancelled','failed')`, `idempotency_key VARCHAR(64) UNIQUE`, `created_at`.

**order_items** — junction: `PRIMARY KEY (order_id, seat_id)`, `price_paid DECIMAL(10,2)`. A seat appears in at most one order because it is part of the composite PK alongside a unique order.

**holds** — append-only audit: `id` PK, `seat_id`, `user_id`, `created_at`, `expires_at`, `released_at`, `outcome ENUM('converted','expired','abandoned')`. Never used for correctness decisions.

### Relationships
- users → orders: one-to-many
- events → seats: one-to-many
- orders → order_items: one-to-many
- seats → order_items: one-to-many, but a seat lands in at most one confirmed order
- users → seats (current holds): one-to-many; each seat held by at most one user at a time

### CREATE TABLE
```sql
CREATE TABLE seats (
  id               INTEGER PRIMARY KEY AUTO_INCREMENT,
  event_id         INTEGER NOT NULL,
  section          VARCHAR(10) NOT NULL,
  row_label        VARCHAR(10) NOT NULL,
  seat_number      VARCHAR(10) NOT NULL,
  price            DECIMAL(10,2) NOT NULL,
  status           ENUM('available','held','sold') NOT NULL DEFAULT 'available',
  held_by_user_id  INTEGER NULL,
  held_until       DATETIME NULL,
  version          INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (held_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_seat (event_id, section, row_label, seat_number),
  KEY idx_event_status (event_id, status),
  KEY idx_held_until (status, held_until),
  CONSTRAINT chk_hold_shape CHECK (
    (status = 'held' AND held_by_user_id IS NOT NULL AND held_until IS NOT NULL)
    OR (status <> 'held')
  )
);

CREATE TABLE orders (
  id              INTEGER PRIMARY KEY AUTO_INCREMENT,
  user_id         INTEGER NOT NULL,
  total_amount    DECIMAL(10,2) NOT NULL,
  status          ENUM('pending','confirmed','cancelled','failed')
                  NOT NULL DEFAULT 'pending',
  idempotency_key VARCHAR(64) NOT NULL UNIQUE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE order_items (
  order_id   INTEGER NOT NULL,
  seat_id    INTEGER NOT NULL,
  price_paid DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (order_id, seat_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (seat_id)  REFERENCES seats(id)  ON DELETE RESTRICT
);
```
`chk_hold_shape` makes an inconsistent row (status `held` with no owner or expiry) impossible at the storage layer, not just in application code. `ON DELETE RESTRICT` on `order_items.seat_id` means a sold seat can never be deleted out from under a paid order.

---

## Part 5: How Double-Booking Is Prevented

This is the heart of the design. Five layers, each catching what the previous one misses.

**Layer 1 — Admission control (waiting room).** At on-sale, buyers join a FIFO queue and receive an admission token that grants a bounded number of hold attempts. Only ~25–30 users/sec are admitted — slightly above the 33 sales/sec the inventory can absorb. This converts a 333+/sec stampede into a rate the database handles calmly. Fairness requirement satisfied: order of arrival decides who buys.

**Layer 2 — Atomic conditional UPDATE.** One statement does check-and-set with no gap between them:
```sql
START TRANSACTION;
UPDATE seats
   SET status = 'held',
       held_by_user_id = 42,
       held_until = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
       version = version + 1
 WHERE id = 1001
   AND status = 'available';
-- affected rows == 1  -> we own the hold
-- affected rows == 0  -> someone else won; ROLLBACK, return 409
COMMIT;
```
The `WHERE status = 'available'` predicate is the guard. Two concurrent transactions cannot both see `available` and both win: the first acquires an exclusive row lock, the second blocks, then re-evaluates its predicate against the committed value (`held`) and matches zero rows. Application code inspects affected-row count — never a prior SELECT. A read-then-write would have a race window; a conditional update does not.

**Layer 3 — Row-level locking + isolation.** InnoDB locks only the touched row, so contention is per-seat, not per-table. 20,000 different seats being fought over do not serialize against each other. `READ COMMITTED` is sufficient because the predicate is re-checked at lock acquisition.

**Layer 4 — Constraints as the final backstop.** `UNIQUE (order_id, seat_id)` plus `chk_hold_shape` plus `ON DELETE RESTRICT` mean that even a logic bug cannot produce two confirmed orders for one seat — the insert fails loudly instead of silently overselling.

**Layer 5 — Hold expiry.** A worker releases stale holds every 30 seconds:
```sql
UPDATE seats
   SET status='available', held_by_user_id=NULL, held_until=NULL
 WHERE status='held' AND held_until < NOW();
```
Without this, abandoned carts permanently lock inventory.

**Order confirmation** runs in one transaction: insert `orders`, insert `order_items`, flip seats `held → sold` (guarded by `AND held_by_user_id = ? AND status = 'held'`). If any guard fails, the whole transaction rolls back and the payment is voided/refunded. Payment is charged **after** the hold is proven, and the idempotency key guarantees retries cannot double-charge.

> Note on Redis: cache is used for seat maps and read fan-out, never as the authority for ownership. Writes go database-first, then the cache is invalidated. Treating Redis as source of truth would trade the one property we cannot lose for speed we can live without.

---

## Part 6: Architecture Diagram

```
                          USERS (200k in a burst)
                     [Web browsers]  [Mobile apps]
                              |            |
                        HTTPS |            | HTTPS
                              v            v
                    +----------------------------------+
                    |   CDN + WAF / bot filtering      |
                    | static assets, seat-map JSON,    |
                    | rate limiting at the edge        |
                    +----------------+-----------------+
                                     |
                    +----------------v-----------------+
                    |   Load Balancer (ALB, multi-AZ)  |
                    | SSL termination, health checks   |
                    +----------------+-----------------+
                                     |
                    +----------------v-----------------+
                    |   API GATEWAY                    |
                    | authn, rate limits, WAITING ROOM |
                    +----------------v-----------------+
                    |   API GATEWAY                    |
                    | authn, rate limits, WAITING ROOM |
                    | admission tokens, idempotency    |
                    +---+----------+----------+--------+
                        |          |          |
             +----------v---+  +---v-------+  +v--------------+
             | Browse Svc   |  | Booking   |  | User/Ticket   |
             | (stateless,  |  | Svc       |  | Svc           |
             |  autoscaled) |  | (holds,   |  |               |
             |              |  |  orders)  |  |               |
             +------+-------+  +-----+-----+  +-------+-------+
                    |                |                |
        +-----------v----+   +-------v--------+       |
        | Redis Cluster  |   | Payment        |       |
        | seat maps,     |   | Gateway        |       |
        | queue state,   |   | (Stripe, etc.) |       |
        | sessions       |   +-------+--------+       |
        +----------------+           |                |
                                     v                v
                          +-----------------------------+
                          |   PRIMARY DB (MySQL/PG)     |
                          | single writer, seats/orders |
                          | row-level locking           |
                          +--+-----------------------+--+
                             |                       |
                  +----------v---------+   +----------v-----------+
                  | READ REPLICAS x3   |   | MESSAGE QUEUE (SQS)  |
                  | event lists, seat  |   | email, receipts,     |
                  | map fan-out        |   | QR gen, hold expiry  |
                  +--------------------+   +----------+-----------+
                                                      |
                                           +----------v-----------+
                                           | WORKERS (autoscaled) |
                                           | emails, expiry sweep,|
                                           | reconciliation loop  |
                                           +----------------------+
```

### Component explanations

| Component | Problem it solves |
|---|---|
| **CDN + WAF** | Serves HTML/CSS/JS and cached seat-map JSON from edge PoPs, so ~90% of the stampede never reaches origin. WAF filters obvious bot traffic before it consumes any compute. |
| **Load Balancer** | Spreads requests across instances, terminates SSL, drains traffic from unhealthy nodes, spans availability zones. |
| **API Gateway / Waiting Room** | The most important box for the big sale. Holds arrivals in a FIFO queue and admits them at a rate the booking path can absorb. Enforces auth, per-user rate limits, and idempotency keys. Turns an unbounded spike into bounded load. |
| **Browse Service** | Read-only event listing and seat maps. Autoscales aggressively; serves from cache/replicas. Can be scaled independently because its failure mode is "stale data," not "wrong data." |
| **Booking Service** | Owns holds and orders — the only service allowed to write seat status. Isolating it means the correctness-critical path has its own connection pool, its own scaling policy, and no noisy neighbors. |
| **User/Ticket Service** | History, downloads, profile. Pure reads, tolerant of staleness. |
| **Redis Cluster** | Sub-millisecond seat maps, waiting-room position tracking, session store, rate-limit counters. Replicated across AZs. Never authoritative for ownership. |
| **Primary Database** | Single writer. Source of truth for seats and orders. Chosen deliberately: one writer makes the double-booking guarantee trivially enforceable. |
| **Read Replicas** | Absorb the 58x read multiplier so browsing never competes with checkout for primary capacity. |
| **Queue** | Decouples email, SMS, QR generation, and receipt delivery from the request path, so a slow SMTP provider cannot make checkout time out. |
| **Workers** | Process queue jobs, run the 30-second expired-hold sweep, and run a reconciliation loop that detects and alerts on any seat whose status contradicts its order rows. |

### How this survives the big sale
1. **Absorb at the edge.** Static assets and seat maps come from CDN/Redis, so the burst mostly dies before origin.
2. **Pace the writes.** The waiting room admits ~25–30 users/sec against 33 sales/sec of inventory throughput — the database sees a manageable trickle, never 333+/sec.
3. **Scale statelessly.** App services are stateless (sessions in Redis), so auto-scaling adds capacity within minutes, satisfying the 4x-in-10-minutes requirement.
4. **Fail gracefully.** If the booking path saturates, it sheds load with 429s while browsing stays fully up. Partial degradation beats total outage, and refusing a sale is always preferable to overselling.

---

## Part 7: Trade-offs

### Trade-off 1 — Hold window (10 min) vs. instant purchase
**Decision:** 10-minute hold with TTL-based auto-release.

**Why:** Checkout involves entering card details, 3-D Secure challenges, and address confirmation. Forcing all of that inside one request means timeouts, failed charges, and abandoned carts — plus you'd be holding a database lock across a third-party payment call, which is how connection pools die.

**Cost paid:** Inventory sits idle during holds. Worst case, if the average buyer takes 6 minutes, effective throughput drops well below the theoretical 33/sec, and scalpers could park seats.

**Mitigation:** short TTL, 30-second expiry sweep, a cap of 4 holds per user per event, and admission tokens that limit how many holds one identity can open. The alternative (no holds) maximizes utilization but measurably hurts conversion and pushes locks across network calls — a worse trade.

### Trade-off 2 — Strong consistency on inventory vs. availability
**Decision:** Seat inventory chooses consistency. If the primary is unreachable, checkout returns 503 rather than serving from a replica.

**Why:** A stale read yields an annoying 409. A stale *write* yields two people with a ticket for seat A12 and a refund nightmare plus reputational damage. Browsing may be stale; selling may not.

**Cost paid:** During a failover window (typically 30–60 seconds), purchases pause even though the site appears up. That dents the 99.9% availability figure for the write path specifically.

**Mitigation:** automated failover with synchronous semi-sync replication to at least one replica so promoted replicas aren't missing committed holds; the reconciliation worker audits for contradictions after every failover. We accept brief write-unavailability as the price of the one invariant we cannot break.

### Trade-off 3 — Single primary vs. sharding seats
**Decision:** One primary now; shard by `event_id` only when measured need appears.

**Why:** Peak demand is ~33 successful writes/sec and maybe a few hundred conditional updates/sec. A single modern instance handles that with headroom. Sharding would force cross-shard coordination for multi-seat carts and make the double-booking guard far harder to reason about.

**Cost paid:** A hard ceiling exists (~10M+ seats or >5k writes/sec). Deferred, not ignored: `event_id` is already the natural shard key, and hot events can later move to dedicated shards. Building that complexity now would be premature optimization with real correctness risk attached.

---

## Part 8: Single Points of Failure

| Risk | Mitigation |
|---|---|
| Load balancer down | Managed ALB across multiple AZs |
| App instance dies | Auto-scaling group, health checks route around failures |
| Primary DB dies | Semi-sync replica + automated promotion (<60 s); writes pause, reads continue |
| Redis node dies | Cluster with cross-AZ replicas; cache misses fall back to replicas |
| Queue/worker loss | SQS redelivery with dead-letter queue; jobs are idempotent |
| Payment provider outage | Circuit breaker; holds survive so users retry without losing seats |
| Bot stampede | Edge rate limits, proof-of-work/token challenge, per-token hold caps |

## Part 9: Monitoring & Verification
- **Oversell alarm:** a nightly + post-failover job asserting `COUNT(order_items) per seat <= 1`. Any violation pages immediately — this is the metric that matters most.
- **Hold leak detector:** held seats past `held_until + 60s` indicate a broken sweeper.
- **Queue depth & admission rate:** confirms the waiting room is actually protecting the DB.
- **p95 latency** on `/hold` and `/orders`, separately tracked from browse latency.
- **Load test target:** replay 200,000 arrivals over 600 seconds against staging and assert zero duplicate seats sold.
