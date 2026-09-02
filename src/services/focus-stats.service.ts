import type { FocusSession, LocalDate } from '@/src/types/domain'
import { addDays, getTodayLocalDate } from '@/src/utils/dates'

export type FocusStatsPeriod = 'today' | '7d' | '30d' | 'all'

export interface FocusStatsSummary {
	totalSeconds: number
	sessionCount: number
	averageSeconds: number
	bySubject: FocusSubjectStats[]
	dailyActivity: FocusDailyActivity[]
}

export interface FocusSubjectStats {
	subjectId: string
	subjectName: string
	totalSeconds: number
	sessionCount: number
}

export interface FocusDailyActivity {
	date: LocalDate
	label: string
	totalSeconds: number
}

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

/** Resolve inclusive local-date range for a stats period. */
export function resolveFocusStatsRange(
	period: FocusStatsPeriod,
	today: LocalDate = getTodayLocalDate(),
): { startDate: LocalDate | null; endDate: LocalDate } {
	if (period === 'all') {
		return { startDate: null, endDate: today }
	}

	if (period === 'today') {
		return { startDate: today, endDate: today }
	}

	const days = period === '7d' ? 6 : 29
	return { startDate: addDays(today, -days), endDate: today }
}

/** Filter sessions whose started_at falls within the local-date range. */
export function filterSessionsByPeriod(
	sessions: FocusSession[],
	period: FocusStatsPeriod,
	today: LocalDate = getTodayLocalDate(),
): FocusSession[] {
	const { startDate, endDate } = resolveFocusStatsRange(period, today)

	return sessions.filter((session) => {
		const sessionDate = session.startedAt.slice(0, 10)
		if (startDate && sessionDate < startDate) {
			return false
		}

		return sessionDate <= endDate
	})
}

/** Aggregate focus session stats for a period. */
export function buildFocusStatsSummary(
	sessions: FocusSession[],
	subjectNames: Map<string, string>,
	period: FocusStatsPeriod,
	today: LocalDate = getTodayLocalDate(),
): FocusStatsSummary {
	const filtered = filterSessionsByPeriod(sessions, period, today)
	const totalSeconds = filtered.reduce(
		(sum, item) => sum + (item.durationSeconds ?? 0),
		0,
	)
	const sessionCount = filtered.length
	const averageSeconds =
		sessionCount === 0 ? 0 : Math.round(totalSeconds / sessionCount)

	const bySubjectMap = new Map<string, { total: number; count: number }>()
	for (const session of filtered) {
		if (!session.subjectId) {
			continue
		}

		const current = bySubjectMap.get(session.subjectId) ?? { total: 0, count: 0 }
		current.total += session.durationSeconds ?? 0
		current.count += 1
		bySubjectMap.set(session.subjectId, current)
	}

	const bySubject = [...bySubjectMap.entries()]
		.map(([subjectId, stats]) => ({
			subjectId,
			subjectName: subjectNames.get(subjectId) ?? 'Без предмета',
			totalSeconds: stats.total,
			sessionCount: stats.count,
		}))
		.sort((a, b) => b.totalSeconds - a.totalSeconds)

	const dailyActivity = buildDailyActivity(filtered, period, today)

	return {
		totalSeconds,
		sessionCount,
		averageSeconds,
		bySubject,
		dailyActivity,
	}
}

function buildDailyActivity(
	sessions: FocusSession[],
	period: FocusStatsPeriod,
	today: LocalDate,
): FocusDailyActivity[] {
	if (period === 'all') {
		return []
	}

	const days = period === 'today' ? 1 : period === '7d' ? 7 : 30
	const startOffset = days - 1
	const buckets = new Map<string, number>()

	for (let offset = startOffset; offset >= 0; offset -= 1) {
		const date = addDays(today, -offset)
		buckets.set(date, 0)
	}

	for (const session of sessions) {
		const date = session.startedAt.slice(0, 10) as LocalDate
		if (buckets.has(date)) {
			buckets.set(date, (buckets.get(date) ?? 0) + (session.durationSeconds ?? 0))
		}
	}

	return [...buckets.entries()].map(([date, totalSeconds]) => {
		const weekday = new Date(`${date}T12:00:00`).getDay()
		return {
			date,
			label: period === 'today' ? 'Сегодня' : WEEKDAY_SHORT[weekday],
			totalSeconds,
		}
	})
}

/** Sum focus duration for one assignment across all sessions. */
export function sumAssignmentFocusSeconds(sessions: FocusSession[]): number {
	return sessions.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0)
}
