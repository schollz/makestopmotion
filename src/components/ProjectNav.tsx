import { Eraser, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ProjectRecord } from '../types'

interface ProjectNavProps {
  projects: ProjectRecord[]
  activeProjectId: string
  activeFrameCount: number
  onSelect: (projectId: string) => void
  onCreate: () => void
  onRename: () => void
  onClear: () => void
  onDelete: () => void
}

export function ProjectNav({
  projects,
  activeProjectId,
  activeFrameCount,
  onSelect,
  onCreate,
  onRename,
  onClear,
  onDelete,
}: ProjectNavProps) {
  const hasProjects = projects.length > 0

  return (
    <nav className="project-nav" aria-label="Project controls">
      <label className="sr-only" htmlFor="project-switcher">
        Current project
      </label>
      <select
        id="project-switcher"
        className="project-nav__select"
        value={hasProjects ? activeProjectId : ''}
        onChange={(event) => onSelect(event.target.value)}
        disabled={!hasProjects}
      >
        {!hasProjects ? <option value="">Loading projects…</option> : null}
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>

      <div className="project-nav__actions">
        <button
          className="project-nav__button"
          type="button"
          onClick={onCreate}
          aria-label="Create project"
          title="New project"
        >
          <Plus size={14} aria-hidden="true" />
          <span>New</span>
        </button>
        <button
          className="project-nav__button"
          type="button"
          onClick={onRename}
          disabled={!hasProjects}
          aria-label="Rename current project"
          title="Rename project"
        >
          <Pencil size={13} aria-hidden="true" />
          <span>Rename</span>
        </button>
        <button
          className="project-nav__button"
          type="button"
          onClick={onClear}
          disabled={!hasProjects || activeFrameCount === 0}
          aria-label="Clear current project frames"
          title="Clear project frames"
        >
          <Eraser size={14} aria-hidden="true" />
          <span>Clear</span>
        </button>
        <button
          className="project-nav__button project-nav__button--danger"
          type="button"
          onClick={onDelete}
          disabled={projects.length < 2}
          aria-label="Delete current project"
          title="Delete project"
        >
          <Trash2 size={14} aria-hidden="true" />
          <span>Delete</span>
        </button>
      </div>
    </nav>
  )
}
