import type { DatabaseConnection } from '@/src/db/types'
import type { FocusSession } from '@/src/types/domain'
import { createId, nowTimestamp } from '@/src/utils/id'

interface FocusSessionRow {
	id: string
	subject_id: string | null
	assignment_id: string | null
	started_at: string
	ended_at: string | null
	duration_seconds: number | null
	completed: number
	created_at: string
}

function mapRow(row: FocusSessionRow): FocusSession {
	return {
		id: row.id,
		subjectId: row.subject_id,
		assignmentId: row.assignment_id,
		startedAt: row.started_at,
		endedAt: row.ended_at,
		durationSeconds: row.duration_seconds,
		completed: row.completed === 1,
		createdAt: row.created_at,
	}
}

export interface CreateFocusSessionInput {
	subjectId: string
	assignmentId?: string | null
	startedAt: string
	endedAt: string
	durationSeconds: number
	completed?: boolean
}

export class FocusSessionRepository {
	constructor(private readonly db: DatabaseConnection) {}

	async listAll(): Promise<FocusSession[]> {
		const rows = await this.db.getAllAsync<FocusSessionRow>(
			`SELECT * FROM focus_sessions ORDER BY started_at DESC`,
		)
		return rows.map(mapRow)
	}

	async listBySubject(subjectId: string): Promise<FocusSession[]> {
		const rows = await this.db.getAllAsync<FocusSessionRow>(
			`SELECT * FROM focus_sessions
			 WHERE subject_id = ?
			 ORDER BY started_at DESC`,
			[subjectId],
		)
		return rows.map(mapRow)
	}

	async listByAssignment(assignmentId: string): Promise<FocusSession[]> {
		const rows = await this.db.getAllAsync<FocusSessionRow>(
			`SELECT * FROM focus_sessions
			 WHERE assignment_id = ?
			 ORDER BY started_at DESC`,
			[assignmentId],
		)
		return rows.map(mapRow)
	}

	async listSince(startedAtIso: string): Promise<FocusSession[]> {
		const rows = await this.db.getAllAsync<FocusSessionRow>(
			`SELECT * FROM focus_sessions
			 WHERE started_at >= ?
			 ORDER BY started_at DESC`,
			[startedAtIso],
		)
		return rows.map(mapRow)
	}

	async getById(id: string): Promise<FocusSession | null> {
		const row = await this.db.getFirstAsync<FocusSessionRow>(
			'SELECT * FROM focus_sessions WHERE id = ?',
			[id],
		)
		return row ? mapRow(row) : null
	}

	private async validateAssignmentIntegrity(
		subjectId: string,
		assignmentId: string | null | undefined,
	): Promise<void> {
		if (!assignmentId) {
			return
		}

		const assignment = await this.db.getFirstAsync<{ subject_id: string }>(
			'SELECT subject_id FROM assignments WHERE id = ?',
			[assignmentId],
		)
		if (!assignment || assignment.subject_id !== subjectId) {
			throw new Error('Focus session assignment must belong to the same subject')
		}
	}

	async create(input: CreateFocusSessionInput): Promise<FocusSession> {
		if (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 0) {
			throw new Error('Focus session duration must be non-negative')
		}

		await this.validateAssignmentIntegrity(input.subjectId, input.assignmentId)

		const timestamp = nowTimestamp()
		const session: FocusSession = {
			id: createId(),
			subjectId: input.subjectId,
			assignmentId: input.assignmentId ?? null,
			startedAt: input.startedAt,
			endedAt: input.endedAt,
			durationSeconds: input.durationSeconds,
			completed: input.completed ?? true,
			createdAt: timestamp,
		}

		await this.db.runAsync(
			`INSERT INTO focus_sessions (
				id, subject_id, assignment_id, started_at, ended_at,
				duration_seconds, completed, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				session.id,
				session.subjectId,
				session.assignmentId,
				session.startedAt,
				session.endedAt,
				session.durationSeconds,
				session.completed ? 1 : 0,
				session.createdAt,
			],
		)

		return session
	}

	async delete(id: string): Promise<void> {
		await this.db.runAsync('DELETE FROM focus_sessions WHERE id = ?', [id])
	}
}
