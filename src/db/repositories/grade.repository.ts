import type { DatabaseConnection } from '@/src/db/types'
import type { Grade, GradeScale } from '@/src/types/domain'
import { createId, nowTimestamp } from '@/src/utils/id'
import { validateGradeForScale } from '@/src/utils/grade-labels'
import {
	validateGradeValue,
	validateGradeWeight,
	validateLocalDate,
} from '@/src/utils/validation'

interface GradeRow {
	id: string
	subject_id: string
	value: number
	weight: number
	grade_type: string | null
	grade_scale: string
	date: string
	note: string | null
	assignment_id: string | null
	created_at: string
	updated_at: string
}

function mapRow(row: GradeRow): Grade {
	return {
		id: row.id,
		subjectId: row.subject_id,
		value: row.value,
		weight: row.weight,
		gradeType: row.grade_type,
		gradeScale: row.grade_scale as GradeScale,
		date: row.date,
		note: row.note,
		assignmentId: row.assignment_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export interface CreateGradeInput {
	subjectId: string
	value: number
	gradeScale: GradeScale
	date: string
	weight?: number
	gradeType?: string | null
	note?: string | null
	assignmentId?: string | null
}

export interface UpdateGradeInput {
	value?: number
	gradeScale?: GradeScale
	date?: string
	weight?: number
	gradeType?: string | null
	note?: string | null
	assignmentId?: string | null
}

export class GradeRepository {
	constructor(private readonly db: DatabaseConnection) {}

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
			throw new Error('Grade subject must match its linked assignment')
		}
	}

	async getById(id: string): Promise<Grade | null> {
		const row = await this.db.getFirstAsync<GradeRow>(
			'SELECT * FROM grades WHERE id = ?',
			[id],
		)
		return row ? mapRow(row) : null
	}

	async listBySubject(subjectId: string): Promise<Grade[]> {
		const rows = await this.db.getAllAsync<GradeRow>(
			`SELECT * FROM grades WHERE subject_id = ?
			 ORDER BY date DESC, created_at DESC`,
			[subjectId],
		)
		return rows.map(mapRow)
	}

	/** Batch-fetch grades for multiple subjects in one query. */
	async listBySubjectIds(subjectIds: string[]): Promise<Grade[]> {
		if (subjectIds.length === 0) {
			return []
		}

		const placeholders = subjectIds.map(() => '?').join(', ')
		const rows = await this.db.getAllAsync<GradeRow>(
			`SELECT * FROM grades WHERE subject_id IN (${placeholders})
			 ORDER BY date DESC, created_at DESC`,
			subjectIds,
		)
		return rows.map(mapRow)
	}

	async getByAssignmentId(assignmentId: string): Promise<Grade | null> {
		const row = await this.db.getFirstAsync<GradeRow>(
			'SELECT * FROM grades WHERE assignment_id = ? LIMIT 1',
			[assignmentId],
		)
		return row ? mapRow(row) : null
	}

	async create(input: CreateGradeInput): Promise<Grade> {
		const value = validateGradeForScale(
			validateGradeValue(input.value),
			input.gradeScale,
		)
		const weight = validateGradeWeight(input.weight ?? 1)
		const date = validateLocalDate(input.date, 'date')

		await this.validateAssignmentIntegrity(input.subjectId, input.assignmentId)

		const timestamp = nowTimestamp()
		const grade: Grade = {
			id: createId(),
			subjectId: input.subjectId,
			value,
			weight,
			gradeType: input.gradeType ?? null,
			gradeScale: input.gradeScale,
			date,
			note: input.note ?? null,
			assignmentId: input.assignmentId ?? null,
			createdAt: timestamp,
			updatedAt: timestamp,
		}

		await this.db.runAsync(
			`INSERT INTO grades (
				id, subject_id, value, weight, grade_type, grade_scale,
				date, note, assignment_id, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				grade.id,
				grade.subjectId,
				grade.value,
				grade.weight,
				grade.gradeType,
				grade.gradeScale,
				grade.date,
				grade.note,
				grade.assignmentId,
				grade.createdAt,
				grade.updatedAt,
			],
		)

		return grade
	}

	async update(id: string, input: UpdateGradeInput): Promise<Grade> {
		const existing = await this.getById(id)
		if (!existing) {
			throw new Error('Grade not found')
		}

		const gradeScale = input.gradeScale ?? existing.gradeScale
		const value = validateGradeForScale(
			validateGradeValue(input.value ?? existing.value),
			gradeScale,
		)
		const weight = validateGradeWeight(input.weight ?? existing.weight)
		const date = input.date
			? validateLocalDate(input.date, 'date')
			: existing.date
		const assignmentId =
			input.assignmentId !== undefined ? input.assignmentId : existing.assignmentId

		await this.validateAssignmentIntegrity(existing.subjectId, assignmentId)

		const updated: Grade = {
			...existing,
			value,
			weight,
			gradeScale,
			date,
			gradeType: input.gradeType !== undefined ? input.gradeType : existing.gradeType,
			note: input.note !== undefined ? input.note : existing.note,
			assignmentId,
			updatedAt: nowTimestamp(),
		}

		await this.db.runAsync(
			`UPDATE grades SET
				value = ?, weight = ?, grade_type = ?, grade_scale = ?,
				date = ?, note = ?, assignment_id = ?, updated_at = ?
			 WHERE id = ?`,
			[
				updated.value,
				updated.weight,
				updated.gradeType,
				updated.gradeScale,
				updated.date,
				updated.note,
				updated.assignmentId,
				updated.updatedAt,
				id,
			],
		)

		return updated
	}

	async delete(id: string): Promise<void> {
		await this.db.runAsync('DELETE FROM grades WHERE id = ?', [id])
	}
}
