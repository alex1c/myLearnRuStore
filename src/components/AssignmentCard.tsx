import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { AssignmentListItem } from '@/src/types/assignment'
import { getAssignmentDeadlineState } from '@/src/services/deadline.service'
import { formatAssignmentDueLabel } from '@/src/services/assignment-query.service'
import {
	ASSIGNMENT_TYPE_BADGE,
	shouldShowTypeBadge,
} from '@/src/utils/assignment-labels'

interface AssignmentCardProps {
	item: AssignmentListItem
	onPress?: () => void
	onToggleComplete?: () => void
}

/** Assignment list card with quick-complete toggle. */
export function AssignmentCard({
	item,
	onPress,
	onToggleComplete,
}: AssignmentCardProps) {
	const accentColor = item.subjectColor ?? '#2563EB'
	const state = getAssignmentDeadlineState(item)
	const isCompleted = item.status === 'COMPLETED'
	const isOverdue = state === 'OVERDUE'

	return (
		<Pressable onPress={onPress} style={[styles.card, isOverdue && styles.cardOverdue]}>
			<View style={[styles.accent, { backgroundColor: accentColor }]} />
			<View style={styles.content}>
				<View style={styles.topRow}>
					<Text style={styles.subject} numberOfLines={1}>
						{item.subjectName}
					</Text>
					{onToggleComplete ? (
						<Pressable
							onPress={(event) => {
								event.stopPropagation?.()
								onToggleComplete()
							}}
							hitSlop={8}
							style={styles.completeButton}
							accessibilityRole="checkbox"
							accessibilityState={{ checked: isCompleted }}
						>
							<Text style={[styles.completeIcon, isCompleted && styles.completeIconDone]}>
								{isCompleted ? '✓' : '○'}
							</Text>
						</Pressable>
					) : null}
				</View>
				<Text
					style={[styles.title, isCompleted && styles.titleCompleted]}
					numberOfLines={3}
				>
					{item.title}
				</Text>
				<View style={styles.metaRow}>
					<Text style={[styles.due, isOverdue && styles.dueOverdue]}>
						{formatAssignmentDueLabel(item)}
					</Text>
					{shouldShowTypeBadge(item.assignmentType) ? (
						<View style={styles.badge}>
							<Text style={styles.badgeText}>
								{ASSIGNMENT_TYPE_BADGE[item.assignmentType]}
							</Text>
						</View>
					) : null}
					{item.photoCount > 0 ? (
						<Text style={styles.indicator}>📷</Text>
					) : null}
					{item.hasReminder ? (
						<Text style={styles.indicator}>🔔</Text>
					) : null}
					{item.priority === 'HIGH' ? (
						<Text style={styles.priority}>!</Text>
					) : null}
				</View>
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
	cardOverdue: {
		borderColor: '#FECACA',
		backgroundColor: '#FFF7F7',
	},
	accent: {
		width: 4,
	},
	content: {
		flex: 1,
		padding: 12,
	},
	topRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 8,
	},
	subject: {
		flex: 1,
		fontSize: 13,
		color: '#64748B',
		fontWeight: '600',
	},
	completeButton: {
		padding: 4,
	},
	completeIcon: {
		fontSize: 20,
		color: '#94A3B8',
	},
	completeIconDone: {
		color: '#16A34A',
	},
	title: {
		fontSize: 16,
		fontWeight: '600',
		color: '#0F172A',
		marginTop: 4,
		lineHeight: 22,
	},
	titleCompleted: {
		textDecorationLine: 'line-through',
		color: '#94A3B8',
	},
	metaRow: {
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
		gap: 6,
		marginTop: 6,
	},
	due: {
		fontSize: 13,
		color: '#64748B',
	},
	dueOverdue: {
		color: '#DC2626',
		fontWeight: '600',
	},
	badge: {
		backgroundColor: '#EEF2FF',
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 8,
	},
	badgeText: {
		fontSize: 11,
		color: '#4338CA',
		fontWeight: '600',
	},
	indicator: {
		fontSize: 12,
	},
	priority: {
		fontSize: 14,
		color: '#DC2626',
		fontWeight: '700',
	},
})
