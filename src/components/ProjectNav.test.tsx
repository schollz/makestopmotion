import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectRecord } from '../types'
import { ProjectNav } from './ProjectNav'

const projects: ProjectRecord[] = [
  { id: 'one', name: 'Clay walk', createdAt: 1 },
  { id: 'two', name: 'Paper test', createdAt: 2 },
]

function renderProjectNav(overrides: Partial<Parameters<typeof ProjectNav>[0]> = {}) {
  const props: Parameters<typeof ProjectNav>[0] = {
    projects,
    activeProjectId: 'one',
    activeFrameCount: 3,
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onClear: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }
  render(<ProjectNav {...props} />)
  return props
}

describe('ProjectNav', () => {
  it('switches projects from the header', async () => {
    const user = userEvent.setup()
    const props = renderProjectNav()

    await user.selectOptions(screen.getByLabelText('Current project'), 'two')
    expect(props.onSelect).toHaveBeenCalledWith('two')
  })

  it('offers project management actions with safe disabled states', async () => {
    const user = userEvent.setup()
    const props = renderProjectNav()

    await user.click(screen.getByRole('button', { name: 'Create project' }))
    await user.click(
      screen.getByRole('button', { name: 'Rename current project' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Clear current project frames' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Delete current project' }),
    )

    expect(props.onCreate).toHaveBeenCalledOnce()
    expect(props.onRename).toHaveBeenCalledOnce()
    expect(props.onClear).toHaveBeenCalledOnce()
    expect(props.onDelete).toHaveBeenCalledOnce()
  })

  it('does not delete the last remaining project', () => {
    renderProjectNav({ projects: [projects[0]] })
    expect(
      screen.getByRole('button', { name: 'Delete current project' }),
    ).toBeDisabled()
  })
})
