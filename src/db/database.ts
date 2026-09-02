import * as SQLite from 'expo-sqlite'
import type { DatabaseConnection } from '@/src/db/types'
import { DATABASE_NAME } from '@/src/db/types'
import { createExpoDatabaseConnection } from '@/src/db/adapters/expo-sqlite-adapter'
import { runMigrations } from '@/src/db/migrator'
import { createId, nowTimestamp } from '@/src/utils/id'

let bootstrapPromise: Promise<DatabaseConnection> | null = null

/** Reset singleton — test hook only. */
export function resetDatabaseSingletonForTests(): void {
	bootstrapPromise = null
}

/**
 * Open the app database once and reuse the same connection promise.
 * Prevents concurrent independent bootstrap races.
 */
export async function getDatabase(): Promise<DatabaseConnection> {
	if (!bootstrapPromise) {
		bootstrapPromise = openAndMigrateDatabase()
	}

	const currentAttempt = bootstrapPromise
	try {
		return await currentAttempt
	} catch (error) {
		// A transient open/migration failure must not poison initialization forever.
		// Only clear the attempt we awaited so a newer retry cannot be discarded.
		if (bootstrapPromise === currentAttempt) {
			bootstrapPromise = null
		}
		throw error
	}
}

async function openAndMigrateDatabase(): Promise<DatabaseConnection> {
	const sqliteDb = await SQLite.openDatabaseAsync(DATABASE_NAME)
	const connection = createExpoDatabaseConnection(sqliteDb)
	await runMigrations(connection)
	await ensureDefaultSettings(connection)
	return connection
}

/** Insert default settings row when the database is fresh. */
async function ensureDefaultSettings(db: DatabaseConnection): Promise<void> {
	const existing = await db.getFirstAsync<{ id: string }>(
		'SELECT id FROM app_settings LIMIT 1',
	)

	if (existing) {
		return
	}

	const timestamp = nowTimestamp()
	await db.runAsync(
		`INSERT INTO app_settings (
			id, user_mode, active_study_period_id, default_reminder_minutes,
			week_cycle_mode, cycle_anchor_date, cycle_length, first_day_of_week,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			createId(),
			'SCHOOL',
			null,
			30,
			'EVERY_WEEK',
			null,
			1,
			1,
			timestamp,
			timestamp,
		],
	)
}

/** Bootstrap helper for tests with an injected connection. */
export async function bootstrapDatabase(
	connection: DatabaseConnection,
): Promise<DatabaseConnection> {
	await runMigrations(connection)
	await ensureDefaultSettings(connection)
	return connection
}
