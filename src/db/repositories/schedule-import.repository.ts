import type { DatabaseConnection } from '@/src/db/types'
import { createId, nowTimestamp } from '@/src/utils/id'

export interface ScheduleImportRecord {
	id: string
	exportId: string
	importedAt: string
	studyPeriodId: string
}

/** Tracks previously imported schedule export IDs to prevent silent duplicates. */
export class ScheduleImportRepository {
	constructor(private readonly db: DatabaseConnection) {}

	async findByExportAndPeriod(
		exportId: string,
		studyPeriodId: string,
	): Promise<ScheduleImportRecord | null> {
		const row = await this.db.getFirstAsync<{
			id: string
			export_id: string
			imported_at: string
			study_period_id: string
		}>(
			`SELECT * FROM schedule_import_history
			 WHERE export_id = ? AND study_period_id = ?`,
			[exportId, studyPeriodId],
		)

		if (!row) {
			return null
		}

		return {
			id: row.id,
			exportId: row.export_id,
			importedAt: row.imported_at,
			studyPeriodId: row.study_period_id,
		}
	}

	async record(input: {
		exportId: string
		studyPeriodId: string
	}): Promise<ScheduleImportRecord> {
		const record: ScheduleImportRecord = {
			id: createId(),
			exportId: input.exportId,
			importedAt: nowTimestamp(),
			studyPeriodId: input.studyPeriodId,
		}

		await this.db.runAsync(
			`INSERT INTO schedule_import_history (id, export_id, imported_at, study_period_id)
			 VALUES (?, ?, ?, ?)`,
			[record.id, record.exportId, record.importedAt, record.studyPeriodId],
		)

		return record
	}
}
