import { beforeEach, describe, expect, it } from 'vitest'
import type { FrameRecord } from '../types'
import {
  clearFrames,
  createProject,
  deleteProject,
  getAllFrames,
  getProjects,
  removeFrame,
  renameProject,
  resetDatabaseForTests,
  saveFrame,
  saveFrames,
} from './frame-db'

function makeFrame(
  id: string,
  sequence: number,
  projectId = 'default-project',
): FrameRecord {
  return {
    id,
    projectId,
    sequence,
    capturedAt: sequence * 1_000,
    width: 1280,
    height: 720,
    imageBlob: new Blob([`image-${id}`], { type: 'image/jpeg' }),
    thumbnailBlob: new Blob([`thumb-${id}`], { type: 'image/jpeg' }),
  }
}

describe('frame database', () => {
  beforeEach(async () => {
    await clearFrames()
  })

  it('stores and returns frames in sequence order', async () => {
    await saveFrame(makeFrame('third', 3))
    await saveFrame(makeFrame('first', 1))
    await saveFrame(makeFrame('second', 2))

    const frames = await getAllFrames()
    expect(frames.map(({ id }) => id)).toEqual(['first', 'second', 'third'])
  })

  it('persists a reordered sequence as one update', async () => {
    await saveFrames([
      makeFrame('third', 1),
      makeFrame('first', 2),
      makeFrame('second', 3),
    ])

    const frames = await getAllFrames()
    expect(frames.map(({ id }) => id)).toEqual(['third', 'first', 'second'])
  })

  it('removes one frame without affecting the others', async () => {
    await saveFrame(makeFrame('one', 1))
    await saveFrame(makeFrame('two', 2))
    await removeFrame('one')

    const frames = await getAllFrames()
    expect(frames.map(({ id }) => id)).toEqual(['two'])
  })

  it('clears the complete sequence', async () => {
    await saveFrame(makeFrame('one', 1))
    await saveFrame(makeFrame('two', 2))
    await clearFrames()

    expect(await getAllFrames()).toEqual([])
  })

  it('keeps frames isolated between projects', async () => {
    const project = await createProject('Second set')
    await saveFrame(makeFrame('default-frame', 1))
    await saveFrame(makeFrame('second-frame', 1, project.id))

    expect((await getAllFrames()).map(({ id }) => id)).toEqual([
      'default-frame',
    ])
    expect(
      (await getAllFrames(project.id)).map(({ id }) => id),
    ).toEqual(['second-frame'])

    await clearFrames(project.id)
    expect(await getAllFrames(project.id)).toEqual([])
    expect((await getAllFrames()).map(({ id }) => id)).toEqual([
      'default-frame',
    ])
  })

  it('creates, renames, and deletes projects with their frames', async () => {
    const project = await createProject('Clay test')
    await renameProject(project.id, 'Clay final')
    await saveFrame(makeFrame('clay-frame', 1, project.id))

    expect((await getProjects()).find(({ id }) => id === project.id)?.name).toBe(
      'Clay final',
    )

    await deleteProject(project.id)
    expect((await getProjects()).some(({ id }) => id === project.id)).toBe(
      false,
    )
    expect(await getAllFrames(project.id)).toEqual([])
  })

  it('migrates frames from the original single-project database', async () => {
    await resetDatabaseForTests()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('stillframe-db')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('stillframe-db', 1)
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('frames', {
          keyPath: 'id',
        })
        store.createIndex('by-sequence', 'sequence')
        const legacyFrame = makeFrame('legacy', 1)
        const { projectId: _projectId, ...storedLegacyFrame } = legacyFrame
        store.put(storedLegacyFrame)
      }
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })

    const migratedFrames = await getAllFrames()
    expect(migratedFrames).toHaveLength(1)
    expect(migratedFrames[0]).toMatchObject({
      id: 'legacy',
      projectId: 'default-project',
    })
    expect(await getProjects()).toEqual([
      expect.objectContaining({
        id: 'default-project',
        name: 'My stop motion',
      }),
    ])
  })
})
