import * as React from 'react'
import {
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { PrimaryButton, TextField } from '@/src/components/ui/FormFields'
import { SUBJECT_COLORS } from '@/src/constants/subject-colors'
import { useAppData } from '@/src/context/AppDataContext'
import type { ScheduleWeekCycle, Weekday } from '@/src/types/domain'
import { WEEK_CYCLE_OPTIONS } from '@/src/utils/cycle-labels'
import { getWeekday } from '@/src/utils/dates'
import { ValidationError } from '@/src/utils/validation'

const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = [
	{ value: 1, label: 'Понедельник' },
	{ value: 2, label: 'Вторник' },
	{ value: 3, label: 'Среда' },
	{ value: 4, label: 'Четверг' },
	{ value: 5, label: 'Пятница' },
	{ value: 6, label: 'Суббота' },
	{ value: 7, label: 'Воскресенье' },
]

/** Add/edit lesson form presented as a modal route. */
export default function LessonFormScreen() {
	const router = useRouter()
	const params = useLocalSearchParams<{
		id?: string
		weekday?: string
		date?: string
		duplicate?: string
	}>()
	const { repositories, activePeriod, settings, refresh } = useAppData()

	const initialWeekday = (
		params.date
			? getWeekday(params.date)
			: params.weekday
				? (Number(params.weekday) as Weekday)
				: 1
	) as Weekday

	const [subjectId, setSubjectId] = React.useState<string | null>(null)
	const [weekday, setWeekday] = React.useState<Weekday>(initialWeekday)
	const [startTime, setStartTime] = React.useState('09:00')
	const [endTime, setEndTime] = React.useState('09:45')
	const [weekCycle, setWeekCycle] = React.useState<ScheduleWeekCycle>('EVERY_WEEK')
	const [teacherName, setTeacherName] = React.useState('')
	const [room, setRoom] = React.useState('')
	const [lessonType, setLessonType] = React.useState('')
	const [showAdvanced, setShowAdvanced] = React.useState(false)
	const [showNewSubject, setShowNewSubject] = React.useState(false)
	const [newSubjectName, setNewSubjectName] = React.useState('')
	const [newSubjectColor, setNewSubjectColor] = React.useState(SUBJECT_COLORS[0])
	const [subjects, setSubjects] = React.useState<
		Awaited<ReturnType<NonNullable<typeof repositories>['subjects']['listByStudyPeriod']>>
	>([])
	const [errors, setErrors] = React.useState<Record<string, string>>({})
	const [isSaving, setIsSaving] = React.useState(false)

	const isEdit = Boolean(params.id)
	const isDuplicate = params.duplicate === '1'
	const cycleLength = settings?.cycleLength ?? 1
	const isStudent = settings?.userMode !== 'SCHOOL'

	React.useEffect(() => {
		if (!repositories || !activePeriod) {
			return
		}

		void repositories.subjects.listByStudyPeriod(activePeriod.id).then(setSubjects)

		if (params.id && !isDuplicate) {
			void repositories.schedule.getById(params.id).then((entry) => {
				if (!entry) {
					return
				}

				setSubjectId(entry.subjectId)
				setWeekday(entry.weekday)
				setStartTime(entry.startTime)
				setEndTime(entry.endTime)
				setWeekCycle(entry.weekCycle)
				setRoom(entry.room ?? '')
				setLessonType(entry.lessonType ?? '')
				if (entry.teacherId) {
					void repositories.teachers.getById(entry.teacherId).then((teacher) => {
						setTeacherName(teacher?.name ?? '')
					})
				}
			})
		} else if (params.id && isDuplicate) {
			void repositories.schedule.getById(params.id).then((entry) => {
				if (!entry) {
					return
				}

				setSubjectId(entry.subjectId)
				setWeekday(entry.weekday)
				setStartTime(entry.startTime)
				setEndTime(entry.endTime)
				setWeekCycle(entry.weekCycle)
				setRoom(entry.room ?? '')
				setLessonType(entry.lessonType ?? '')
			})
		}
	}, [repositories, activePeriod, params.id, isDuplicate])

	async function resolveTeacherId(): Promise<string | null> {
		if (!repositories || !teacherName.trim()) {
			return null
		}

		const teachers = await repositories.teachers.list()
		const existing = teachers.find(
			(item) => item.name.toLowerCase() === teacherName.trim().toLowerCase(),
		)
		if (existing) {
			return existing.id
		}

		const created = await repositories.teachers.create({ name: teacherName.trim() })
		return created.id
	}

	async function handleSave() {
		if (!repositories || !activePeriod) {
			return
		}

		setErrors({})
		setIsSaving(true)

		try {
			let resolvedSubjectId = subjectId

			if (showNewSubject) {
				const created = await repositories.subjects.create({
					studyPeriodId: activePeriod.id,
					name: newSubjectName,
					color: newSubjectColor,
				})
				resolvedSubjectId = created.id
			}

			if (!resolvedSubjectId) {
				setErrors({ subject: 'Выберите предмет' })
				return
			}

			const teacherId = await resolveTeacherId()
			const payload = {
				studyPeriodId: activePeriod.id,
				subjectId: resolvedSubjectId,
				weekday,
				startTime,
				endTime,
				weekCycle: cycleLength === 1 ? 'EVERY_WEEK' as const : weekCycle,
				teacherId,
				room: room.trim() || null,
				lessonType: lessonType.trim() || null,
			}

			if (isEdit && params.id && !isDuplicate) {
				await repositories.schedule.update(params.id, payload)
			} else {
				await repositories.schedule.create(payload)
			}

			await refresh()
			router.back()
		} catch (error) {
			const message =
				error instanceof ValidationError
					? error.message
					: error instanceof Error
						? error.message
						: 'Не удалось сохранить занятие'

			if (message.includes('time') || message.includes('время')) {
				setErrors({ time: 'Время окончания должно быть позже начала.' })
			} else {
				Alert.alert('Ошибка', message)
			}
		} finally {
			setIsSaving(false)
		}
	}

	async function handleDelete() {
		if (!repositories || !params.id || isDuplicate) {
			return
		}

		Alert.alert('Удалить занятие из расписания?', '', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await repositories.schedule.delete(params.id!)
						await refresh()
						router.back()
					})()
				},
			},
		])
	}

	return (
		<ScreenContainer title={isEdit && !isDuplicate ? 'Редактировать занятие' : 'Добавить занятие'}>
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<ScrollView contentContainerStyle={styles.content}>
					<Text style={styles.label}>Предмет *</Text>
					{!showNewSubject ? (
						<View style={styles.chipRow}>
							{subjects.map((subject) => (
								<Pressable
									key={subject.id}
									onPress={() => setSubjectId(subject.id)}
									style={[
										styles.chip,
										subjectId === subject.id && styles.chipSelected,
									]}
								>
									<Text style={styles.chipText}>{subject.shortName ?? subject.name}</Text>
								</Pressable>
							))}
							<Pressable onPress={() => setShowNewSubject(true)} style={styles.addChip}>
								<Text style={styles.addChipText}>+ Новый предмет</Text>
							</Pressable>
						</View>
					) : (
						<>
							<TextField
								label="Название предмета *"
								value={newSubjectName}
								onChangeText={setNewSubjectName}
							/>
							<View style={styles.colorRow}>
								{SUBJECT_COLORS.map((color) => (
									<Pressable
										key={color}
										onPress={() => setNewSubjectColor(color)}
										style={[
											styles.colorDot,
											{ backgroundColor: color },
											newSubjectColor === color && styles.colorDotSelected,
										]}
									/>
								))}
							</View>
						</>
					)}
					{errors.subject ? <Text style={styles.error}>{errors.subject}</Text> : null}

					<Text style={styles.label}>День недели *</Text>
					<View style={styles.chipRow}>
						{WEEKDAY_OPTIONS.map((day) => (
							<Pressable
								key={day.value}
								onPress={() => setWeekday(day.value)}
								style={[styles.chip, weekday === day.value && styles.chipSelected]}
							>
								<Text style={styles.chipText}>{day.label.slice(0, 2)}</Text>
							</Pressable>
						))}
					</View>

					<TextField label="Начало *" value={startTime} onChangeText={setStartTime} placeholder="09:00" />
					<TextField label="Конец *" value={endTime} onChangeText={setEndTime} placeholder="09:45" />
					{errors.time ? <Text style={styles.error}>{errors.time}</Text> : null}

					{cycleLength === 2 ? (
						<>
							<Text style={styles.label}>Повтор</Text>
							{WEEK_CYCLE_OPTIONS.map((option) => (
								<Pressable
									key={option.value}
									onPress={() => setWeekCycle(option.value)}
									style={[
										styles.cycleRow,
										weekCycle === option.value && styles.cycleRowSelected,
									]}
								>
									<Text>{option.label}</Text>
								</Pressable>
							))}
						</>
					) : null}

					<Pressable onPress={() => setShowAdvanced((value) => !value)}>
						<Text style={styles.advancedToggle}>
							{showAdvanced ? 'Скрыть дополнительно' : 'Дополнительно'}
						</Text>
					</Pressable>

					{showAdvanced ? (
						<>
							<TextField
								label="Преподаватель"
								value={teacherName}
								onChangeText={setTeacherName}
								placeholder="Иванов А.П."
							/>
							<TextField label="Кабинет / аудитория" value={room} onChangeText={setRoom} />
							{isStudent ? (
								<TextField
									label="Тип занятия"
									value={lessonType}
									onChangeText={setLessonType}
									placeholder="Лекция"
								/>
							) : null}
						</>
					) : null}

					<PrimaryButton
						title="Сохранить"
						onPress={() => void handleSave()}
						disabled={isSaving}
					/>

					{isEdit && !isDuplicate ? (
						<Pressable onPress={() => void handleDelete()} style={styles.deleteButton}>
							<Text style={styles.deleteText}>Удалить занятие</Text>
						</Pressable>
					) : null}
				</ScrollView>
			</KeyboardAvoidingView>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	content: { paddingBottom: 40 },
	label: {
		fontSize: 14,
		fontWeight: '600',
		color: '#334155',
		marginBottom: 8,
		marginTop: 8,
	},
	chipRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginBottom: 8,
	},
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
		backgroundColor: '#F1F5F9',
	},
	chipSelected: {
		backgroundColor: '#2563EB',
	},
	chipText: {
		fontSize: 14,
		color: '#0F172A',
	},
	addChip: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#2563EB',
		borderStyle: 'dashed',
	},
	addChipText: {
		color: '#2563EB',
		fontSize: 14,
	},
	colorRow: {
		flexDirection: 'row',
		gap: 8,
		marginBottom: 12,
	},
	colorDot: {
		width: 28,
		height: 28,
		borderRadius: 14,
	},
	colorDotSelected: {
		borderWidth: 2,
		borderColor: '#0F172A',
	},
	cycleRow: {
		padding: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#E2E8F0',
		marginBottom: 6,
	},
	cycleRowSelected: {
		borderColor: '#2563EB',
		backgroundColor: '#F8FAFF',
	},
	advancedToggle: {
		color: '#2563EB',
		fontWeight: '600',
		marginVertical: 12,
	},
	error: {
		color: '#EF4444',
		fontSize: 13,
		marginBottom: 8,
	},
	deleteButton: {
		marginTop: 16,
		alignItems: 'center',
	},
	deleteText: {
		color: '#EF4444',
		fontSize: 15,
	},
})
