import type { DatabaseConnection } from '@/src/db/types'
import type { ActiveFocusTimerState } from '@/src/services/focus-timer.service'

interface ActiveFocusRow {
	subject_id: string
	assignment_id: string | null
	planned_duration_seconds: number
	started_at: string
	paused_at: string | null
	accumulated_pause_ms: number
	notify_on_complete: number
	notification_id: string | null
	state: 'RUNNING' | 'PAUSED'
}

function mapRow(row: ActiveFocusRow): ActiveFocusTimerState {
	return {
		subjectId: row.subject_id,
		assignmentId: row.assignment_id,
		plannedDurationSeconds: row.planned_duration_seconds,
		startedAt: row.started_at,
		pausedAt: row.paused_at,
		accumulatedPauseMs: row.accumulated_pause_ms,
		state: row.state,
		notifyOnComplete: row.notify_on_complete === 1,
		notificationId: row.notification_id,
	}
}

/** Singleton persistence for the in-progress focus timer. */
export class ActiveFocusRepository {
	constructor(private readonly db: DatabaseConnection) {}

	async get(): Promise<ActiveFocusTimerState | null> {
		const row = await this.db.getFirstAsync<ActiveFocusRow>(
			'SELECT * FROM active_focus_session WHERE id = 1',
		)
		return row ? mapRow(row) : null
	}

	async save(state: ActiveFocusTimerState): Promise<void> {
		await this.db.runAsync(
			`INSERT INTO active_focus_session (
				id, subject_id, assignment_id, planned_duration_seconds,
				started_at, paused_at, accumulated_pause_ms,
				notify_on_complete, notification_id, state
			) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				subject_id = excluded.subject_id,
				assignment_id = excluded.assignment_id,
				planned_duration_seconds = excluded.planned_duration_seconds,
				started_at = excluded.started_at,
				paused_at = excluded.paused_at,
				accumulated_pause_ms = excluded.accumulated_pause_ms,
				notify_on_complete = excluded.notify_on_complete,
				notification_id = excluded.notification_id,
				state = excluded.state`,
			[
				state.subjectId,
				state.assignmentId,
				state.plannedDurationSeconds,
				state.startedAt,
				state.pausedAt,
				state.accumulatedPauseMs,
				state.notifyOnComplete ? 1 : 0,
				state.notificationId,
				state.state,
			],
		)
	}

	async clear(): Promise<void> {
		await this.db.runAsync('DELETE FROM active_focus_session WHERE id = 1')
	}
}
