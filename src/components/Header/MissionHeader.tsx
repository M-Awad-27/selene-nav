import React from 'react';
import { useMissionStore } from '../../store/missionStore';

interface MissionHeaderProps {
  onOpenJplModal: () => void;
  onOpenScenarioModal: () => void;
}

export const MissionHeader: React.FC<MissionHeaderProps> = ({ onOpenJplModal, onOpenScenarioModal }) => {
  const persona = useMissionStore((s) => s.persona);
  const setPersona = useMissionStore((s) => s.setPersona);
  const sunsetCountdown = useMissionStore((s) => s.sunsetCountdown);
  const earthsetCountdown = useMissionStore((s) => s.earthsetCountdown);
  const currentSunClear = useMissionStore((s) => s.currentSunClear);
  const currentDteActive = useMissionStore((s) => s.currentDteActive);

  return (
    <header className="mission-header">
      {/* Brand & Callsign */}
      <div className="header-brand">
        <span className="brand-callsign">ALRAKIS</span>
        <span className="brand-separator">//</span>
        <span className="brand-system">SELENE-NAV</span>
        <span className="brand-version">[v2.6]</span>
      </div>

      {/* Dual Persona Switcher */}
      <div className="persona-toggle">
        <button
          className={`persona-toggle-option ${persona === 'flight-dynamics' ? 'active' : ''}`}
          onClick={() => setPersona('flight-dynamics')}
          title="Raw azimuth/elevation, vertical solar flux, slope hazards, and Earth libration"
        >
          [01 // FLIGHT DYNAMICS]
        </button>
        <button
          className={`persona-toggle-option ${persona === 'educator' ? 'active' : ''}`}
          onClick={() => setPersona('educator')}
          title="Interactive visual comparisons explaining axial tilt, eternal light & cold traps"
        >
          [02 // EDUCATOR & EXPLORER]
        </button>
      </div>

      {/* Live Operational Countdowns */}
      <div className="header-status">
        {/* Solar Illumination Countdown */}
        <div className={`countdown-block ${currentSunClear ? 'solar-active' : 'hazard-active'}`}>
          <div className="countdown-header-row">
            <span className="countdown-label">
              ☀️ {sunsetCountdown.isSetting ? 'TIME TO SUNSET' : 'TIME TO SUNRISE'}
            </span>
            <span className={`countdown-tag ${currentSunClear ? 'tag-solar' : 'tag-hazard'}`}>
              {currentSunClear ? 'ILLUMINATED' : 'OCCULTED'}
            </span>
          </div>
          <span
            className={`countdown-value ${
              currentSunClear ? 'solar' : 'hazard'
            }`}
          >
            {sunsetCountdown.formattedCountdown}
          </span>
        </div>

        {/* Earth Direct-to-Earth (DTE) Countdown */}
        <div className={`countdown-block ${currentDteActive ? 'earth-active' : 'hazard-active'}`}>
          <div className="countdown-header-row">
            <span className="countdown-label">
              📡 {earthsetCountdown.isSetting ? 'TIME TO LOS' : 'TIME TO AOS'}
            </span>
            <span className={`countdown-tag ${currentDteActive ? 'tag-earth' : 'tag-hazard'}`}>
              {currentDteActive ? 'DTE LOCK' : 'COMM BLOCKED'}
            </span>
          </div>
          <span
            className={`countdown-value ${
              currentDteActive ? 'earth' : 'hazard'
            }`}
          >
            {earthsetCountdown.formattedCountdown}
          </span>
        </div>

        {/* Mission Scenarios & JPL Verifier Buttons */}
        <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '1rem' }}>
          <button
            className="btn-tactical-secondary"
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.70rem' }}
            onClick={onOpenScenarioModal}
            title="Launch interactive Artemis & CLPS mission scenario walkthrough"
          >
            DEMO SCENARIOS
          </button>

          <button
            className="btn-tactical-primary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.70rem' }}
            onClick={onOpenJplModal}
            title="Verify topocentric ephemeris with NASA JPL Horizons API (coord@301)"
          >
            VERIFY JPL API
          </button>
        </div>
      </div>
    </header>
  );
};
