import { AI_MODELS, saveSettings, useSettings } from '../state/settings'

const MODEL_LABELS: Record<string, string> = {
  'claude-opus-5': 'Claude Opus 5 (best)',
  'claude-sonnet-5': 'Claude Sonnet 5 (fast + smart)',
  'claude-haiku-4-5': 'Claude Haiku 4.5 (cheapest)',
}

/**
 * AI settings: bring-your-own key, model, gateway base URL, and the on/off
 * toggle. The key is stored in localStorage and sent only to whichever
 * endpoint is configured, straight from this browser — there is no backend.
 */
export default function SettingsPanel() {
  const settings = useSettings()
  const viaGateway = settings.baseUrl.trim() !== ''

  return (
    <section className="settings-panel" aria-label="AI settings">
      <h2>AI mode</h2>
      <p className="settings-note">
        With your own API key, the interview asks real questions about your idea and writes each
        block's sentence. Your key stays in this browser (localStorage). Without a key, everything
        still works with plain template sentences.
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
        <span>API key</span>
        <input
          type="password"
          placeholder="sk-ant-… or a gateway key"
          autoComplete="off"
          value={settings.apiKey}
          onChange={(e) => saveSettings({ apiKey: e.target.value })}
        />
      </label>
      <label className="settings-row settings-row--stacked">
        <span>Model</span>
        <input
          type="text"
          list="model-presets"
          placeholder="claude-opus-5"
          autoComplete="off"
          value={settings.model}
          onChange={(e) => saveSettings({ model: e.target.value })}
        />
        <datalist id="model-presets">
          {AI_MODELS.map((m) => (
            <option key={m} value={m}>
              {MODEL_LABELS[m] ?? m}
            </option>
          ))}
        </datalist>
      </label>
      <label className="settings-row settings-row--stacked">
        <span>Gateway base URL (optional)</span>
        <input
          type="text"
          placeholder="https://openrouter.ai/api"
          autoComplete="off"
          value={settings.baseUrl}
          onChange={(e) => saveSettings({ baseUrl: e.target.value })}
        />
      </label>
      <p className="settings-note">
        {viaGateway ? (
          <>
            Routing through <strong>{settings.baseUrl}</strong>. Omit the trailing
            <code> /v1</code> — the SDK appends <code>/v1/messages</code> itself. Gateway model ids
            are usually namespaced, e.g. <code>anthropic/claude-opus-5</code>.
          </>
        ) : (
          <>Leave the gateway blank to talk to the Anthropic API directly.</>
        )}
      </p>
    </section>
  )
}
