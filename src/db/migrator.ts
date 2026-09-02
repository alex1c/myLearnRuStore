import type { DatabaseConnection } from '@/src/db/types'
import { migrations } from '@/src/db/migrations'
import { nowTimestamp } from '@/src/utils/id'

interface MigrationRow {
	version: number
}

/** Ensure schema_migrations exists before reading versions. */
async function ensureMigrationTable(db: DatabaseConnection): Promise<void> {
	await db.execAsync(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY NOT NULL,
			name TEXT NOT NULL,
			applied_at TEXT NOT NULL
		);
	`)
}

/** Return applied migration versions sorted ascending. */
export async function getAppliedMigrationVersions(
	db: DatabaseConnection,
): Promise<number[]> {
	await ensureMigrationTable(db)
	const rows = await db.getAllAsync<MigrationRow>(
		'SELECT version FROM schema_migrations ORDER BY version ASC',
	)
	return rows.map((row) => row.version)
}

/** Apply pending migrations inside a single transaction. */
export async function runMigrations(db: DatabaseConnection): Promise<void> {
	await db.execAsync('PRAGMA foreign_keys = ON;')
	await ensureMigrationTable(db)

	const appliedVersions = await getAppliedMigrationVersions(db)
	const latestSupportedVersion = Math.max(0, ...migrations.map(({ version }) => version))
	const futureVersion = appliedVersions.find((version) => version > latestSupportedVersion)
	if (futureVersion !== undefined) {
		throw new Error(
			`Database schema version ${futureVersion} is newer than supported version ${latestSupportedVersion}`,
		)
	}

	const appliedSet = new Set(appliedVersions)

	const pending = migrations
		.filter((migration) => !appliedSet.has(migration.version))
		.sort((a, b) => a.version - b.version)

	if (pending.length === 0) {
		return
	}

	await db.withTransactionAsync(async () => {
		for (const migration of pending) {
			await migration.up(db)
			await db.runAsync(
				'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
				[migration.version, migration.name, nowTimestamp()],
			)
		}
	})
}
