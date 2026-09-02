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
- Migration version **5** — focus timer persistence, schedule import history

### Tables

`app_settings`, `study_periods`, `teachers`, `subjects`, `schedule_entries`, `schedule_exceptions`, `assignments`, `assignment_photos`, `grades`, `attendance`, `focus_sessions`, `holidays`, `schema_migrations`

### Classroom decision

There is **no** separate `classrooms` table. Room/cabinet values are stored as nullable `room` text snapshots on `schedule_entries` and `schedule_exceptions`. This keeps Phase 1 simpler while still supporting room changes via exceptions.

### Week cycle

Two-week schedules use `cycle_anchor_date` in `app_settings` plus abstract `CYCLE_0` / `CYCLE_1` values on `schedule_entries`. UI labels like «числитель/знаменатель» are not baked into calculations.

## Current phase

**Phase 6 — Backup, Monetization & Release Prep (v1.0.0 feature freeze)**

Implemented:

- Full backup/restore (`myLearnBackup` v1 ZIP: manifest, data, photos)
- Restore replaces all local data with validation (zip slip, FK, version checks)
- CSV export: grades, attendance, focus history (formula-injection safe)
- AppMetrica production analytics (PII-free event params)
- Yandex Mobile Ads: banners (Today, Performance, Focus Stats) + gated interstitial
- Privacy policy (`docs/privacy.html`)
- About screen with version and privacy link
- Text share retained; image share deferred (no dead native deps)

### Backup format

- Kind: `myLearnBackup`, version `1`
- Includes: settings, periods, teachers, subjects, schedule, exceptions, assignments, photos, reminder intent, grades, attendance, completed focus sessions, holidays, import history
- Excludes: `active_focus_session`, platform `notification_id` values
- Photos use archive-relative paths; restore writes to managed app storage

### Advertising policy (v1.0.0)

- Banners: one per screen (Today, Performance, Focus Stats only — not on running timer)
- Interstitial: session ≥ 5, once per session, 24h cooldown, eligible contexts only
- **Not used:** App Open, Rewarded, Native ad units

### Analytics events

`app_open`, `onboarding_completed`, `schedule_lesson_created`, `assignment_created`, `assignment_completed`, `grade_added`, `attendance_marked`, `focus_started`, `focus_completed`, `schedule_shared`, `schedule_exported`, `schedule_imported`, `backup_created`, `backup_restored`

Configuration: `src/config/analytics.ts`, `src/config/ads.ts`

### Release requirements (user actions)

- Support email before RuStore listing
- Enable/verify GitHub Pages for privacy URL
- Production keystore and signed AAB (after Final Codex review)

Not implemented (post-v1):

- Native widget
- Image share cards

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
