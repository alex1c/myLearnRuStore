import * as React from 'react'
import {
	ActionSheetIOS,
	Alert,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { EmptyState } from '@/src/components/EmptyState'
import { LessonCard } from '@/src/components/LessonCard'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { SectionCard } from '@/src/components/SectionCard'
import { useAppData } from '@/src/context/AppDataContext'
import { getCycleIndexForDate, getScheduleForDate } from '@/src/services/occurrence.service'
import {
	formatNextFutureDetailed,
	getTodayLessonState,
	getLessonTimingStatus,
} from '@/src/services/today.service'
import { formatMinutesUntil } from '@/src/utils/format'
import { getCycleBadgeLabel } from '@/src/utils/cycle-labels'
import { formatDisplayDate, getTodayLocalDate } from '@/src/utils/dates'

/** Today dashboard with next lesson, daily schedule, and assignments preview. */
export function TodayScreen() {
	const router = useRouter()
	const { scheduleContext, settings, repositories, refreshKey, isReady } = useAppData()
	const today = getTodayLocalDate()

	const lessonState = React.useMemo(() => {
		if (!scheduleContext) {
			return null
		}

		return getTodayLessonState(scheduleContext, today)
	}, [scheduleContext, today, refreshKey]) // refreshKey forces reload after mutations

	const todayLessons = React.useMemo(() => {
		if (!scheduleContext) {
			return []
		}

		return getScheduleForDate(today, scheduleContext)
	}, [scheduleContext, today, refreshKey]) // refreshKey forces reload after mutations

	const cycleBadge =
		settings && settings.cycleLength === 2 && scheduleContext
			? getCycleBadgeLabel(getCycleIndexForDate(today, scheduleContext))
			: null

	function showQuickAdd() {
		const options = ['Занятие', 'Предмет', 'Отмена']
		if (Platform.OS === 'ios') {
			ActionSheetIOS.showActionSheetWithOptions(
				{ options, cancelButtonIndex: 2 },
				(index) => {
					if (index === 0) {
						router.push(`/lesson-form?date=${today}`)
					}
				},
			)
			return
		}

		Alert.alert('Добавить', undefined, [
			{ text: 'Занятие', onPress: () => router.push(`/lesson-form?date=${today}`) },
			{ text: 'Отмена', style: 'cancel' },
		])
	}

	return (
		<ScreenContainer>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.scrollContent}
			>
				<Text style={styles.dateLabel}>{formatDisplayDate(today)}</Text>
				<View style={styles.headerRow}>
					<Text style={styles.subtitle}>Сегодня</Text>
					{cycleBadge ? (
						<View style={styles.badge}>
							<Text style={styles.badgeText}>{cycleBadge}</Text>
						</View>
					) : null}
				</View>

				<SectionCard title="Следующее занятие">
					<NextLessonSection
						lessonState={lessonState}
						onSetupPress={() => router.push('/(tabs)/schedule')}
					/>
				</SectionCard>

				<SectionCard title="Сегодня">
					{todayLessons.length === 0 ? (
						<EmptyState title="Сегодня занятий нет" />
					) : (
						todayLessons.map((lesson) => {
							const status = getLessonTimingStatus(lesson)
							return (
								<LessonCard
									key={lesson.id}
									occurrence={lesson}
									variant={
										status === 'ongoing'
											? 'highlight'
											: status === 'finished'
												? 'muted'
												: 'compact'
									}
									onPress={() => {
										if (lesson.scheduleEntryId) {
											router.push(`/lesson-form?id=${lesson.scheduleEntryId}`)
										}
									}}
								/>
							)
						})
					)}
				</SectionCard>

				<SectionCard title="Ближайшие задания">
					<AssignmentsPreview repositories={repositories} isReady={isReady} />
				</SectionCard>
			</ScrollView>

			<Pressable
				style={styles.fab}
				onPress={showQuickAdd}
				accessibilityRole="button"
				accessibilityLabel="Добавить"
			>
				<Text style={styles.fabText}>+</Text>
			</Pressable>
		</ScreenContainer>
	)
}

function NextLessonSection({
	lessonState,
	onSetupPress,
}: {
	lessonState: ReturnType<typeof getTodayLessonState> | null
	onSetupPress: () => void
}) {
	if (!lessonState) {
		return (
			<EmptyState
				title="Добавьте расписание"
				description="Настройте расписание, чтобы видеть следующий урок."
				actionLabel="Настроить расписание"
				onActionPress={onSetupPress}
			/>
		)
	}

	if (lessonState.status === 'empty_schedule') {
		return (
			<EmptyState
				title="Добавьте расписание"
				actionLabel="Настроить расписание"
				onActionPress={onSetupPress}
			/>
		)
	}

	if (lessonState.status === 'ongoing' && lessonState.occurrence) {
		return (
			<View>
				<Text style={styles.nextLabel}>Сейчас</Text>
				<Text style={styles.nextSubject}>{lessonState.occurrence.subjectName}</Text>
				<Text style={styles.nextMeta}>до {lessonState.occurrence.endTime}</Text>
				{lessonState.occurrence.room ? (
					<Text style={styles.nextMeta}>{lessonState.occurrence.room}</Text>
				) : null}
			</View>
		)
	}

	if (lessonState.status === 'upcoming' && lessonState.occurrence) {
		return (
			<View>
				<Text style={styles.nextLabel}>Следующая пара</Text>
				<Text style={styles.nextSubject}>{lessonState.occurrence.subjectName}</Text>
				<Text style={styles.nextMeta}>
					{lessonState.occurrence.startTime}–{lessonState.occurrence.endTime}
				</Text>
				{lessonState.minutesUntil !== null ? (
					<Text style={styles.nextHighlight}>
						{formatMinutesUntil(lessonState.minutesUntil)}
					</Text>
				) : null}
				{lessonState.occurrence.room ? (
					<Text style={styles.nextMeta}>{lessonState.occurrence.room}</Text>
				) : null}
				{lessonState.occurrence.teacherName ? (
					<Text style={styles.nextMeta}>{lessonState.occurrence.teacherName}</Text>
				) : null}
			</View>
		)
	}

	if (
		(lessonState.status === 'finished_today' || lessonState.status === 'no_lessons_today') &&
		lessonState.nextFuture
	) {
		return (
			<View>
				<Text style={styles.nextLabel}>На сегодня всё</Text>
				<Text style={styles.nextMeta}>Следующее занятие:</Text>
				<Text style={styles.nextSubject}>
					{formatNextFutureDetailed(lessonState.nextFuture)}
				</Text>
			</View>
		)
	}

	return <EmptyState title="Сегодня занятий нет" />
}

function AssignmentsPreview({
	repositories,
	isReady,
}: {
	repositories: ReturnType<typeof import('@/src/context/AppDataContext').useAppData>['repositories']
	isReady: boolean
}) {
	const [items, setItems] = React.useState<
		Awaited<ReturnType<NonNullable<typeof repositories>['assignments']['listUpcoming']>>
	>([])

	React.useEffect(() => {
		if (!repositories) {
			return
		}

		let mounted = true
		void repositories.assignments.listUpcoming(5).then((result) => {
			if (mounted) {
				setItems(result)
			}
		})
		return () => {
			mounted = false
		}
	}, [repositories, isReady])

	if (items.length === 0) {
		return <EmptyState title="Заданий пока нет" />
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
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginBottom: 16,
	},
	subtitle: {
		fontSize: 28,
		fontWeight: '700',
		color: '#0F172A',
	},
	badge: {
		backgroundColor: '#EEF2FF',
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 12,
	},
	badgeText: {
		fontSize: 12,
		color: '#4338CA',
		fontWeight: '600',
	},
	nextLabel: {
		fontSize: 13,
		color: '#64748B',
		marginBottom: 4,
	},
	nextSubject: {
		fontSize: 20,
		fontWeight: '700',
		color: '#0F172A',
		marginBottom: 4,
	},
	nextMeta: {
		fontSize: 14,
		color: '#64748B',
		lineHeight: 20,
	},
	nextHighlight: {
		fontSize: 15,
		color: '#2563EB',
		fontWeight: '600',
		marginVertical: 4,
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
