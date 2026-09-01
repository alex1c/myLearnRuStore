import { createRequire } from 'node:module'
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import type { DatabaseConnection, RunResult } from '@/src/db/types'

const nodeRequire = createRequire(__filename)

let sqlJsPromise: ReturnType<typeof initSqlJs> | null = null

async function getSqlJs() {
	if (!sqlJsPromise) {
		sqlJsPromise = initSqlJs({
			locateFile: (file: string) =>
				nodeRequire.resolve(`sql.js/dist/${file}`),
		})
	}

	return sqlJsPromise
}

function readLastInsertRowId(db: SqlJsDatabase): number {
	const statement = db.prepare('SELECT last_insert_rowid() as id')
	statement.step()
	const row = statement.getAsObject() as { id: number }
	statement.free()
	return Number(row.id ?? 0)
}

/** Wrap sql.js with the shared async connection interface for Jest. */
export function createSqlJsConnection(db: SqlJsDatabase): DatabaseConnection {
	return {
		async execAsync(sql: string): Promise<void> {
			db.exec(sql)
		},
		async runAsync(
			sql: string,
			params: readonly unknown[] = [],
		): Promise<RunResult> {
			const normalizedParams = params.map((value) =>
				value === undefined ? null : value,
			) as (string | number | null)[]
			db.run(sql, normalizedParams)
			return {
				changes: db.getRowsModified(),
				lastInsertRowId: readLastInsertRowId(db),
			}
		},
		async getAllAsync<T>(
			sql: string,
			params: readonly unknown[] = [],
		): Promise<T[]> {
			const normalizedParams = params.map((value) =>
				value === undefined ? null : value,
			) as (string | number | null)[]
			const statement = db.prepare(sql)
			statement.bind(normalizedParams)
			const rows: T[] = []

			while (statement.step()) {
				rows.push(statement.getAsObject() as T)
			}

			statement.free()
			return rows
		},
		async getFirstAsync<T>(
			sql: string,
			params: readonly unknown[] = [],
		): Promise<T | null> {
			const rows = await this.getAllAsync<T>(sql, params)
			return rows[0] ?? null
		},
		async withTransactionAsync(task: () => Promise<void>): Promise<void> {
			db.exec('BEGIN IMMEDIATE')
			try {
				await task()
				db.exec('COMMIT')
			} catch (error) {
				db.exec('ROLLBACK')
				throw error
			}
		},
	}
}

/** Open an in-memory database for tests with FK enforcement. */
export async function openTestDatabase(): Promise<{
	sqlite: SqlJsDatabase
	connection: DatabaseConnection
}> {
	const SQL = await getSqlJs()
	const sqlite = new SQL.Database()
	sqlite.exec('PRAGMA foreign_keys = ON;')
	const connection = createSqlJsConnection(sqlite)
	return { sqlite, connection }
}
