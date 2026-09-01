import * as React from 'react'
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { EmptyState } from '@/src/components/EmptyState'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { SectionCard } from '@/src/components/SectionCard'
import { useDatabase } from '@/src/hooks/useDatabase'
import type { Repositories } from '@/src/db/repositories'
import { formatDisplayDate, getTodayLocalDate } from '@/src/utils/dates'

/** Today tab foundation — date header, next lesson placeholder, assignments preview. */
export function TodayScreen() {
	const { isReady, repositories } = useDatabase()
	const today = getTodayLocalDate()

	return (
		<ScreenContainer>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.scrollContent}
			>
				<Text style={styles.dateLabel}>{formatDisplayDate(today)}</Text>
				<Text style={styles.subtitle}>Сегодня</Text>

				<SectionCard title="Следующее занятие">
					<EmptyState
						title="Сегодня занятий нет"
						description="Добавьте расписание, чтобы видеть следующий урок."
					/>
				</SectionCard>

				<SectionCard
					title="Ближайшие задания"
					actionLabel="+"
					onActionPress={() => {}}
				>
					{!isReady ? (
						<ActivityIndicator color="#2563EB" />
					) : (
						<AssignmentsPreview repositories={repositories} />
					)}
				</SectionCard>
			</ScrollView>

			<Pressable
				style={styles.fab}
				accessibilityRole="button"
				accessibilityLabel="Добавить"
			>
				<Text style={styles.fabText}>+</Text>
			</Pressable>
		</ScreenContainer>
	)
}

function AssignmentsPreview({
	repositories,
}: {
	repositories: Repositories | null
}) {
	if (!repositories) {
		return (
			<EmptyState
				title="Заданий пока нет"
				description="Нажмите +, чтобы быстро записать домашнее задание."
			/>
		)
	}

	return <AssignmentsList repositories={repositories} />
}

function AssignmentsList({ repositories }: { repositories: Repositories }) {
	const [items, setItems] = React.useState<
		Awaited<ReturnType<typeof repositories.assignments.listUpcoming>>
	>([])

	React.useEffect(() => {
		let mounted = true
		void repositories.assignments.listUpcoming(5).then((result) => {
			if (mounted) {
				setItems(result)
			}
		})
		return () => {
			mounted = false
		}
	}, [repositories])

	if (items.length === 0) {
		return (
			<EmptyState
				title="Заданий пока нет"
				description="Нажмите +, чтобы быстро записать домашнее задание."
			/>
		)
	}

	return (
		<View style={styles.assignmentsList}>
			{items.map((item) => (
				<View key={item.id} style={styles.assignmentRow}>
					<Text style={styles.assignmentTitle}>{item.title}</Text>
					<Text style={styles.assignmentMeta}>{item.dueDate}</Text>
				</View>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	scrollContent: {
		paddingBottom: 96,
	},
	dateLabel: {
		fontSize: 14,
		color: '#64748B',
		marginBottom: 4,
	},
	subtitle: {
		fontSize: 28,
		fontWeight: '700',
		color: '#0F172A',
		marginBottom: 16,
	},
	assignmentsList: {
		gap: 8,
	},
	assignmentRow: {
		paddingVertical: 4,
	},
	assignmentTitle: {
		fontSize: 15,
		color: '#0F172A',
	},
	assignmentMeta: {
		fontSize: 13,
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
		fontWeight: '500',
	},
})
