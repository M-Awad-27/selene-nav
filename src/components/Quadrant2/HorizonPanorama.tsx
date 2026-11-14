import React, { useMemo, useState } from 'react';
import { useMissionStore } from '../../store/missionStore';
import { getInterpolatedHorizonElevation } from '../../engine/horizonRaycaster';
import { computeTopocentricPosition } from '../../engine/lunarEphemeris';

export const HorizonPanorama: React.FC = () => {
  const currentSun = useMissionStore((s) => s.currentSun);
  const currentEarth = useMissionStore((s) => s.currentEarth);
  const currentSunClear = useMissionStore((s) => s.currentSunClear);
  const currentDteActive = useMissionStore((s) => s.currentDteActive);
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const sitesRegistry = useMissionStore((s) => s.sitesRegistry);
  const customCoordinate = useMissionStore((s) => s.customCoordinate);
  const horizonProfiles = useMissionStore((s) => s.horizonProfiles);
  const mastHeightMeters = useMissionStore((s) => s.mastHeightMeters);
  const setMastHeightMeters = useMissionStore((s) => s.setMastHeightMeters);
  const simulationDate = useMissionStore((s) => s.simulationDate);

  const [displayMode, setDisplayMode] = useState<'panorama' | 'skyplot'>('panorama');

  // Active site coordinates
  const siteCoord = useMemo(() => {
    if (customCoordinate) return customCoordinate;
    const reg = sitesRegistry.find((s) => s.id === selectedSiteId);
    if (reg) return { latDeg: reg.lat, lonDeg: reg.lon, elevationKm: reg.elevationKm };
    return { latDeg: -89.54, lonDeg: 137.0, elevationKm: 1.25 };
  }, [customCoordinate, selectedSiteId, sitesRegistry]);

  // Profile data for selected site
  const profile = horizonProfiles[selectedSiteId] || [];

  // 1. Calculate Sun Grazing Trajectory Wave (24-hour diurnal arc)
  const sunTrajectory = useMemo(() => {
    const pts: { az: number; el: number }[] = [];
    const baseMs = simulationDate.getTime();
    for (let h = -12; h <= 12; h += 0.5) {
      const d = new Date(baseMs + h * 3600000);
      const pos = computeTopocentricPosition(d, siteCoord, 'sun');
      pts.push({ az: pos.azimuthDeg, el: pos.elevationDeg });
    }
    return pts;
  }, [simulationDate, siteCoord]);

  // 2. Calculate Earth Libration Figure-8 Loop (27.2-day draconic month)
  const earthLibrationLoop = useMemo(() => {
    const pts: { az: number; el: number }[] = [];
    const baseMs = simulationDate.getTime();
    for (let d = -14; d <= 14; d += 1) {
      const date = new Date(baseMs + d * 86400000);
      const pos = computeTopocentricPosition(date, siteCoord, 'earth');
      pts.push({ az: pos.azimuthDeg, el: pos.elevationDeg });
    }
    return pts;
  }, [simulationDate, siteCoord]);

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
    const bottomY = HEIGHT - MARGIN_BOTTOM;
    terrainPathD = `${points.join(' ')} L ${azToX(360).toFixed(1)} ${bottomY} L ${azToX(0).toFixed(1)} ${bottomY} Z`;
  }

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

  // Polar Skyplot coordinates helpers
  const SKY_CX = WIDTH / 2;
  const SKY_CY = (HEIGHT - 10) / 2;
  const SKY_R = 115; // Max radius at 0° elevation

  const skyplotPolarToXY = (azDeg: number, elDeg: number) => {
    // 90° elevation = center, 0° elevation = outer edge
    const r = SKY_R * Math.max(0, 1 - elDeg / 90.0);
    const rad = (azDeg * Math.PI) / 180.0;
    return {
      x: SKY_CX + r * Math.sin(rad),
      y: SKY_CY - r * Math.cos(rad),
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Subheader: Telemetry, Mast Slider & View Toggle */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge-precomputed">
            {displayMode === 'panorama' ? '360° SKYLINE RAYCASTER' : 'POLAR FISHEYE SKYPLOT'}
          </span>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              className={`btn-tactical-secondary ${displayMode === 'panorama' ? 'active' : ''}`}
              style={{
                padding: '0.2rem 0.45rem',
                fontSize: '0.62rem',
                borderLeftColor: displayMode === 'panorama' ? 'var(--accent-solar)' : undefined,
              }}
              onClick={() => setDisplayMode('panorama')}
            >
              PANORAMA
            </button>
            <button
              className={`btn-tactical-secondary ${displayMode === 'skyplot' ? 'active' : ''}`}
              style={{
                padding: '0.2rem 0.45rem',
                fontSize: '0.62rem',
                borderLeftColor: displayMode === 'skyplot' ? 'var(--accent-earth)' : undefined,
              }}
              onClick={() => setDisplayMode('skyplot')}
            >
              SKYPLOT DOME
            </button>
          </div>
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

      {/* Main SVG Visualization */}
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
          </defs>

          {displayMode === 'panorama' ? (
            /* ──────────────── 360° RECTANGULAR PANORAMA ──────────────── */
            <g>
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

              {/* Sun Grazing Diurnal Trajectory Wave */}
              {(() => {
                let waveD = '';
                sunTrajectory.forEach((p, idx) => {
                  const x = azToX(p.az);
                  const y = elToY(p.el);
                  if (idx === 0) {
                    waveD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
                  } else {
                    const prevX = azToX(sunTrajectory[idx - 1].az);
                    // Don't draw wrap-around line across 360 to 0
                    if (Math.abs(x - prevX) < 150) {
                      waveD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
                    } else {
                      waveD += ` M ${x.toFixed(1)} ${y.toFixed(1)}`;
                    }
                  }
                });
                return (
                  <path
                    d={waveD}
                    fill="none"
                    stroke="var(--accent-solar)"
                    strokeWidth="1.2"
                    strokeDasharray="3,3"
                    opacity="0.6"
                  />
                );
              })()}

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
                    <circle cx="0" cy="0" r="14" fill="url(#earthGlow)" />
                    <circle
                      cx="0"
                      cy="0"
                      r="5"
                      fill="var(--accent-earth-hi)"
                      stroke="#090A0D"
                      strokeWidth="1.5"
                    />
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
                    <circle cx="0" cy="0" r="18" fill="url(#sunGlow)" />
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
            </g>
          ) : (
            /* ──────────────── CIRCULAR POLAR SKYPLOT DOME ──────────────── */
            <g>
              {/* Outer boundary circle (0° horizon) */}
              <circle cx={SKY_CX} cy={SKY_CY} r={SKY_R} fill="#111318" stroke="var(--border-hairline)" strokeWidth="1.5" />
              {/* Concentric elevation rings: 30°, 60° */}
              {[30, 60].map((el) => {
                const r = SKY_R * (1 - el / 90.0);
                return (
                  <g key={el}>
                    <circle cx={SKY_CX} cy={SKY_CY} r={r} fill="none" stroke="#262A34" strokeWidth="0.8" strokeDasharray="3,3" />
                    <text x={SKY_CX + 4} y={SKY_CY - r + 8} fill="var(--text-muted)" fontSize="7" fontFamily="var(--font-mono)">
                      {el}°
                    </text>
                  </g>
                );
              })}

              {/* Cardinal Azimuth axes (N, E, S, W) */}
              <line x1={SKY_CX} y1={SKY_CY - SKY_R} x2={SKY_CX} y2={SKY_CY + SKY_R} stroke="#1F232D" strokeWidth="0.8" />
              <line x1={SKY_CX - SKY_R} y1={SKY_CY} x2={SKY_CX + SKY_R} y2={SKY_CY} stroke="#1F232D" strokeWidth="0.8" />

              {/* Axis labels */}
              <text x={SKY_CX} y={SKY_CY - SKY_R - 6} fill="var(--accent-solar)" fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)">N</text>
              <text x={SKY_CX + SKY_R + 10} y={SKY_CY + 3} fill="var(--text-secondary)" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)">E</text>
              <text x={SKY_CX} y={SKY_CY + SKY_R + 14} fill="var(--text-secondary)" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)">S</text>
              <text x={SKY_CX - SKY_R - 10} y={SKY_CY + 3} fill="var(--text-secondary)" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)">W</text>

              {/* Zenith crosshair */}
              <line x1={SKY_CX - 4} y1={SKY_CY} x2={SKY_CX + 4} y2={SKY_CY} stroke="var(--text-muted)" strokeWidth="1" />
              <line x1={SKY_CX} y1={SKY_CY - 4} x2={SKY_CX} y2={SKY_CY + 4} stroke="var(--text-muted)" strokeWidth="1" />
              <text x={SKY_CX + 5} y={SKY_CY - 4} fill="var(--text-muted)" fontSize="7" fontFamily="var(--font-mono)">ZENITH (90°)</text>

              {/* 360° Terrain Horizon Masking Ring */}
              {(() => {
                if (profile.length === 0) return null;
                let maskD = '';
                for (let az = 0; az <= 360; az++) {
                  const hElev = getInterpolatedHorizonElevation(az, profile, mastHeightMeters);
                  const { x, y } = skyplotPolarToXY(az, hElev);
                  maskD += `${az === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                }
                return (
                  <path
                    d={maskD}
                    fill="none"
                    stroke="var(--border-active)"
                    strokeWidth="1.2"
                  />
                );
              })()}

              {/* Sun Diurnal Trajectory Ring in Skyplot */}
              {(() => {
                let sunPathD = '';
                sunTrajectory.forEach((p, idx) => {
                  const { x, y } = skyplotPolarToXY(p.az, p.el);
                  sunPathD += `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                });
                return <path d={sunPathD} fill="none" stroke="var(--accent-solar)" strokeWidth="1" strokeDasharray="3,2" opacity="0.7" />;
              })()}

              {/* Sun Position Marker in Skyplot */}
              {(() => {
                const { x, y } = skyplotPolarToXY(currentSun.azimuthDeg, currentSun.elevationDeg);
                return (
                  <g transform={`translate(${x}, ${y})`}>
                    <circle cx="0" cy="0" r="10" fill="url(#sunGlow)" />
                    <circle cx="0" cy="0" r="4.5" fill="var(--accent-solar-hi)" stroke="#090A0D" strokeWidth="1" />
                    <text x="8" y="3" fill="var(--accent-solar-hi)" fontSize="8" fontFamily="var(--font-mono)" fontWeight="bold">
                      SUN
                    </text>
                  </g>
                );
              })()}

              {/* Earth Position Marker in Skyplot */}
              {(() => {
                const { x, y } = skyplotPolarToXY(currentEarth.azimuthDeg, currentEarth.elevationDeg);
                return (
                  <g transform={`translate(${x}, ${y})`}>
                    <circle cx="0" cy="0" r="8" fill="url(#earthGlow)" />
                    <circle cx="0" cy="0" r="4" fill="var(--accent-earth-hi)" stroke="#090A0D" strokeWidth="1" />
                    <text x="7" y="3" fill="var(--accent-earth-hi)" fontSize="8" fontFamily="var(--font-mono)" fontWeight="bold">
                      EARTH
                    </text>
                  </g>
                );
              })()}
            </g>
          )}
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
