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

  return (
    <header className="flight-deck-header">
      {/* Brand & Persona Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
        <div className="header-brand">
          <span className="brand-callsign">ALRAKIS</span>
          <span className="brand-separator">//</span>
          <span className="brand-system">SELENE-NAV</span>
          <span className="brand-version">[v2.6]</span>
        </div>

        <div className="persona-toggle-bento">
          <button
            className={persona === 'flight-dynamics' ? 'persona-btn-active' : 'persona-btn-inactive'}
            onClick={() => setPersona('flight-dynamics')}
            title="Raw azimuth/elevation, vertical solar flux, slope hazards, and Earth libration"
          >
            [01 // FLIGHT DYNAMICS ENGINEER]
          </button>
          <button
            className={persona === 'educator' ? 'persona-btn-active' : 'persona-btn-inactive'}
            onClick={() => setPersona('educator')}
            title="Interactive visual comparisons explaining axial tilt, eternal light & cold traps"
          >
            [02 // EDUCATOR & PUBLIC EXPLORER]
          </button>
        </div>
      </div>

      {/* Center-Right: Large Tabular Telemetry Countdowns */}
      <div className="header-countdowns">
        <div className="header-countdown-item">
          <span className="header-countdown-label">
            {sunsetCountdown.isSetting ? 'TIME TO LOCAL SUNSET:' : 'TIME TO LOCAL SUNRISE:'}
          </span>
          <span className="header-countdown-val-solar">
            {sunsetCountdown.formattedCountdown}
          </span>
        </div>

        <div className="header-countdown-item">
          <span className="header-countdown-label">
            {earthsetCountdown.isSetting ? 'TIME TO EARTHSET:' : 'TIME TO EARTHRISE:'}
          </span>
          <span className="header-countdown-val-earth">
            {earthsetCountdown.formattedCountdown}
          </span>
        </div>
      </div>

      {/* Far Right: Status LED Strip & Tactical Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        {/* Animated Avionics LED Indicator */}
        <div className="live-data-led-group" title="Ephemeris synchronized to NASA JPL Horizons System API (coord@301)">
          <div className="led-bar-graph">
            <span className="led-tick active-teal" />
            <span className="led-tick active-teal" />
            <span className="led-tick active-teal" />
            <span className="led-tick active-teal" />
            <span className="led-tick active-amber" />
            <span className="led-tick active-teal" />
          </div>
          <span className="led-text">LIVE DATA LINK: OPTIMAL [JPL ENGINES]</span>
        </div>

        <button
          className="btn-tactical-secondary"
          style={{ padding: '0.38rem 0.75rem', fontSize: '0.66rem' }}
          onClick={onOpenScenarioModal}
          title="Compare landing site alternatives and launch slip timeline deltas"
        >
          + COMPARE SITE / DATE DELTA
        </button>

        <button
          className="btn-tactical-primary"
          style={{ padding: '0.38rem 0.85rem', fontSize: '0.66rem' }}
          onClick={onOpenJplModal}
          title="Verify topocentric ephemeris with NASA JPL Horizons API (coord@301)"
        >
          VERIFY JPL HORIZONS API
        </button>
      </div>
    </header>
  );
};
