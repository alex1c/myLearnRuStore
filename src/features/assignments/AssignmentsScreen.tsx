import { ScreenContainer } from '@/src/components/ScreenContainer'
import { EmptyState } from '@/src/components/EmptyState'

/** Assignments tab foundation placeholder for Phase 2. */
export function AssignmentsScreen() {
	return (
		<ScreenContainer title="Задания">
			<EmptyState
				title="Заданий пока нет"
				description="Быстрое добавление: предмет → текст → дата → сохранить."
				actionLabel="Добавить задание"
				onActionPress={() => {}}
			/>
		</ScreenContainer>
	)
}
