import type {
	ClockTime,
	LocalDate,
	ScheduleWeekCycle,
} from '@/src/types/domain'

/** Runtime lesson occurrence — not stored in SQLite. */
export interface ScheduleOccurrence {
	/** Stable key: `${scheduleEntryId}:${occurrenceDate}` or `added:${exceptionId}` */
	id: string
	scheduleEntryId: string | null
	exceptionId: string | null
	occurrenceDate: LocalDate
	subjectId: string
	subjectName: string
	subjectShortName: string | null
	subjectColor: string | null
	teacherId: string | null
	teacherName: string | null
	room: string | null
	startTime: ClockTime
	endTime: ClockTime
	lessonType: string | null
	weekCycle: ScheduleWeekCycle
	isCancelled: boolean
	isOneOff: boolean
	isRescheduled: boolean
}

export type LessonTimingStatus = 'upcoming' | 'ongoing' | 'finished'

export interface NextLessonResult {
	status: 'upcoming' | 'ongoing' | 'finished_today' | 'no_lessons_today' | 'empty_schedule'
	occurrence: ScheduleOccurrence | null
	minutesUntil: number | null
	minutesRemaining: number | null
	nextFuture: {
		occurrence: ScheduleOccurrence
		date: LocalDate
		dateLabel: string
	} | null
}

/** Preloaded schedule context for occurrence resolution. */
export interface ScheduleContext {
	studyPeriodId: string
	cycleLength: 1 | 2
	cycleAnchorDate: LocalDate | null
	entries: import('@/src/types/domain').ScheduleEntry[]
	subjects: Map<string, import('@/src/types/domain').Subject>
	teachers: Map<string, import('@/src/types/domain').Teacher>
	exceptions: import('@/src/types/domain').ScheduleException[]
	holidays: import('@/src/types/domain').Holiday[]
}
