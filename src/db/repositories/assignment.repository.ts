import type { DatabaseConnection } from '@/src/db/types'
import type {
	Assignment,
	AssignmentPriority,
	AssignmentStatus,
	AssignmentType,
	LocalDate,
} from '@/src/types/domain'
import type { AssignmentListItem } from '@/src/types/assignment'
import { createId, nowTimestamp } from '@/src/utils/id'
import {
	validateLocalDate,
	validateOptionalClockTime,
} from '@/src/utils/validation'

interface AssignmentRow {
	id: string
	subject_id: string
	title: string
	description: string | null
	due_date: string
	due_time: string | null
	priority: string
	status: string
	assignment_type: string
	source_schedule_entry_id: string | null
	source_occurrence_date: string | null
	completed_at: string | null
	notes: string | null
	created_at: string
	updated_at: string
}

interface ListRow extends AssignmentRow {
	subject_name: string
	subject_color: string | null
	subject_is_archived: number
	photo_count: number
	has_reminder: number
}

function mapRow(row: AssignmentRow): Assignment {
	return {
		id: row.id,
		subjectId: row.subject_id,
		title: row.title,
		description: row.description,
		dueDate: row.due_date,
		dueTime: row.due_time,
		priority: row.priority as AssignmentPriority,
		status: row.status as AssignmentStatus,
		assignmentType: row.assignment_type as AssignmentType,
		sourceScheduleEntryId: row.source_schedule_entry_id,
		sourceOccurrenceDate: row.source_occurrence_date,
		completedAt: row.completed_at,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

function mapListRow(row: ListRow): AssignmentListItem {
	return {
		...mapRow(row),
		subjectName: row.subject_name,
		subjectColor: row.subject_color,
		subjectIsArchived: row.subject_is_archived === 1,
		photoCount: row.photo_count,
		hasReminder: row.has_reminder === 1,
	}
}

const LIST_SELECT = `
	SELECT
		a.*,
		s.name AS subject_name,
		s.color AS subject_color,
		s.is_archived AS subject_is_archived,
		COALESCE(p.photo_count, 0) AS photo_count,
		CASE WHEN r.enabled = 1 THEN 1 ELSE 0 END AS has_reminder
	FROM assignments a
	INNER JOIN subjects s ON s.id = a.subject_id
	LEFT JOIN (
		SELECT assignment_id, COUNT(*) AS photo_count
		FROM assignment_photos
		GROUP BY assignment_id
	) p ON p.assignment_id = a.id
	LEFT JOIN assignment_reminders r ON r.assignment_id = a.id
`

export interface CreateAssignmentInput {
	subjectId: string
	title: string
	description?: string | null
	dueDate: string
	dueTime?: string | null
	priority?: AssignmentPriority
	assignmentType?: AssignmentType
	sourceScheduleEntryId?: string | null
	sourceOccurrenceDate?: string | null
	notes?: string | null
}

export interface UpdateAssignmentInput {
	subjectId?: string
	title?: string
	description?: string | null
	dueDate?: string
	dueTime?: string | null
	priority?: AssignmentPriority
	assignmentType?: AssignmentType
	sourceScheduleEntryId?: string | null
	sourceOccurrenceDate?: string | null
	notes?: string | null
	status?: AssignmentStatus
}

export class AssignmentRepository {
	constructor(private readonly db: DatabaseConnection) {}

	private async validateSourceIntegrity(
		subjectId: string,
		sourceScheduleEntryId: string | null | undefined,
	): Promise<void> {
		if (!sourceScheduleEntryId) {
			return
		}

		const source = await this.db.getFirstAsync<{ subject_id: string }>(
			'SELECT subject_id FROM schedule_entries WHERE id = ?',
			[sourceScheduleEntryId],
		)
		if (!source || source.subject_id !== subjectId) {
			throw new Error('Assignment subject must match its source schedule entry')
		}
	}

	async getById(id: string): Promise<Assignment | null> {
		const row = await this.db.getFirstAsync<AssignmentRow>(
			'SELECT * FROM assignments WHERE id = ?',
			[id],
		)
		return row ? mapRow(row) : null
	}

	async getListItemById(id: string): Promise<AssignmentListItem | null> {
		const row = await this.db.getFirstAsync<ListRow>(
			`${LIST_SELECT} WHERE a.id = ?`,
			[id],
		)
		return row ? mapListRow(row) : null
	}

	async listAll(): Promise<AssignmentListItem[]> {
		const rows = await this.db.getAllAsync<ListRow>(
			`${LIST_SELECT} ORDER BY a.due_date ASC, COALESCE(a.due_time, '23:59') ASC`,
		)
		return rows.map(mapListRow)
	}

	async listActive(): Promise<AssignmentListItem[]> {
		const rows = await this.db.getAllAsync<ListRow>(
			`${LIST_SELECT}
			 WHERE a.status IN ('PENDING', 'IN_PROGRESS')
			 ORDER BY a.due_date ASC, COALESCE(a.due_time, '23:59') ASC`,
		)
		return rows.map(mapListRow)
	}

	async listByDueDate(dueDate: LocalDate, activeOnly = true): Promise<AssignmentListItem[]> {
		const statusClause = activeOnly ? `AND a.status IN ('PENDING', 'IN_PROGRESS')` : ''
		const rows = await this.db.getAllAsync<ListRow>(
			`${LIST_SELECT}
			 WHERE a.due_date = ? ${statusClause}
			 ORDER BY COALESCE(a.due_time, '23:59') ASC`,
			[dueDate],
		)
		return rows.map(mapListRow)
	}

	async listUpcoming(limit = 10): Promise<AssignmentListItem[]> {
		const rows = await this.db.getAllAsync<ListRow>(
			`${LIST_SELECT}
			 WHERE a.status IN ('PENDING', 'IN_PROGRESS')
			 ORDER BY a.due_date ASC, COALESCE(a.due_time, '23:59') ASC
			 LIMIT ?`,
			[limit],
		)
		return rows.map(mapListRow)
	}

	async listCompleted(): Promise<AssignmentListItem[]> {
		const rows = await this.db.getAllAsync<ListRow>(
			`${LIST_SELECT}
			 WHERE a.status = 'COMPLETED'
			 ORDER BY a.completed_at DESC`,
		)
		return rows.map(mapListRow)
	}

	async create(input: CreateAssignmentInput): Promise<Assignment> {
		const dueDate = validateLocalDate(input.dueDate, 'dueDate')
		const dueTime = validateOptionalClockTime(input.dueTime, 'dueTime')
		const title = input.title.trim()

		if (!title) {
			throw new Error('Assignment title is required')
		}

		const sourceOccurrenceDate = input.sourceOccurrenceDate
			? validateLocalDate(input.sourceOccurrenceDate, 'sourceOccurrenceDate')
			: null

		await this.validateSourceIntegrity(input.subjectId, input.sourceScheduleEntryId)

		const timestamp = nowTimestamp()
		const assignment: Assignment = {
			id: createId(),
			subjectId: input.subjectId,
			title,
			description: input.description ?? null,
			dueDate,
			dueTime,
			priority: input.priority ?? 'NORMAL',
			status: 'PENDING',
			assignmentType: input.assignmentType ?? 'HOMEWORK',
			sourceScheduleEntryId: input.sourceScheduleEntryId ?? null,
			sourceOccurrenceDate,
			completedAt: null,
			notes: input.notes ?? null,
			createdAt: timestamp,
			updatedAt: timestamp,
		}

		await this.db.runAsync(
			`INSERT INTO assignments (
				id, subject_id, title, description, due_date, due_time,
				priority, status, assignment_type, source_schedule_entry_id,
				source_occurrence_date, completed_at, notes, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				assignment.id,
				assignment.subjectId,
				assignment.title,
				assignment.description,
				assignment.dueDate,
				assignment.dueTime,
				assignment.priority,
				assignment.status,
				assignment.assignmentType,
				assignment.sourceScheduleEntryId,
				assignment.sourceOccurrenceDate,
				assignment.completedAt,
				assignment.notes,
				assignment.createdAt,
				assignment.updatedAt,
			],
		)

		return assignment
	}

	async update(id: string, input: UpdateAssignmentInput): Promise<Assignment> {
		const existing = await this.getById(id)
		if (!existing) {
			throw new Error('Assignment not found')
		}

		const subjectId = input.subjectId ?? existing.subjectId
		const sourceScheduleEntryId =
			input.sourceScheduleEntryId !== undefined
				? input.sourceScheduleEntryId
				: existing.sourceScheduleEntryId

		await this.validateSourceIntegrity(subjectId, sourceScheduleEntryId)

		const dueDate = input.dueDate
			? validateLocalDate(input.dueDate, 'dueDate')
			: existing.dueDate
		const dueTime =
			input.dueTime !== undefined
				? validateOptionalClockTime(input.dueTime, 'dueTime')
				: existing.dueTime
		const title = input.title !== undefined ? input.title.trim() : existing.title

		if (!title) {
			throw new Error('Assignment title is required')
		}

		const status = input.status ?? existing.status
		const completedAt =
			status === 'COMPLETED'
				? existing.completedAt ?? nowTimestamp()
				: null

		const sourceOccurrenceDate =
			input.sourceOccurrenceDate !== undefined
				? input.sourceOccurrenceDate
					? validateLocalDate(input.sourceOccurrenceDate, 'sourceOccurrenceDate')
					: null
				: existing.sourceOccurrenceDate

		const updated: Assignment = {
			...existing,
			subjectId,
			title,
			description:
				input.description !== undefined ? input.description : existing.description,
			dueDate,
			dueTime,
			priority: input.priority ?? existing.priority,
			assignmentType: input.assignmentType ?? existing.assignmentType,
			sourceScheduleEntryId,
			sourceOccurrenceDate,
			notes: input.notes !== undefined ? input.notes : existing.notes,
			status,
			completedAt,
			updatedAt: nowTimestamp(),
		}

		await this.db.runAsync(
			`UPDATE assignments SET
				subject_id = ?, title = ?, description = ?, due_date = ?, due_time = ?,
				priority = ?, status = ?, assignment_type = ?,
				source_schedule_entry_id = ?, source_occurrence_date = ?,
				completed_at = ?, notes = ?, updated_at = ?
			WHERE id = ?`,
			[
				updated.subjectId,
				updated.title,
				updated.description,
				updated.dueDate,
				updated.dueTime,
				updated.priority,
				updated.status,
				updated.assignmentType,
				updated.sourceScheduleEntryId,
				updated.sourceOccurrenceDate,
				updated.completedAt,
				updated.notes,
				updated.updatedAt,
				id,
			],
		)

		return updated
	}

	async complete(id: string): Promise<Assignment> {
		return this.update(id, { status: 'COMPLETED' })
	}

	async reopen(id: string): Promise<Assignment> {
		const existing = await this.getById(id)
		if (!existing) {
			throw new Error('Assignment not found')
		}

		const timestamp = nowTimestamp()
		await this.db.runAsync(
			`UPDATE assignments SET status = 'PENDING', completed_at = NULL, updated_at = ?
			 WHERE id = ?`,
			[timestamp, id],
		)

		return { ...existing, status: 'PENDING', completedAt: null, updatedAt: timestamp }
	}

	async delete(id: string): Promise<void> {
		await this.db.runAsync('DELETE FROM assignments WHERE id = ?', [id])
	}
}
