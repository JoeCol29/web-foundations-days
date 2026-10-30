# TicketHub — Event Ticketing System Design

## Part 1: Requirements

### Functional Requirements
1. **User Management:** Users can register, log in, and view their profile.
2. **Event Browsing:** Users can browse events by date, category, and location.
3. **Seat Selection:** Users can view a map of available seats for a specific event and select individual seats.
4. **Seat Holding:** Users can "hold" a seat for 10 minutes while they proceed to payment.
5. **Ticket Purchase:** Users can pay for held seats and receive a digital ticket with a QR code.
6. **Ticket History:** Users can view their purchase history and download tickets.

### Non-Functional Requirements
1. **Correctness (No Double Booking):** The system must guarantee that no two users can purchase the same seat simultaneously. This is the most critical constraint.
2. **Speed:** Seat selection and payment confirmation must complete in under 2 seconds under normal load. During peak sales, the system must handle 200,000 concurrent connection attempts with an average response time under 5 seconds.
3. **Fairness:** The system must prevent bots and script-based attacks from monopolizing seats. First-come-first-served logic must be enforced fairly.
4. **Availability:** The site must remain up during high-traffic sales events (99.9% uptime).
5. **Scalability:** The system must handle a 4x spike in traffic (from 50k to 200k users) within 10 minutes.

---

## Part 2: Load Estimates

### Normal Day Traffic
| Metric | Value |
|---|---|
| Registered Users | 2,000,000 |
| Daily Active Visitors | 50,000 |
| Pages viewed per visitor | 10 |
| **Average page views/sec** | **~58** |
| Tickets sold per day | 5,000 |
| **Average ticket purchases/sec** | **~0.06** |
| Storage per year (100 bytes per ticket record) | ~1.8 GB |

_Calculation: 50,000 visitors × 10 pages = 500,000 page views/day ÷ 86,400 seconds = 5.78 page views/sec (rounded to 58 for safety margin including API calls). 5,000 tickets/day ÷ 86,400 = 0.058 purchases/sec._

### Big Sale Peak (Popular Concert)
| Metric | Value |
|---|---|
| Users attempting to buy | 200,000 |
| Time window | 10 minutes (600 seconds) |
| Seats available | 20,000 |
| **Peak connection attempts/sec** | **~333** |
| **Peak purchase attempts/sec** | **~33** |
| **Peak successful purchases/sec** | **~3.3** |
| Failed attempts (unsold seats) | 180,000 |
| **Failure rate** | **90%** |

_Calculation: 200,000 users ÷ 600 seconds = 333 connection attempts/sec. Only 20,000 seats available, so 33,333 attempts/sec if distributed evenly, but realistically concentrated in bursts. 20,000 seats ÷ 600 seconds = 33.3 successful purchases/sec max. Actual successful rate is lower due to failed payments and timeouts._

**Comparison:** The big sale creates a **57x increase in connection attempts** (58 → 3,333) and a **550x increase in purchase attempts** (0.06 → 33). The system must handle this surge without crashing or double-booking.

---

## Part 3: API Design

| Method | Path | Description | Success Status |
|---|---|---|---|
| GET | `/api/events` | List upcoming events with pagination | 200 OK |
| GET | `/api/events/{id}` | Get details for a specific event | 200 OK |
| GET | `/api/events/{id}/seats` | View available seats for an event | 200 OK |
| POST | `/api/seats/{id}/hold` | Hold a seat for 10 minutes | 201 Created |
| POST | `/api/orders` | Create an order and process payment | 201 Created |
| GET | `/api/users/{id}/tickets` | View user's purchased tickets | 200 OK |

### Request/Response Examples

#### Viewing Seats (GET /api/events/{id}/seats)

**Response (200 OK):**

```json
{
  "event_id": 101,
  "event_name": "Rock Concert 2025",
  "seats": [
    {
      "seat_id": 1001,
      "section": "A",
      "row": "5",
      "seat": "12",
      "price": 75.00,
      "status": "available"
    },
    {
      "seat_id": 1002,
      "section": "A",
      "row": "5",
      "seat": "13",
      "price": 75.00,
      "status": "held",
      "held_by_user_id": 42,
      "expires_at": "2025-01-15T10:35:00Z"
    }
  ]
}
