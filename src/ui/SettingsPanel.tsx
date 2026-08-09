import { AI_MODELS, saveSettings, useSettings, type AiModel } from '../state/settings'

const MODEL_LABELS: Record<AiModel, string> = {
  'claude-opus-5': 'Claude Opus 5 (best)',
  'claude-sonnet-5': 'Claude Sonnet 5 (fast + smart)',
  'claude-haiku-4-5': 'Claude Haiku 4.5 (cheapest)',
}

/**
 * AI settings: bring-your-own Anthropic API key + model + on/off toggle.
 * The key is stored in localStorage and sent only to the Anthropic API
 * directly from this browser — there is no backend.
 */
export default function SettingsPanel() {
  const settings = useSettings()

  return (
    <section className="settings-panel" aria-label="AI settings">
      <h2>AI mode</h2>
      <p className="settings-note">
        With your own Anthropic API key, Surprise me writes brand-new prompts and Brain Scout
        actually thinks about your idea. Your key stays in this browser (localStorage) and is sent
        only to the Anthropic API. Without a key, everything still works in template mode.
      </p>
      <label className="settings-row">
        <input
          type="checkbox"
          checked={settings.aiEnabled}
          onChange={(e) => saveSettings({ aiEnabled: e.target.checked })}
        />
        <span>Use AI generation when a key is set</span>
      </label>
      <label className="settings-row settings-row--stacked">
        <span>Anthropic API key</span>
        <input
          type="password"
          placeholder="sk-ant-…"
          autoComplete="off"
          value={settings.apiKey}
          onChange={(e) => saveSettings({ apiKey: e.target.value })}
        />
      </label>
      <label className="settings-row settings-row--stacked">
        <span>Model</span>
        <select
          value={settings.model}
          onChange={(e) => saveSettings({ model: e.target.value as AiModel })}
        >
          {AI_MODELS.map((m) => (
            <option key={m} value={m}>
              {MODEL_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}
