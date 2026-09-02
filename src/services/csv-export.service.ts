import type { Repositories } from '@/src/db/repositories'
import { buildCsvDocument } from '@/src/utils/csv'
import { getGradeTypeLabel } from '@/src/utils/grade-labels'

const ATTENDANCE_LABELS: Record<string, string> = {
	PRESENT: 'Был',
	ABSENT: 'Пропустил',
	EXCUSED: 'Уважительная',
}

/** Export all grades as CSV with formula-injection protection. */
export async function exportGradesCsv(repos: Repositories): Promise<string> {
	const grades = await repos.db.getAllAsync<{
		value: number
		weight: number
		grade_type: string | null
		date: string
		note: string | null
		subject_id: string
	}>('SELECT * FROM grades ORDER BY date DESC')

	const subjects = await repos.db.getAllAsync<{ id: string; name: string }>(
		'SELECT id, name FROM subjects',
	)
	const subjectNames = new Map(subjects.map((item) => [item.id, item.name]))

	return buildCsvDocument(
		['Предмет', 'Дата', 'Оценка', 'Вес', 'Тип', 'Комментарий'],
		grades.map((grade) => [
			subjectNames.get(grade.subject_id) ?? grade.subject_id,
			grade.date,
			grade.value,
			grade.weight,
			grade.grade_type ? getGradeTypeLabel(grade.grade_type) : '',
			grade.note ?? '',
		]),
	)
}

/** Export attendance records as CSV. */
export async function exportAttendanceCsv(repos: Repositories): Promise<string> {
	const rows = await repos.db.getAllAsync<{
		attendance_date: string
		subject_id: string
		status: string
	}>('SELECT attendance_date, subject_id, status FROM attendance ORDER BY attendance_date DESC')

	const subjects = await repos.db.getAllAsync<{ id: string; name: string }>(
		'SELECT id, name FROM subjects',
	)
	const subjectNames = new Map(subjects.map((item) => [item.id, item.name]))

	return buildCsvDocument(
		['Дата', 'Предмет', 'Статус'],
		rows.map((row) => [
			row.attendance_date,
			subjectNames.get(row.subject_id) ?? row.subject_id,
			ATTENDANCE_LABELS[row.status] ?? row.status,
		]),
	)
}

/** Export focus sessions as CSV. */
export async function exportFocusCsv(repos: Repositories): Promise<string> {
	const sessions = await repos.focusSessions.listAll()
	const subjects = await repos.db.getAllAsync<{ id: string; name: string }>(
		'SELECT id, name FROM subjects',
	)
	const assignments = await repos.db.getAllAsync<{ id: string; title: string }>(
		'SELECT id, title FROM assignments',
	)

	const subjectNames = new Map(subjects.map((item) => [item.id, item.name]))
	const assignmentTitles = new Map(assignments.map((item) => [item.id, item.title]))

	return buildCsvDocument(
		['Дата', 'Предмет', 'Задание', 'Минуты'],
		sessions.map((session) => [
			session.startedAt.slice(0, 10),
			session.subjectId ? subjectNames.get(session.subjectId) ?? '' : '',
			session.assignmentId
				? assignmentTitles.get(session.assignmentId) ?? ''
				: '',
			Math.round((session.durationSeconds ?? 0) / 60),
		]),
	)
}
