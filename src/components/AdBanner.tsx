import * as React from 'react'
import { View, type ViewStyle } from 'react-native'

interface AdBannerProps {
	adUnitId: string
	style?: ViewStyle
}

/** Yandex banner slot — hidden when SDK unavailable or load fails. */
export function AdBanner({ adUnitId, style }: AdBannerProps) {
	const [loaded, setLoaded] = React.useState(false)

	const BannerView = React.useMemo(() => {
		if (process.env.NODE_ENV === 'test') {
			return null
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const module = require('yandex-mobile-ads')
			return module.BannerView ?? null
		} catch {
			return null
		}
	}, [])

	if (!BannerView) {
		return null
	}

	return (
		<View style={[style, loaded ? undefined : { height: 0, overflow: 'hidden' }]}>
			<BannerView
				adUnitId={adUnitId}
				size="adaptive"
				onAdLoaded={() => setLoaded(true)}
				onAdFailedToLoad={() => setLoaded(false)}
			/>
		</View>
	)
}
