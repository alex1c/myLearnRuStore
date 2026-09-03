/**
 * Russian plural form picker for integer counts.
 * Forms: one (1, 21), few (2–4, 22–24), many (0, 5–20, 25–…).
 */
export function pluralizeRu(
	count: number,
	one: string,
	few: string,
	many: string,
): string {
	const absolute = Math.abs(Math.trunc(count))
	const mod100 = absolute % 100
	const mod10 = absolute % 10

	if (mod10 === 1 && mod100 !== 11) {
		return one
	}

	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
		return few
	}

	return many
}
