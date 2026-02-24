---
paths:
  - "src/lib/db/__tests__/**"
---
# Use Drizzle for TRUNCATE in Tests

Use `db.execute(sql`TRUNCATE ...`)` for database cleanup in tests, not `pool.query()`.

Drizzle's `db.execute()` and `pool.query()` use different connection management paths. Mixing them causes FK violations because operations may run on different connections with different transaction states.

## Bad

```typescript
await pool.query('TRUNCATE videos CASCADE')
```

## Good

```typescript
await db.execute(sql`TRUNCATE videos CASCADE`)
```
