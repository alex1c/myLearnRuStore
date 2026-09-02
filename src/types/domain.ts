/** User education mode stored in app settings. */
export type UserMode = 'SCHOOL' | 'COLLEGE' | 'UNIVERSITY'

/** Study period classification. */
export type StudyPeriodType = 'YEAR' | 'SEMESTER' | 'QUARTER'

/** How the app interprets repeating week cycles. */
export type WeekCycleMode = 'EVERY_WEEK' | 'TWO_WEEK'

/**
 * Schedule recurrence relative to a configured anchor week.
 * CYCLE_0 is the anchor week; CYCLE_1 is the alternating week.
 */
export type ScheduleWeekCycle = 'EVERY_WEEK' | 'CYCLE_0' | 'CYCLE_1'

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type AssignmentType =
	| 'HOMEWORK'
	| 'PROJECT'
	| 'ESSAY'
	| 'LAB'
	| 'TEST'
	| 'EXAM'
	| 'OTHER'

export type AssignmentPriority = 'LOW' | 'NORMAL' | 'HIGH'

export type AssignmentStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

/** How a reminder should fire relative to the assignment deadline. */
export type ReminderKind =
	| 'NONE'
	| 'RELATIVE'
	| 'MORNING_OF_DUE'
	| 'EVENING_BEFORE'
	| 'DAY_BEFORE'
	| 'CUSTOM_ABSOLUTE'

export type DeadlineState = 'UPCOMING' | 'DUE_TODAY' | 'OVERDUE' | 'COMPLETED'

export type ScheduleExceptionType =
	| 'CANCELLED'
	| 'RESCHEDULED'
	| 'ROOM_CHANGE'
	| 'TEACHER_CHANGE'
	| 'TIME_CHANGE'
	| 'ADDED'

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED'

export type GradeScale = 'FIVE_POINT' | 'TEN_POINT' | 'HUNDRED_POINT' | 'LETTER' | 'CUSTOM'

/** Local calendar date in YYYY-MM-DD format. */
export type LocalDate = string

/** Clock time in HH:MM 24-hour format. */
export type ClockTime = string

/** ISO-8601 timestamp string. */
export type Timestamp = string

export interface AppSettings {
	id: string
	userMode: UserMode
	activeStudyPeriodId: string | null
	defaultReminderMinutes: number
	weekCycleMode: WeekCycleMode
	cycleAnchorDate: LocalDate | null
	cycleLength: 1 | 2
	firstDayOfWeek: Weekday
	createdAt: Timestamp
	updatedAt: Timestamp
}

export interface StudyPeriod {
	id: string
	name: string
	type: StudyPeriodType
	startDate: LocalDate
	endDate: LocalDate
	isActive: boolean
	createdAt: Timestamp
	updatedAt: Timestamp
}

export interface Teacher {
	id: string
	name: string
	notes: string | null
	createdAt: Timestamp
	updatedAt: Timestamp
}

export interface Subject {
	id: string
	studyPeriodId: string
	name: string
	shortName: string | null
	color: string | null
	roomDefault: string | null
	teacherId: string | null
	targetGrade: number | null
	/** Default grading scale for new grades in this subject. */
	gradeScale: GradeScale
	/** Minimum attendance percentage target (0–100), student mode only. */
	attendanceTarget: number | null
	sortOrder: number
	isArchived: boolean
	createdAt: Timestamp
	updatedAt: Timestamp
}

/**
 * Regular schedule entry.
 * Classroom is stored as a room string snapshot — no separate classrooms table.
 */
export interface ScheduleEntry {
	id: string
	studyPeriodId: string
	subjectId: string
	teacherId: string | null
	room: string | null
	weekday: Weekday
	startTime: ClockTime
	endTime: ClockTime
	lessonType: string | null
	weekCycle: ScheduleWeekCycle
	createdAt: Timestamp
	updatedAt: Timestamp
}

export interface ScheduleException {
	id: string
	studyPeriodId: string
	exceptionDate: LocalDate
	scheduleEntryId: string | null
	exceptionType: ScheduleExceptionType
	subjectId: string | null
	teacherId: string | null
	room: string | null
	startTime: ClockTime | null
	endTime: ClockTime | null
	newDate: LocalDate | null
	notes: string | null
	createdAt: Timestamp
	updatedAt: Timestamp
}

export interface Assignment {
	id: string
	subjectId: string
	title: string
	description: string | null
	dueDate: LocalDate
	dueTime: ClockTime | null
	priority: AssignmentPriority
	status: AssignmentStatus
	assignmentType: AssignmentType
	sourceScheduleEntryId: string | null
	/** Local date of the lesson occurrence that spawned this assignment. */
	sourceOccurrenceDate: LocalDate | null
	completedAt: Timestamp | null
	notes: string | null
	createdAt: Timestamp
	updatedAt: Timestamp
}

export interface AssignmentPhoto {
	id: string
	assignmentId: string
	localUri: string
	createdAt: Timestamp
}

/** Persisted reminder intent — platform notification IDs are ephemeral. */
export interface AssignmentReminder {
	id: string
	assignmentId: string
	enabled: boolean
	reminderKind: ReminderKind
	relativeMinutes: number | null
	absoluteTime: ClockTime | null
	absoluteDayOffset: number
	scheduledAt: Timestamp | null
	notificationId: string | null
	createdAt: Timestamp
	updatedAt: Timestamp
}

export interface Grade {
	id: string
	subjectId: string
	value: number
	weight: number
	gradeType: string | null
	gradeScale: GradeScale
	date: LocalDate
	note: string | null
	assignmentId: string | null
	createdAt: Timestamp
	updatedAt: Timestamp
}

/**
 * Attendance is keyed by subject + date (+ optional schedule entry)
 * without pre-generating lesson occurrences.
 */
export interface Attendance {
	id: string
	subjectId: string
	scheduleEntryId: string | null
	attendanceDate: LocalDate
	status: AttendanceStatus
	notes: string | null
	createdAt: Timestamp
	updatedAt: Timestamp
}

export interface FocusSession {
	id: string
	subjectId: string | null
	assignmentId: string | null
	startedAt: Timestamp
	endedAt: Timestamp | null
	durationSeconds: number | null
	completed: boolean
	createdAt: Timestamp
}

export interface Holiday {
	id: string
	name: string
	startDate: LocalDate
	endDate: LocalDate
	studyPeriodId: string | null
	createdAt: Timestamp
	updatedAt: Timestamp
}
