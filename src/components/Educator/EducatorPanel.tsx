import React from 'react';
import { useMissionStore } from '../../store/missionStore';

export const EducatorPanel: React.FC = () => {
  const powerAndLink = useMissionStore((s) => s.powerAndLink);
  const currentSun = useMissionStore((s) => s.currentSun);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface-1)',
        border: '1px solid var(--border-hairline)',
        padding: '1rem',
        borderRadius: '2px',
        margin: '1px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span className="badge-live">EDUCATOR & PUBLIC EXPLORER DECK</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--accent-solar-hi)' }}>
          WHY IS THE MOON'S SOUTH POLE UNIQUE IN THE SOLAR SYSTEM?
        </span>
      </div>

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
            While Earth is tilted by <strong>23.5°</strong> (creating four distinct seasons), the Moon’s rotational axis is nearly perpendicular to the ecliptic plane at just <strong>1.54°</strong>.
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

        {/* Card 3: Vertical vs Horizontal Solar Arrays */}
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
            3. VERTICAL VS. HORIZONTAL SOLAR ARRAYS
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.5 }}>
            At polar grazing angles (Sun elevation currently {currentSun.elevationDeg.toFixed(1)}°):
            <div style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              • Vertical Mast Power: <strong style={{ color: 'var(--accent-solar-hi)' }}>{powerAndLink.powerGeneratedVerticalWatts} W</strong> ({powerAndLink.verticalFluxWm2} W/m²)
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              • Horizontal Deck Power: <strong style={{ color: 'var(--status-hazard)' }}>{powerAndLink.powerGeneratedHorizontalWatts} W</strong> ({powerAndLink.horizontalFluxWm2} W/m²)
            </div>
            This mathematical proof illustrates why vertical solar masts are mandatory for Artemis and CLPS landers!
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
            Because the Moon’s orbit is slightly tilted (5.14°) and elliptical, the Moon "wobbles" as seen from Earth by <strong>±6.68° in latitude</strong> and <strong>±7.90° in longitude</strong>.
            From the South Pole, Earth never rises or sets in a straight line—it traces a perpetual figure-8 loop in the northern sky. When it dips below a crater rim, direct radio communications are severed unless a relay satellite is available.
          </div>
        </div>
      </div>
    </div>
  );
};
