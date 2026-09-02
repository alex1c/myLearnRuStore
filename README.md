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
  context/           # AppDataContext with refresh
  services/          # occurrence, today, schedule-data services
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
- Migration version **3** — grade scale per subject, attendance target, grade-assignment link

### Tables

`app_settings`, `study_periods`, `teachers`, `subjects`, `schedule_entries`, `schedule_exceptions`, `assignments`, `assignment_photos`, `grades`, `attendance`, `focus_sessions`, `holidays`, `schema_migrations`

### Classroom decision

There is **no** separate `classrooms` table. Room/cabinet values are stored as nullable `room` text snapshots on `schedule_entries` and `schedule_exceptions`. This keeps Phase 1 simpler while still supporting room changes via exceptions.

### Week cycle

Two-week schedules use `cycle_anchor_date` in `app_settings` plus abstract `CYCLE_0` / `CYCLE_1` values on `schedule_entries`. UI labels like «числитель/знаменатель» are not baked into calculations.

## Current phase

**Phase 5 — Focus, Time Statistics & Share/Export**

Implemented:

- Focus timer with timestamp-based countdown (survives background)
- Pause/resume, early finish with save prompt, restart recovery
- Focus history (today) and delete
- Study time statistics (today / 7 / 30 / all) with weekly activity bars
- Share: today, week, lesson, assignment, tomorrow homework, grade progress, focus stats
- Schedule export (JSON `myLearnScheduleExport` v1) and import with preview
- Duplicate import detection via `schedule_import_history`
- Migration v5: `active_focus_session`, import history, focus indexes

Not implemented yet (Phase 6+):

- Backup/restore
- AppMetrica / Yandex Ads
- Native widget
- Image share cards (text share fallback always available)

### Focus timer semantics

- Remaining time derived from `startedAt`, `accumulatedPauseMs`, and clock — not interval counters
- Completed sessions stored in `focus_sessions.duration_seconds`
- Active in-progress state in singleton `active_focus_session`

### Share vs export

- **Share** — human-readable text for messaging apps
- **Export** — machine-readable recurring schedule templates (`myLearnScheduleExport` v1)

### Assignment lifecycle (Phase 3)

1. Quick add: subject → text → due date → save
2. Optional: time, type, priority, notes, photos, reminder
3. Complete toggles status + cancels notification
4. Undo restores status + reschedules future reminders
5. Delete removes DB rows + best-effort photo cleanup

### Deadline semantics

- `due_time = NULL` → deadline is end of local calendar day
- `due_time` set → overdue after that local time
- Domain helpers: `isAssignmentOverdue()`, `getAssignmentDeadlineState()`

### Notification model

- User intent stored in `assignment_reminders` (kind, relative/absolute config)
- Platform `notification_id` is ephemeral — reconciled on bootstrap
- Permission requested only when user enables a reminder
- Tap opens assignment via `assignmentId` payload

### Photo storage

Photos copied to `documentDirectory/assignment-photos/<assignmentId>/<uuid>.jpg` via `expo-file-system/legacy`. External `content://` URIs are never persisted.

### Source occurrence

`assignments.source_occurrence_date` stores the lesson date when created from a specific occurrence (migration v2).

### Occurrence service (Phase 2)

`src/services/occurrence.service.ts` resolves runtime lessons from:

1. weekday + week cycle parity
2. `schedule_exceptions` (cancel, override, reschedule, one-off ADDED)
3. `holidays` (suppress regular lessons; ADDED still shown)

Occurrence identity: `scheduleEntryId:occurrenceDate` or `added:exceptionId`.

### Cycle UI mapping

| Domain | UI (Russian) |
|--------|----------------|
| `CYCLE_0` | Числитель |
| `CYCLE_1` | Знаменатель |
| `EVERY_WEEK` | Каждую неделю |

Anchor is computed from user's «current week» selection during onboarding.

## Exception rules (Phase 2)

- Regular `schedule_entries` are never mutated for one-day changes
- `CANCELLED` hides an occurrence on a specific date
- `TIME_CHANGE` with room/teacher fields overrides that occurrence
- `ADDED` creates a one-off lesson (shown even during holidays)
- Holidays suppress regular lessons only

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
