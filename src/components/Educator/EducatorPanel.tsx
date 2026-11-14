import React, { useState } from 'react';
import { useMissionStore } from '../../store/missionStore';
import { SOLAR_CONSTANT_W_M2 } from '../../engine/lunarEphemeris';

export const EducatorPanel: React.FC = () => {
  const currentSun = useMissionStore((s) => s.currentSun);
  const currentIlluminationFraction = useMissionStore((s) => s.currentIlluminationFraction);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Interactive student / educator solar array simulator
  const [panelAreaM2, setPanelAreaM2] = useState(2.5);
  const [panelEfficiency, setPanelEfficiency] = useState(0.30); // 30% triple-junction GaAs

  const elSunRad = Math.max(0, currentSun.elevationDeg) * (Math.PI / 180.0);
  const f = Math.max(0, Math.min(1, currentIlluminationFraction));

  const vertFlux = SOLAR_CONSTANT_W_M2 * f * Math.cos(elSunRad);
  const horizFlux = SOLAR_CONSTANT_W_M2 * f * Math.sin(elSunRad);

  const vertWatts = Math.round(vertFlux * panelEfficiency * panelAreaM2);
  const horizWatts = Math.round(horizFlux * panelEfficiency * panelAreaM2);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface-1)',
        border: '1px solid var(--border-hairline)',
        padding: isCollapsed ? '0.5rem 1rem' : '0.8rem 1rem',
        borderRadius: '2px',
        margin: '1px',
        display: 'flex',
        flexDirection: 'column',
        gap: isCollapsed ? '0' : '0.8rem',
        transition: 'all 0.2s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span className="badge-live">EDUCATOR & PUBLIC EXPLORER DECK</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.80rem', fontWeight: 'bold', color: 'var(--accent-solar-hi)' }}>
            WHY IS THE MOON'S SOUTH POLE UNIQUE? {isCollapsed ? '· 1.54° Axial Tilt · Cryo PSRs · Solar Mast Physics · Figure-8 Libration' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="badge-precomputed" style={{ fontSize: '0.62rem' }}>
            SUN ELEVATION: {currentSun.elevationDeg.toFixed(2)}°
          </span>
          <button
            className="btn-tactical-secondary"
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.65rem' }}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand 4 educational visual explanation cards' : 'Collapse to compact avionics ribbon'}
          >
            {isCollapsed ? '▼ EXPAND DECK' : '▲ MINIMIZE DECK'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {/* Card 1: 1.54° Axial Tilt & Eternal Light */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-2)',
            border: '1px solid var(--border-hairline)',
            borderLeft: '3px solid var(--accent-solar)',
            padding: '0.8rem',
            borderRadius: '2px',
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-solar-hi)' }}>
            1. THE 1.54° AXIAL TILT PHENOMENON
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.5 }}>
            While Earth is tilted by <strong>23.5°</strong> (creating seasons), the Moon’s rotational axis is nearly perpendicular to the ecliptic plane at just <strong>1.54°</strong>.
            Because of this, the Sun never climbs high into the polar sky—it skims continuously along the horizon (0° to 3.5° elevation), casting shadows tens of kilometers long across deep crater depressions.
          </div>
        </div>

        {/* Card 2: Permanently Shadowed Regions & Water Ice */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-2)',
            border: '1px solid var(--border-hairline)',
            borderLeft: '3px solid var(--surface-psr)',
            padding: '0.8rem',
            borderRadius: '2px',
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-earth-hi)' }}>
            2. PERMANENTLY SHADOWED REGIONS (PSRs)
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.5 }}>
            Impact crater floors like <em>Shackleton</em>, <em>Faustini</em>, and <em>Cabeus</em> have deep rims that permanently block grazing sunlight. Inside these cold traps, temperatures drop below <strong>40 Kelvin (-233°C)</strong>, preserving billions of tons of ancient water ice essential for rocket propellant and life support.
          </div>
        </div>

        {/* Card 3: Interactive Solar Array Simulator */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-2)',
            border: '1px solid var(--border-hairline)',
            borderLeft: '3px solid var(--accent-solar-hi)',
            padding: '0.8rem',
            borderRadius: '2px',
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-solar-hi)' }}>
            3. INTERACTIVE SOLAR ARRAY SIMULATOR
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.4 }}>
            Test why vertical masts generate peak power at polar grazing sun angles:
            <div style={{ display: 'flex', gap: '1rem', marginTop: '6px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  PANEL AREA: {panelAreaM2.toFixed(1)} m²
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="8.0"
                  step="0.5"
                  value={panelAreaM2}
                  onChange={(e) => setPanelAreaM2(parseFloat(e.target.value))}
                  className="range-tactical"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  EFFICIENCY: {(panelEfficiency * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0.15"
                  max="0.38"
                  step="0.01"
                  value={panelEfficiency}
                  onChange={(e) => setPanelEfficiency(parseFloat(e.target.value))}
                  className="range-tactical"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.70rem' }}>
              <div>
                • Vertical Tracking Mast: <strong style={{ color: 'var(--accent-solar-hi)' }}>{vertWatts} Watts</strong> ({Math.round(vertFlux)} W/m²)
              </div>
              <div>
                • Horizontal Deck Panel: <strong style={{ color: 'var(--status-hazard)' }}>{horizWatts} Watts</strong> ({Math.round(horizFlux)} W/m²)
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Direct-to-Earth Libration */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-2)',
            border: '1px solid var(--border-hairline)',
            borderLeft: '3px solid var(--accent-earth)',
            padding: '0.8rem',
            borderRadius: '2px',
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-earth-hi)' }}>
            4. EARTH LIBRATION & DIRECT COMMUNICATIONS
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.5 }}>
            Because the Moon’s orbit is slightly tilted (5.14°) and elliptical, the Moon "wobbles" by <strong>±6.68° in latitude</strong> and <strong>±7.90° in longitude</strong>.
            From the South Pole, Earth never rises or sets in a straight line—it traces a perpetual figure-8 loop in the northern sky. When it dips below a crater rim, direct radio communications are severed unless a relay satellite is available.
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
