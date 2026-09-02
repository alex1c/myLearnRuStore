import AsyncStorage from '@react-native-async-storage/async-storage'
import {
	canShowInterstitial,
	incrementSessionCount,
	recordInterstitialShown,
	type AdSessionState,
} from '@/src/services/ads/ad-session.service'
import {
	INTERSTITIAL_COOLDOWN_MS,
	type InterstitialContext,
	YANDEX_INTERSTITIAL_ID,
} from '@/src/config/ads'

const STORAGE_KEY = 'mylearn_ad_session_state'

let shownThisSession = false
let interstitialLoader: {
	load: (config: { adUnitId: string }) => Promise<{ show: () => Promise<void> }>
} | null = null
let mobileAdsInitialized = false

function loadMobileAds() {
	if (process.env.NODE_ENV === 'test') {
		return null
	}

	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		return require('yandex-mobile-ads')
	} catch {
		return null
	}
}

/** Initialize Yandex Mobile Ads SDK once. Never throws. */
export async function initializeMobileAds(): Promise<void> {
	if (mobileAdsInitialized) {
		return
	}

	const module = loadMobileAds()
	if (!module?.MobileAds) {
		mobileAdsInitialized = true
		return
	}

	try {
		await module.MobileAds.initialize()
		interstitialLoader = module.InterstitialAdLoader
	} catch {
		// Ad SDK failure must not affect app functionality.
	}

	mobileAdsInitialized = true
}

async function readState(): Promise<AdSessionState> {
	try {
		const raw = await AsyncStorage.getItem(STORAGE_KEY)
		if (!raw) {
			return { sessionCount: 0, lastInterstitialAt: null }
		}

		return JSON.parse(raw) as AdSessionState
	} catch {
		return { sessionCount: 0, lastInterstitialAt: null }
	}
}

async function writeState(state: AdSessionState): Promise<void> {
	await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/** Call once when app process starts — increments persisted session count. */
export async function registerAppSessionStart(): Promise<void> {
	const state = await readState()
	await writeState(incrementSessionCount(state))
	shownThisSession = false
}

/** Attempt to show interstitial when gating allows. Never throws. */
export async function maybeShowInterstitial(context: InterstitialContext): Promise<boolean> {
	const state = await readState()
	const eligible = canShowInterstitial({
		state,
		nowMs: Date.now(),
		context,
		shownThisSession,
	})

	if (!eligible || !interstitialLoader) {
		return false
	}

	try {
		const ad = await interstitialLoader.load({ adUnitId: YANDEX_INTERSTITIAL_ID })
		await ad.show()
		shownThisSession = true
		await writeState(recordInterstitialShown(state, Date.now()))
		return true
	} catch {
		return false
	}
}

export const INTERSTITIAL_COOLDOWN = INTERSTITIAL_COOLDOWN_MS

/** Reset runtime ad session flags for tests. */
export function resetAdRuntimeForTests(): void {
	shownThisSession = false
	mobileAdsInitialized = false
	interstitialLoader = null
}

export async function resetAdStorageForTests(): Promise<void> {
	await AsyncStorage.removeItem(STORAGE_KEY)
	resetAdRuntimeForTests()
}

/** Test helper to mark interstitial shown in current session. */
export function markInterstitialShownThisSessionForTests(): void {
	shownThisSession = true
}

/** Test helper to read shownThisSession. */
export function isInterstitialShownThisSessionForTests(): boolean {
	return shownThisSession
}
