declare module 'sql.js' {
	export interface SqlJsStatic {
		Database: new (data?: ArrayLike<number> | Buffer | null) => Database
	}

	export interface Database {
		exec(sql: string): void
		run(sql: string, params?: (string | number | null)[]): void
		prepare(sql: string): Statement
		getRowsModified(): number
	}

	export interface Statement {
		bind(params?: (string | number | null)[]): void
		step(): boolean
		getAsObject(): Record<string, unknown>
		free(): void
	}

	export type InitSqlJs = (config?: {
		locateFile?: (file: string) => string
	}) => Promise<SqlJsStatic>

	const initSqlJs: InitSqlJs
	export default initSqlJs
}
