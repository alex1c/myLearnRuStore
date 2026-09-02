import * as React from 'react'
import { getDatabase } from '@/src/db/database'
import { createRepositories, type Repositories } from '@/src/db/repositories'
import type { AppSettings, StudyPeriod } from '@/src/types/domain'
import type { ScheduleContext } from '@/src/types/schedule'
import { loadAppBootstrapData } from '@/src/services/schedule-data.service'
import { reconcileAssignmentReminders } from '@/src/services/assignment-reminder-sync.service'
import { recoverActiveFocusSession } from '@/src/services/focus-session.service'
import { initializeAnalytics, trackEvent } from '@/src/services/analytics/analytics.service'
import { ANALYTICS_EVENTS } from '@/src/config/analytics'
import {
	initializeMobileAds,
	registerAppSessionStart,
} from '@/src/services/ads/ads-runtime.service'

let bootstrapInitialized = false

interface AppDataContextValue {
	isReady: boolean
	error: Error | null
	repositories: Repositories | null
	settings: AppSettings | null
	activePeriod: StudyPeriod | null
	scheduleContext: ScheduleContext | null
	isOnboarded: boolean
	refreshKey: number
	refresh: () => Promise<void>
}

const AppDataContext = React.createContext<AppDataContextValue | null>(null)

/** Global app data provider with refresh support for schedule/today screens. */
export function AppDataProvider({ children }: { children: React.ReactNode }) {
	const [state, setState] = React.useState<Omit<AppDataContextValue, 'refresh'>>({
		isReady: false,
		error: null,
		repositories: null,
		settings: null,
		activePeriod: null,
		scheduleContext: null,
		isOnboarded: false,
		refreshKey: 0,
	})

	const load = React.useCallback(async () => {
		try {
			if (!bootstrapInitialized) {
				initializeAnalytics()
				await initializeMobileAds()
				await registerAppSessionStart()
				trackEvent(ANALYTICS_EVENTS.APP_OPEN)
				bootstrapInitialized = true
			}

			const db = await getDatabase()
			const repositories = createRepositories(db)
			const data = await loadAppBootstrapData(repositories)
			await reconcileAssignmentReminders(repositories)
			await recoverActiveFocusSession(repositories)

			setState((prev) => ({
				isReady: true,
				error: null,
				repositories,
				settings: data.settings,
				activePeriod: data.activePeriod,
				scheduleContext: data.scheduleContext,
				isOnboarded: data.isOnboarded,
				refreshKey: prev.refreshKey + 1,
			}))
		} catch (error) {
			setState((prev) => ({
				...prev,
				isReady: false,
				error: error instanceof Error ? error : new Error('Failed to load app data'),
			}))
		}
	}, [])

	React.useEffect(() => {
		void load()
	}, [load])

	const value = React.useMemo(
		() => ({
			...state,
			refresh: load,
		}),
		[state, load],
	)

	return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue {
	const context = React.useContext(AppDataContext)
	if (!context) {
		throw new Error('useAppData must be used within AppDataProvider')
	}

	return context
}
