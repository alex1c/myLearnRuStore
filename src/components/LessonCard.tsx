import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ScheduleOccurrence } from '@/src/types/schedule'
import { formatTimeRange } from '@/src/utils/format'

interface LessonCardProps {
	occurrence: ScheduleOccurrence
	onPress?: () => void
	variant?: 'default' | 'compact' | 'highlight' | 'muted'
}

/** Lesson card for schedule and today screens. */
export function LessonCard({
	occurrence,
	onPress,
	variant = 'default',
}: LessonCardProps) {
	const accentColor = occurrence.subjectColor ?? '#2563EB'
	const isMuted = variant === 'muted'

	return (
		<Pressable
			onPress={onPress}
			style={[
				styles.card,
				variant === 'highlight' && styles.cardHighlight,
				isMuted && styles.cardMuted,
			]}
		>
			<View style={[styles.accent, { backgroundColor: accentColor }]} />
			<View style={styles.content}>
				<Text style={[styles.time, isMuted && styles.textMuted]}>
					{formatTimeRange(occurrence.startTime, occurrence.endTime)}
				</Text>
				<Text style={[styles.subject, isMuted && styles.textMuted]} numberOfLines={2}>
					{occurrence.subjectName}
				</Text>
				{occurrence.lessonType ? (
					<Text style={styles.meta} numberOfLines={1}>
						{occurrence.lessonType}
					</Text>
				) : null}
				{occurrence.teacherName ? (
					<Text style={styles.meta} numberOfLines={1}>
						{occurrence.teacherName}
					</Text>
				) : null}
				{occurrence.room ? (
					<Text style={styles.meta} numberOfLines={1}>
						{occurrence.room}
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
		marginBottom: 8,
		overflow: 'hidden',
	},
	cardHighlight: {
		borderColor: '#2563EB',
		backgroundColor: '#F8FAFF',
	},
	cardMuted: {
		opacity: 0.65,
	},
	accent: {
		width: 4,
	},
	content: {
		flex: 1,
		padding: 12,
	},
	time: {
		fontSize: 13,
		color: '#64748B',
		marginBottom: 4,
	},
	subject: {
		fontSize: 16,
		fontWeight: '600',
		color: '#0F172A',
		marginBottom: 2,
	},
	meta: {
		fontSize: 14,
		color: '#64748B',
		lineHeight: 20,
	},
	textMuted: {
		color: '#94A3B8',
	},
})
