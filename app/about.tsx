import * as React from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import Constants from 'expo-constants'
import { ScreenContainer } from '@/src/components/ScreenContainer'

const PRIVACY_URL = 'https://alex1c.github.io/myLearnRuStore/privacy.html'

/** About screen with version and privacy policy link. */
export default function AboutScreen() {
	return (
		<ScreenContainer title="О приложении">
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={styles.appName}>Моя учёба</Text>
				<Text style={styles.version}>
					Версия {Constants.expoConfig?.version ?? '1.0.0'}
				</Text>
				<Text style={styles.description}>
					Офлайн-first учебный органайзер: расписание, задания, оценки и подготовка к
					занятиям.
				</Text>

				<Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} style={styles.linkRow}>
					<Text style={styles.link}>Политика конфиденциальности</Text>
				</Pressable>

				<Text style={styles.note}>
					Support email: rustore-alex1c@yandex.ru
				</Text>
			</ScrollView>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 32,
	},
	appName: {
		fontSize: 28,
		fontWeight: '700',
		color: '#0F172A',
		marginBottom: 4,
	},
	version: {
		fontSize: 15,
		color: '#64748B',
		marginBottom: 16,
	},
	description: {
		fontSize: 15,
		color: '#334155',
		lineHeight: 22,
		marginBottom: 24,
	},
	linkRow: {
		paddingVertical: 12,
	},
	link: {
		fontSize: 16,
		color: '#2563EB',
	},
	note: {
		marginTop: 24,
		fontSize: 13,
		color: '#94A3B8',
		lineHeight: 20,
	},
})
