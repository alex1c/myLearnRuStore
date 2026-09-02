import type { ScheduleWeekCycle } from '@/src/types/domain'

/** Human-readable cycle badge for two-week mode. */
export function getCycleBadgeLabel(cycleIndex: number): string {
	return cycleIndex === 0 ? 'Числитель' : 'Знаменатель'
}

/** UI options for lesson repeat selector in two-week mode. */
export const WEEK_CYCLE_OPTIONS: { value: ScheduleWeekCycle; label: string }[] = [
	{ value: 'EVERY_WEEK', label: 'Каждую неделю' },
	{ value: 'CYCLE_0', label: 'Только числитель' },
	{ value: 'CYCLE_1', label: 'Только знаменатель' },
]

/** Map domain week cycle to display label. */
export function getWeekCycleLabel(weekCycle: ScheduleWeekCycle): string {
	const option = WEEK_CYCLE_OPTIONS.find((item) => item.value === weekCycle)
	return option?.label ?? 'Каждую неделю'
}

/** Student lesson type options. */
export const LESSON_TYPE_OPTIONS = [
	'Лекция',
	'Практика',
	'Семинар',
	'Лабораторная',
	'Другое',
] as const
