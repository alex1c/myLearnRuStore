/** Production Yandex Mobile Ads block IDs — public SDK identifiers. */
export const YANDEX_BANNER_TODAY_ID = 'R-M-19857798-1'
export const YANDEX_BANNER_PERFORMANCE_ID = 'R-M-19857798-2'
export const YANDEX_BANNER_FOCUS_ID = 'R-M-19857798-3'
export const YANDEX_INTERSTITIAL_ID = 'R-M-19857798-4'

/** Minimum app sessions before interstitial becomes eligible. */
export const AD_SESSION_THRESHOLD = 5

/** Cooldown between interstitials — 24 hours in milliseconds. */
export const INTERSTITIAL_COOLDOWN_MS = 24 * 60 * 60 * 1000

/** Contexts where interstitial may be shown after successful secondary action. */
export type InterstitialContext =
	| 'share_completed'
	| 'export_completed'
	| 'stats_exit'

/** Contexts where interstitial must never appear. */
export const FORBIDDEN_INTERSTITIAL_CONTEXTS = new Set([
	'app_launch',
	'onboarding',
	'notification_tap',
	'assignment_open',
	'assignment_create',
	'grade_add',
	'attendance_mark',
	'focus_start',
	'focus_running',
	'focus_complete',
	'backup',
	'restore',
	'error',
])
