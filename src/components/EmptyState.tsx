import { Pressable, StyleSheet, Text } from 'react-native'

interface EmptyStateProps {
	title: string
	description?: string
	actionLabel?: string
	onActionPress?: () => void
}

/** Reusable empty/foundation state for Phase 1 tabs. */
export function EmptyState({
	title,
	description,
	actionLabel,
	onActionPress,
}: EmptyStateProps) {
	return (
		<>
			<Text style={styles.title}>{title}</Text>
			{description ? <Text style={styles.description}>{description}</Text> : null}
			{actionLabel && onActionPress ? (
				<Pressable style={styles.button} onPress={onActionPress}>
					<Text style={styles.buttonText}>{actionLabel}</Text>
				</Pressable>
			) : null}
		</>
	)
}

const styles = StyleSheet.create({
	title: {
		fontSize: 16,
		fontWeight: '600',
		color: '#0F172A',
		marginBottom: 4,
	},
	description: {
		fontSize: 14,
		color: '#64748B',
		lineHeight: 20,
	},
	button: {
		marginTop: 12,
		alignSelf: 'flex-start',
		backgroundColor: '#2563EB',
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 8,
	},
	buttonText: {
		color: '#FFFFFF',
		fontWeight: '600',
	},
})
