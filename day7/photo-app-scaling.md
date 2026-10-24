# SnapShare — Photo-App Scaling Plan (Day 7)

## 1. Assumptions

| Assumption | Value |
|---|---|
| Registered users | 10,000,000 |
| Daily active user rate | 10% of registered |
| Photos uploaded per active user per day | 1 |
| Feed pages viewed per active user per day | 50 |
| Average raw photo size | 2 MB |
| Average thumbnail size | 50 KB |
| Peak traffic multiplier | 5× average |
| Days per year | 365 |

**Daily Active Users (DAU):** 10,000,000 × 10% = **1,000,000 DAU**

---

## 2. Load Estimates

### Uploads per Second

| Metric | Value |
|---|---|
| Total daily uploads | 1,000,000 |
| Average uploads/sec | **11.57** |
| Peak uploads/sec (5×) | **57.87** |

_Calculation: 1,000,000 ÷ 86,400 seconds = 11.57 avg → 11.57 × 5 = 57.87 peak_

### Feed Views per Second

| Metric | Value |
|---|---|
| Total daily feed views | 50,000,000 |
| Average feed views/sec | **578.70** |
| Peak feed views/sec (5×) | **2,893.52** |

_Calculation: 50,000,000 ÷ 86,400 = 578.70 avg → 578.70 × 5 = 2,893.52 peak_

### Storage per Year

| Component | Daily | Yearly |
|---|---|---|
| Raw photos (2 MB each) | 1,953.13 GB | **696.18 TB** |
| Thumbnails (50 KB each) | 48.83 GB | **17.40 TB** |
| **Total** | **2,001.96 GB** | **~713.58 TB** |

_Calculation: 1,000,000 × 2 MB × 365 = 730,000,000 MB = 712.89 GB → 696.18 TB for raw photos. Thumbnails: 1,000,000 × 50 KB × 365 = 36,500,000 MB → 17.40 TB. Combined ≈ **713.58 TB per year**._

---

## 3. Read-Heavy vs Write-Heavy

**SnapShare is a read-heavy system.**

The read-to-write ratio is **50:1** — for every 1 upload (write), there are 50 feed page views (reads). This fundamentally shapes the architecture:

- **Read replicas** handle the overwhelming majority of database load (feed queries).
- **Cache (Redis)** is critical — without it, the primary database would be saturated by feed reads.
- **CDN** serves 90%+ of photo/thumbnail requests at the edge, never hitting origin.
- **App servers** scale out for reads; upload capacity (11.57 writes/sec) is trivial.
- **Write path** can use a single primary database — no sharding needed at this scale.

---

## 4. Why Photos Should Not Be Stored in the Database

Storing binary photo files (BLOBs) inside a relational database is a performance anti-pattern:

1. **Database bloat** — 713 TB of binary data makes backups, replicas, and recovery exponentially slower and costlier.
2. **Network waste** — every photo fetch consumes database connection bandwidth that should serve query results, not payloads.
3. **No built-in optimization** — databases can't transcode, resize, or deduplicate binary content.
4. **Scaling limits** — databases are hard to shard horizontally for large blobs; object storage is built for petabyte-scale horizontal growth.
5. **Cost** — database storage is orders of magnitude more expensive per GB than S3-like object storage.

**Where photos belong:** **Object storage** (e.g., Amazon S3). Object storage provides horizontal scale, 11-nines durability, lifecycle policies, CDN integration, and a fraction of the cost. The database stores only metadata — user ID, S3 key, upload timestamp, dimensions, and thumbnail URL.

---

## 5. Architecture Diagram
                          USERS
              [Mobile Apps]  [Web Browsers]
                     │              │
               HTTPS │              │ HTTPS
                     ▼              ▼
                ┌───────────────────────────────┐
                │          CDN (CloudFront)     │
                │  Serves cached photos & thumbs│
                │  from edge locations globally │
                └───────────────┬───────────────┘
                                │
                ┌───────────────▼───────────────┐
                │       Load Balancer (ALB)     │
                │  Distributes traffic, SSL term│
                └──┬────────────┬───────────────┘
                   │            │
      ┌────────────▼──┐ ┌───────▼──────────┐
      │  App Server 1 │ │  App Server 2    │
      │  (REST API)   │ │  (REST API)      │
      │               │ │                  │
      │ • Upload API  │ │ • Feed API       │
      │ • Auth        │ │ • User API       │
      └──┬────────────┘ └──┬───────────────┘
         │       │         │
  ┌──────▼──┐ ┌──▼─────────▼──────┐  ┌──────────────────┐
  │  Cache  │ │   Database        │  │      Queue       │
  │(Redis)  │ │   (Primary)       │  │  (SQS/RabbitMQ)  │
  │         │ │                   │  │                  │
  │ • Feed  │ │ • Users           │  │ • Thumbnail jobs │
  │   pages │ │ • Photo metadata  │  │ • Events         │
  │ • Users │ │ • Follows         │  └──────┬───────────┘
  └─────────┘ └───┬───────────────┘         │
                  │              ┌──────────▼──────────┐
                  │              │  Worker             │
                  │              │  (Thumbnail Gen)    │
                  │              │                     │
                  │              │ • Resize 2MB → 50KB │
                  │              │ • Upload to S3      │
                  │              │ • Update DB         │
                  │              └────────┬────────────┘
                  │                       │
          ┌───────▼───────────────────────▼───────────┐
          │               READ REPLICAS               │
          │  Offload feed queries from primary        │
          └───────────────────────────────────────────┘

          ┌────────────────────────────────────────────┐
          │           OBJECT STORAGE (S3)              │
          │  Raw photos  │  Thumbnails  │  Metadata    │
          └────────────────────────────────────────────┘

---

## 6. Component Breakdown (One Sentence Each)

| Component | Problem It Solves |
|---|---|
| **CDN** | Delivers photos and thumbnails from edge servers closest to users, reducing latency to under 100 ms and offloading 90%+ of read traffic from the origin. |
| **Load Balancer** | Distributes incoming HTTP requests evenly across app server instances, performs health checks, and terminates SSL so app servers handle only plaintext traffic. |
| **App Servers** | Host the REST API (upload, feed, auth) and scale horizontally to absorb traffic spikes without downtime. |
| **Cache (Redis)** | Stores hot feed pages, user profiles, and session data in memory, reducing database query volume by ~80% and serving responses in under 10 ms. |
| **Database (Primary)** | Serves as the source of truth for all write operations — users, photo metadata, and follow relationships — while read replicas handle reads. |
| **Read Replica** | Offloads the read-heavy feed queries from the primary database, allowing uploads to stay fast while thousands of users scroll simultaneously. |
| **Object Storage (S3)** | Stores raw photo files and thumbnails at petabyte scale with built-in durability, lifecycle policies, and seamless CDN integration at a fraction of DB storage cost. |
| **Queue** | Decouples the upload API from thumbnail generation so the API returns immediately and thumbnail jobs are processed at a controlled rate without blocking users. |
| **Worker** | Consumes queue jobs to resize raw photos into 50 KB thumbnails, uploads them to S3, and updates the database with the thumbnail URL — all asynchronously. |

---

## 7. Upload Flow — Step by Step

1. **User selects a photo** from their device camera roll or captures a new one within the SnapShare mobile or web app.

2. **Client authenticates** the request by attaching a valid JWT or session token in the HTTP Authorization header.

3. **Client uploads the raw photo (2 MB)** via a POST to `/api/upload`, routed through the load balancer to an available app server.

4. **App server validates** the request — checking file type (JPEG/PNG/WebP only), size limits (max 25 MB), and user upload quota. Invalid uploads return a 400 error immediately.

5. **App server uploads the raw photo to Object Storage (S3)** under a unique key such as `uploads/{user-id}/{uuid}.jpg` with private ACLs.

6. **App server inserts photo metadata** into the primary database — storing user ID, S3 key, upload timestamp, dimensions, and file size (but **not** the binary data).

7. **App server enqueues a thumbnail job** to the message queue, including the S3 key, user ID, and desired thumbnail dimensions.

8. **App server returns `202 Accepted`** to the client with the photo's metadata ID, so the user sees a "Processing…" state instantly rather than waiting.

9. **A worker picks up the queue job** — if the queue is backed up, the job waits until a worker is available; if idle, processing begins immediately.

10. **Worker downloads the raw photo from S3**, resizes it to create a 50 KB thumbnail (using a library like Sharp or ImageMagick), and uploads the thumbnail back to S3 under `thumbnails/{user-id}/{uuid}_thumb.jpg`.

11. **Worker updates the database** with the thumbnail URL in the photo's metadata record.

12. **Worker signals completion** (optional) — the new photo is now live and will appear in followers' feeds on their next page refresh.

---

## 8. Trade-Offs

### Trade-off 1: Cache Invalidation vs. Feed Freshness

**Decision:** Use a short TTL (5–10 seconds) on cached feed pages rather than implementing complex write-through cache invalidation.

**Rationale:** Cache hits are essential given the 50:1 read-to-write ratio — without caching the database would be saturated. A short TTL keeps the cache effective while limiting stale data to ~10 seconds, which is acceptable for a social feed. The alternative — invalidating caches on every upload — adds significant complexity and risks cache stampedes during peak times, with marginal UX benefit since social feeds are inherently "best effort" rather than real-time.

### Trade-off 2: Synchronous vs. Asynchronous Thumbnail Generation

**Decision:** Use an asynchronous queue-based approach rather than generating thumbnails synchronously within the upload API request.

**Rationale:** Synchronous generation would add 2–5 seconds to the upload response time, making the user experience feel sluggish. The queue-based approach returns in under 100ms (step 8 above), giving the user a snappy experience while thumbnails are generated in the background. The alternative — simpler synchronous generation — would save engineering effort but directly increases upload latency, consumes more app server resources per request, and creates a failure risk during upload spikes.

### Trade-off 3: Single Primary DB vs. Database Sharding

**Decision:** Start with a single primary database plus read replicas, deferring sharding until the dataset exceeds ~100 million photos.

**Rationale:** At 11.57 writes per second, a single well-provisioned primary database handles writes with ease. Read replicas handle the feed queries. Sharding adds massive operational complexity — cross-shard queries, rebalancing, data migration — that is unjustified at current scale. The alternative — sharding from day one — would complicate feed ordering (which requires data from multiple users) and add overhead for no measurable benefit yet.
