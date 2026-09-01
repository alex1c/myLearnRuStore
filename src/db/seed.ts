import type { DatabaseConnection } from '@/src/db/types'
import { createRepositories } from '@/src/db/repositories'
import { createId, nowTimestamp } from '@/src/utils/id'

/**
 * Development-only seed helper.
 * Never call this automatically in production bootstrap.
 */
export async function seedDevelopmentData(db: DatabaseConnection): Promise<void> {
	const repos = createRepositories(db)
	const timestamp = nowTimestamp()

	const period = await repos.studyPeriods.create({
		name: '2025–2026 учебный год',
		type: 'YEAR',
		startDate: '2025-09-01',
		endDate: '2026-05-31',
		isActive: true,
	})

	await db.runAsync(
		`UPDATE app_settings
		 SET active_study_period_id = ?, cycle_anchor_date = ?, cycle_length = 2,
		     week_cycle_mode = 'TWO_WEEK', updated_at = ?
		 WHERE id = (SELECT id FROM app_settings LIMIT 1)`,
		[period.id, '2025-09-01', timestamp],
	)

	const math = await repos.subjects.create({
		studyPeriodId: period.id,
		name: 'Математика',
		color: '#4F46E5',
		sortOrder: 1,
	})

	const history = await repos.subjects.create({
		studyPeriodId: period.id,
		name: 'История',
		color: '#059669',
		sortOrder: 2,
	})

	await repos.schedule.create({
		studyPeriodId: period.id,
		subjectId: math.id,
		weekday: 1,
		startTime: '08:30',
		endTime: '09:15',
		room: '204',
		weekCycle: 'CYCLE_0',
	})

	await repos.schedule.create({
		studyPeriodId: period.id,
		subjectId: history.id,
		weekday: 1,
		startTime: '09:25',
		endTime: '10:10',
		room: '112',
	})

	await repos.assignments.create({
		subjectId: math.id,
		title: 'Решить задачи §12',
		dueDate: '2025-09-15',
	})

	// Ensure at least one teacher row exists for future FK demos.
	await db.runAsync(
		`INSERT INTO teachers (id, name, notes, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?)`,
		[createId(), 'Иванова А.С.', null, timestamp, timestamp],
	)
}
