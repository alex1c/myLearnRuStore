import { ScreenContainer } from '@/src/components/ScreenContainer'
import { EmptyState } from '@/src/components/EmptyState'

/** More tab foundation placeholder for settings and future tools. */
export function MoreScreen() {
	return (
		<ScreenContainer title="Ещё">
			<EmptyState
				title="Настройки и инструменты"
				description="Режим обучения, учебный период, напоминания и Pomodoro появятся в следующих фазах."
			/>
		</ScreenContainer>
	)
}
