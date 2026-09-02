import {
	canShowInterstitial,
	incrementSessionCount,
	recordInterstitialShown,
} from '@/src/services/ads/ad-session.service'
import { AD_SESSION_THRESHOLD, INTERSTITIAL_COOLDOWN_MS } from '@/src/config/ads'

describe('ad-session.service', () => {
	const baseState = { sessionCount: AD_SESSION_THRESHOLD, lastInterstitialAt: null }

	it('blocks interstitial when session count below threshold', () => {
		expect(
			canShowInterstitial({
				state: { sessionCount: 4, lastInterstitialAt: null },
				nowMs: 0,
				context: 'share_completed',
				shownThisSession: false,
			}),
		).toBe(false)
	})

	it('allows interstitial when all gates pass', () => {
		expect(
			canShowInterstitial({
				state: baseState,
				nowMs: INTERSTITIAL_COOLDOWN_MS + 1,
				context: 'share_completed',
				shownThisSession: false,
			}),
		).toBe(true)
	})

	it('blocks second interstitial in same session', () => {
		expect(
			canShowInterstitial({
				state: baseState,
				nowMs: INTERSTITIAL_COOLDOWN_MS + 1,
				context: 'share_completed',
				shownThisSession: true,
			}),
		).toBe(false)
	})

	it('blocks interstitial within 24h cooldown', () => {
		const now = 1_000_000
		expect(
			canShowInterstitial({
				state: { sessionCount: 10, lastInterstitialAt: now - 1000 },
				nowMs: now,
				context: 'export_completed',
				shownThisSession: false,
			}),
		).toBe(false)
	})

	it('blocks forbidden contexts', () => {
		expect(
			canShowInterstitial({
				state: baseState,
				nowMs: INTERSTITIAL_COOLDOWN_MS + 1,
				context: 'app_launch',
				shownThisSession: false,
			}),
		).toBe(false)
	})

	it('increments session count', () => {
		expect(incrementSessionCount({ sessionCount: 2, lastInterstitialAt: null }).sessionCount).toBe(3)
	})

	it('records interstitial timestamp', () => {
		const next = recordInterstitialShown(baseState, 5000)
		expect(next.lastInterstitialAt).toBe(5000)
	})
})
