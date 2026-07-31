import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => cleanup())

const localValues = new Map<string, string>()
const localStorageMock: Storage = {
  get length() {
    return localValues.size
  },
  clear() {
    localValues.clear()
  },
  getItem(key) {
    return localValues.get(key) ?? null
  },
  key(index) {
    return [...localValues.keys()][index] ?? null
  },
  removeItem(key) {
    localValues.delete(key)
  },
  setItem(key, value) {
    localValues.set(key, String(value))
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorageMock,
})

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorageMock,
})

Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: vi.fn(() => 'blob:stillframe-test'),
})

Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: vi.fn(),
})

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: vi.fn(() => ({
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    stroke: vi.fn(),
    set fillStyle(_value: string) {},
    set imageSmoothingEnabled(_value: boolean) {},
    set imageSmoothingQuality(_value: ImageSmoothingQuality) {},
    set lineWidth(_value: number) {},
    set shadowBlur(_value: number) {},
    set shadowColor(_value: string) {},
    set strokeStyle(_value: string) {},
  })),
})
