import type { Grade, LocalDate, Subject } from '@/src/types/domain'
import type { ScheduleOccurrence } from '@/src/types/schedule'
import type { FocusStatsSummary } from '@/src/services/focus-stats.service'
import { formatGradeAverage } from '@/src/services/grade-calculation.service'
import { formatDisplayDate, getWeekday } from '@/src/utils/dates'
import { formatDurationSeconds } from '@/src/utils/duration'
import { formatWeekRange, formatTimeRange } from '@/src/utils/format'

const WEEKDAY_NAMES = [
	'Воскресенье',
	'Понедельник',
	'Вторник',
	'Среда',
	'Четверг',
	'Пятница',
	'Суббота',
]

const FOOTER = '\n\nСоздано в «Моя учёба»'

function weekdayLabel(date: LocalDate): string {
	const weekday = getWeekday(date)
	return WEEKDAY_NAMES[weekday === 7 ? 0 : weekday]
}

/** Share text for one day's resolved schedule occurrences. */
export function formatShareTodaySchedule(
	date: LocalDate,
	occurrences: ScheduleOccurrence[],
): string {
	const lines: string[] = [`**Сегодня, ${formatDisplayDate(date)}**`, '']

	if (occurrences.length === 0) {
		lines.push('Занятий нет.')
	} else {
		for (const lesson of occurrences) {
			lines.push(`${lesson.startTime}–${lesson.endTime} ${lesson.subjectName}`)
			const details = [lesson.teacherName, lesson.room].filter(Boolean).join(' · ')
			if (details) {
				lines.push(details)
			}
			lines.push('')
		}
	}

	return lines.join('\n').trim() + FOOTER
}

/** Share text for a week of resolved occurrences grouped by day. */
export function formatShareWeekSchedule(
	weekStart: LocalDate,
	days: { date: LocalDate; occurrences: ScheduleOccurrence[] }[],
): string {
	const lines: string[] = [`**Расписание на ${formatWeekRange(weekStart)}**`, '']

	for (const day of days) {
		lines.push(weekdayLabel(day.date))
		if (day.occurrences.length === 0) {
			lines.push('—')
		} else {
			for (const lesson of day.occurrences) {
				const room = lesson.room ? ` — ${lesson.room}` : ''
				lines.push(`${lesson.startTime} ${lesson.subjectName}${room}`)
			}
		}
		lines.push('')
	}

	return lines.join('\n').trim() + FOOTER
}

/** Share text for a single lesson occurrence. */
export function formatShareLesson(occurrence: ScheduleOccurrence): string {
	const lines = [
		`**${occurrence.subjectName}**`,
		`${formatTimeRange(occurrence.startTime, occurrence.endTime)}`,
	]

	if (occurrence.teacherName) {
		lines.push(occurrence.teacherName)
	}

	if (occurrence.room) {
		lines.push(`каб. ${occurrence.room}`)
	}

	return lines.join('\n') + FOOTER
}

/** Share text for one assignment. */
export function formatShareAssignment(input: {
	subjectName: string
	title: string
	dueLabel: string
	notes?: string | null
}): string {
	const lines = [
		`**${input.subjectName}**`,
		'',
		input.title,
		`Срок: ${input.dueLabel}`,
	]

	if (input.notes?.trim()) {
		lines.push('', input.notes.trim())
	}

	return lines.join('\n') + FOOTER
}

/** Share text for tomorrow's homework list. */
export function formatShareTomorrowHomework(
	items: { subjectName: string; title: string }[],
): string {
	const lines = ['**Задания на завтра**', '']

	if (items.length === 0) {
		lines.push('Заданий нет.')
	} else {
		for (const item of items) {
			lines.push(`${item.subjectName} — ${item.title}`)
		}
	}

	return lines.join('\n') + FOOTER
}

/** Share text for subject grade progress. */
export function formatShareGradeProgress(input: {
	subject: Subject
	average: number | null
	recentGrades: Grade[]
}): string {
	const lines = [`**${input.subject.name}**`, '']

	if (input.average !== null) {
		lines.push(`Средний балл: ${formatGradeAverage(input.average)}`)
	}

	if (input.subject.targetGrade !== null) {
		lines.push(`Цель: ${formatGradeAverage(input.subject.targetGrade)}`)
	}

	if (input.recentGrades.length > 0) {
		const values = input.recentGrades
			.slice(0, 5)
			.map((item) => String(item.value))
			.join(', ')
		lines.push(`Последние оценки: ${values}`)
	}

	return lines.join('\n') + FOOTER
}

/** Share text for focus stats summary. */
export function formatShareFocusStats(
	periodLabel: string,
	stats: FocusStatsSummary,
): string {
	const lines = [
		`**Учёба за ${periodLabel}**`,
		'',
		`Всего: ${formatDurationSeconds(stats.totalSeconds)}`,
		'',
	]

	for (const item of stats.bySubject.slice(0, 10)) {
		lines.push(`${item.subjectName} — ${formatDurationSeconds(item.totalSeconds)}`)
	}

	return lines.join('\n') + FOOTER
}
