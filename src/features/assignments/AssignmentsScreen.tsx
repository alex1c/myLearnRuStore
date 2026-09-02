import * as React from 'react'
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { AssignmentCard } from '@/src/components/AssignmentCard'
import { EmptyState } from '@/src/components/EmptyState'
import { FilterChips } from '@/src/components/FilterChips'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { Snackbar } from '@/src/components/Snackbar'
import { useAppData } from '@/src/context/AppDataContext'
import {
	filterAssignments,
	groupAssignmentsByDate,
	splitActiveAndCompleted,
} from '@/src/services/assignment-query.service'
import {
	completeAssignment,
	reopenAssignment,
} from '@/src/services/assignment.service'
import type { AssignmentFilter, AssignmentListItem } from '@/src/types/assignment'

/** Full assignments tab with filters, grouping, and quick complete. */
export function AssignmentsScreen() {
	const router = useRouter()
	const { repositories, refresh, refreshKey } = useAppData()
	const [filter, setFilter] = React.useState<AssignmentFilter>('upcoming')
	const [items, setItems] = React.useState<AssignmentListItem[]>([])
	const [showCompleted, setShowCompleted] = React.useState(false)
	const [undoState, setUndoState] = React.useState<{
		item: AssignmentListItem
	} | null>(null)

	React.useEffect(() => {
		if (!repositories) {
			return
		}

		let mounted = true
		void repositories.assignments.listAll().then((result) => {
			if (mounted) {
				setItems(result)
			}
		})
		return () => {
			mounted = false
		}
	}, [repositories, refreshKey])

	const filtered = React.useMemo(
		() => filterAssignments(items, filter),
		[items, filter],
	)

	const groups = React.useMemo(
		() => groupAssignmentsByDate(filtered),
		[filtered],
	)

	const { completed } = React.useMemo(
		() => splitActiveAndCompleted(items),
		[items],
	)

	async function handleToggleComplete(item: AssignmentListItem) {
		if (!repositories) {
			return
		}

		if (item.status === 'COMPLETED') {
			await reopenAssignment(repositories, item.id, item.subjectName)
			await refresh()
			return
		}

		await completeAssignment(repositories, item.id)
		setUndoState({ item })
		await refresh()
	}

	async function handleUndo() {
		if (!repositories || !undoState) {
			return
		}

		await reopenAssignment(
			repositories,
			undoState.item.id,
			undoState.item.subjectName,
		)
		setUndoState(null)
		await refresh()
	}

	React.useEffect(() => {
		if (!undoState) {
			return
		}

		const timer = setTimeout(() => setUndoState(null), 5000)
		return () => clearTimeout(timer)
	}, [undoState])

	function renderEmpty() {
		if (filter === 'overdue') {
			return <EmptyState title="Просроченных заданий нет" />
		}

		return (
			<EmptyState
				title="Заданий пока нет"
				description="Добавьте домашнее задание, контрольную или экзамен."
				actionLabel="Добавить задание"
				onActionPress={() => router.push('/assignment-form')}
			/>
		)
	}

	return (
		<ScreenContainer title="Задания">
			<FilterChips selected={filter} onSelect={setFilter} />

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.scroll}
			>
				{groups.length === 0 && filter !== 'all' ? (
					renderEmpty()
				) : (
					groups.map((group) => (
						<View key={group.dueDate} style={styles.group}>
							<Text style={styles.groupTitle}>{group.dateLabel}</Text>
							{group.items.map((item) => (
								<AssignmentCard
									key={item.id}
									item={item}
									onPress={() => router.push(`/assignment-form?id=${item.id}`)}
									onToggleComplete={() => void handleToggleComplete(item)}
								/>
							))}
						</View>
					))
				)}

				{filter === 'all' && completed.length > 0 ? (
					<View style={styles.group}>
						<Pressable
							onPress={() => setShowCompleted((value) => !value)}
							style={styles.completedHeader}
						>
							<Text style={styles.groupTitle}>
								Выполнено ({completed.length})
							</Text>
							<Text style={styles.chevron}>{showCompleted ? '▲' : '▼'}</Text>
						</Pressable>
						{showCompleted
							? completed.map((item) => (
									<AssignmentCard
										key={item.id}
										item={item}
										onPress={() => router.push(`/assignment-form?id=${item.id}`)}
										onToggleComplete={() => void handleToggleComplete(item)}
									/>
								))
							: null}
					</View>
				) : null}
			</ScrollView>

			<Pressable
				style={styles.fab}
				onPress={() => router.push('/assignment-form')}
				accessibilityRole="button"
				accessibilityLabel="Добавить задание"
			>
				<Text style={styles.fabText}>+</Text>
			</Pressable>

			<Snackbar
				visible={undoState !== null}
				message="Задание выполнено"
				actionLabel="Отменить"
				onAction={() => void handleUndo()}
			/>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	scroll: {
		paddingBottom: 96,
	},
	group: {
		marginBottom: 16,
	},
	groupTitle: {
		fontSize: 15,
		fontWeight: '700',
		color: '#334155',
		marginBottom: 8,
	},
	completedHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	chevron: {
		fontSize: 12,
		color: '#64748B',
	},
	fab: {
		position: 'absolute',
		right: 20,
		bottom: 24,
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: '#2563EB',
		alignItems: 'center',
		justifyContent: 'center',
		elevation: 4,
	},
	fabText: {
		color: '#FFFFFF',
		fontSize: 28,
		lineHeight: 30,
	},
})
