import {
	AD_SESSION_THRESHOLD,
	FORBIDDEN_INTERSTITIAL_CONTEXTS,
	INTERSTITIAL_COOLDOWN_MS,
	type InterstitialContext,
} from '@/src/config/ads'

export interface AdSessionState {
	sessionCount: number
	lastInterstitialAt: number | null
}

export interface InterstitialEligibilityInput {
	state: AdSessionState
	nowMs: number
	context: InterstitialContext | string
	shownThisSession: boolean
}

/** Pure gating logic for interstitial display eligibility. */
export function canShowInterstitial(input: InterstitialEligibilityInput): boolean {
	if (FORBIDDEN_INTERSTITIAL_CONTEXTS.has(input.context)) {
		return false
	}

	if (input.shownThisSession) {
		return false
	}

	if (input.state.sessionCount < AD_SESSION_THRESHOLD) {
		return false
	}

	if (
		input.state.lastInterstitialAt !== null &&
		input.nowMs - input.state.lastInterstitialAt < INTERSTITIAL_COOLDOWN_MS
	) {
		return false
	}

	return true
}

/** Increment session count when a new app process session starts. */
export function incrementSessionCount(state: AdSessionState): AdSessionState {
	return {
		...state,
		sessionCount: state.sessionCount + 1,
	}
}

/** Record that an interstitial was shown in the current session. */
export function recordInterstitialShown(
	state: AdSessionState,
	nowMs: number,
): AdSessionState {
	return {
		...state,
		lastInterstitialAt: nowMs,
	}
}
