import { Pressable, StyleSheet, Text, View } from 'react-native'
import { getCycleBadgeLabel } from '@/src/utils/cycle-labels'
import { formatWeekRange } from '@/src/utils/format'

interface WeekNavigatorProps {
	weekStart: string
	cycleLength: 1 | 2
	cycleIndex?: number
	onPrevious: () => void
	onNext: () => void
	onToday: () => void
}

/** Week header with navigation arrows and optional cycle badge. */
export function WeekNavigator({
	weekStart,
	cycleLength,
	cycleIndex,
	onPrevious,
	onNext,
	onToday,
}: WeekNavigatorProps) {
	return (
		<View style={styles.container}>
			<View style={styles.navRow}>
				<Pressable onPress={onPrevious} style={styles.arrow} hitSlop={8}>
					<Text style={styles.arrowText}>‹</Text>
				</Pressable>
				<View style={styles.center}>
					<Text style={styles.range}>{formatWeekRange(weekStart)}</Text>
					{cycleLength === 2 && cycleIndex !== undefined ? (
						<View style={styles.badge}>
							<Text style={styles.badgeText}>{getCycleBadgeLabel(cycleIndex)}</Text>
						</View>
					) : null}
				</View>
				<Pressable onPress={onNext} style={styles.arrow} hitSlop={8}>
					<Text style={styles.arrowText}>›</Text>
				</Pressable>
			</View>
			<Pressable onPress={onToday} style={styles.todayButton}>
				<Text style={styles.todayText}>Сегодня</Text>
			</Pressable>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		marginBottom: 12,
	},
	navRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	arrow: {
		width: 36,
		height: 36,
		alignItems: 'center',
		justifyContent: 'center',
	},
	arrowText: {
		fontSize: 28,
		color: '#2563EB',
		lineHeight: 30,
	},
	center: {
		alignItems: 'center',
		flex: 1,
	},
	range: {
		fontSize: 16,
		fontWeight: '600',
		color: '#0F172A',
	},
	badge: {
		marginTop: 4,
		backgroundColor: '#EEF2FF',
		paddingHorizontal: 10,
		paddingVertical: 2,
		borderRadius: 12,
	},
	badgeText: {
		fontSize: 12,
		color: '#4338CA',
		fontWeight: '600',
	},
	todayButton: {
		alignSelf: 'center',
		marginTop: 8,
		paddingHorizontal: 12,
		paddingVertical: 4,
	},
	todayText: {
		fontSize: 14,
		color: '#2563EB',
		fontWeight: '600',
	},
})
