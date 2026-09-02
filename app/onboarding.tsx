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
import { useRouter } from 'expo-router'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { PrimaryButton, TextField } from '@/src/components/ui/FormFields'
import { useAppData } from '@/src/context/AppDataContext'
import type { UserMode } from '@/src/types/domain'
import { computeAnchorDateFromCurrentWeek } from '@/src/utils/anchor'
import { getCycleBadgeLabel } from '@/src/utils/cycle-labels'

type Step = 'mode' | 'period' | 'cycle'

export default function OnboardingScreen() {
	const router = useRouter()
	const { repositories, refresh } = useAppData()
	const [step, setStep] = React.useState<Step>('mode')
	const [userMode, setUserMode] = React.useState<UserMode>('SCHOOL')
	const [periodName, setPeriodName] = React.useState('2026/2027 учебный год')
	const [startDate, setStartDate] = React.useState('2026-09-01')
	const [endDate, setEndDate] = React.useState('2027-05-31')
	const [cycleLength, setCycleLength] = React.useState<1 | 2>(1)
	const [selectedCycle, setSelectedCycle] = React.useState<0 | 1>(0)
	const [error, setError] = React.useState<string | null>(null)
	const [isSaving, setIsSaving] = React.useState(false)

	const isStudent = userMode === 'COLLEGE' || userMode === 'UNIVERSITY'

	async function finishOnboarding() {
		if (!repositories) {
			return
		}

		setIsSaving(true)
		setError(null)

		try {
			const period = await repositories.studyPeriods.create({
				name: periodName.trim(),
				type: isStudent ? 'SEMESTER' : 'YEAR',
				startDate,
				endDate,
				isActive: true,
			})

			await repositories.appSettings.updateUserMode(userMode)
			await repositories.appSettings.setActiveStudyPeriod(period.id)

			if (cycleLength === 2) {
				const anchorDate = computeAnchorDateFromCurrentWeek(selectedCycle)
				await repositories.appSettings.updateCycleSettings({
					weekCycleMode: 'TWO_WEEK',
					cycleLength: 2,
					cycleAnchorDate: anchorDate,
				})
			} else {
				await repositories.appSettings.updateCycleSettings({
					weekCycleMode: 'EVERY_WEEK',
					cycleLength: 1,
					cycleAnchorDate: null,
				})
			}

			await refresh()
			router.replace('/(tabs)')
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Не удалось сохранить настройки')
		} finally {
			setIsSaving(false)
		}
	}

	function handleModeSelect(mode: UserMode) {
		setUserMode(mode)
		if (mode === 'SCHOOL') {
			setCycleLength(1)
			setPeriodName('2026/2027 учебный год')
		} else {
			setPeriodName('1 семестр 2026/2027')
			setCycleLength(2)
		}
		setStep('period')
	}

	return (
		<ScreenContainer>
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<ScrollView contentContainerStyle={styles.content}>
					{step === 'mode' ? (
						<>
							<Text style={styles.title}>Как вы учитесь?</Text>
							<ModeCard
								title="Школьник"
								description="Уроки, домашние задания и оценки"
								selected={userMode === 'SCHOOL'}
								onPress={() => handleModeSelect('SCHOOL')}
							/>
							<ModeCard
								title="Студент"
								description="Пары, числитель/знаменатель, преподаватели и аудитории"
								selected={isStudent}
								onPress={() => handleModeSelect('COLLEGE')}
							/>
						</>
					) : null}

					{step === 'period' ? (
						<>
							<Text style={styles.title}>Учебный период</Text>
							<TextField label="Название" value={periodName} onChangeText={setPeriodName} />
							<TextField
								label="Дата начала (ГГГГ-ММ-ДД)"
								value={startDate}
								onChangeText={setStartDate}
								placeholder="2026-09-01"
							/>
							<TextField
								label="Дата окончания (ГГГГ-ММ-ДД)"
								value={endDate}
								onChangeText={setEndDate}
								placeholder="2027-05-31"
							/>

							{isStudent ? (
								<View style={styles.section}>
									<Text style={styles.sectionTitle}>Тип расписания</Text>
									<CycleOption
										label="Каждую неделю"
										selected={cycleLength === 1}
										onPress={() => setCycleLength(1)}
									/>
									<CycleOption
										label="Числитель / знаменатель"
										selected={cycleLength === 2}
										onPress={() => setCycleLength(2)}
									/>
								</View>
							) : null}

							<PrimaryButton
								title={cycleLength === 2 ? 'Далее' : 'Начать'}
								onPress={() => {
									if (cycleLength === 2) {
										setStep('cycle')
									} else {
										void finishOnboarding()
									}
								}}
								disabled={isSaving}
							/>
							<Pressable onPress={() => setStep('mode')} style={styles.backLink}>
								<Text style={styles.backText}>Назад</Text>
							</Pressable>
						</>
					) : null}

					{step === 'cycle' ? (
						<>
							<Text style={styles.title}>Какая сейчас неделя?</Text>
							<Text style={styles.subtitle}>
								Это нужно, чтобы правильно чередовать расписание.
							</Text>
							<CycleOption
								label={getCycleBadgeLabel(0)}
								selected={selectedCycle === 0}
								onPress={() => setSelectedCycle(0)}
							/>
							<CycleOption
								label={getCycleBadgeLabel(1)}
								selected={selectedCycle === 1}
								onPress={() => setSelectedCycle(1)}
							/>
							<PrimaryButton title="Начать" onPress={() => void finishOnboarding()} disabled={isSaving} />
							<Pressable onPress={() => setStep('period')} style={styles.backLink}>
								<Text style={styles.backText}>Назад</Text>
							</Pressable>
						</>
					) : null}

					{error ? <Text style={styles.error}>{error}</Text> : null}
				</ScrollView>
			</KeyboardAvoidingView>
		</ScreenContainer>
	)
}

function ModeCard({
	title,
	description,
	selected,
	onPress,
}: {
	title: string
	description: string
	selected: boolean
	onPress: () => void
}) {
	return (
		<Pressable
			onPress={onPress}
			style={[styles.modeCard, selected && styles.modeCardSelected]}
		>
			<Text style={styles.modeTitle}>{title}</Text>
			<Text style={styles.modeDescription}>{description}</Text>
		</Pressable>
	)
}

function CycleOption({
	label,
	selected,
	onPress,
}: {
	label: string
	selected: boolean
	onPress: () => void
}) {
	return (
		<Pressable onPress={onPress} style={[styles.cycleOption, selected && styles.cycleSelected]}>
			<View style={[styles.radio, selected && styles.radioSelected]} />
			<Text style={styles.cycleLabel}>{label}</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	content: {
		paddingBottom: 32,
	},
	title: {
		fontSize: 24,
		fontWeight: '700',
		color: '#0F172A',
		marginBottom: 16,
	},
	subtitle: {
		fontSize: 14,
		color: '#64748B',
		marginBottom: 16,
		lineHeight: 20,
	},
	modeCard: {
		borderWidth: 1,
		borderColor: '#E2E8F0',
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
		backgroundColor: '#FFFFFF',
	},
	modeCardSelected: {
		borderColor: '#2563EB',
		backgroundColor: '#F8FAFF',
	},
	modeTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: '#0F172A',
	},
	modeDescription: {
		fontSize: 14,
		color: '#64748B',
		marginTop: 4,
	},
	section: {
		marginBottom: 16,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 8,
		color: '#0F172A',
	},
	cycleOption: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 14,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#E2E8F0',
		marginBottom: 8,
	},
	cycleSelected: {
		borderColor: '#2563EB',
		backgroundColor: '#F8FAFF',
	},
	radio: {
		width: 18,
		height: 18,
		borderRadius: 9,
		borderWidth: 2,
		borderColor: '#94A3B8',
		marginRight: 10,
	},
	radioSelected: {
		borderColor: '#2563EB',
		backgroundColor: '#2563EB',
	},
	cycleLabel: {
		fontSize: 16,
		color: '#0F172A',
	},
	backLink: {
		marginTop: 12,
		alignItems: 'center',
	},
	backText: {
		color: '#64748B',
		fontSize: 14,
	},
	error: {
		marginTop: 12,
		color: '#EF4444',
		fontSize: 14,
	},
})

// colors exported via src/constants/subject-colors.ts
