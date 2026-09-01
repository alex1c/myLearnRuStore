import { useEffect, useState } from 'react'
import { getDatabase } from '@/src/db/database'
import { createRepositories, type Repositories } from '@/src/db/repositories'

interface DatabaseState {
	isReady: boolean
	error: Error | null
	repositories: Repositories | null
}

/** Initialize SQLite once and expose repositories to the UI layer. */
export function useDatabase(): DatabaseState {
	const [state, setState] = useState<DatabaseState>({
		isReady: false,
		error: null,
		repositories: null,
	})

	useEffect(() => {
		let isMounted = true

		async function init() {
			try {
				const db = await getDatabase()
				const repositories = createRepositories(db)

				if (isMounted) {
					setState({
						isReady: true,
						error: null,
						repositories,
					})
				}
			} catch (error) {
				if (isMounted) {
					setState({
						isReady: false,
						error: error instanceof Error ? error : new Error('Database init failed'),
						repositories: null,
					})
				}
			}
		}

		void init()

		return () => {
			isMounted = false
		}
	}, [])

	return state
}
