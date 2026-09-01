import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { Platform } from 'react-native'

import Colors from '@/constants/Colors'
import { useColorScheme } from '@/components/useColorScheme'

export default function TabLayout() {
	const colorScheme = useColorScheme() ?? 'light'

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: Colors[colorScheme].tint,
				headerShown: false,
				tabBarStyle: {
					paddingBottom: Platform.OS === 'android' ? 4 : 0,
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Сегодня',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="today-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="schedule"
				options={{
					title: 'Расписание',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="calendar-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="assignments"
				options={{
					title: 'Задания',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="document-text-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="grades"
				options={{
					title: 'Успеваемость',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="stats-chart-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="more"
				options={{
					title: 'Ещё',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="menu-outline" size={size} color={color} />
					),
				}}
			/>
		</Tabs>
	)
}
