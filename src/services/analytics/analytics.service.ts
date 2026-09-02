import { APPMETRICA_API_KEY, type AnalyticsEventName, type AnalyticsParams } from '@/src/config/analytics'

type AppMetricaModule = {
	activate: (config: { apiKey: string; sessionTimeout?: number; logs?: boolean }) => void
	reportEvent: (name: string, params?: Record<string, string | number>) => void
}

let initialized = false
let appMetrica: AppMetricaModule | null = null

function loadAppMetrica(): AppMetricaModule | null {
	if (process.env.NODE_ENV === 'test') {
		return null
	}

	try {
		// Native module — unavailable in Jest and Expo Go.
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const module = require('@appmetrica/react-native-analytics')
		return module.default ?? module
	} catch {
		return null
	}
}

/** Initialize AppMetrica once per app process. Safe to call multiple times. */
export function initializeAnalytics(): void {
	if (initialized) {
		return
	}

	appMetrica = loadAppMetrica()
	if (!appMetrica) {
		initialized = true
		return
	}

	try {
		appMetrica.activate({
			apiKey: APPMETRICA_API_KEY,
			sessionTimeout: 120,
			logs: __DEV__,
		})
	} catch {
		// Analytics must never break user flows.
	}

	initialized = true
}

/** Sanitize params — only primitive non-text-heavy values allowed. */
function sanitizeParams(params?: AnalyticsParams): Record<string, string | number> | undefined {
	if (!params) {
		return undefined
	}

	const result: Record<string, string | number> = {}
	for (const [key, value] of Object.entries(params)) {
		if (value === null || value === undefined) {
			continue
		}

		if (typeof value === 'boolean') {
			result[key] = value ? 1 : 0
		} else if (typeof value === 'number' || typeof value === 'string') {
			result[key] = value
		}
	}

	return Object.keys(result).length > 0 ? result : undefined
}

/** Report an analytics event without PII. Never throws. */
export function trackEvent(name: AnalyticsEventName, params?: AnalyticsParams): void {
	if (!initialized) {
		initializeAnalytics()
	}

	if (!appMetrica) {
		return
	}

	try {
		const safeParams = sanitizeParams(params)
		if (safeParams) {
			appMetrica.reportEvent(name, safeParams)
		} else {
			appMetrica.reportEvent(name)
		}
	} catch {
		// Fail silently — analytics must not affect UX.
	}
}

/** Reset for tests. */
export function resetAnalyticsForTests(): void {
	initialized = false
	appMetrica = null
}
