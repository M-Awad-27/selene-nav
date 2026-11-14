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
  const setIsSimulationOpen = useMissionStore((s) => s.setIsSimulationOpen);

  return (
    <header className="flight-deck-header">
      {/* Left: Brand Callsign & Dual Persona Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap' }}>
        <div className="header-brand" style={{ fontSize: '0.82rem' }}>
          <span className="brand-callsign">ALRAKIS</span>
          <span className="brand-separator">//</span>
          <span className="brand-system">SELENE-NAV</span>
          <span className="brand-version">[v2.6]</span>
        </div>

        <div className="persona-toggle-bento" style={{ gap: '2px', padding: '1px' }}>
          <button
            className={persona === 'flight-dynamics' ? 'persona-btn-active' : 'persona-btn-inactive'}
            style={{ padding: '0.22rem 0.5rem', fontSize: '0.60rem' }}
            onClick={() => setPersona('flight-dynamics')}
            title="Raw topocentric azimuth/elevation, vertical solar flux, slope hazards, and Earth libration"
          >
            [01 // FLIGHT DYNAMICS]
          </button>
          <button
            className={persona === 'educator' ? 'persona-btn-active' : 'persona-btn-inactive'}
            style={{ padding: '0.22rem 0.5rem', fontSize: '0.60rem' }}
            onClick={() => setPersona('educator')}
            title="Interactive visual comparisons explaining axial tilt, eternal light & cold traps"
          >
            [02 // EDUCATOR & EXPLORER]
          </button>
        </div>
      </div>

      {/* Center: Large High-Contrast Tabular Countdowns */}
      <div className="header-countdowns" style={{ gap: '10px' }}>
        <div className="header-countdown-item">
          <span className="header-countdown-label">
            {sunsetCountdown.isSetting ? 'LOCAL SUNSET:' : 'LOCAL SUNRISE:'}
          </span>
          <span className="header-countdown-val-solar" style={{ fontSize: '0.98rem' }}>
            {sunsetCountdown.formattedCountdown}
          </span>
        </div>

        <div className="header-countdown-item">
          <span className="header-countdown-label">
            {earthsetCountdown.isSetting ? 'EARTHSET:' : 'EARTHRISE:'}
          </span>
          <span className="header-countdown-val-earth" style={{ fontSize: '0.98rem' }}>
            {earthsetCountdown.formattedCountdown}
          </span>
        </div>
      </div>

      {/* Right: Live Data Link Indicator & Tactical Action Buttons (Guaranteed 16px clearance from right edge) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap', paddingRight: '4px' }}>
        {/* Animated Avionics LED Indicator */}
        <div className="live-data-led-group" style={{ padding: '0.20rem 0.45rem' }} title="Ephemeris synchronized to NASA JPL Horizons System API (coord@301)">
          <div className="led-bar-graph">
            <span className="led-tick active-teal" />
            <span className="led-tick active-teal" />
            <span className="led-tick active-teal" />
            <span className="led-tick active-teal" />
            <span className="led-tick active-amber" />
            <span className="led-tick active-teal" />
          </div>
          <span className="led-text" style={{ fontSize: '0.54rem' }}>DATA LINK: OPTIMAL [JPL]</span>
        </div>

        <button
          className="btn-tactical-primary"
          style={{
            padding: '0.24rem 0.60rem',
            fontSize: '0.60rem',
            whiteSpace: 'nowrap',
            backgroundColor: 'rgba(229, 154, 35, 0.22)',
            borderColor: '#E59A23',
            color: '#F7B955',
            fontWeight: 'bold',
            boxShadow: '0 0 10px rgba(229, 154, 35, 0.4)',
          }}
          onClick={() => setIsSimulationOpen(true)}
          title="Launch Powered Descent, Touchdown & Surface Rover Digital Twin Simulation"
        >
          ▶ LAUNCH SIMULATION
        </button>

        <button
          className="btn-tactical-secondary"
          style={{ padding: '0.24rem 0.55rem', fontSize: '0.60rem', whiteSpace: 'nowrap' }}
          onClick={onOpenScenarioModal}
          title="Compare landing site alternatives and launch slip timeline deltas"
        >
          + COMPARE DELTA
        </button>

        <button
          className="btn-tactical-primary"
          style={{ padding: '0.24rem 0.60rem', fontSize: '0.60rem', whiteSpace: 'nowrap' }}
          onClick={onOpenJplModal}
          title="Verify topocentric ephemeris with NASA JPL Horizons API (coord@301)"
        >
          VERIFY JPL API
        </button>
      </div>
    </header>
  );
};
