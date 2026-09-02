import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SubjectPerformanceSummary } from '@/src/services/performance-data.service'
import { formatGradeAverage, formatGradeValue } from '@/src/services/grade-calculation.service'

interface SubjectPerformanceCardProps {
	summary: SubjectPerformanceSummary
	onPress?: () => void
}

/** Subject row on the performance tab. */
export function SubjectPerformanceCard({ summary, onPress }: SubjectPerformanceCardProps) {
	const { subject, averageLabel, targetGrade, belowTarget, recentGrades, gradeCount } =
		summary

	return (
		<Pressable onPress={onPress} style={styles.card}>
			<View style={[styles.accent, { backgroundColor: subject.color ?? '#2563EB' }]} />
			<View style={styles.content}>
				<View style={styles.headerRow}>
					<Text style={styles.name} numberOfLines={2}>
						{subject.name}
					</Text>
					{belowTarget ? (
						<View style={styles.badge}>
							<Text style={styles.badgeText}>Ниже цели</Text>
						</View>
					) : null}
				</View>

				<View style={styles.statsRow}>
					<View style={styles.stat}>
						<Text style={styles.statLabel}>
							{summary.isWeighted ? 'Средневзвешенный' : 'Средний балл'}
						</Text>
						<Text style={styles.statValue}>
							{gradeCount === 0 ? 'Оценок пока нет' : averageLabel}
						</Text>
					</View>
					{targetGrade !== null ? (
						<View style={styles.stat}>
							<Text style={styles.statLabel}>Цель</Text>
							<Text style={styles.statValue}>
								{formatGradeAverage(targetGrade)}
							</Text>
						</View>
					) : null}
				</View>

				{recentGrades.length > 0 ? (
					<Text style={styles.recent}>
						Последние:{' '}
						{recentGrades
							.map((value) => formatGradeValue(value, subject.gradeScale))
							.join(' · ')}
					</Text>
				) : null}
			</View>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	card: {
		flexDirection: 'row',
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#E2E8F0',
		marginBottom: 10,
		overflow: 'hidden',
	},
	accent: { width: 4 },
	content: { flex: 1, padding: 12 },
	headerRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: 8,
	},
	name: {
		flex: 1,
		fontSize: 16,
		fontWeight: '700',
		color: '#0F172A',
	},
	badge: {
		backgroundColor: '#FEF3C7',
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 8,
	},
	badgeText: {
		fontSize: 11,
		color: '#B45309',
		fontWeight: '600',
	},
	statsRow: {
		flexDirection: 'row',
		gap: 16,
		marginTop: 8,
	},
	stat: { flex: 1 },
	statLabel: {
		fontSize: 12,
		color: '#64748B',
	},
	statValue: {
		fontSize: 18,
		fontWeight: '700',
		color: '#0F172A',
		marginTop: 2,
	},
	recent: {
		fontSize: 13,
		color: '#64748B',
		marginTop: 8,
	},
})
