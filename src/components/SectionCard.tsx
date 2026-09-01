import { Pressable, StyleSheet, Text, View } from 'react-native'

interface SectionCardProps {
	title: string
	children: React.ReactNode
	actionLabel?: string
	onActionPress?: () => void
}

/** Card section used on the Today foundation screen. */
export function SectionCard({
	title,
	children,
	actionLabel,
	onActionPress,
}: SectionCardProps) {
	return (
		<View style={styles.card}>
			<View style={styles.header}>
				<Text style={styles.title}>{title}</Text>
				{actionLabel && onActionPress ? (
					<Pressable onPress={onActionPress} hitSlop={8}>
						<Text style={styles.action}>{actionLabel}</Text>
					</Pressable>
				) : null}
			</View>
			{children}
		</View>
	)
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
		borderWidth: 1,
		borderColor: '#E2E8F0',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
	title: {
		fontSize: 16,
		fontWeight: '600',
		color: '#0F172A',
	},
	action: {
		fontSize: 20,
		fontWeight: '600',
		color: '#2563EB',
	},
})
