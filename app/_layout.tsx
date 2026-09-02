import { useFonts } from 'expo-font'
import { Redirect, Stack, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import 'react-native-reanimated'
import { AppDataProvider, useAppData } from '@/src/context/AppDataContext'
import { useNotificationNavigation } from '@/src/hooks/useNotificationNavigation'

export {
	ErrorBoundary,
} from 'expo-router'

export const unstable_settings = {
	initialRouteName: '(tabs)',
}

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
	const [loaded, error] = useFonts({
		SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
	})

	useEffect(() => {
		if (error) {
			throw error
		}
	}, [error])

	useEffect(() => {
		if (loaded) {
			void SplashScreen.hideAsync()
		}
	}, [loaded])

	if (!loaded) {
		return null
	}

	return (
		<SafeAreaProvider>
			<AppDataProvider>
				<RootNavigator />
			</AppDataProvider>
		</SafeAreaProvider>
	)
}

function RootNavigator() {
	const { isReady, isOnboarded } = useAppData()
	const segments = useSegments()
	useNotificationNavigation()

	if (!isReady) {
		return (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ActivityIndicator size="large" color="#2563EB" />
			</View>
		)
	}

	const onOnboarding = segments[0] === 'onboarding'

	if (!isOnboarded && !onOnboarding) {
		return <Redirect href="/onboarding" />
	}

	if (isOnboarded && onOnboarding) {
		return <Redirect href="/(tabs)" />
	}

	return (
		<Stack>
			<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
			<Stack.Screen name="onboarding" options={{ headerShown: false }} />
			<Stack.Screen
				name="lesson-form"
				options={{ presentation: 'modal', title: 'Занятие' }}
			/>
			<Stack.Screen
				name="lesson-exception"
				options={{ presentation: 'modal', title: 'Исключение' }}
			/>
			<Stack.Screen
				name="assignment-form"
				options={{ presentation: 'modal', title: 'Задание' }}
			/>
			<Stack.Screen
				name="one-off-lesson-form"
				options={{ presentation: 'modal', title: 'Занятие на день' }}
			/>
			<Stack.Screen
				name="grade-form"
				options={{ presentation: 'modal', title: 'Оценка' }}
			/>
			<Stack.Screen name="subject-performance" options={{ title: 'Предмет' }} />
			<Stack.Screen
				name="attendance-form"
				options={{ presentation: 'modal', title: 'Посещаемость' }}
			/>
			<Stack.Screen name="focus" options={{ title: 'Фокус' }} />
			<Stack.Screen name="focus-stats" options={{ title: 'Статистика' }} />
			<Stack.Screen name="schedule-import" options={{ title: 'Импорт' }} />
			<Stack.Screen name="subjects" options={{ title: 'Предметы' }} />
			<Stack.Screen name="teachers" options={{ title: 'Преподаватели' }} />
		</Stack>
	)
}
