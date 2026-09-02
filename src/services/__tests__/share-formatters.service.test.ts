import { getScheduleForDate } from '@/src/services/occurrence.service'
import {
	formatShareFocusStats,
	formatShareGradeProgress,
	formatShareTodaySchedule,
	formatShareTomorrowHomework,
	formatShareWeekSchedule,
} from '@/src/services/share/share-formatters.service'
import { buildFocusStatsSummary } from '@/src/services/focus-stats.service'
import type { ScheduleContext, ScheduleOccurrence } from '@/src/types/schedule'
import type { Grade, Subject } from '@/src/types/domain'

function occurrence(overrides: Partial<ScheduleOccurrence>): ScheduleOccurrence {
	return {
		id: 'e1:2026-09-02',
		scheduleEntryId: 'e1',
		exceptionId: null,
		occurrenceDate: '2026-09-02',
		subjectId: 'sub-1',
		subjectName: 'Math',
		subjectShortName: null,
		subjectColor: null,
		teacherId: null,
		teacherName: null,
		room: '204',
		startTime: '09:00',
		endTime: '09:45',
		lessonType: null,
		weekCycle: 'EVERY_WEEK',
		isCancelled: false,
		isOneOff: false,
		isRescheduled: false,
		...overrides,
	}
}

describe('share-formatters.service', () => {
	it('formats today schedule with footer', () => {
		const text = formatShareTodaySchedule('2026-09-02', [
			occurrence({ subjectName: 'Math' }),
		])
		expect(text).toContain('Сегодня')
		expect(text).toContain('Math')
		expect(text).toContain('Моя учёба')
	})

	it('formats empty today schedule', () => {
		const text = formatShareTodaySchedule('2026-09-02', [])
		expect(text).toContain('Занятий нет')
	})

	it('formats week schedule grouped by weekday', () => {
		const text = formatShareWeekSchedule('2026-09-01', [
			{ date: '2026-09-01', occurrences: [occurrence({ occurrenceDate: '2026-09-01' })] },
			{ date: '2026-09-02', occurrences: [] },
		])
		expect(text).toContain('Расписание на')
		expect(text).toContain('Вторник')
	})

	it('formats tomorrow homework list', () => {
		const text = formatShareTomorrowHomework([
			{ subjectName: 'Math', title: '№315–320' },
		])
		expect(text).toContain('Задания на завтра')
		expect(text).toContain('№315–320')
	})

	it('formats grade progress summary', () => {
		const subject: Subject = {
			id: 'sub-1',
			studyPeriodId: 'p1',
			name: 'Math',
			shortName: null,
			color: null,
			roomDefault: null,
			teacherId: null,
			targetGrade: 4.5,
			gradeScale: 'FIVE_POINT',
			attendanceTarget: null,
			sortOrder: 0,
			isArchived: false,
			createdAt: '',
			updatedAt: '',
		}
		const grades: Grade[] = [
			{
				id: 'g1',
				subjectId: 'sub-1',
				value: 5,
				weight: 1,
				gradeType: null,
				gradeScale: 'FIVE_POINT',
				date: '2026-09-01',
				note: null,
				assignmentId: null,
				createdAt: '',
				updatedAt: '',
			},
		]

		const text = formatShareGradeProgress({ subject, average: 4.37, recentGrades: grades })
		expect(text).toContain('4,37')
		expect(text).toContain('5')
	})

	it('formats focus stats summary', () => {
		const stats = buildFocusStatsSummary(
			[],
			new Map([['sub-1', 'Math']]),
			'7d',
			'2026-09-02',
		)
		const text = formatShareFocusStats('7 дней', stats)
		expect(text).toContain('Учёба за 7 дней')
	})
})

describe('occurrence share semantics', () => {
	it('omits cancelled lessons from resolved day schedule', () => {
		const context: ScheduleContext = {
			studyPeriodId: 'p1',
			cycleLength: 1,
			cycleAnchorDate: null,
			entries: [
				{
					id: 'e1',
					studyPeriodId: 'p1',
					subjectId: 'sub-1',
					teacherId: null,
					room: null,
					weekday: 2,
					startTime: '09:00',
					endTime: '09:45',
					lessonType: null,
					weekCycle: 'EVERY_WEEK',
					createdAt: '',
					updatedAt: '',
				},
			],
			subjects: new Map([
				[
					'sub-1',
					{
						id: 'sub-1',
						studyPeriodId: 'p1',
						name: 'Math',
						shortName: null,
						color: null,
						roomDefault: null,
						teacherId: null,
						targetGrade: null,
						gradeScale: 'FIVE_POINT',
						attendanceTarget: null,
						sortOrder: 0,
						isArchived: false,
						createdAt: '',
						updatedAt: '',
					},
				],
			]),
			teachers: new Map(),
			exceptions: [
				{
					id: 'ex1',
					scheduleEntryId: 'e1',
					exceptionDate: '2026-09-02',
					exceptionType: 'CANCELLED',
					newDate: null,
					newStartTime: null,
					newEndTime: null,
					newRoom: null,
					newTeacherId: null,
					subjectId: 'sub-1',
					startTime: '09:00',
					endTime: '09:45',
					room: null,
					teacherId: null,
					lessonType: null,
					createdAt: '',
					updatedAt: '',
				},
			],
			holidays: [],
		}

		const resolved = getScheduleForDate('2026-09-02', context)
		expect(resolved).toHaveLength(0)
	})
})
