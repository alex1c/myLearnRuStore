import * as React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { FocusDailyActivity } from '@/src/services/focus-stats.service'
import { formatDurationSeconds } from '@/src/utils/duration'

interface WeeklyActivityChartProps {
	days: FocusDailyActivity[]
}

/** Lightweight bar chart without external chart dependencies. */
export function WeeklyActivityChart({ days }: WeeklyActivityChartProps) {
	const maxSeconds = Math.max(...days.map((item) => item.totalSeconds), 1)

	return (
		<View style={styles.container}>
			{days.map((day) => {
				const height = Math.max(4, (day.totalSeconds / maxSeconds) * 80)
				return (
					<View key={day.date} style={styles.column}>
						<Text style={styles.minutes}>
							{day.totalSeconds > 0
								? Math.round(day.totalSeconds / 60)
								: ''}
						</Text>
						<View style={[styles.bar, { height }]} />
						<Text style={styles.label}>{day.label}</Text>
					</View>
				)
			})}
		</View>
	)
}

export function formatActivitySummary(days: FocusDailyActivity[]): string {
	const total = days.reduce((sum, item) => sum + item.totalSeconds, 0)
	return formatDurationSeconds(total)
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-end',
		paddingVertical: 12,
		gap: 4,
	},
	column: {
		flex: 1,
		alignItems: 'center',
	},
	bar: {
		width: '70%',
		backgroundColor: '#2563EB',
		borderRadius: 4,
		minHeight: 4,
	},
	label: {
		fontSize: 11,
		color: '#64748B',
		marginTop: 4,
	},
	minutes: {
		fontSize: 10,
		color: '#94A3B8',
		marginBottom: 2,
		minHeight: 12,
	},
})
