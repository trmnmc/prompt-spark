import { beforeEach, describe, expect, it } from 'vitest'
import { aiReady, loadSettings, saveSettings, SETTINGS_KEY } from './settings'

beforeEach(() => {
  localStorage.clear()
})

describe('settings store', () => {
  it('defaults: AI off, opus model, empty key', () => {
    const s = loadSettings()
    expect(s).toEqual({ apiKey: '', model: 'claude-opus-5', aiEnabled: false })
    expect(aiReady(s)).toBe(false)
  })

  it('persists patches under the versioned key and round-trips', () => {
    saveSettings({ apiKey: 'sk-ant-x', aiEnabled: true })
    expect(localStorage.getItem(SETTINGS_KEY)).not.toBeNull()
    const s = loadSettings()
    expect(s.apiKey).toBe('sk-ant-x')
    expect(s.aiEnabled).toBe(true)
    expect(s.model).toBe('claude-opus-5')
    expect(aiReady(s)).toBe(true)
  })

  it('normalizes junk: corrupt JSON and unknown model fall back to defaults', () => {
    localStorage.setItem(SETTINGS_KEY, '{nope')
    expect(loadSettings().model).toBe('claude-opus-5')
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ model: 'gpt-9', apiKey: 42, aiEnabled: 'yes' }))
    const s = loadSettings()
    expect(s.model).toBe('claude-opus-5')
    expect(s.apiKey).toBe('')
    expect(s.aiEnabled).toBe(false)
  })

  it('aiReady requires both the toggle and a non-blank key', () => {
    expect(aiReady(saveSettings({ aiEnabled: true, apiKey: '   ' }))).toBe(false)
    expect(aiReady(saveSettings({ aiEnabled: false, apiKey: 'sk-ant-x' }))).toBe(false)
    expect(aiReady(saveSettings({ aiEnabled: true, apiKey: 'sk-ant-x' }))).toBe(true)
  })
})
