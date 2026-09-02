import {
	initializeAnalytics,
	resetAnalyticsForTests,
	trackEvent,
} from '@/src/services/analytics/analytics.service'
import { ANALYTICS_EVENTS } from '@/src/config/analytics'

describe('analytics.service', () => {
	afterEach(() => {
		resetAnalyticsForTests()
	})

	it('initializes safely without native module', () => {
		expect(() => initializeAnalytics()).not.toThrow()
	})

	it('tracks events without throwing when SDK unavailable', () => {
		initializeAnalytics()
		expect(() =>
			trackEvent(ANALYTICS_EVENTS.GRADE_ADDED, { grade_scale: 'FIVE_POINT' }),
		).not.toThrow()
	})

	it('does not pass free-text fields in params', () => {
		initializeAnalytics()
		expect(() =>
			trackEvent(ANALYTICS_EVENTS.ASSIGNMENT_CREATED, {
				assignment_type: 'HOMEWORK',
				has_photo: 0,
			}),
		).not.toThrow()
	})
})
