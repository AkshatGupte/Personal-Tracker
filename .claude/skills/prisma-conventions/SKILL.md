---
name: prisma-conventions
description: Use when creating or modifying the Prisma schema, running migrations, or writing database queries in this project.
---

# Prisma Conventions

- Never edit the SQLite `.db` file directly — always change `schema.prisma` first
- After any schema change, run:
npx prisma migrate dev --name <short-descriptive-name>

- After migrating, regenerate the client:
npx prisma generate

- Field names: camelCase, must exactly match `docs/SCHEMA.md`
- Never delete or edit a migration file that's already been applied —
  create a new migration instead
- If `docs/SCHEMA.md` and the actual Prisma schema drift apart, update
  `docs/SCHEMA.md` to match and note it in `docs/DECISIONS.md`
