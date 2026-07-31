import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { FrameRecord, ProjectRecord } from '../types'

interface StopMotionDB extends DBSchema {
  frames: {
    key: string
    value: FrameRecord
    indexes: {
      'by-sequence': number
      'by-project-sequence': [string, number]
    }
  }
  projects: {
    key: string
    value: ProjectRecord
    indexes: { 'by-created-at': number }
  }
}

export const DEFAULT_PROJECT_ID = 'default-project'
export const DEFAULT_PROJECT_NAME = 'My stop motion'

const DB_NAME = 'stillframe-db'
const DB_VERSION = 2
let databasePromise: Promise<IDBPDatabase<StopMotionDB>> | null = null

function projectFrameRange(projectId: string) {
  return IDBKeyRange.bound(
    [projectId, 0],
    [projectId, Number.MAX_SAFE_INTEGER],
  )
}

function getDatabase() {
  databasePromise ??= openDB<StopMotionDB>(DB_NAME, DB_VERSION, {
    async upgrade(database, oldVersion, _newVersion, transaction) {
      let framesStore

      if (oldVersion < 1) {
        framesStore = database.createObjectStore('frames', { keyPath: 'id' })
        framesStore.createIndex('by-sequence', 'sequence')
      } else {
        framesStore = transaction.objectStore('frames')
      }

      if (oldVersion < 2) {
        const projectsStore = database.createObjectStore('projects', {
          keyPath: 'id',
        })
        projectsStore.createIndex('by-created-at', 'createdAt')
        await projectsStore.put({
          id: DEFAULT_PROJECT_ID,
          name: DEFAULT_PROJECT_NAME,
          createdAt: Date.now(),
        })

        framesStore.createIndex('by-project-sequence', [
          'projectId',
          'sequence',
        ])

        let cursor = await framesStore.openCursor()
        while (cursor) {
          const legacyFrame = cursor.value as FrameRecord & {
            projectId?: string
          }
          if (!legacyFrame.projectId) {
            await cursor.update({
              ...legacyFrame,
              projectId: DEFAULT_PROJECT_ID,
            })
          }
          cursor = await cursor.continue()
        }
      }
    },
  })

  return databasePromise
}

export async function getProjects(): Promise<ProjectRecord[]> {
  const database = await getDatabase()
  const projects = await database.getAllFromIndex(
    'projects',
    'by-created-at',
  )

  if (projects.length > 0) return projects

  const defaultProject: ProjectRecord = {
    id: DEFAULT_PROJECT_ID,
    name: DEFAULT_PROJECT_NAME,
    createdAt: Date.now(),
  }
  await database.put('projects', defaultProject)
  return [defaultProject]
}

export async function createProject(name: string): Promise<ProjectRecord> {
  const database = await getDatabase()
  const project: ProjectRecord = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
  }
  await database.put('projects', project)
  return project
}

export async function renameProject(id: string, name: string): Promise<void> {
  const database = await getDatabase()
  const project = await database.get('projects', id)
  if (!project) throw new Error('Project not found.')
  await database.put('projects', { ...project, name })
}

export async function deleteProject(id: string): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction(
    ['projects', 'frames'],
    'readwrite',
  )
  const framesStore = transaction.objectStore('frames')
  const frameKeys = await framesStore
    .index('by-project-sequence')
    .getAllKeys(projectFrameRange(id))

  await Promise.all([
    ...frameKeys.map((key) => framesStore.delete(key)),
    transaction.objectStore('projects').delete(id),
  ])
  await transaction.done
}

export async function getAllFrames(
  projectId = DEFAULT_PROJECT_ID,
): Promise<FrameRecord[]> {
  const database = await getDatabase()
  return database.getAllFromIndex(
    'frames',
    'by-project-sequence',
    projectFrameRange(projectId),
  )
}

export async function saveFrame(frame: FrameRecord): Promise<void> {
  const database = await getDatabase()
  await database.put('frames', frame)
}

export async function saveFrames(frames: FrameRecord[]): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction('frames', 'readwrite')
  await Promise.all([
    ...frames.map((frame) => transaction.store.put(frame)),
    transaction.done,
  ])
}

export async function removeFrame(id: string): Promise<void> {
  const database = await getDatabase()
  await database.delete('frames', id)
}

export async function clearFrames(
  projectId = DEFAULT_PROJECT_ID,
): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction('frames', 'readwrite')
  const frameKeys = await transaction.store
    .index('by-project-sequence')
    .getAllKeys(projectFrameRange(projectId))

  await Promise.all(frameKeys.map((key) => transaction.store.delete(key)))
  await transaction.done
}

export async function resetDatabaseForTests(): Promise<void> {
  if (databasePromise) {
    const database = await databasePromise
    database.close()
  }
  databasePromise = null
}
