/** Format seconds as human-readable duration (Russian labels). */
export function formatDurationSeconds(totalSeconds: number): string {
	const safe = Math.max(0, Math.round(totalSeconds))
	if (safe === 0) {
		return '0 мин'
	}

	const hours = Math.floor(safe / 3600)
	const minutes = Math.floor((safe % 3600) / 60)

	if (hours === 0) {
		return `${minutes} мин`
	}

	if (minutes === 0) {
		return `${hours} ч`
	}

	return `${hours} ч ${minutes} мин`
}

/** Format mm:ss or hh:mm:ss for running timer display. */
export function formatTimerDisplay(totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds))
	const hours = Math.floor(safe / 3600)
	const minutes = Math.floor((safe % 3600) / 60)
	const seconds = safe % 60

	const pad = (value: number) => String(value).padStart(2, '0')

	if (hours > 0) {
		return `${hours}:${pad(minutes)}:${pad(seconds)}`
	}

	return `${minutes}:${pad(seconds)}`
}

/** Convert elapsed ms to whole minutes for saved session duration. */
export function elapsedMsToSavedMinutes(elapsedMs: number): number {
	return Math.max(1, Math.floor(elapsedMs / 60_000))
}
