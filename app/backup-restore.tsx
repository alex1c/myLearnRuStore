import * as React from 'react'
import { Alert, ScrollView, StyleSheet, Text } from 'react-native'
import { useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { PrimaryButton } from '@/src/components/ui/FormFields'
import { useAppData } from '@/src/context/AppDataContext'
import {
	buildBackupPreview,
	createBackupArchive,
	parseBackupArchive,
	restoreBackupArchive,
	writeBackupFile,
} from '@/src/services/backup/backup.service'
import type { ParsedBackupArchive } from '@/src/services/backup/backup.types'
import { ANALYTICS_EVENTS } from '@/src/config/analytics'
import { trackEvent } from '@/src/services/analytics/analytics.service'
import { shareFileUri } from '@/src/services/share/share.service'
import { toUserErrorMessage } from '@/src/utils/user-error'

/** Backup create/restore with preview and full replace confirmation. */
export default function BackupRestoreScreen() {
	const router = useRouter()
	const { repositories, refresh } = useAppData()
	const [preview, setPreview] = React.useState<ParsedBackupArchive | null>(null)
	const [isWorking, setIsWorking] = React.useState(false)

	async function handleCreateBackup() {
		if (!repositories) {
			return
		}

		setIsWorking(true)
		try {
			const archive = await createBackupArchive(repositories)
			const uri = await writeBackupFile(archive)
			await shareFileUri(uri, 'application/zip')
			trackEvent(ANALYTICS_EVENTS.BACKUP_CREATED)
		} catch (error) {
			Alert.alert(
				'Ошибка',
				toUserErrorMessage(error, 'Не удалось создать резервную копию'),
			)
		} finally {
			setIsWorking(false)
		}
	}

	async function handlePickRestore() {
		const result = await DocumentPicker.getDocumentAsync({
			type: ['application/zip', 'application/octet-stream'],
			copyToCacheDirectory: true,
		})

		if (result.canceled || !result.assets[0]) {
			return
		}

		try {
			const response = await fetch(result.assets[0].uri)
			const buffer = await response.arrayBuffer()
			setPreview(parseBackupArchive(new Uint8Array(buffer)))
		} catch (error) {
			Alert.alert(
				'Ошибка',
				toUserErrorMessage(error, 'Не удалось прочитать резервную копию'),
			)
		}
	}

	function handleConfirmRestore() {
		if (!repositories || !preview) {
			return
		}

		Alert.alert(
			'Восстановить данные?',
			'Восстановление заменит текущие данные приложения. Продолжить?',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Восстановить',
					style: 'destructive',
					onPress: () => {
						void (async () => {
							setIsWorking(true)
							try {
								await restoreBackupArchive(repositories, preview)
								trackEvent(ANALYTICS_EVENTS.BACKUP_RESTORED)
								await refresh()
								Alert.alert('Готово', 'Данные восстановлены', [
									{ text: 'OK', onPress: () => router.replace('/(tabs)') },
								])
							} catch (error) {
								Alert.alert(
									'Ошибка',
									toUserErrorMessage(error, 'Не удалось восстановить данные'),
								)
							} finally {
								setIsWorking(false)
							}
						})()
					},
				},
			],
		)
	}

	const summary = preview ? buildBackupPreview(preview) : null

	return (
		<ScreenContainer title="Резервная копия">
			<ScrollView contentContainerStyle={styles.content}>
				{!summary ? (
					<>
						<Text style={styles.description}>
							Создайте полную резервную копию или восстановите данные из файла ZIP.
							Активный таймер фокуса не переносится — только завершённые сессии.
						</Text>
						<PrimaryButton
							title={isWorking ? 'Создание…' : 'Создать резервную копию'}
							onPress={() => void handleCreateBackup()}
							disabled={isWorking}
						/>
						<PrimaryButton
							title="Восстановить из файла"
							onPress={() => void handlePickRestore()}
							disabled={isWorking}
						/>
					</>
				) : (
					<>
						<Text style={styles.sectionTitle}>Предпросмотр</Text>
						<Text style={styles.meta}>Дата: {summary.exportedAt.slice(0, 10)}</Text>
						<Text style={styles.meta}>Версия: {summary.manifest.version}</Text>
						<Text style={styles.meta}>
							Периодов: {summary.counts.studyPeriods}
						</Text>
						<Text style={styles.meta}>Предметов: {summary.counts.subjects}</Text>
						<Text style={styles.meta}>Занятий: {summary.counts.scheduleEntries}</Text>
						<Text style={styles.meta}>Заданий: {summary.counts.assignments}</Text>
						<Text style={styles.meta}>Оценок: {summary.counts.grades}</Text>
						<Text style={styles.meta}>Фото: {summary.counts.photos}</Text>
						<Text style={styles.meta}>
							Focus-сессий: {summary.counts.focusSessions}
						</Text>
						<Text style={styles.warning}>
							Восстановление заменит текущие данные приложения.
						</Text>
						<PrimaryButton
							title={isWorking ? 'Восстановление…' : 'Восстановить'}
							onPress={handleConfirmRestore}
							disabled={isWorking}
						/>
						<PrimaryButton
							title="Выбрать другой файл"
							onPress={() => setPreview(null)}
							disabled={isWorking}
						/>
					</>
				)}
			</ScrollView>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 32,
		gap: 12,
	},
	description: {
		fontSize: 15,
		color: '#64748B',
		lineHeight: 22,
		marginBottom: 8,
	},
	sectionTitle: {
		fontSize: 13,
		fontWeight: '700',
		color: '#64748B',
		textTransform: 'uppercase',
	},
	meta: {
		fontSize: 15,
		color: '#334155',
	},
	warning: {
		fontSize: 14,
		color: '#DC2626',
		marginVertical: 8,
		lineHeight: 20,
	},
})
