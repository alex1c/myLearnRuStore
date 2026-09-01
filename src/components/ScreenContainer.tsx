import { StyleSheet, Text, View, type ViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ScreenContainerProps extends ViewProps {
	title?: string
}

/** Base screen wrapper with safe area and horizontal padding for 360dp+. */
export function ScreenContainer({
	title,
	children,
	style,
	...props
}: ScreenContainerProps) {
	const insets = useSafeAreaInsets()

	return (
		<View
			style={[
				styles.container,
				{
					paddingTop: insets.top + 8,
					paddingBottom: insets.bottom + 8,
				},
				style,
			]}
			{...props}
		>
			{title ? <Text style={styles.title}>{title}</Text> : null}
			{children}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: 16,
		backgroundColor: '#F8FAFC',
	},
	title: {
		fontSize: 24,
		fontWeight: '700',
		color: '#0F172A',
		marginBottom: 16,
	},
})
