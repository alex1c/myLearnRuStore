import * as Crypto from 'expo-crypto'

/** Generate a stable text UUID for domain entities and backup portability. */
export function createId(): string {
	return Crypto.randomUUID()
}

/** Current ISO timestamp for created_at / updated_at fields. */
export function nowTimestamp(): string {
	return new Date().toISOString()
}
