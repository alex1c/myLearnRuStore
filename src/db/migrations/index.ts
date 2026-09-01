import type { Migration } from '@/src/db/types'
import { migration001InitialSchema } from '@/src/db/migrations/001_initial_schema'

/** Ordered migration list — never skip versions. */
export const migrations: Migration[] = [
	migration001InitialSchema,
]
