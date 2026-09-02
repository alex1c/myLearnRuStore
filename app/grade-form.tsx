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
import { useAppData } from '@/src/context/AppDataContext'
import type { GradeScale } from '@/src/types/domain'
import {
	parseDecimalInput,
} from '@/src/services/grade-calculation.service'
import { getTodayLocalDate } from '@/src/utils/dates'
import { GRADE_TYPE_OPTIONS } from '@/src/utils/grade-labels'
import { ValidationError } from '@/src/utils/validation'
import { ANALYTICS_EVENTS } from '@/src/config/analytics'
import { trackEvent } from '@/src/services/analytics/analytics.service'

/** Add/edit grade form. */
export default function GradeFormScreen() {
	const router = useRouter()
	const params = useLocalSearchParams<{
		id?: string
		subjectId?: string
		assignmentId?: string
		date?: string
		gradeType?: string
	}>()
	const { repositories, activePeriod, refresh } = useAppData()

	const isEdit = Boolean(params.id)
	const today = getTodayLocalDate()

	const [subjectId, setSubjectId] = React.useState<string | null>(params.subjectId ?? null)
	const [selectedValue, setSelectedValue] = React.useState<number | null>(null)
	const [numericValue, setNumericValue] = React.useState('')
	const [date, setDate] = React.useState(params.date ?? today)
	const [gradeType, setGradeType] = React.useState<string | null>(params.gradeType ?? null)
	const [weight, setWeight] = React.useState('1')
	const [note, setNote] = React.useState('')
	const [showAdvanced, setShowAdvanced] = React.useState(false)
	const [subjects, setSubjects] = React.useState<
		Awaited<ReturnType<NonNullable<typeof repositories>['subjects']['listByStudyPeriod']>>
	>([])
	const [gradeScale, setGradeScale] = React.useState<GradeScale>('FIVE_POINT')
	const [errors, setErrors] = React.useState<Record<string, string>>({})
	const [isSaving, setIsSaving] = React.useState(false)

	React.useEffect(() => {
		if (!repositories || !activePeriod) {
			return
		}

		void repositories.subjects.listByStudyPeriod(activePeriod.id).then(setSubjects)

		if (params.id) {
			void repositories.grades.getById(params.id).then((grade) => {
				if (!grade) {
					return
				}

				setSubjectId(grade.subjectId)
				setSelectedValue(grade.value)
				setNumericValue(String(grade.value).replace('.', ','))
				setDate(grade.date)
				setGradeType(grade.gradeType)
				setWeight(String(grade.weight))
				setNote(grade.note ?? '')
				setGradeScale(grade.gradeScale)
			})
		} else if (params.subjectId) {
			void repositories.subjects.getById(params.subjectId).then((subject) => {
				if (subject) {
					setGradeScale(subject.gradeScale)
				}
			})
		}
	}, [repositories, activePeriod, params.id, params.subjectId])

	React.useEffect(() => {
		if (!subjectId || !repositories) {
			return
		}

		void repositories.subjects.getById(subjectId).then((subject) => {
			if (subject) {
				setGradeScale(subject.gradeScale)
			}
		})
	}, [subjectId, repositories])

	async function handleSave() {
		if (!repositories || !subjectId) {
			setErrors({ subjectId: 'Выберите предмет' })
			return
		}

		const value =
			gradeScale === 'FIVE_POINT'
				? selectedValue
				: parseDecimalInput(numericValue)

		if (value === null) {
			setErrors({ value: 'Укажите оценку' })
			return
		}

		const parsedWeight = parseDecimalInput(weight) ?? 1

		setIsSaving(true)
		setErrors({})

		try {
			const payload = {
				subjectId,
				value,
				gradeScale,
				date,
				weight: parsedWeight,
				gradeType,
				note: note.trim() || null,
				assignmentId: params.assignmentId ?? null,
			}

			if (isEdit && params.id) {
				await repositories.grades.update(params.id, payload)
			} else {
				await repositories.grades.create(payload)
				trackEvent(ANALYTICS_EVENTS.GRADE_ADDED, {
					grade_scale: gradeScale,
				})
			}

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

	async function handleDelete() {
		if (!repositories || !params.id) {
			return
		}

		Alert.alert('Удалить оценку?', undefined, [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: async () => {
					await repositories.grades.delete(params.id!)
					await refresh()
					router.back()
				},
			},
		])
	}

	const fivePointOptions = [2, 3, 4, 5]

	return (
		<ScreenContainer title={isEdit ? 'Оценка' : 'Новая оценка'}>
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<ScrollView contentContainerStyle={styles.form}>
					<Text style={styles.label}>Предмет *</Text>
					<View style={styles.chipRow}>
						{subjects.map((item) => (
							<Pressable
								key={item.id}
								onPress={() => setSubjectId(item.id)}
								style={[styles.chip, subjectId === item.id && styles.chipActive]}
							>
								<Text style={styles.chipText}>{item.shortName ?? item.name}</Text>
							</Pressable>
						))}
					</View>

					<Text style={styles.label}>Оценка *</Text>
					{gradeScale === 'FIVE_POINT' ? (
						<View style={styles.gradeButtons}>
							{fivePointOptions.map((value) => (
								<Pressable
									key={value}
									onPress={() => setSelectedValue(value)}
									style={[
										styles.gradeButton,
										selectedValue === value && styles.gradeButtonActive,
									]}
								>
									<Text
										style={[
											styles.gradeButtonText,
											selectedValue === value && styles.gradeButtonTextActive,
										]}
									>
										{value}
									</Text>
								</Pressable>
							))}
						</View>
					) : (
						<TextField
							label=""
							value={numericValue}
							onChangeText={setNumericValue}
							placeholder={gradeScale === 'TEN_POINT' ? '1–10' : '0–100'}
							keyboardType="numeric"
						/>
					)}
					{errors.value ? <Text style={styles.error}>{errors.value}</Text> : null}

					<TextField label="Дата" value={date} onChangeText={setDate} />

					<Pressable onPress={() => setShowAdvanced((v) => !v)}>
						<Text style={styles.advancedToggle}>
							{showAdvanced ? '▼ Дополнительно' : '▶ Дополнительно'}
						</Text>
					</Pressable>

					{showAdvanced ? (
						<View>
							<Text style={styles.label}>Тип работы</Text>
							<View style={styles.chipRow}>
								{GRADE_TYPE_OPTIONS.map((option) => (
									<Pressable
										key={option.value}
										onPress={() => setGradeType(option.value)}
										style={[
											styles.chip,
											gradeType === option.value && styles.chipActive,
										]}
									>
										<Text style={styles.chipText}>{option.label}</Text>
									</Pressable>
								))}
							</View>
							<TextField
								label="Вес оценки"
								value={weight}
								onChangeText={setWeight}
								keyboardType="numeric"
							/>
							<TextField label="Заметка" value={note} onChangeText={setNote} />
						</View>
					) : null}

					{errors.form ? <Text style={styles.error}>{errors.form}</Text> : null}

					<PrimaryButton
						title="Сохранить"
						onPress={() => void handleSave()}
						disabled={isSaving}
					/>

					{isEdit ? (
						<Pressable onPress={() => void handleDelete()} style={styles.deleteButton}>
							<Text style={styles.deleteText}>Удалить оценку</Text>
						</Pressable>
					) : null}
				</ScrollView>
			</KeyboardAvoidingView>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	form: { paddingBottom: 32 },
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
	chipActive: { backgroundColor: '#2563EB' },
	chipText: { fontSize: 13, color: '#475569' },
	gradeButtons: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
		marginBottom: 12,
	},
	gradeButton: {
		width: 64,
		height: 64,
		borderRadius: 12,
		backgroundColor: '#F1F5F9',
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: '#E2E8F0',
	},
	gradeButtonActive: {
		backgroundColor: '#2563EB',
		borderColor: '#2563EB',
	},
	gradeButtonText: {
		fontSize: 24,
		fontWeight: '700',
		color: '#0F172A',
	},
	gradeButtonTextActive: { color: '#FFFFFF' },
	advancedToggle: {
		fontSize: 14,
		color: '#2563EB',
		fontWeight: '600',
		marginVertical: 8,
	},
	error: { color: '#EF4444', fontSize: 13, marginBottom: 8 },
	deleteButton: { marginTop: 16, alignItems: 'center', padding: 12 },
	deleteText: { color: '#DC2626', fontSize: 15 },
})
