import * as React from 'react'
import { Dimensions, View, type ViewStyle } from 'react-native'

interface AdBannerProps {
	adUnitId: string
	style?: ViewStyle
}

type BannerAdSizeLike = {
	width: number
	height: number
}

type BannerViewComponent = React.ComponentType<{
	size: BannerAdSizeLike
	adRequest: { adUnitId: string }
	onAdLoaded?: () => void
	onAdFailedToLoad?: () => void
	style?: ViewStyle
}>

type YandexAdsModule = {
	BannerView?: BannerViewComponent
	BannerAdSize?: {
		stickySize: (width: number) => Promise<BannerAdSizeLike>
	}
}

function loadYandexModule(): YandexAdsModule | null {
	if (process.env.NODE_ENV === 'test') {
		return null
	}

	try {
		// Native module — unavailable in Jest / Expo Go.
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		return require('yandex-mobile-ads') as YandexAdsModule
	} catch {
		return null
	}
}

/**
 * Yandex sticky banner slot.
 * Hidden until size is ready and the ad loads; never crashes the host screen.
 */
export function AdBanner({ adUnitId, style }: AdBannerProps) {
	const [adSize, setAdSize] = React.useState<BannerAdSizeLike | null>(null)
	const [loaded, setLoaded] = React.useState(false)
	const [failed, setFailed] = React.useState(false)
	const moduleRef = React.useRef<YandexAdsModule | null>(loadYandexModule())

	React.useEffect(() => {
		let cancelled = false
		const ads = moduleRef.current
		if (!ads?.BannerAdSize) {
			setFailed(true)
			return
		}

		void (async () => {
			try {
				const width = Math.floor(Dimensions.get('window').width)
				const size = await ads.BannerAdSize!.stickySize(width)
				if (!cancelled) {
					setAdSize(size)
				}
			} catch {
				if (!cancelled) {
					setFailed(true)
				}
			}
		})()

		return () => {
			cancelled = true
		}
	}, [])

	const BannerView = moduleRef.current?.BannerView
	if (failed || !BannerView || !adSize) {
		return null
	}

	return (
		<View style={[style, loaded ? undefined : { height: 0, overflow: 'hidden' }]}>
			<BannerView
				size={adSize}
				adRequest={{ adUnitId }}
				onAdLoaded={() => setLoaded(true)}
				onAdFailedToLoad={() => {
					setLoaded(false)
					setFailed(true)
				}}
			/>
		</View>
	)
}
