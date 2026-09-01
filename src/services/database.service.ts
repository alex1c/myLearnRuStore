import { getDatabase } from '@/src/db/database'
import { createRepositories } from '@/src/db/repositories'

/** Application service entry for UI — hides direct SQL access. */
export async function getAppRepositories() {
	const db = await getDatabase()
	return createRepositories(db)
}
