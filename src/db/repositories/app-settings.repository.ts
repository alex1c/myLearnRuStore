import type { DatabaseConnection } from '@/src/db/types'
import type { AppSettings, UserMode } from '@/src/types/domain'
import { createId, nowTimestamp } from '@/src/utils/id'
import { validateCycleSettings } from '@/src/utils/validation'

interface AppSettingsRow {
	id: string
	user_mode: string
	active_study_period_id: string | null
	default_reminder_minutes: number
	week_cycle_mode: string
	cycle_anchor_date: string | null
	cycle_length: number
	first_day_of_week: number
	created_at: string
	updated_at: string
}

function mapRow(row: AppSettingsRow): AppSettings {
	return {
		id: row.id,
		userMode: row.user_mode as AppSettings['userMode'],
		activeStudyPeriodId: row.active_study_period_id,
		defaultReminderMinutes: row.default_reminder_minutes,
		weekCycleMode: row.week_cycle_mode as AppSettings['weekCycleMode'],
		cycleAnchorDate: row.cycle_anchor_date,
		cycleLength: row.cycle_length as 1 | 2,
		firstDayOfWeek: row.first_day_of_week as AppSettings['firstDayOfWeek'],
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export class AppSettingsRepository {
	constructor(private readonly db: DatabaseConnection) {}

	async get(): Promise<AppSettings | null> {
		const row = await this.db.getFirstAsync<AppSettingsRow>(
			'SELECT * FROM app_settings LIMIT 1',
		)
		return row ? mapRow(row) : null
	}

	async updateUserMode(userMode: UserMode): Promise<void> {
		const current = await this.get()
		if (!current) {
			throw new Error('App settings not initialized')
		}

		await this.db.runAsync(
			'UPDATE app_settings SET user_mode = ?, updated_at = ? WHERE id = ?',
			[userMode, nowTimestamp(), current.id],
		)
	}

	async setActiveStudyPeriod(studyPeriodId: string): Promise<void> {
		const current = await this.get()
		if (!current) {
			throw new Error('App settings not initialized')
		}

		await this.db.runAsync(
			'UPDATE app_settings SET active_study_period_id = ?, updated_at = ? WHERE id = ?',
			[studyPeriodId, nowTimestamp(), current.id],
		)
	}

	async updateCycleSettings(input: {
		weekCycleMode: AppSettings['weekCycleMode']
		cycleLength: number
		cycleAnchorDate: string | null
	}): Promise<void> {
		const validated = validateCycleSettings(
			input.cycleLength,
			input.cycleAnchorDate,
		)
		if (
			(input.weekCycleMode === 'EVERY_WEEK' && validated.cycleLength !== 1) ||
			(input.weekCycleMode === 'TWO_WEEK' && validated.cycleLength !== 2)
		) {
			throw new Error('Week cycle mode and cycle length are inconsistent')
		}
		const current = await this.get()
		if (!current) {
			throw new Error('App settings not initialized')
		}

		await this.db.runAsync(
			`UPDATE app_settings
			 SET week_cycle_mode = ?, cycle_length = ?, cycle_anchor_date = ?, updated_at = ?
			 WHERE id = ?`,
			[
				input.weekCycleMode,
				validated.cycleLength,
				validated.anchorDate,
				nowTimestamp(),
				current.id,
			],
		)
	}

	async ensureExists(): Promise<AppSettings> {
		const existing = await this.get()
		if (existing) {
			return existing
		}

		const timestamp = nowTimestamp()
		const settings: AppSettings = {
			id: createId(),
			userMode: 'SCHOOL',
			activeStudyPeriodId: null,
			defaultReminderMinutes: 30,
			weekCycleMode: 'EVERY_WEEK',
			cycleAnchorDate: null,
			cycleLength: 1,
			firstDayOfWeek: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
		}

		await this.db.runAsync(
			`INSERT INTO app_settings (
				id, user_mode, active_study_period_id, default_reminder_minutes,
				week_cycle_mode, cycle_anchor_date, cycle_length, first_day_of_week,
				created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				settings.id,
				settings.userMode,
				settings.activeStudyPeriodId,
				settings.defaultReminderMinutes,
				settings.weekCycleMode,
				settings.cycleAnchorDate,
				settings.cycleLength,
				settings.firstDayOfWeek,
				settings.createdAt,
				settings.updatedAt,
			],
		)

		return settings
	}
}
