import { ScreenContainer } from '@/src/components/ScreenContainer'
import { EmptyState } from '@/src/components/EmptyState'

/** Schedule tab foundation placeholder for Phase 2. */
export function ScheduleScreen() {
	return (
		<ScreenContainer title="Расписание">
			<EmptyState
				title="Расписание пока пустое"
				description="Здесь появится недельное расписание с поддержкой числителя и знаменателя."
			/>
		</ScreenContainer>
	)
}
