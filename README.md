# Моя учёба

Офлайн-first учебный органайзер для школьников и студентов: расписание, задания, оценки и подготовка к занятиям в одном месте.

Позиционирование: **«Моя учёба — расписание, задания, оценки и подготовка к занятиям в одном месте»**.

## Stack

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript strict
- Expo Router
- SQLite (`expo-sqlite`)
- Jest + ESLint
- Android-first, RuStore-first

## Commands

```bash
npm install
npm start
npm run android
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo-doctor
```

## Architecture

```
app/                 # Expo Router navigation shell
src/
  components/        # Shared UI building blocks
  db/                # SQLite connection, migrations, repositories
  features/          # Screen-level feature modules
  hooks/             # React hooks
  services/          # App services for UI consumption
  types/             # Domain types
  utils/             # Date/time/week-cycle/validation utilities
```

Principles:

- UI ≠ repository ≠ database ≠ domain calculations
- UUID/text IDs for domain entities (backup/import friendly)
- Bind parameters for all SQL
- Transactions for multi-row writes

## Database and migrations

- Versioned migration system via `schema_migrations`
- `PRAGMA foreign_keys = ON` on bootstrap
- Idempotent bootstrap with singleton connection promise (concurrent-open protection)
- Migration version **1** — initial schema

### Tables

`app_settings`, `study_periods`, `teachers`, `subjects`, `schedule_entries`, `schedule_exceptions`, `assignments`, `assignment_photos`, `grades`, `attendance`, `focus_sessions`, `holidays`, `schema_migrations`

### Classroom decision

There is **no** separate `classrooms` table. Room/cabinet values are stored as nullable `room` text snapshots on `schedule_entries` and `schedule_exceptions`. This keeps Phase 1 simpler while still supporting room changes via exceptions.

### Week cycle

Two-week schedules use `cycle_anchor_date` in `app_settings` plus abstract `CYCLE_0` / `CYCLE_1` values on `schedule_entries`. UI labels like «числитель/знаменатель» are not baked into calculations.

## Current phase

**Phase 1 — Foundation + Data Model**

Implemented:

- Project bootstrap and Android package config
- SQLite schema and repositories
- Date/time/week-cycle utilities with tests
- 5-tab navigation shell
- Today screen foundation (date, placeholders, assignments preview hook)

Not implemented yet (later phases):

- Full schedule UI
- Assignment create/edit flows
- Grades analytics
- Pomodoro
- Share / backup / ads / analytics

## Development seed

`src/db/seed.ts` contains a **development-only** helper. It is not called during production bootstrap.

## Two-computer workflow

GitHub is the single source of truth between Cursor (remote) and Codex (local).

| Machine | Path |
|---------|------|
| Remote Cursor | `D:\PetProject\myLearnRuStore` |
| Local Codex | `D:\petProject\myLearnRuStore` |

After each major phase:

1. Run all checks
2. Create one meaningful commit
3. Push to `origin/main`
4. Report starting and final commit hashes

Repository: https://github.com/alex1c/myLearnRuStore

## Package

- Android package: `com.calculatorplatform.mylearn`
- App name: `Моя учёба`
- Version: `1.0.0`
- Version code: `1`
