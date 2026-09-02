/** Production AppMetrica API key — public SDK identifier, not a secret. */
export const APPMETRICA_API_KEY = 'd01150e2-2267-4a63-ab39-622ab5c0f2ca'

export const ANALYTICS_EVENTS = {
	APP_OPEN: 'app_open',
	ONBOARDING_COMPLETED: 'onboarding_completed',
	SCHEDULE_LESSON_CREATED: 'schedule_lesson_created',
	ASSIGNMENT_CREATED: 'assignment_created',
	ASSIGNMENT_COMPLETED: 'assignment_completed',
	GRADE_ADDED: 'grade_added',
	ATTENDANCE_MARKED: 'attendance_marked',
	FOCUS_STARTED: 'focus_started',
	FOCUS_COMPLETED: 'focus_completed',
	SCHEDULE_SHARED: 'schedule_shared',
	SCHEDULE_EXPORTED: 'schedule_exported',
	SCHEDULE_IMPORTED: 'schedule_imported',
	BACKUP_CREATED: 'backup_created',
	BACKUP_RESTORED: 'backup_restored',
} as const

export type AnalyticsEventName =
	(typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

/** Allowed analytics parameter keys — no free-text user content. */
export type AnalyticsParams = Record<
	string,
	string | number | boolean | null | undefined
>
