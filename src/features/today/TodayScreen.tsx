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
import { AssignmentCard } from '@/src/components/AssignmentCard'
import { EmptyState } from '@/src/components/EmptyState'
import { LessonCard } from '@/src/components/LessonCard'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { SectionCard } from '@/src/components/SectionCard'
import { useAppData } from '@/src/context/AppDataContext'
import {
	countOverdue,
	formatAssignmentDueLabel,
	pickTodayAssignments,
	pickUpcomingTestsExams,
} from '@/src/services/assignment-query.service'
import { getCycleIndexForDate, getScheduleForDate } from '@/src/services/occurrence.service'
import {
	formatNextFutureDetailed,
	getTodayLessonState,
	getLessonTimingStatus,
} from '@/src/services/today.service'
import { ASSIGNMENT_TYPE_BADGE } from '@/src/utils/assignment-labels'
import { formatMinutesUntil } from '@/src/utils/format'
import { getCycleBadgeLabel } from '@/src/utils/cycle-labels'
import { formatDisplayDate, getTodayLocalDate } from '@/src/utils/dates'
import type { AssignmentListItem } from '@/src/types/assignment'

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
		const options = ['Занятие', 'Задание', 'Предмет', 'Отмена']
		const handlers = [
			() => router.push(`/lesson-form?date=${today}`),
			() => router.push('/assignment-form'),
		]

		if (Platform.OS === 'ios') {
			ActionSheetIOS.showActionSheetWithOptions(
				{ options, cancelButtonIndex: 3 },
				(index) => {
					if (index !== undefined && index < 2) {
						handlers[index]()
					}
				},
			)
			return
		}

		Alert.alert('Добавить', undefined, [
			{ text: 'Занятие', onPress: handlers[0] },
			{ text: 'Задание', onPress: handlers[1] },
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
				<Pressable
					onPress={() => router.push('/focus')}
					style={styles.focusLink}
				>
					<Text style={styles.focusLinkText}>Начать фокус</Text>
				</Pressable>

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
											router.push(
												`/assignment-form?scheduleEntryId=${lesson.scheduleEntryId}&occurrenceDate=${today}&subjectId=${lesson.subjectId}`,
											)
										}
									}}
								/>
							)
						})
					)}
				</SectionCard>

				<SectionCard title="Задания">
					<AssignmentsPreview
					repositories={repositories}
					isReady={isReady}
					refreshKey={refreshKey}
					onViewAll={() => router.push('/(tabs)/assignments')}
					onOpenAssignment={(id) => router.push(`/assignment-form?id=${id}`)}
					/>
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
	refreshKey,
	onViewAll,
	onOpenAssignment,
}: {
	repositories: ReturnType<typeof import('@/src/context/AppDataContext').useAppData>['repositories']
	isReady: boolean
	refreshKey: number
	onViewAll: () => void
	onOpenAssignment: (id: string) => void
}) {
	const [items, setItems] = React.useState<AssignmentListItem[]>([])

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
	}, [repositories, isReady, refreshKey])

	const overdueCount = countOverdue(items)
	const preview = pickTodayAssignments(items, 5)
	const upcomingTests = pickUpcomingTestsExams(items)

	return (
		<View>
			{overdueCount > 0 ? (
				<Text style={styles.overdueBanner}>Просрочено: {overdueCount}</Text>
			) : null}

			{upcomingTests.length > 0 ? (
				<View style={styles.soonSection}>
					<Text style={styles.soonTitle}>Скоро</Text>
					{upcomingTests.map((item) => (
						<Pressable
							key={item.id}
							onPress={() => onOpenAssignment(item.id)}
							style={styles.soonRow}
						>
							<Text style={styles.soonSubject}>
								{ASSIGNMENT_TYPE_BADGE[item.assignmentType]} по {item.subjectName}
							</Text>
							<Text style={styles.soonMeta}>
								{formatAssignmentDueLabel(item)}
							</Text>
						</Pressable>
					))}
				</View>
			) : null}

			<Text style={styles.sectionInlineTitle}>Ближайшие</Text>

			{preview.length === 0 ? (
				<EmptyState title="На ближайшее время заданий нет" />
			) : (
				preview.map((item) => (
					<AssignmentCard
						key={item.id}
						item={item}
						onPress={() => onOpenAssignment(item.id)}
					/>
				))
			)}

			<Pressable onPress={onViewAll} style={styles.viewAll}>
				<Text style={styles.viewAllText}>Все задания</Text>
			</Pressable>
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
		marginBottom: 8,
	},
	focusLink: {
		alignSelf: 'flex-start',
		marginBottom: 16,
	},
	focusLinkText: {
		color: '#2563EB',
		fontSize: 14,
		fontWeight: '600',
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
	overdueBanner: {
		fontSize: 14,
		color: '#DC2626',
		fontWeight: '600',
		marginBottom: 8,
	},
	soonSection: {
		marginBottom: 12,
	},
	soonTitle: {
		fontSize: 15,
		fontWeight: '700',
		color: '#334155',
		marginBottom: 6,
	},
	soonRow: {
		paddingVertical: 6,
	},
	soonSubject: {
		fontSize: 15,
		fontWeight: '600',
		color: '#0F172A',
	},
	soonMeta: {
		fontSize: 13,
		color: '#64748B',
	},
	sectionInlineTitle: {
		fontSize: 15,
		fontWeight: '700',
		color: '#334155',
		marginBottom: 8,
	},
	viewAll: {
		marginTop: 8,
		paddingVertical: 8,
	},
	viewAllText: {
		fontSize: 14,
		color: '#2563EB',
		fontWeight: '600',
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
