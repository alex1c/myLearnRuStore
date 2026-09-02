import type { Migration } from '@/src/db/types'
import { migration001InitialSchema } from '@/src/db/migrations/001_initial_schema'
import { migration002AssignmentReminders } from '@/src/db/migrations/002_assignment_reminders'
import { migration003GradesAttendance } from '@/src/db/migrations/003_grades_attendance'
import { migration004IntegrityHardening } from '@/src/db/migrations/004_integrity_hardening'

/** Ordered migration list — never skip versions. */
export const migrations: Migration[] = [
	migration001InitialSchema,
	migration002AssignmentReminders,
	migration003GradesAttendance,
	migration004IntegrityHardening,
]
