import * as React from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { useAppData } from '@/src/context/AppDataContext'
import { getCycleBadgeLabel } from '@/src/utils/cycle-labels'
import { getCurrentCycleIndex } from '@/src/utils/anchor'
import { buildScheduleExport } from '@/src/services/schedule-export.service'
import {
	cleanupOldExportFiles,
	writeScheduleExportFile,
} from '@/src/services/schedule-export-file.service'
import { shareFileUri } from '@/src/services/share/share.service'
import {
	exportAttendanceCsv,
	exportFocusCsv,
	exportGradesCsv,
} from '@/src/services/csv-export.service'
import * as FileSystem from 'expo-file-system/legacy'
import { ANALYTICS_EVENTS } from '@/src/config/analytics'
import { trackEvent } from '@/src/services/analytics/analytics.service'
import { toUserErrorMessage } from '@/src/utils/user-error'

/** Minimal settings screen for study mode, period, and cycle configuration. */
export function MoreScreen() {
	const router = useRouter()
	const { settings, activePeriod, repositories, refresh } = useAppData()

	const modeLabel =
		settings?.userMode === 'SCHOOL' ? 'Школьник' : 'Студент'

	const cycleLabel =
		settings?.cycleLength === 2 && settings.cycleAnchorDate
			? getCycleBadgeLabel(
					getCurrentCycleIndex(settings.cycleAnchorDate, 2),
				)
			: 'Каждую неделю'

	async function handleCycleModeChange() {
		if (!repositories || !activePeriod || !settings) {
			return
		}

		if (settings.cycleLength === 2) {
			const hasSpecific = await repositories.schedule.hasCycleSpecificEntries(
				activePeriod.id,
			)
			if (hasSpecific) {
				Alert.alert(
					'Нельзя переключить режим',
					'Сначала объедините занятия числителя и знаменателя или удалите cycle-specific записи.',
				)
				return
			}
		}

		Alert.alert(
			'Перейти на одинаковое расписание каждую неделю?',
			'Занятия числителя/знаменателя нужно будет объединить вручную.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Переключить',
					onPress: () => {
						void (async () => {
							await repositories.appSettings.updateCycleSettings({
								weekCycleMode: 'EVERY_WEEK',
								cycleLength: 1,
								cycleAnchorDate: null,
							})
							await refresh()
						})()
					},
				},
			],
		)
	}

	async function handleExportSchedule() {
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
			trackEvent(ANALYTICS_EVENTS.SCHEDULE_EXPORTED)
		} catch (error) {
			Alert.alert(
				'Ошибка экспорта',
				toUserErrorMessage(error, 'Не удалось экспортировать'),
			)
		}
	}

	async function shareCsv(content: string, filename: string) {
		const dir = `${FileSystem.cacheDirectory ?? ''}exports`
		const dirInfo = await FileSystem.getInfoAsync(dir)
		if (!dirInfo.exists) {
			await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
		}

		const uri = `${dir}/${filename}`
		await FileSystem.writeAsStringAsync(uri, content, {
			encoding: FileSystem.EncodingType.UTF8,
		})
		await shareFileUri(uri, 'text/csv')
	}

	async function handleExportGradesCsv() {
		if (!repositories) {
			return
		}

		try {
			await shareCsv(await exportGradesCsv(repositories), 'grades.csv')
		} catch (error) {
			Alert.alert('Ошибка', toUserErrorMessage(error, 'Не удалось экспортировать оценки'))
		}
	}

	async function handleExportAttendanceCsv() {
		if (!repositories) {
			return
		}

		try {
			await shareCsv(await exportAttendanceCsv(repositories), 'attendance.csv')
		} catch (error) {
			Alert.alert(
				'Ошибка',
				toUserErrorMessage(error, 'Не удалось экспортировать посещаемость'),
			)
		}
	}

	async function handleExportFocusCsv() {
		if (!repositories) {
			return
		}

		try {
			await shareCsv(await exportFocusCsv(repositories), 'focus.csv')
		} catch (error) {
			Alert.alert('Ошибка', toUserErrorMessage(error, 'Не удалось экспортировать фокус'))
		}
	}

	return (
		<ScreenContainer title="Ещё">
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={styles.sectionTitle}>Учёба</Text>
				<SettingsRow label="Режим" value={modeLabel} />
				<SettingsRow
					label="Учебный период"
					value={activePeriod?.name ?? 'Не настроен'}
				/>
				<SettingsRow label="Тип недели" value={cycleLabel} />
				{settings?.cycleLength === 2 ? (
					<Pressable onPress={() => void handleCycleModeChange()}>
						<Text style={styles.link}>Перейти на еженедельное расписание</Text>
					</Pressable>
				) : null}

				<Text style={styles.sectionTitle}>Справочники</Text>
				<Pressable onPress={() => router.push('/subjects')}>
					<Text style={styles.link}>Предметы</Text>
				</Pressable>
				<Pressable onPress={() => router.push('/teachers')}>
					<Text style={styles.link}>Преподаватели</Text>
				</Pressable>

				<Text style={styles.sectionTitle}>Инструменты</Text>
				<Pressable onPress={() => router.push('/focus')}>
					<Text style={styles.link}>Фокус / Таймер</Text>
				</Pressable>
				<Pressable onPress={() => router.push('/focus-stats')}>
					<Text style={styles.link}>Статистика занятий</Text>
				</Pressable>
				<Pressable onPress={() => void handleExportSchedule()}>
					<Text style={styles.link}>Экспорт расписания</Text>
				</Pressable>
				<Pressable onPress={() => router.push('/schedule-import')}>
					<Text style={styles.link}>Импорт расписания</Text>
				</Pressable>

				<Text style={styles.sectionTitle}>Данные</Text>
				<Pressable onPress={() => router.push('/backup-restore')}>
					<Text style={styles.link}>Резервная копия</Text>
				</Pressable>
				<Pressable onPress={() => void handleExportGradesCsv()}>
					<Text style={styles.link}>Экспорт оценок (CSV)</Text>
				</Pressable>
				<Pressable onPress={() => void handleExportAttendanceCsv()}>
					<Text style={styles.link}>Экспорт посещаемости (CSV)</Text>
				</Pressable>
				<Pressable onPress={() => void handleExportFocusCsv()}>
					<Text style={styles.link}>Экспорт фокуса (CSV)</Text>
				</Pressable>

				<Text style={styles.sectionTitle}>О приложении</Text>
				<Pressable onPress={() => router.push('/about')}>
					<Text style={styles.link}>О приложении</Text>
				</Pressable>
			</ScrollView>
		</ScreenContainer>
	)
}

function SettingsRow({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.row}>
			<Text style={styles.rowLabel}>{label}</Text>
			<Text style={styles.rowValue} numberOfLines={2}>
				{value}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 32,
	},
	sectionTitle: {
		fontSize: 13,
		fontWeight: '700',
		color: '#64748B',
		textTransform: 'uppercase',
		marginTop: 16,
		marginBottom: 8,
	},
	row: {
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#E2E8F0',
	},
	rowLabel: {
		fontSize: 14,
		color: '#64748B',
		marginBottom: 2,
	},
	rowValue: {
		fontSize: 16,
		color: '#0F172A',
		fontWeight: '500',
	},
	link: {
		fontSize: 16,
		color: '#2563EB',
		paddingVertical: 12,
	},
})
