import type { Repositories } from '@/src/db/repositories'
import type { AppSettings, StudyPeriod } from '@/src/types/domain'
import type { ScheduleContext } from '@/src/types/schedule'

export interface AppBootstrapData {
	settings: AppSettings
	activePeriod: StudyPeriod | null
	scheduleContext: ScheduleContext | null
	isOnboarded: boolean
}

/** Load all data needed for schedule/today screens in minimal queries. */
export async function loadAppBootstrapData(
	repos: Repositories,
): Promise<AppBootstrapData> {
	const settings = await repos.appSettings.ensureExists()
	const activePeriod = settings.activeStudyPeriodId
		? (await repos.studyPeriods.getById(settings.activeStudyPeriodId))
		: await repos.studyPeriods.getActive()

	const isOnboarded = Boolean(activePeriod)

	if (!activePeriod) {
		return { settings, activePeriod: null, scheduleContext: null, isOnboarded }
	}

	const [entries, subjects, teachers, exceptions, holidays] = await Promise.all([
		repos.schedule.listByStudyPeriod(activePeriod.id),
		repos.subjects.listByStudyPeriod(activePeriod.id),
		repos.teachers.list(),
		repos.scheduleExceptions.listByStudyPeriod(activePeriod.id),
		repos.holidays.listByStudyPeriod(activePeriod.id),
	])

	const scheduleContext: ScheduleContext = {
		studyPeriodId: activePeriod.id,
		cycleLength: settings.cycleLength,
		cycleAnchorDate: settings.cycleAnchorDate,
		entries,
		subjects: new Map(subjects.map((item) => [item.id, item])),
		teachers: new Map(teachers.map((item) => [item.id, item])),
		exceptions,
		holidays,
	}

	return { settings, activePeriod, scheduleContext, isOnboarded }
}
