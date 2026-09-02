import type {
	Holiday,
	ScheduleEntry,
	ScheduleException,
	Subject,
	Teacher,
} from '@/src/types/domain'
import type { ScheduleContext } from '@/src/types/schedule'
import {
	buildOccurrenceId,
	getCycleIndexForDate,
	getScheduleForDate,
	isHolidayDate,
} from '@/src/services/occurrence.service'

const periodId = 'period-1'
const subjectMath: Subject = {
	id: 'sub-math',
	studyPeriodId: periodId,
	name: 'Математика',
	shortName: 'Мат',
	color: '#4F46E5',
	roomDefault: '204',
	teacherId: 'teacher-1',
	targetGrade: null,
	sortOrder: 1,
	isArchived: false,
	createdAt: '2025-01-01T00:00:00.000Z',
	updatedAt: '2025-01-01T00:00:00.000Z',
}

const teacher: Teacher = {
	id: 'teacher-1',
	name: 'Иванов А.П.',
	notes: null,
	createdAt: '2025-01-01T00:00:00.000Z',
	updatedAt: '2025-01-01T00:00:00.000Z',
}

function buildEntry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
	return {
		id: 'entry-1',
		studyPeriodId: periodId,
		subjectId: subjectMath.id,
		teacherId: teacher.id,
		room: '204',
		weekday: 1,
		startTime: '09:00',
		endTime: '09:45',
		lessonType: null,
		weekCycle: 'EVERY_WEEK',
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		...overrides,
	}
}

function buildContext(overrides: Partial<ScheduleContext> = {}): ScheduleContext {
	return {
		studyPeriodId: periodId,
		cycleLength: 1,
		cycleAnchorDate: '2025-09-01',
		entries: [buildEntry()],
		subjects: new Map([[subjectMath.id, subjectMath]]),
		teachers: new Map([[teacher.id, teacher]]),
		exceptions: [],
		holidays: [],
		...overrides,
	}
}

describe('occurrence service', () => {
	it('returns weekly schedule sorted by start time', () => {
		const context = buildContext({
			entries: [
				buildEntry({ id: 'e2', startTime: '11:00', endTime: '11:45' }),
				buildEntry({ id: 'e1', startTime: '09:00', endTime: '09:45' }),
			],
		})

		const result = getScheduleForDate('2025-09-01', context)
		expect(result).toHaveLength(2)
		expect(result[0].startTime).toBe('09:00')
		expect(result[1].startTime).toBe('11:00')
	})

	it('filters CYCLE_0 and CYCLE_1 entries', () => {
		const context = buildContext({
			cycleLength: 2,
			cycleAnchorDate: '2025-09-01',
			entries: [
				buildEntry({ id: 'c0', weekCycle: 'CYCLE_0' }),
				buildEntry({ id: 'c1', weekCycle: 'CYCLE_1', startTime: '10:00', endTime: '10:45' }),
			],
		})

		const cycle0Day = getScheduleForDate('2025-09-01', context)
		expect(cycle0Day).toHaveLength(1)
		expect(cycle0Day[0].id).toBe(buildOccurrenceId('c0', '2025-09-01'))

		const cycle1Day = getScheduleForDate('2025-09-08', context)
		expect(cycle1Day).toHaveLength(1)
		expect(cycle1Day[0].id).toBe(buildOccurrenceId('c1', '2025-09-08'))
	})

	it('applies cancelled and override exceptions', () => {
		const cancelled: ScheduleException = {
			id: 'ex-cancel',
			studyPeriodId: periodId,
			exceptionDate: '2025-09-01',
			scheduleEntryId: 'entry-1',
			exceptionType: 'CANCELLED',
			subjectId: null,
			teacherId: null,
			room: null,
			startTime: null,
			endTime: null,
			newDate: null,
			notes: null,
			createdAt: '2025-01-01T00:00:00.000Z',
			updatedAt: '2025-01-01T00:00:00.000Z',
		}

		const override: ScheduleException = {
			...cancelled,
			id: 'ex-override',
			scheduleEntryId: 'entry-1',
			exceptionType: 'TIME_CHANGE',
			exceptionDate: '2025-09-08',
			startTime: '12:00',
			endTime: '12:45',
			room: '305',
			teacherId: teacher.id,
		}

		const cancelledContext = buildContext({ exceptions: [cancelled] })
		expect(getScheduleForDate('2025-09-01', cancelledContext)).toHaveLength(0)

		const overrideContext = buildContext({
			cycleLength: 2,
			entries: [buildEntry({ weekCycle: 'CYCLE_1' })],
			exceptions: [override],
		})
		const result = getScheduleForDate('2025-09-08', overrideContext)
		expect(result[0].startTime).toBe('12:00')
		expect(result[0].room).toBe('305')
	})

	it('suppresses regular lessons on holidays but keeps ADDED lessons', () => {
		const holiday: Holiday = {
			id: 'hol-1',
			name: 'Каникулы',
			startDate: '2025-09-01',
			endDate: '2025-09-07',
			studyPeriodId: periodId,
			createdAt: '2025-01-01T00:00:00.000Z',
			updatedAt: '2025-01-01T00:00:00.000Z',
		}

		const added: ScheduleException = {
			id: 'ex-added',
			studyPeriodId: periodId,
			exceptionDate: '2025-09-02',
			scheduleEntryId: null,
			exceptionType: 'ADDED',
			subjectId: subjectMath.id,
			teacherId: teacher.id,
			room: '101',
			startTime: '10:00',
			endTime: '10:45',
			newDate: null,
			notes: null,
			createdAt: '2025-01-01T00:00:00.000Z',
			updatedAt: '2025-01-01T00:00:00.000Z',
		}

		const context = buildContext({ holidays: [holiday], exceptions: [added] })
		expect(isHolidayDate('2025-09-02', context)).toBe(true)
		const result = getScheduleForDate('2025-09-02', context)
		expect(result).toHaveLength(1)
		expect(result[0].isOneOff).toBe(true)
	})

	it('computes cycle index across year boundary', () => {
		const context = buildContext({
			cycleLength: 2,
			cycleAnchorDate: '2025-12-29',
		})

		expect(getCycleIndexForDate('2025-12-29', context)).toBe(0)
		expect(getCycleIndexForDate('2026-01-05', context)).toBe(1)
	})
})
