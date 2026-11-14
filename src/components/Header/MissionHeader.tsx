import React from 'react';
import { useMissionStore } from '../../store/missionStore';

interface MissionHeaderProps {
  onOpenJplModal: () => void;
}

export const MissionHeader: React.FC<MissionHeaderProps> = ({ onOpenJplModal }) => {
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
        {/* Sunset Countdown */}
        <div className="countdown-block">
          <span className="countdown-label">
            {sunsetCountdown.isSetting ? 'TIME TO LOCAL SUNSET' : 'TIME TO LOCAL SUNRISE'}
          </span>
          <span
            className={`countdown-value ${
              currentSunClear ? 'solar' : 'hazard'
            }`}
          >
            {sunsetCountdown.formattedCountdown}
          </span>
        </div>

        {/* Earthset Countdown */}
        <div className="countdown-block" style={{ marginLeft: '1rem' }}>
          <span className="countdown-label">
            {earthsetCountdown.isSetting ? 'TIME TO EARTHSET (LOS)' : 'TIME TO EARTHRISE (AOS)'}
          </span>
          <span
            className={`countdown-value ${
              currentDteActive ? 'earth' : 'hazard'
            }`}
          >
            {earthsetCountdown.formattedCountdown}
          </span>
        </div>

        {/* JPL Horizons Live Verifier Button */}
        <button
          className="btn-tactical-primary"
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.70rem', marginLeft: '1rem' }}
          onClick={onOpenJplModal}
          title="Verify topocentric ephemeris with NASA JPL Horizons API (coord@301)"
        >
          VERIFY JPL API
        </button>
      </div>
    </header>
  );
};
