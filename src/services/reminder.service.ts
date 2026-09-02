import type { Assignment, ReminderKind } from '@/src/types/domain'
import { addDays } from '@/src/utils/dates'
import { toMinutesSinceMidnight } from '@/src/utils/time'

/** UI preset for timed-deadline relative reminders. */
export interface RelativeReminderPreset {
	label: string
	minutes: number
	kind: 'RELATIVE'
}

/** UI preset for date-only deadline reminders. */
export interface DateOnlyReminderPreset {
	label: string
	kind: ReminderKind
	absoluteTime?: string
	absoluteDayOffset?: number
	relativeMinutes?: number
}

export const TIMED_REMINDER_PRESETS: RelativeReminderPreset[] = [
	{ label: 'За 15 минут', minutes: 15, kind: 'RELATIVE' },
	{ label: 'За 1 час', minutes: 60, kind: 'RELATIVE' },
	{ label: 'За 3 часа', minutes: 180, kind: 'RELATIVE' },
	{ label: 'За 1 день', minutes: 1440, kind: 'RELATIVE' },
]

export const DATE_ONLY_REMINDER_PRESETS: DateOnlyReminderPreset[] = [
	{ label: 'Утром в день срока', kind: 'MORNING_OF_DUE', absoluteTime: '09:00', absoluteDayOffset: 0 },
	{ label: 'Вечером накануне', kind: 'EVENING_BEFORE', absoluteTime: '18:00', absoluteDayOffset: -1 },
	{ label: 'За 1 день', kind: 'DAY_BEFORE', absoluteTime: '09:00', absoluteDayOffset: -1 },
]

/** Compute local Date when a reminder should fire. Returns null if in the past. */
export function computeReminderFireDate(
	assignment: Pick<Assignment, 'dueDate' | 'dueTime'>,
	config: {
		reminderKind: ReminderKind
		relativeMinutes?: number | null
		absoluteTime?: string | null
		absoluteDayOffset?: number
	},
	now: Date = new Date(),
): Date | null {
	if (config.reminderKind === 'NONE') {
		return null
	}

	let fireDate: Date

	if (config.reminderKind === 'RELATIVE') {
		if (!assignment.dueTime || !config.relativeMinutes) {
			return null
		}

		const [hours, minutes] = assignment.dueTime.split(':').map(Number)
		fireDate = new Date(
			Number(assignment.dueDate.slice(0, 4)),
			Number(assignment.dueDate.slice(5, 7)) - 1,
			Number(assignment.dueDate.slice(8, 10)),
			hours,
			minutes,
			0,
			0,
		)
		fireDate = new Date(fireDate.getTime() - config.relativeMinutes * 60_000)
	} else {
		const time =
			config.absoluteTime ??
			(config.reminderKind === 'EVENING_BEFORE' ? '18:00' : '09:00')
		const dayOffset = config.absoluteDayOffset ?? 0
		const targetDate =
			dayOffset === 0 ? assignment.dueDate : addDays(assignment.dueDate, dayOffset)
		const [hours, minutes] = time.split(':').map(Number)
		fireDate = new Date(
			Number(targetDate.slice(0, 4)),
			Number(targetDate.slice(5, 7)) - 1,
			Number(targetDate.slice(8, 10)),
			hours,
			minutes,
			0,
			0,
		)
	}

	if (fireDate.getTime() <= now.getTime()) {
		return null
	}

	return fireDate
}

/** Build notification body from assignment. */
export function buildReminderNotificationBody(
	assignment: Pick<Assignment, 'title'>,
	subjectName: string,
): { title: string; body: string } {
	return {
		title: subjectName,
		body: assignment.title,
	}
}

/** Validate custom absolute time string. */
export function parseCustomReminderTime(time: string): number | null {
	const match = /^(\d{2}):(\d{2})$/.exec(time)
	if (!match) {
		return null
	}

	return toMinutesSinceMidnight(time)
}
