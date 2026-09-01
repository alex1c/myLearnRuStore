import type * as SQLite from 'expo-sqlite'
import type { DatabaseConnection, RunResult } from '@/src/db/types'

/** Wrap expo-sqlite database with the shared connection interface. */
export function createExpoDatabaseConnection(
	db: SQLite.SQLiteDatabase,
): DatabaseConnection {
	return {
		async execAsync(sql: string): Promise<void> {
			await db.execAsync(sql)
		},
		async runAsync(
			sql: string,
			params: readonly unknown[] = [],
		): Promise<RunResult> {
			const result = await db.runAsync(sql, params as SQLite.SQLiteBindParams)
			return {
				changes: result.changes,
				lastInsertRowId: result.lastInsertRowId,
			}
		},
		async getAllAsync<T>(
			sql: string,
			params: readonly unknown[] = [],
		): Promise<T[]> {
			return db.getAllAsync<T>(sql, params as SQLite.SQLiteBindParams)
		},
		async getFirstAsync<T>(
			sql: string,
			params: readonly unknown[] = [],
		): Promise<T | null> {
			const row = await db.getFirstAsync<T>(sql, params as SQLite.SQLiteBindParams)
			return row ?? null
		},
		async withTransactionAsync(task: () => Promise<void>): Promise<void> {
			await db.withTransactionAsync(task)
		},
	}
}
