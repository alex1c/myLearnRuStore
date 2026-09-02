import type { DatabaseConnection } from '@/src/db/types'
import type { GradeScale, Subject } from '@/src/types/domain'
import { createId, nowTimestamp } from '@/src/utils/id'
import { validateSubjectName } from '@/src/utils/validation'
import { validateAttendanceTarget, validateTargetForScale } from '@/src/utils/grade-labels'

interface SubjectRow {
	id: string
	study_period_id: string
	name: string
	short_name: string | null
	color: string | null
	room_default: string | null
	teacher_id: string | null
	target_grade: number | null
	grade_scale: string
	attendance_target: number | null
	sort_order: number
	is_archived: number
	created_at: string
	updated_at: string
}

function mapRow(row: SubjectRow): Subject {
	return {
		id: row.id,
		studyPeriodId: row.study_period_id,
		name: row.name,
		shortName: row.short_name,
		color: row.color,
		roomDefault: row.room_default,
		teacherId: row.teacher_id,
		targetGrade: row.target_grade,
		gradeScale: row.grade_scale as GradeScale,
		attendanceTarget: row.attendance_target,
		sortOrder: row.sort_order,
		isArchived: row.is_archived === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export interface CreateSubjectInput {
	studyPeriodId: string
	name: string
	shortName?: string | null
	color?: string | null
	roomDefault?: string | null
	teacherId?: string | null
	sortOrder?: number
	gradeScale?: GradeScale
}

export interface UpdateSubjectInput {
	name?: string
	shortName?: string | null
	color?: string | null
	targetGrade?: number | null
	gradeScale?: GradeScale
	attendanceTarget?: number | null
}

export class SubjectRepository {
	constructor(private readonly db: DatabaseConnection) {}

	async listByStudyPeriod(studyPeriodId: string): Promise<Subject[]> {
		const rows = await this.db.getAllAsync<SubjectRow>(
			`SELECT * FROM subjects
			 WHERE study_period_id = ? AND is_archived = 0
			 ORDER BY sort_order ASC, name ASC`,
			[studyPeriodId],
		)
		return rows.map(mapRow)
	}

	async create(input: CreateSubjectInput): Promise<Subject> {
		const name = validateSubjectName(input.name)
		const timestamp = nowTimestamp()
		const subject: Subject = {
			id: createId(),
			studyPeriodId: input.studyPeriodId,
			name,
			shortName: input.shortName ?? null,
			color: input.color ?? null,
			roomDefault: input.roomDefault ?? null,
			teacherId: input.teacherId ?? null,
			targetGrade: null,
			gradeScale: input.gradeScale ?? 'FIVE_POINT',
			attendanceTarget: null,
			sortOrder: input.sortOrder ?? 0,
			isArchived: false,
			createdAt: timestamp,
			updatedAt: timestamp,
		}

		await this.db.runAsync(
			`INSERT INTO subjects (
				id, study_period_id, name, short_name, color, room_default,
				teacher_id, target_grade, grade_scale, attendance_target,
				sort_order, is_archived, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				subject.id,
				subject.studyPeriodId,
				subject.name,
				subject.shortName,
				subject.color,
				subject.roomDefault,
				subject.teacherId,
				subject.targetGrade,
				subject.gradeScale,
				subject.attendanceTarget,
				subject.sortOrder,
				0,
				subject.createdAt,
				subject.updatedAt,
			],
		)

		return subject
	}

	async getById(id: string): Promise<Subject | null> {
		const row = await this.db.getFirstAsync<SubjectRow>(
			'SELECT * FROM subjects WHERE id = ?',
			[id],
		)
		return row ? mapRow(row) : null
	}

	async update(id: string, input: UpdateSubjectInput): Promise<Subject> {
		const existing = await this.getById(id)
		if (!existing) {
			throw new Error('Subject not found')
		}

		const gradeScale = input.gradeScale ?? existing.gradeScale
		let targetGrade = existing.targetGrade
		if (input.targetGrade !== undefined) {
			targetGrade =
				input.targetGrade === null
					? null
					: validateTargetForScale(input.targetGrade, gradeScale)
		}

		let attendanceTarget = existing.attendanceTarget
		if (input.attendanceTarget !== undefined) {
			attendanceTarget =
				input.attendanceTarget === null
					? null
					: validateAttendanceTarget(input.attendanceTarget)
		}

		const updated: Subject = {
			...existing,
			name: input.name ? validateSubjectName(input.name) : existing.name,
			shortName: input.shortName !== undefined ? input.shortName : existing.shortName,
			color: input.color !== undefined ? input.color : existing.color,
			targetGrade,
			gradeScale,
			attendanceTarget,
			updatedAt: nowTimestamp(),
		}

		await this.db.runAsync(
			`UPDATE subjects SET
				name = ?, short_name = ?, color = ?, target_grade = ?,
				grade_scale = ?, attendance_target = ?, updated_at = ?
			 WHERE id = ?`,
			[
				updated.name,
				updated.shortName,
				updated.color,
				updated.targetGrade,
				updated.gradeScale,
				updated.attendanceTarget,
				updated.updatedAt,
				id,
			],
		)

		return updated
	}
}
