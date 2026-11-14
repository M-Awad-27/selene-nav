import React from 'react';
import { useMissionStore } from '../../store/missionStore';
import { getInterpolatedHorizonElevation } from '../../engine/horizonRaycaster';

export const HorizonPanorama: React.FC = () => {
  const currentSun = useMissionStore((s) => s.currentSun);
  const currentEarth = useMissionStore((s) => s.currentEarth);
  const currentSunClear = useMissionStore((s) => s.currentSunClear);
  const currentDteActive = useMissionStore((s) => s.currentDteActive);
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const horizonProfiles = useMissionStore((s) => s.horizonProfiles);
  const mastHeightMeters = useMissionStore((s) => s.mastHeightMeters);
  const setMastHeightMeters = useMissionStore((s) => s.setMastHeightMeters);

  // Profile data for selected site
  const profile = horizonProfiles[selectedSiteId] || [];

  // Panorama Viewbox dimensions
  const WIDTH = 720;
  const HEIGHT = 280;
  const MARGIN_BOTTOM = 30;
  const MARGIN_LEFT = 35;
  const PLOT_W = WIDTH - MARGIN_LEFT - 15;
  const PLOT_H = HEIGHT - MARGIN_BOTTOM - 20;

  // Elevation range: -5° to +25°
  const EL_MIN = -5.0;
  const EL_MAX = 25.0;
  const EL_RANGE = EL_MAX - EL_MIN;

  const azToX = (azDeg: number) => {
    const normAz = ((azDeg % 360) + 360) % 360;
    return MARGIN_LEFT + (normAz / 360.0) * PLOT_W;
  };

  const elToY = (elDeg: number) => {
    const clampedEl = Math.max(EL_MIN, Math.min(EL_MAX, elDeg));
    const frac = (clampedEl - EL_MIN) / EL_RANGE;
    return HEIGHT - MARGIN_BOTTOM - frac * PLOT_H;
  };

  // Build the 360° terrain silhouette SVG path
  let terrainPathD = '';
  if (profile.length > 0) {
    const points: string[] = [];
    for (let az = 0; az <= 360; az++) {
      const hElev = getInterpolatedHorizonElevation(az, profile, mastHeightMeters);
      const x = azToX(az);
      const y = elToY(hElev);
      points.push(`${az === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    // Close polygon to bottom of plot
    const bottomY = HEIGHT - MARGIN_BOTTOM;
    terrainPathD = `${points.join(' ')} L ${azToX(360).toFixed(1)} ${bottomY} L ${azToX(0).toFixed(1)} ${bottomY} Z`;
  }

  // 0° elevation horizon line
  const zeroElY = elToY(0);

  // Elevation grid lines
  const elGridTicks = [-5, 0, 5, 10, 15, 20, 25];

  // Azimuth ticks (Cardinal headings)
  const azTicks = [
    { label: '0° N', az: 0 },
    { label: '45° NE', az: 45 },
    { label: '90° E', az: 90 },
    { label: '135° SE', az: 135 },
    { label: '180° S', az: 180 },
    { label: '225° SW', az: 225 },
    { label: '270° W', az: 270 },
    { label: '315° NW', az: 315 },
    { label: '360° N', az: 360 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Subheader: Telemetry & Mast Slider */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.4rem 0.8rem',
          borderBottom: '1px solid var(--border-hairline)',
          backgroundColor: 'var(--bg-surface-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="badge-precomputed">360° SKYLINE RAYCASTER</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            AZ: 0°..360° · EL: -5°..+25°
          </span>
        </div>

        {/* Mast Height Slider (0m to 15m) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.65rem', color: 'var(--accent-solar-hi)', fontFamily: 'var(--font-mono)' }}>
            MAST: {mastHeightMeters.toFixed(1)}m
          </label>
          <input
            type="range"
            min="0"
            max="15"
            step="0.5"
            value={mastHeightMeters}
            onChange={(e) => setMastHeightMeters(parseFloat(e.target.value))}
            className="range-tactical"
            style={{ width: '85px' }}
            title="Adjustable Lander Solar Mast Height (0m to 15m)"
          />
        </div>
      </div>

      {/* Main SVG Panorama */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: '100%', height: '100%', display: 'block', backgroundColor: 'var(--bg-void)' }}
        >
          <defs>
            {/* Terrain gradient: Basalt to carbon void */}
            <linearGradient id="terrainGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2A303C" stopOpacity="0.9" />
              <stop offset="35%" stopColor="#1B1F27" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#111318" stopOpacity="1" />
            </linearGradient>

            {/* Solar disk glow */}
            <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFE082" stopOpacity="1" />
              <stop offset="40%" stopColor="#F7B955" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#E59A23" stopOpacity="0" />
            </radialGradient>

            {/* Earth disk glow */}
            <radialGradient id="earthGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#80E5D8" stopOpacity="1" />
              <stop offset="50%" stopColor="#289E8E" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#185E54" stopOpacity="0" />
            </radialGradient>

            {/* Obstruction cross-hatch */}
            <pattern id="hazardHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(217, 70, 62, 0.25)" strokeWidth="1.5" />
            </pattern>
          </defs>

          {/* Elevation grid lines */}
          {elGridTicks.map((el) => {
            const y = elToY(el);
            const isZero = el === 0;
            return (
              <g key={el}>
                <line
                  x1={MARGIN_LEFT}
                  y1={y}
                  x2={WIDTH - 15}
                  y2={y}
                  stroke={isZero ? 'var(--border-active)' : 'var(--border-hairline)'}
                  strokeWidth={isZero ? 1.2 : 0.6}
                  strokeDasharray={isZero ? undefined : '2,4'}
                />
                <text
                  x={MARGIN_LEFT - 6}
                  y={y + 3}
                  fill={isZero ? 'var(--accent-solar)' : 'var(--text-muted)'}
                  fontSize="8"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                >
                  {el > 0 ? `+${el}°` : `${el}°`}
                </text>
              </g>
            );
          })}

          {/* Azimuth grid verticals */}
          {azTicks.map((tick) => {
            const x = azToX(tick.az);
            return (
              <g key={tick.az}>
                <line
                  x1={x}
                  y1={HEIGHT - MARGIN_BOTTOM}
                  x2={x}
                  y2={20}
                  stroke="var(--border-hairline)"
                  strokeWidth="0.6"
                  strokeDasharray="2,4"
                />
                <text
                  x={x}
                  y={HEIGHT - MARGIN_BOTTOM + 14}
                  fill="var(--text-secondary)"
                  fontSize="8"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                >
                  {tick.label}
                </text>
              </g>
            );
          })}

          {/* Terrain Skyline Silhouette Fill */}
          {terrainPathD && (
            <path
              d={terrainPathD}
              fill="url(#terrainGradient)"
              stroke="var(--border-active)"
              strokeWidth="1.5"
            />
          )}

          {/* Earth Position Marker & S-Band Link Vector */}
          {(() => {
            const x = azToX(currentEarth.azimuthDeg);
            const y = elToY(currentEarth.elevationDeg);
            return (
              <g transform={`translate(${x}, ${y})`}>
                {/* Glow ring */}
                <circle cx="0" cy="0" r="14" fill="url(#earthGlow)" />
                {/* Earth core disk */}
                <circle
                  cx="0"
                  cy="0"
                  r="5"
                  fill="var(--accent-earth-hi)"
                  stroke="#090A0D"
                  strokeWidth="1.5"
                />
                {/* Libration figure-8 tracer hint */}
                <ellipse cx="0" cy="0" rx="8" ry="4" fill="none" stroke="var(--accent-earth)" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.6" />
                <text
                  x="10"
                  y="-4"
                  fill="var(--accent-earth-hi)"
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                  fontWeight="bold"
                >
                  EARTH ({currentEarth.elevationDeg.toFixed(1)}°)
                </text>
                <text
                  x="10"
                  y="6"
                  fill={currentDteActive ? 'var(--accent-earth-hi)' : 'var(--status-hazard)'}
                  fontSize="7"
                  fontFamily="var(--font-mono)"
                >
                  {currentDteActive ? 'DTE LOCK [ACTIVE]' : 'TERRAIN OCCULTED'}
                </text>
              </g>
            );
          })()}

          {/* Sun Position Marker & Solar Disk (0.53° diameter) */}
          {(() => {
            const x = azToX(currentSun.azimuthDeg);
            const y = elToY(currentSun.elevationDeg);
            return (
              <g transform={`translate(${x}, ${y})`}>
                {/* Sun outer corona glow */}
                <circle cx="0" cy="0" r="18" fill="url(#sunGlow)" />
                {/* Solar disk with physical 0.53° diameter scale */}
                <circle
                  cx="0"
                  cy="0"
                  r="6"
                  fill="var(--accent-solar-hi)"
                  stroke="#090A0D"
                  strokeWidth="1.5"
                />
                <text
                  x="12"
                  y="-4"
                  fill="var(--accent-solar-hi)"
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                  fontWeight="bold"
                >
                  SUN ({currentSun.elevationDeg.toFixed(1)}°)
                </text>
                <text
                  x="12"
                  y="6"
                  fill={currentSunClear ? 'var(--accent-solar)' : 'var(--status-hazard)'}
                  fontSize="7"
                  fontFamily="var(--font-mono)"
                >
                  {currentSunClear ? 'DIRECT ILLUMINATION' : 'CRATER RIM SHADOW'}
                </text>
              </g>
            );
          })()}
        </svg>

        {/* Live Horizon Silhouette Overlay Telemetry HUD */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '10px',
            backgroundColor: 'rgba(17, 19, 24, 0.88)',
            border: '1px solid var(--border-hairline)',
            padding: '0.35rem 0.65rem',
            borderRadius: '2px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.62rem',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div style={{ color: 'var(--accent-solar-hi)' }}>
            SUN: Az {currentSun.azimuthDeg.toFixed(1)}° | El {currentSun.elevationDeg.toFixed(1)}°
          </div>
          <div style={{ color: 'var(--accent-earth-hi)', marginTop: '2px' }}>
            EARTH: Az {currentEarth.azimuthDeg.toFixed(1)}° | El {currentEarth.elevationDeg.toFixed(1)}°
          </div>
        </div>
      </div>
    </div>
  );
};
