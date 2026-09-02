import * as React from 'react'
import {
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
import { formatDisplayDate } from '@/src/utils/dates'
import { ValidationError } from '@/src/utils/validation'

/** Form for adding a one-off lesson on a specific date (ADDED exception). */
export default function OneOffLessonFormScreen() {
	const router = useRouter()
	const params = useLocalSearchParams<{ date?: string }>()
	const { repositories, activePeriod, refresh } = useAppData()

	const occurrenceDate = params.date ?? ''

	const [subjectId, setSubjectId] = React.useState<string | null>(null)
	const [startTime, setStartTime] = React.useState('09:00')
	const [endTime, setEndTime] = React.useState('09:45')
	const [teacherName, setTeacherName] = React.useState('')
	const [room, setRoom] = React.useState('')
	const [showNewSubject, setShowNewSubject] = React.useState(false)
	const [newSubjectName, setNewSubjectName] = React.useState('')
	const [newSubjectColor, setNewSubjectColor] = React.useState(SUBJECT_COLORS[0])
	const [subjects, setSubjects] = React.useState<
		Awaited<ReturnType<NonNullable<typeof repositories>['subjects']['listByStudyPeriod']>>
	>([])
	const [errors, setErrors] = React.useState<Record<string, string>>({})
	const [isSaving, setIsSaving] = React.useState(false)

	React.useEffect(() => {
		if (!repositories || !activePeriod) {
			return
		}

		void repositories.subjects.listByStudyPeriod(activePeriod.id).then(setSubjects)
	}, [repositories, activePeriod])

	async function handleSave() {
		if (!repositories || !activePeriod || !occurrenceDate) {
			return
		}

		let resolvedSubjectId = subjectId

		if (showNewSubject && newSubjectName.trim()) {
			const created = await repositories.subjects.create({
				studyPeriodId: activePeriod.id,
				name: newSubjectName.trim(),
				color: newSubjectColor,
			})
			resolvedSubjectId = created.id
		}

		if (!resolvedSubjectId) {
			setErrors({ subjectId: 'Выберите предмет' })
			return
		}

		setIsSaving(true)
		setErrors({})

		try {
			let teacherId: string | null = null
			if (teacherName.trim()) {
				const teacher = await repositories.teachers.create({
					name: teacherName.trim(),
				})
				teacherId = teacher.id
			}

			await repositories.scheduleExceptions.createOneOffLesson({
				studyPeriodId: activePeriod.id,
				exceptionDate: occurrenceDate,
				subjectId: resolvedSubjectId,
				teacherId,
				room: room.trim() || null,
				startTime,
				endTime,
			})

			await refresh()
			router.back()
		} catch (error) {
			const message =
				error instanceof ValidationError
					? error.message
					: error instanceof Error
						? error.message
						: 'Не удалось сохранить'
			setErrors({ form: message })
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<ScreenContainer title="Занятие на один день">
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<ScrollView contentContainerStyle={styles.form}>
					<Text style={styles.dateLabel}>
						{occurrenceDate ? formatDisplayDate(occurrenceDate) : ''}
					</Text>
					<Text style={styles.hint}>
						Это занятие появится только в выбранный день и не повторится.
					</Text>

					<Text style={styles.label}>Предмет *</Text>
					<View style={styles.chipRow}>
						{subjects
							.filter((item) => !item.isArchived)
							.map((item) => (
								<Pressable
									key={item.id}
									onPress={() => {
										setSubjectId(item.id)
										setShowNewSubject(false)
									}}
									style={[
										styles.chip,
										subjectId === item.id && styles.chipActive,
									]}
								>
									<Text style={styles.chipText}>
										{item.shortName ?? item.name}
									</Text>
								</Pressable>
							))}
						<Pressable
							onPress={() => setShowNewSubject(true)}
							style={styles.chip}
						>
							<Text style={styles.chipText}>+ Новый</Text>
						</Pressable>
					</View>

					{showNewSubject ? (
						<>
							<TextField
								label="Название предмета"
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
											newSubjectColor === color && styles.colorSelected,
										]}
									/>
								))}
							</View>
						</>
					) : null}

					<TextField
						label="Начало *"
						value={startTime}
						onChangeText={setStartTime}
						placeholder="09:00"
					/>
					<TextField
						label="Конец *"
						value={endTime}
						onChangeText={setEndTime}
						placeholder="09:45"
					/>
					<TextField
						label="Преподаватель"
						value={teacherName}
						onChangeText={setTeacherName}
					/>
					<TextField label="Кабинет / аудитория" value={room} onChangeText={setRoom} />

					{errors.form ? <Text style={styles.error}>{errors.form}</Text> : null}

					<PrimaryButton
						title="Сохранить"
						onPress={() => void handleSave()}
						disabled={isSaving}
					/>
				</ScrollView>
			</KeyboardAvoidingView>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	form: { paddingBottom: 32 },
	dateLabel: {
		fontSize: 16,
		fontWeight: '600',
		color: '#0F172A',
		marginBottom: 4,
	},
	hint: {
		fontSize: 14,
		color: '#64748B',
		marginBottom: 16,
		lineHeight: 20,
	},
	label: {
		fontSize: 14,
		fontWeight: '600',
		color: '#334155',
		marginBottom: 8,
	},
	chipRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginBottom: 12,
	},
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
		backgroundColor: '#F1F5F9',
	},
	chipActive: {
		backgroundColor: '#2563EB',
	},
	chipText: {
		fontSize: 13,
		color: '#475569',
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
	colorSelected: {
		borderWidth: 2,
		borderColor: '#0F172A',
	},
	error: {
		color: '#EF4444',
		fontSize: 13,
		marginBottom: 8,
	},
})
