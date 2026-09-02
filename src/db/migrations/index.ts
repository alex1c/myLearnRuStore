import type { Migration } from '@/src/db/types'
import { migration001InitialSchema } from '@/src/db/migrations/001_initial_schema'
import { migration002AssignmentReminders } from '@/src/db/migrations/002_assignment_reminders'

/** Ordered migration list — never skip versions. */
export const migrations: Migration[] = [
	migration001InitialSchema,
	migration002AssignmentReminders,
]
