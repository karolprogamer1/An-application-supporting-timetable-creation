function ViewSettings({ fontScale, contrast, onFontScaleChange, onContrastChange, onBack }) {
  return (
    <div className="student-settings-page">
      <div className="student-settings-card">
        <h1>Ustawienia aplikacji</h1>
        <div className="settings-field">
          <span>Powiekszenie tekstu</span>
          <div className="settings-actions">
            <button type="button" onClick={() => onFontScaleChange((value) => Math.max(value - 10, 80))}>
              A-
            </button>
            <button type="button" onClick={() => onFontScaleChange((value) => Math.min(value + 10, 160))}>
              A+
            </button>
            <strong>{fontScale}%</strong>
          </div>
        </div>
        <div className="settings-field">
          <span>Kontrast</span>
          <div className="settings-actions">
            <button type="button" onClick={() => onContrastChange((value) => Math.max(value - 15, 80))}>
              K-
            </button>
            <button type="button" onClick={() => onContrastChange((value) => Math.min(value + 15, 200))}>
              K+
            </button>
            <strong>{contrast}%</strong>
          </div>
        </div>
        <button type="button" className="card-back-button" onClick={onBack}>
          Powrót do menu
        </button>
      </div>
    </div>
  )
}

export default ViewSettings
