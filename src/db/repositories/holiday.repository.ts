import type { DatabaseConnection } from '@/src/db/types'
import type { Holiday } from '@/src/types/domain'
import { createId, nowTimestamp } from '@/src/utils/id'
import { validateLocalDate, validateStudyPeriodRange } from '@/src/utils/validation'

interface HolidayRow {
	id: string
	name: string
	start_date: string
	end_date: string
	study_period_id: string | null
	created_at: string
	updated_at: string
}

function mapRow(row: HolidayRow): Holiday {
	return {
		id: row.id,
		name: row.name,
		startDate: row.start_date,
		endDate: row.end_date,
		studyPeriodId: row.study_period_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export class HolidayRepository {
	constructor(private readonly db: DatabaseConnection) {}

	async listByStudyPeriod(studyPeriodId: string): Promise<Holiday[]> {
		const rows = await this.db.getAllAsync<HolidayRow>(
			`SELECT * FROM holidays
			 WHERE study_period_id = ? OR study_period_id IS NULL
			 ORDER BY start_date ASC`,
			[studyPeriodId],
		)
		return rows.map(mapRow)
	}

	async create(input: {
		name: string
		startDate: string
		endDate: string
		studyPeriodId?: string | null
	}): Promise<Holiday> {
		const startDate = validateLocalDate(input.startDate, 'startDate')
		const endDate = validateLocalDate(input.endDate, 'endDate')
		validateStudyPeriodRange(startDate, endDate)

		const timestamp = nowTimestamp()
		const holiday: Holiday = {
			id: createId(),
			name: input.name.trim(),
			startDate,
			endDate,
			studyPeriodId: input.studyPeriodId ?? null,
			createdAt: timestamp,
			updatedAt: timestamp,
		}

		await this.db.runAsync(
			`INSERT INTO holidays (id, name, start_date, end_date, study_period_id, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				holiday.id,
				holiday.name,
				holiday.startDate,
				holiday.endDate,
				holiday.studyPeriodId,
				holiday.createdAt,
				holiday.updatedAt,
			],
		)

		return holiday
	}
}
