import type { DatabaseConnection } from '@/src/db/types'
import type { StudyPeriod, StudyPeriodType } from '@/src/types/domain'
import { createId, nowTimestamp } from '@/src/utils/id'
import { validateLocalDate, validateStudyPeriodRange } from '@/src/utils/validation'

interface StudyPeriodRow {
	id: string
	name: string
	type: string
	start_date: string
	end_date: string
	is_active: number
	created_at: string
	updated_at: string
}

function mapRow(row: StudyPeriodRow): StudyPeriod {
	return {
		id: row.id,
		name: row.name,
		type: row.type as StudyPeriodType,
		startDate: row.start_date,
		endDate: row.end_date,
		isActive: row.is_active === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export interface CreateStudyPeriodInput {
	name: string
	type: StudyPeriodType
	startDate: string
	endDate: string
	isActive?: boolean
}

export class StudyPeriodRepository {
	constructor(private readonly db: DatabaseConnection) {}

	async list(): Promise<StudyPeriod[]> {
		const rows = await this.db.getAllAsync<StudyPeriodRow>(
			'SELECT * FROM study_periods ORDER BY start_date DESC',
		)
		return rows.map(mapRow)
	}

	async getActive(): Promise<StudyPeriod | null> {
		const row = await this.db.getFirstAsync<StudyPeriodRow>(
			'SELECT * FROM study_periods WHERE is_active = 1 LIMIT 1',
		)
		return row ? mapRow(row) : null
	}

	async create(input: CreateStudyPeriodInput): Promise<StudyPeriod> {
		const startDate = validateLocalDate(input.startDate, 'startDate')
		const endDate = validateLocalDate(input.endDate, 'endDate')
		validateStudyPeriodRange(startDate, endDate)

		const timestamp = nowTimestamp()
		const period: StudyPeriod = {
			id: createId(),
			name: input.name.trim(),
			type: input.type,
			startDate,
			endDate,
			isActive: input.isActive ?? false,
			createdAt: timestamp,
			updatedAt: timestamp,
		}

		await this.db.withTransactionAsync(async () => {
			if (period.isActive) {
				await this.db.runAsync(
					'UPDATE study_periods SET is_active = 0, updated_at = ? WHERE is_active = 1',
					[timestamp],
				)
			}

			await this.db.runAsync(
				`INSERT INTO study_periods (
					id, name, type, start_date, end_date, is_active, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					period.id,
					period.name,
					period.type,
					period.startDate,
					period.endDate,
					period.isActive ? 1 : 0,
					period.createdAt,
					period.updatedAt,
				],
			)
		})

		return period
	}
}
