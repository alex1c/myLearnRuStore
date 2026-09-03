import * as React from 'react'
import {
	ActionSheetIOS,
	Alert,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
} from 'react-native'
import { useRouter } from 'expo-router'
import { DaySelector } from '@/src/components/DaySelector'
import { EmptyState } from '@/src/components/EmptyState'
import { LessonCard } from '@/src/components/LessonCard'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { WeekNavigator } from '@/src/components/WeekNavigator'
import { useAppData } from '@/src/context/AppDataContext'
import { getCycleIndexForDate, getScheduleForDate } from '@/src/services/occurrence.service'
import { buildScheduleExport } from '@/src/services/schedule-export.service'
import {
	cleanupOldExportFiles,
	writeScheduleExportFile,
} from '@/src/services/schedule-export-file.service'
import {
	formatShareTodaySchedule,
	formatShareWeekSchedule,
	formatShareLesson,
} from '@/src/services/share/share-formatters.service'
import { shareFileUri, shareText } from '@/src/services/share/share.service'
import { addDays, daysBetween, getTodayLocalDate, startOfWeek } from '@/src/utils/dates'

/** Full weekly schedule screen with day switching and cycle support. */
export function ScheduleScreen() {
	const router = useRouter()
	const { scheduleContext, settings, refreshKey, repositories, activePeriod } = useAppData()
	const isStudent = settings?.userMode !== 'SCHOOL'
	const today = getTodayLocalDate()
	const [weekStart, setWeekStart] = React.useState(startOfWeek(today, 1))
	const [selectedDate, setSelectedDate] = React.useState(today)

	function shiftWeek(delta: number) {
		const nextWeekStart = addDays(weekStart, delta * 7)
		const offset = daysBetween(weekStart, selectedDate)
		setWeekStart(nextWeekStart)
		setSelectedDate(addDays(nextWeekStart, Math.min(Math.max(offset, 0), 6)))
	}

	const lessons = React.useMemo(() => {
		if (!scheduleContext) {
			return []
		}

		return getScheduleForDate(selectedDate, scheduleContext)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scheduleContext, selectedDate, refreshKey]) // refreshKey forces reload after mutations

	const cycleIndex = scheduleContext
		? getCycleIndexForDate(selectedDate, scheduleContext)
		: 0

	function showLessonActions(
		entryId: string,
		occurrenceDate: string,
		subjectId: string,
	) {
		const options = [
			'Редактировать',
			'Дублировать',
			'Добавить задание',
			'Изменить только этот день',
		]
		const handlers = [
			() => router.push(`/lesson-form?id=${entryId}`),
			() => router.push(`/lesson-form?id=${entryId}&duplicate=1`),
			() =>
				router.push(
					`/assignment-form?scheduleEntryId=${entryId}&occurrenceDate=${occurrenceDate}`,
				),
			() => router.push(`/lesson-exception?entryId=${entryId}&date=${occurrenceDate}`),
		]

		if (isStudent) {
			options.push('Отметить посещаемость')
			handlers.push(() =>
				router.push(
					`/attendance-form?subjectId=${subjectId}&scheduleEntryId=${entryId}&date=${occurrenceDate}`,
				),
			)
		}

		options.push('Поделиться занятием')
		handlers.push(() => {
			const lesson = lessons.find(
				(item) =>
					item.scheduleEntryId === entryId && item.occurrenceDate === occurrenceDate,
			)
			if (lesson) {
				void shareText(formatShareLesson(lesson))
			}
		})

		options.push('Отмена')
		const cancelIndex = options.length - 1

		if (Platform.OS === 'ios') {
			ActionSheetIOS.showActionSheetWithOptions(
				{ options, cancelButtonIndex: cancelIndex },
				(index) => {
					if (index !== undefined && index < handlers.length) {
						handlers[index]()
					}
				},
			)
			return
		}

		Alert.alert(
			'Занятие',
			undefined,
			[
				...handlers.map((handler, index) => ({
					text: options[index],
					onPress: handler,
				})),
				{ text: 'Отмена', style: 'cancel' as const },
			],
		)
	}

	function showShareMenu() {
		const options = [
			'Поделиться этим днём',
			'Поделиться неделей',
			'Экспорт расписания',
			'Отмена',
		]

		const shareDay = () => {
			void shareText(formatShareTodaySchedule(selectedDate, lessons))
		}

		const shareWeek = () => {
			if (!scheduleContext) {
				return
			}

			const days = Array.from({ length: 7 }, (_, index) => {
				const date = addDays(weekStart, index)
				return {
					date,
					occurrences: getScheduleForDate(date, scheduleContext),
				}
			})
			void shareText(formatShareWeekSchedule(weekStart, days))
		}

		const exportSchedule = () => {
			void (async () => {
				if (!repositories || !activePeriod || !settings) {
					return
				}

				try {
					const document = await buildScheduleExport(
						repositories,
						settings,
						activePeriod.id,
						activePeriod.name,
					)
					const uri = await writeScheduleExportFile(document)
					await shareFileUri(uri, 'application/json')
					await cleanupOldExportFiles()
				} catch (error) {
					Alert.alert(
						'Ошибка',
						error instanceof Error ? error.message : 'Не удалось экспортировать',
					)
				}
			})()
		}

		const handlers = [shareDay, shareWeek, exportSchedule]

		if (Platform.OS === 'ios') {
			ActionSheetIOS.showActionSheetWithOptions(
				{ options, cancelButtonIndex: 3 },
				(index) => {
					if (index !== undefined && index < handlers.length) {
						handlers[index]()
					}
				},
			)
			return
		}

		Alert.alert('Поделиться', undefined, [
			{ text: 'Этот день', onPress: shareDay },
			{ text: 'Неделя', onPress: shareWeek },
			{ text: 'Экспорт JSON', onPress: exportSchedule },
			{ text: 'Отмена', style: 'cancel' },
		])
	}

	function showAddLessonMenu() {
		const options = ['Регулярное занятие', 'Только на этот день', 'Отмена']
		const handlers = [
			() => router.push(`/lesson-form?date=${selectedDate}`),
			() => router.push(`/one-off-lesson-form?date=${selectedDate}`),
		]

		if (Platform.OS === 'ios') {
			ActionSheetIOS.showActionSheetWithOptions(
				{ options, cancelButtonIndex: 2 },
				(index) => {
					if (index !== undefined && index < 2) {
						handlers[index]()
					}
				},
			)
			return
		}

		Alert.alert('Добавить занятие', undefined, [
			{ text: 'Регулярное занятие', onPress: handlers[0] },
			{ text: 'Только на этот день', onPress: handlers[1] },
			{ text: 'Отмена', style: 'cancel' },
		])
	}

	if (!scheduleContext) {
		return (
			<ScreenContainer title="Расписание">
				<EmptyState
					title="Добавьте расписание"
					description="Сначала завершите настройку приложения."
					actionLabel="Настроить"
					onActionPress={() => router.push('/onboarding')}
				/>
			</ScreenContainer>
		)
	}

	return (
		<ScreenContainer title="Расписание">
			<Pressable onPress={showShareMenu} style={styles.shareLink}>
				<Text style={styles.shareLinkText}>Поделиться / экспорт</Text>
			</Pressable>
			<WeekNavigator
				weekStart={weekStart}
				cycleLength={settings?.cycleLength ?? 1}
				cycleIndex={cycleIndex}
				onPrevious={() => shiftWeek(-1)}
				onNext={() => shiftWeek(1)}
				onToday={() => {
					const currentWeek = startOfWeek(today, 1)
					setWeekStart(currentWeek)
					setSelectedDate(today)
				}}
			/>

			<DaySelector
				weekStart={weekStart}
				selectedDate={selectedDate}
				onSelectDate={setSelectedDate}
			/>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.list}
			>
				{lessons.length === 0 ? (
					<EmptyState
						title="Занятий нет"
						description="Можно добавить занятие или выбрать другой день."
						actionLabel="Добавить занятие"
						onActionPress={showAddLessonMenu}
					/>
				) : (
					lessons.map((lesson) => (
						<LessonCard
							key={lesson.id}
							occurrence={lesson}
							onPress={() => {
								if (lesson.scheduleEntryId) {
									showLessonActions(
										lesson.scheduleEntryId,
										selectedDate,
										lesson.subjectId,
									)
								} else if (isStudent && lesson.exceptionId) {
									router.push(
										`/attendance-form?subjectId=${lesson.subjectId}&scheduleExceptionId=${lesson.exceptionId}&date=${selectedDate}`,
									)
								}
							}}
						/>
					))
				)}
			</ScrollView>

			<Pressable
				style={styles.fab}
				onPress={showAddLessonMenu}
				accessibilityRole="button"
				accessibilityLabel="Добавить занятие"
			>
				<Text style={styles.fabText}>+</Text>
			</Pressable>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	shareLink: {
		alignSelf: 'flex-end',
		marginTop: -8,
		marginBottom: 8,
	},
	shareLinkText: {
		color: '#2563EB',
		fontSize: 14,
	},
	list: {
		paddingBottom: 96,
		paddingTop: 8,
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
