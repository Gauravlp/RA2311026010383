# Notification System Design

## Stage 1
### REST API Design
Core actions supported: Create Notification, Fetch User Notifications, Mark Notification as Read.

**1. Fetch Notifications**
- **Endpoint**: `GET /api/v1/notifications`
- **Headers**: `Authorization: Bearer <token>`
- **Query Params**: `page` (int), `limit` (int), `unread_only` (boolean)
- **Response**:
  ```json
  {
    "notifications": [
      {
        "id": "d146095a...",
        "type": "Result",
        "message": "mid-sem",
        "timestamp": "2026-04-22T17:51:30Z",
        "isRead": false
      }
    ],
    "meta": { "total": 15, "page": 1 }
  }
  ```

**2. Mark as Read**
- **Endpoint**: `PATCH /api/v1/notifications/:id/read`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `204 No Content`

**3. Create Notification (Internal/Admin)**
- **Endpoint**: `POST /api/v1/notifications`
- **Payload**: `{ "userId": "1042", "type": "Event", "message": "Techfest!" }`

## Stage 2
### Database Selection & Schema
**Storage Choice**: PostgreSQL. 
*Reasoning*: Relational databases are excellent for structured data where consistency matters. With 5M notifications, PostgreSQL handles indexing efficiently, but partitioned tables might be necessary as volume scales. NoSQL (like MongoDB) is also viable for write-heavy appends but PostgreSQL provides rich querying and immediate consistency.

**Schema (PostgreSQL)**:
```sql
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studentID INT NOT NULL,
    notificationType notification_type NOT NULL,
    message TEXT NOT NULL,
    isRead BOOLEAN DEFAULT false,
    createdAt TIMESTAMP DEFAULT NOW()
);
```
*Problems at Scale*: Slow queries for high offsets, index bloat, large table scans for unread.
*Solutions*: Table partitioning by time, Redis caching for recent unread counts.

## Stage 3
### Query Optimization

**Original Query:**
`SELECT * FROM notifications WHERE studentID = 1042 AND isRead = false ORDER BY createdAt DESC;`

**Why is it slow?**
Without a composite index on `(studentID, isRead, createdAt DESC)`, the DB has to perform a full table scan or sort the filtered results in memory which is computationally expensive for 5,000,000 records.

**Another Developer's Advice (Indexes on every column):**
This is terrible advice. Putting indexes on *every* column causes severe write-amplification (Inserts/Updates become very slow and use massive disk space) because every index tree needs to be updated per insert.

**Optimized Query (Targeting Placement Notifications in Last 7 Days):**
```sql
SELECT * FROM notifications 
WHERE notificationType = 'Placement' 
  AND createdAt >= NOW() - INTERVAL '7 days';
```
*Note*: This requires a specific composite index: `CREATE INDEX idx_placement_recent ON notifications(notificationType, createdAt);`

## Stage 4
### Performance Improvements for Page Loads
Fetching directly from the DB on every page load overwhelms the database.

**Solutions & Tradeoffs:**
1. **Redis Caching**: Cache the top 20 latest notifications per user. 
   - *Tradeoff*: Data duplication, memory costs, complex cache-invalidation logic on read.
2. **Pagination / Cursor-based Fetching**: Switch from Offset-based to Cursor-based. 
   - *Tradeoff*: Harder to implement UI "jump to page" links.
3. **WebSockets Server-Push**: Use SSE or WebSockets to push counts instead of polling.
   - *Tradeoff*: High connection overhead, requires scaling socket servers.

## Stage 5
### Notify All Weakness & Redesign
**Shortcomings:**
The pseudo-code is fully synchronous, sequential, and lacks transactional guarantees. If `send_email` fails at iteration 200, the function aborts. Remaining 49,800 students get nothing, and it's impossible to safely retry without duplicate emails for the first 200.

**Redesign (Event-Driven Async Approach):**
```python
function notify_all(student_ids, message):
    # 1. Bulk Insert into DB for speed (1 query instead of 50k)
    bulk_save_to_db(student_ids, message)
    
    # 2. Push message identifiers to a Message Broker (e.g. RabbitMQ)
    for chunk in chunked(student_ids, 1000):
        publish_to_message_queue(chunk, message)

function queue_worker(job):
    try:
        send_email_bulk(job.student_ids, job.message)
        push_to_app_bulk(job.student_ids, job.message)
    except Exception:
        retry_job(job)  # Fails safely
```

## Stage 6
### Priority Inbox
Implemented via an in-memory Min-Heap pattern in Node.js (see `campus_notifications/priority_queue.ts`). Space complexity is O(K) where K=10.
