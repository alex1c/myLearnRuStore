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

interface ShareCardProps {
	title: string
	subtitle?: string
	lines: string[]
	footer?: string
}

/** Off-screen-friendly card layout for optional image sharing. */
export function ShareCard({ title, subtitle, lines, footer }: ShareCardProps) {
	return (
		<View style={shareStyles.card}>
			<Text style={shareStyles.brand}>Моя учёба</Text>
			<Text style={shareStyles.title}>{title}</Text>
			{subtitle ? <Text style={shareStyles.subtitle}>{subtitle}</Text> : null}
			{lines.map((line, index) => (
				<Text key={`${index}-${line}`} style={shareStyles.line} numberOfLines={2}>
					{line}
				</Text>
			))}
			{footer ? <Text style={shareStyles.footer}>{footer}</Text> : null}
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

const shareStyles = StyleSheet.create({
	card: {
		backgroundColor: '#FFFFFF',
		padding: 24,
		width: 360,
		borderRadius: 16,
	},
	brand: {
		fontSize: 13,
		color: '#64748B',
		marginBottom: 8,
	},
	title: {
		fontSize: 22,
		fontWeight: '700',
		color: '#0F172A',
		marginBottom: 4,
	},
	subtitle: {
		fontSize: 14,
		color: '#64748B',
		marginBottom: 12,
	},
	line: {
		fontSize: 15,
		color: '#1E293B',
		marginBottom: 6,
	},
	footer: {
		fontSize: 12,
		color: '#94A3B8',
		marginTop: 12,
	},
})
