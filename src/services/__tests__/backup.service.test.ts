import { strToU8, zipSync } from 'fflate'
import * as FileSystem from 'expo-file-system/legacy'
import { parseBackupArchive, restoreBackupArchive } from '@/src/services/backup/backup.service'
import { BACKUP_KIND, BACKUP_VERSION } from '@/src/services/backup/backup.types'
import { openTestDatabase } from '@/src/db/adapters/sqljs-test-adapter'
import { bootstrapDatabase } from '@/src/db/database'
import { createRepositories } from '@/src/db/repositories'

function buildMinimalBackupZip(): Uint8Array {
	const manifest = {
		kind: BACKUP_KIND,
		version: BACKUP_VERSION,
		exportedAt: '2026-09-02T10:00:00.000Z',
		appVersion: '1.0.0',
		counts: {
			studyPeriods: 1,
			subjects: 1,
			scheduleEntries: 0,
			assignments: 0,
			grades: 0,
			photos: 0,
			focusSessions: 0,
		},
	}

	const data = {
		appSettings: [{ id: 's1' }],
		studyPeriods: [{ id: 'p1' }],
		teachers: [],
		subjects: [{ id: 'sub1', study_period_id: 'p1' }],
		scheduleEntries: [],
		scheduleExceptions: [],
		assignments: [],
		assignmentPhotos: [],
		assignmentReminders: [],
		grades: [],
		attendance: [],
		focusSessions: [],
		holidays: [],
		scheduleImportHistory: [],
	}

	return zipSync({
		'manifest.json': strToU8(JSON.stringify(manifest)),
		'data.json': strToU8(JSON.stringify(data)),
	})
}

describe('backup.service validation', () => {
	it('parses valid backup archive', () => {
		const parsed = parseBackupArchive(buildMinimalBackupZip())
		expect(parsed.manifest.kind).toBe(BACKUP_KIND)
		expect(parsed.data.subjects).toHaveLength(1)
	})

	it('rejects unsupported version', () => {
		const bad = zipSync({
			'manifest.json': strToU8(JSON.stringify({ kind: BACKUP_KIND, version: 99 })),
			'data.json': strToU8('{}'),
		})

		expect(() => parseBackupArchive(bad)).toThrow('Unsupported backup version')
	})

	it('rejects path traversal in zip', () => {
		const bad = zipSync({
			'../evil.json': strToU8('{}'),
			'manifest.json': strToU8('{}'),
			'data.json': strToU8('{}'),
		})

		expect(() => parseBackupArchive(bad)).toThrow('Unsafe path in backup archive')
	})

	it('rejects broken subject reference', () => {
		const manifest = {
			kind: BACKUP_KIND,
			version: BACKUP_VERSION,
			exportedAt: '2026-09-02',
			appVersion: '1.0.0',
			counts: {},
		}

		const data = {
			appSettings: [],
			studyPeriods: [],
			teachers: [],
			subjects: [{ id: 'sub1', study_period_id: 'missing' }],
			scheduleEntries: [],
			scheduleExceptions: [],
			assignments: [],
			assignmentPhotos: [],
			assignmentReminders: [],
			grades: [],
			attendance: [],
			focusSessions: [],
			holidays: [],
			scheduleImportHistory: [],
		}

		const bad = zipSync({
			'manifest.json': strToU8(JSON.stringify(manifest)),
			'data.json': strToU8(JSON.stringify(data)),
		})

		expect(() => parseBackupArchive(bad)).toThrow('Backup subject references unknown study period')
	})

	it('rejects duplicate IDs before restore', () => {
		const bytes = buildMinimalBackupZip()
		const parsed = parseBackupArchive(bytes)
		parsed.data.subjects.push({ ...parsed.data.subjects[0] })
		const bad = zipSync({
			'manifest.json': strToU8(JSON.stringify(parsed.manifest)),
			'data.json': strToU8(JSON.stringify(parsed.data)),
		})
		expect(() => parseBackupArchive(bad)).toThrow('duplicate subjects IDs')
	})

	it('rolls back DB A and removes staged media when restore fails midway', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)
		const ts = '2026-09-02T10:00:00.000Z'
		await connection.runAsync(
			'INSERT INTO study_periods VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			['current-a', 'Current A', 'SEMESTER', '2026-01-01', '2026-06-30', 1, ts, ts],
		)
		jest.mocked(FileSystem.makeDirectoryAsync).mockResolvedValue(undefined)
		const write = jest.mocked(FileSystem.writeAsStringAsync)
		write.mockResolvedValue(undefined)

		const parsed = {
			manifest: { kind: BACKUP_KIND, version: BACKUP_VERSION, exportedAt: ts, appVersion: '1.0.0',
				counts: { studyPeriods: 1, subjects: 1, scheduleEntries: 0, assignments: 1,
					grades: 1, photos: 1, focusSessions: 0 } },
			data: {
				appSettings: [],
				studyPeriods: [{ id: 'p-b', name: 'B', type: 'SEMESTER', start_date: '2026-01-01', end_date: '2026-06-30', is_active: 1, created_at: ts, updated_at: ts }],
				teachers: [],
				subjects: [{ id: 's-b', study_period_id: 'p-b', name: 'Math', short_name: null, color: null, room_default: null, teacher_id: null, target_grade: null, sort_order: 0, is_archived: 0, created_at: ts, updated_at: ts, grade_scale: 'FIVE_POINT', attendance_target: null }],
				scheduleEntries: [], scheduleExceptions: [],
				assignments: [{ id: 'a-b', subject_id: 's-b', title: 'Task', description: null, due_date: '2026-09-03', due_time: null, priority: 'NORMAL', status: 'PENDING', assignment_type: 'HOMEWORK', source_schedule_entry_id: null, completed_at: null, notes: null, created_at: ts, updated_at: ts, source_occurrence_date: null }],
				assignmentPhotos: [{ id: 'ph-b', assignmentId: 'a-b', archiveName: 'photos/ph-b.jpg', sortOrder: 0, createdAt: ts }],
				assignmentReminders: [],
				grades: [{ id: 'bad-grade', subject_id: 'missing', value: 5, weight: 1, grade_type: null, grade_scale: 'FIVE_POINT', date: '2026-09-02', note: null, created_at: ts, updated_at: ts, assignment_id: null }],
				attendance: [], focusSessions: [], holidays: [], scheduleImportHistory: [],
			},
			photos: new Map([['ph-b', new Uint8Array([1, 2, 3])]]),
		}

		await expect(restoreBackupArchive(repos, parsed)).rejects.toThrow()
		expect(await connection.getFirstAsync<{ name: string }>(
			"SELECT name FROM study_periods WHERE id = 'current-a'",
		)).toEqual({ name: 'Current A' })
		expect(write).toHaveBeenCalledTimes(1)
		expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
			expect.stringContaining('assignment-photos/restores/'), { idempotent: true },
		)
	})
})
