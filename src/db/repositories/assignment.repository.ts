import type { DatabaseConnection } from '@/src/db/types'
import type {
	Assignment,
	AssignmentPriority,
	AssignmentStatus,
	AssignmentType,
} from '@/src/types/domain'
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
	completed_at: string | null
	notes: string | null
	created_at: string
	updated_at: string
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
		completedAt: row.completed_at,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export interface CreateAssignmentInput {
	subjectId: string
	title: string
	description?: string | null
	dueDate: string
	dueTime?: string | null
	priority?: AssignmentPriority
	assignmentType?: AssignmentType
	sourceScheduleEntryId?: string | null
}

export class AssignmentRepository {
	constructor(private readonly db: DatabaseConnection) {}

	async listUpcoming(limit = 10): Promise<Assignment[]> {
		const rows = await this.db.getAllAsync<AssignmentRow>(
			`SELECT * FROM assignments
			 WHERE status IN ('PENDING', 'IN_PROGRESS')
			 ORDER BY due_date ASC, COALESCE(due_time, '23:59') ASC
			 LIMIT ?`,
			[limit],
		)
		return rows.map(mapRow)
	}

	async create(input: CreateAssignmentInput): Promise<Assignment> {
		const dueDate = validateLocalDate(input.dueDate, 'dueDate')
		const dueTime = validateOptionalClockTime(input.dueTime, 'dueTime')
		const title = input.title.trim()

		if (!title) {
			throw new Error('Assignment title is required')
		}

		if (input.sourceScheduleEntryId) {
			const source = await this.db.getFirstAsync<{ subject_id: string }>(
				'SELECT subject_id FROM schedule_entries WHERE id = ?',
				[input.sourceScheduleEntryId],
			)
			if (!source || source.subject_id !== input.subjectId) {
				throw new Error('Assignment subject must match its source schedule entry')
			}
		}

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
			completedAt: null,
			notes: null,
			createdAt: timestamp,
			updatedAt: timestamp,
		}

		await this.db.runAsync(
			`INSERT INTO assignments (
				id, subject_id, title, description, due_date, due_time,
				priority, status, assignment_type, source_schedule_entry_id,
				completed_at, notes, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
				assignment.completedAt,
				assignment.notes,
				assignment.createdAt,
				assignment.updatedAt,
			],
		)

		return assignment
	}
}
