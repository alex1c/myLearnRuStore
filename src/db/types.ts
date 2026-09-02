export interface RunResult {
	changes: number
	lastInsertRowId: number
}

/** Minimal async SQLite surface shared by Expo and test adapters. */
export interface DatabaseConnection {
	execAsync(sql: string): Promise<void>
	runAsync(sql: string, params?: readonly unknown[]): Promise<RunResult>
	getAllAsync<T>(sql: string, params?: readonly unknown[]): Promise<T[]>
	getFirstAsync<T>(sql: string, params?: readonly unknown[]): Promise<T | null>
	withTransactionAsync(task: () => Promise<void>): Promise<void>
}

export interface Migration {
	version: number
	name: string
	up: (db: DatabaseConnection) => Promise<void>
}

export const DATABASE_NAME = 'mylearn.db'
export const LATEST_MIGRATION_VERSION = 5
