# Operations

## Monitoring & Logging (Production)

### Error tracking (Sentry)
1) Create a Sentry project (Node/Express).
2) Set environment variables:
- `SENTRY_DSN=...`
- `SENTRY_TRACES_SAMPLE_RATE=0.1` (adjust per traffic)

Sentry captures unhandled errors and request context automatically.

### Log aggregation (Logtail)
1) Create a Logtail source.
2) Set:
- `LOGTAIL_TOKEN=...`

All API requests and server errors are logged as structured JSON. Logtail is optional; if not set, logs stay in stdout.

### Metrics (Prometheus)
The backend exposes Prometheus metrics:
- `GET /api/v1/metrics`

Protect it in production by setting:
- `METRICS_TOKEN=your-secret-token`

Then call:
- `GET /api/v1/metrics?token=your-secret-token`
or
- `Authorization: Bearer your-secret-token`

### Health check (Uptime monitoring)
- `GET /api/v1/health` returns `status`, `uptime`, timestamp, and DB connection state.

---

## MongoDB Backups & Restore

### Atlas (current)
Use Atlas automated backups:
1) Enable **Daily Snapshots** in your Atlas cluster (Project → Clusters → Backup).
2) Configure retention (recommended 14–30 days).
3) Test restore monthly:
   - Restore snapshot to a **new** Atlas cluster.
   - Point staging API to the restored cluster and run basic smoke checks.

### Self-hosted (future)
Use the included scripts:
- `backend/scripts/backup_mongo.sh`
- `backend/scripts/restore_mongo.sh`

**Backup (daily)**
```bash
export MONGO_URI="mongodb://user:pass@host:27017/dbname"
export BACKUP_DIR="/var/backups/mongo"
export BACKUP_RETENTION_DAYS=14
./backend/scripts/backup_mongo.sh
```

**Restore (tested monthly)**
```bash
export MONGO_URI="mongodb://user:pass@host:27017/dbname"
./backend/scripts/restore_mongo.sh /var/backups/mongo/mongo_YYYYmmdd_HHMMSS.gz
```

**Cron example (daily at 2:00 AM)**
```cron
0 2 * * * /usr/bin/env MONGO_URI="mongodb://user:pass@host:27017/dbname" \
  BACKUP_DIR="/var/backups/mongo" BACKUP_RETENTION_DAYS=14 \
  /path/to/backend/scripts/backup_mongo.sh >> /var/log/mongo_backup.log 2>&1
```

**Restore validation checklist**
1) Restore into a staging DB.
2) Verify critical collections counts (Users, Inventory, Requests).
3) Run a smoke test (login, view dashboard, submit a request).
4) Document time to restore and issues.
