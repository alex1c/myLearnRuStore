import * as React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

interface SnackbarProps {
	message: string
	actionLabel?: string
	onAction?: () => void
	visible: boolean
}

/** Simple bottom snackbar for undo actions. */
export function Snackbar({ message, actionLabel, onAction, visible }: SnackbarProps) {
	if (!visible) {
		return null
	}

	return (
		<View style={styles.container} pointerEvents="box-none">
			<View style={styles.bar}>
				<Text style={styles.message}>{message}</Text>
				{actionLabel && onAction ? (
					<Pressable onPress={onAction} hitSlop={8}>
						<Text style={styles.action}>{actionLabel}</Text>
					</Pressable>
				) : null}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		left: 16,
		right: 16,
		bottom: 24,
	},
	bar: {
		backgroundColor: '#1E293B',
		borderRadius: 10,
		paddingHorizontal: 16,
		paddingVertical: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
		elevation: 6,
	},
	message: {
		flex: 1,
		color: '#F8FAFC',
		fontSize: 14,
	},
	action: {
		color: '#93C5FD',
		fontSize: 14,
		fontWeight: '600',
	},
})
