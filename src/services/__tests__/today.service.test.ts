import type { ScheduleEntry, Subject, Teacher } from '@/src/types/domain'
import type { ScheduleContext } from '@/src/types/schedule'
import { getTodayLessonState, getLessonTimingStatus } from '@/src/services/today.service'
import { buildOccurrenceId, getScheduleForDate } from '@/src/services/occurrence.service'

const periodId = 'period-1'

const subject: Subject = {
	id: 'sub-1',
	studyPeriodId: periodId,
	name: 'Физика',
	shortName: null,
	color: null,
	roomDefault: '314',
	teacherId: 't-1',
	targetGrade: null,
	gradeScale: 'FIVE_POINT' as const,
	attendanceTarget: null,
	sortOrder: 0,
	isArchived: false,
	createdAt: '2025-01-01T00:00:00.000Z',
	updatedAt: '2025-01-01T00:00:00.000Z',
}

const teacher: Teacher = {
	id: 't-1',
	name: 'Петров И.И.',
	notes: null,
	createdAt: '2025-01-01T00:00:00.000Z',
	updatedAt: '2025-01-01T00:00:00.000Z',
}

function entry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
	return {
		id: 'entry-1',
		studyPeriodId: periodId,
		subjectId: subject.id,
		teacherId: teacher.id,
		room: '314',
		weekday: 2,
		startTime: '10:20',
		endTime: '11:50',
		lessonType: 'Лекция',
		weekCycle: 'EVERY_WEEK',
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		...overrides,
	}
}

function context(entries: ScheduleEntry[]): ScheduleContext {
	return {
		studyPeriodId: periodId,
		cycleLength: 1,
		cycleAnchorDate: null,
		entries,
		subjects: new Map([[subject.id, subject]]),
		teachers: new Map([[teacher.id, teacher]]),
		exceptions: [],
		holidays: [],
	}
}

describe('today service', () => {
	it('detects upcoming lesson', () => {
		const result = getTodayLessonState(
			context([entry()]),
			'2025-09-02',
			'09:00',
		)

		expect(result.status).toBe('upcoming')
		expect(result.occurrence?.subjectName).toBe('Физика')
		expect(result.minutesUntil).toBeGreaterThan(0)
	})

	it('detects ongoing lesson', () => {
		const result = getTodayLessonState(
			context([entry()]),
			'2025-09-02',
			'10:30',
		)

		expect(result.status).toBe('ongoing')
		expect(result.minutesRemaining).toBeGreaterThan(0)
	})

	it('detects finished day and finds next lesson tomorrow', () => {
		const result = getTodayLessonState(
			context([
				entry({ weekday: 2 }),
				entry({ id: 'entry-2', weekday: 3, startTime: '09:00', endTime: '09:45' }),
			]),
			'2025-09-02',
			'20:00',
		)

		expect(result.status).toBe('finished_today')
		expect(result.nextFuture?.date).toBe('2025-09-03')
	})

	it('handles empty schedule', () => {
		const result = getTodayLessonState(context([]), '2025-09-02', '12:00')
		expect(result.status).toBe('empty_schedule')
	})

	it('handles no lessons today with future occurrence', () => {
		const result = getTodayLessonState(
			context([entry({ weekday: 3 })]),
			'2025-09-02',
			'12:00',
		)

		expect(result.status).toBe('no_lessons_today')
		expect(result.nextFuture).not.toBeNull()
	})

	it('classifies lesson timing status', () => {
		const lesson = getScheduleForDate(
			'2025-09-02',
			context([entry()]),
		)[0]

		expect(getLessonTimingStatus(lesson, '09:00')).toBe('upcoming')
		expect(getLessonTimingStatus(lesson, '10:30')).toBe('ongoing')
		expect(getLessonTimingStatus(lesson, '12:00')).toBe('finished')
		expect(lesson.id).toBe(buildOccurrenceId('entry-1', '2025-09-02'))
	})
})
