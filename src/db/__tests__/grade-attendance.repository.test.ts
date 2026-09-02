import { openTestDatabase } from '@/src/db/adapters/sqljs-test-adapter'
import { bootstrapDatabase } from '@/src/db/database'
import { createRepositories } from '@/src/db/repositories'

describe('grade and attendance repositories', () => {
	it('creates grades and rejects assignment subject mismatch', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)

		const period = await repos.studyPeriods.create({
			name: '2026',
			type: 'YEAR',
			startDate: '2026-09-01',
			endDate: '2027-05-31',
			isActive: true,
		})

		const math = await repos.subjects.create({
			studyPeriodId: period.id,
			name: 'Math',
		})
		const history = await repos.subjects.create({
			studyPeriodId: period.id,
			name: 'History',
		})

		const assignment = await repos.assignments.create({
			subjectId: math.id,
			title: 'Test',
			dueDate: '2026-10-01',
		})

		await expect(
			repos.grades.create({
				subjectId: history.id,
				value: 5,
				gradeScale: 'FIVE_POINT',
				date: '2026-09-10',
				assignmentId: assignment.id,
			}),
		).rejects.toThrow()

		const grade = await repos.grades.create({
			subjectId: math.id,
			value: 5,
			gradeScale: 'FIVE_POINT',
			date: '2026-09-10',
			assignmentId: assignment.id,
		})

		expect(grade.assignmentId).toBe(assignment.id)

		const updated = await repos.grades.update(grade.id, { value: 4 })
		expect(updated.value).toBe(4)

		await repos.grades.delete(grade.id)
		expect(await repos.grades.getById(grade.id)).toBeNull()
	})

	it('supports separate attendance for two lessons same day', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)

		const period = await repos.studyPeriods.create({
			name: '2026',
			type: 'YEAR',
			startDate: '2026-09-01',
			endDate: '2027-05-31',
			isActive: true,
		})

		const math = await repos.subjects.create({
			studyPeriodId: period.id,
			name: 'Math',
		})

		const entry1 = await repos.schedule.create({
			studyPeriodId: period.id,
			subjectId: math.id,
			weekday: 1,
			startTime: '09:00',
			endTime: '09:45',
		})
		const entry2 = await repos.schedule.create({
			studyPeriodId: period.id,
			subjectId: math.id,
			weekday: 1,
			startTime: '10:00',
			endTime: '10:45',
		})

		await repos.attendance.upsert({
			subjectId: math.id,
			scheduleEntryId: entry1.id,
			attendanceDate: '2026-09-08',
			status: 'PRESENT',
		})
		await repos.attendance.upsert({
			subjectId: math.id,
			scheduleEntryId: entry2.id,
			attendanceDate: '2026-09-08',
			status: 'ABSENT',
		})

		const records = await repos.attendance.listBySubject(math.id)
		expect(records).toHaveLength(2)
	})

	it('prevents mixed grade scales, historical reinterpretation, and assignment mismatch', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)
		const period = await repos.studyPeriods.create({
			name: '2026', type: 'YEAR', startDate: '2026-09-01', endDate: '2027-05-31',
		})
		const math = await repos.subjects.create({ studyPeriodId: period.id, name: 'Math' })
		const physics = await repos.subjects.create({ studyPeriodId: period.id, name: 'Physics' })
		await expect(repos.grades.create({
			subjectId: math.id, value: 7, gradeScale: 'TEN_POINT', date: '2026-09-10',
		})).rejects.toThrow('must match')
		const assignment = await repos.assignments.create({
			subjectId: math.id, title: 'Test', dueDate: '2026-09-10',
		})
		await repos.grades.create({
			subjectId: math.id, value: 5, gradeScale: 'FIVE_POINT',
			date: '2026-09-10', assignmentId: assignment.id,
		})
		await expect(repos.subjects.update(math.id, { gradeScale: 'TEN_POINT' }))
			.rejects.toThrow('Cannot change grade scale')
		await expect(repos.assignments.update(assignment.id, { subjectId: physics.id }))
			.rejects.toThrow()
	})

	it('keeps one-off attendance distinct from manual attendance', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)
		const period = await repos.studyPeriods.create({
			name: '2026', type: 'YEAR', startDate: '2026-09-01', endDate: '2027-05-31',
		})
		const subject = await repos.subjects.create({ studyPeriodId: period.id, name: 'Math' })
		const added = await repos.scheduleExceptions.create({
			studyPeriodId: period.id, exceptionDate: '2026-09-10', exceptionType: 'ADDED',
			subjectId: subject.id, startTime: '09:00', endTime: '10:00',
		})
		await repos.attendance.upsert({
			subjectId: subject.id, attendanceDate: '2026-09-10', status: 'PRESENT',
			scheduleExceptionId: added.id,
		})
		await repos.attendance.upsert({
			subjectId: subject.id, attendanceDate: '2026-09-10', status: 'ABSENT',
		})
		expect(await repos.attendance.listBySubject(subject.id)).toHaveLength(2)
	})
})
