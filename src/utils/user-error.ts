/** Map internal/repository errors to user-friendly Russian messages. */
export function toUserErrorMessage(error: unknown, fallback: string): string {
	if (!(error instanceof Error)) {
		return fallback
	}

	const message = error.message

	if (message.includes('FOREIGN KEY') || message.includes('constraint')) {
		return 'Не удалось сохранить данные из‑за связи с другими записями.'
	}

	if (message.includes('UNIQUE') || message.includes('duplicate')) {
		return 'Такая запись уже существует.'
	}

	if (message.includes('not found')) {
		return 'Запись не найдена.'
	}

	if (message.includes('Invalid') || message.includes('Unsupported')) {
		return message
	}

	if (message.includes('SQLite') || message.includes('TypeError')) {
		return fallback
	}

	return message.length > 120 ? fallback : message
}
