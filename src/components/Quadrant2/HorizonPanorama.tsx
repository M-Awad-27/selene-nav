import React, { useMemo } from 'react';
import { useMissionStore } from '../../store/missionStore';
import { getInterpolatedHorizonElevation } from '../../engine/horizonRaycaster';
import { computeTopocentricPosition, SOLAR_CONSTANT_W_M2 } from '../../engine/lunarEphemeris';

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
  const powerAndLink = useMissionStore((s) => s.powerAndLink);

  // Active site coordinates
  const siteCoord = useMemo(() => {
    if (customCoordinate) return customCoordinate;
    const reg = sitesRegistry.find((s) => s.id === selectedSiteId);
    if (reg) return { latDeg: reg.lat, lonDeg: reg.lon, elevationKm: reg.elevationKm };
    return { latDeg: -89.54, lonDeg: 137.0, elevationKm: 1.25 };
  }, [customCoordinate, selectedSiteId, sitesRegistry]);

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

  // Dimensions for 360° Panorama
  const PANO_W = 540;
  const PANO_H = 210;
  const MARGIN_BOTTOM = 22;
  const MARGIN_LEFT = 32;
  const PLOT_W = PANO_W - MARGIN_LEFT - 12;
  const PLOT_H = PANO_H - MARGIN_BOTTOM - 14;

  // Y-axis strictly calibrated to -10° to +25° (Filling vertical space)
  const EL_MIN = -10.0;
  const EL_MAX = 25.0;
  const EL_RANGE = EL_MAX - EL_MIN;

  const azToX = (azDeg: number) => {
    const normAz = ((azDeg % 360) + 360) % 360;
    return MARGIN_LEFT + (normAz / 360.0) * PLOT_W;
  };

  const elToY = (elDeg: number) => {
    const clampedEl = Math.max(EL_MIN, Math.min(EL_MAX, elDeg));
    const frac = (clampedEl - EL_MIN) / EL_RANGE;
    return PANO_H - MARGIN_BOTTOM - frac * PLOT_H;
  };

  // Build the 360° terrain silhouette SVG path
  let terrainPathD = '';
  const bottomY = PANO_H - MARGIN_BOTTOM;
  if (profile.length > 0) {
    const points: string[] = [];
    for (let az = 0; az <= 360; az++) {
      const hElev = getInterpolatedHorizonElevation(az, profile, mastHeightMeters);
      const x = azToX(az);
      const y = elToY(hElev);
      points.push(`${az === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    terrainPathD = `${points.join(' ')} L ${azToX(360).toFixed(1)} ${bottomY} L ${azToX(0).toFixed(1)} ${bottomY} Z`;
  }

  // Red Hatched Obstruction polygon where Sun wave dips below terrain
  let obstructionPathD = '';
  if (profile.length > 0) {
    const points: string[] = [];
    let hasObstruction = false;
    for (let az = 0; az <= 360; az += 2) {
      const hElev = getInterpolatedHorizonElevation(az, profile, mastHeightMeters);
      // Diurnal sun elevation at this azimuth
      const sunPt = sunTrajectory.reduce((prev, curr) => {
        return Math.abs(curr.az - az) < Math.abs(prev.az - az) ? curr : prev;
      }, sunTrajectory[0]);

      if (sunPt && sunPt.el < hElev) {
        hasObstruction = true;
        const x = azToX(az);
        const yTop = elToY(hElev);
        points.push(`L ${x.toFixed(1)} ${yTop.toFixed(1)}`);
      }
    }
    if (hasObstruction && points.length > 2) {
      obstructionPathD = `M ${points[0].slice(2)} ${points.join(' ')} L ${points[points.length - 1].slice(2).split(' ')[0]} ${bottomY} L ${points[0].slice(2).split(' ')[0]} ${bottomY} Z`;
    }
  }

  // Solar Flux calculation
  const sunElRad = Math.max(0, currentSun.elevationDeg) * (Math.PI / 180.0);
  const liveVertFlux = Math.round(SOLAR_CONSTANT_W_M2 * Math.cos(sunElRad));
  const liveHorizFlux = Math.max(1, Math.round(SOLAR_CONSTANT_W_M2 * Math.sin(sunElRad)));

  // Radar Dome dimensions
  const DOME_SIZE = 200;
  const DOME_CX = DOME_SIZE / 2;
  const DOME_CY = DOME_SIZE / 2;
  const DOME_R = 76; // outer ring 0° elevation

  const domePolarToXY = (azDeg: number, elDeg: number) => {
    const r = DOME_R * Math.max(0, 1 - elDeg / 90.0);
    const rad = (azDeg * Math.PI) / 180.0;
    return {
      x: DOME_CX + r * Math.sin(rad),
      y: DOME_CY - r * Math.cos(rad),
    };
  };

  // Radar dome terrain silhouette polygon
  let domeTerrainPolygon = '';
  if (profile.length > 0) {
    const pts: string[] = [];
    for (let az = 0; az < 360; az += 4) {
      const hElev = getInterpolatedHorizonElevation(az, profile, mastHeightMeters);
      const { x, y } = domePolarToXY(az, hElev);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    domeTerrainPolygon = pts.join(' ');
  }

  const activeSiteSlope = sitesRegistry.find((s) => s.id === selectedSiteId)?.slopeDeg || 4.2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* 4 Corner Targeting Brackets */}
      <div className="corner-tr" />
      <div className="corner-bl" />

      {/* Panel Header */}
      <div className="bento-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span>360° TOPOGRAPHIC SKYLINE PANORAMA & POLAR RADAR SKY-DOME</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ color: 'var(--accent-solar-hi)', fontSize: '0.60rem' }}>
            SUN: Az {currentSun.azimuthDeg.toFixed(1)}° | El {currentSun.elevationDeg > 0 ? `+${currentSun.elevationDeg.toFixed(1)}°` : `${currentSun.elevationDeg.toFixed(1)}°`}
          </span>
          <span style={{ color: 'var(--accent-earth-hi)', fontSize: '0.60rem' }}>
            EARTH: Az {currentEarth.azimuthDeg.toFixed(1)}° | El +{currentEarth.elevationDeg.toFixed(1)}°
          </span>
        </div>
      </div>

      {/* Top Visualizer Row: 360° Skyline Panorama (68%) + Polar Radar Sky-Dome (32%) */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative', borderBottom: '1px solid var(--border-hairline)' }}>
        {/* Left 68%: 360° Topographic Skyline Panorama */}
        <div style={{ flex: '0 0 68%', position: 'relative', borderRight: '1px solid var(--border-hairline)', overflow: 'hidden' }}>
          <svg
            viewBox={`0 0 ${PANO_W} ${PANO_H}`}
            style={{ width: '100%', height: '100%', display: 'block', backgroundColor: '#090A0D' }}
          >
            <defs>
              {/* Basalt Mountain Silhouette Gradient */}
              <linearGradient id="basaltRidgeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1C2029" stopOpacity="0.95" />
                <stop offset="45%" stopColor="#12151D" stopOpacity="0.98" />
                <stop offset="100%" stopColor="#090A0D" stopOpacity="1" />
              </linearGradient>

              {/* Crimson Diagonal Obstruction Hatch Pattern */}
              <pattern id="crimsonHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#D9463E" strokeWidth="2" opacity="0.35" />
              </pattern>

              {/* Solar disk glow */}
              <radialGradient id="sunGlowPanorama" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFE082" stopOpacity="1" />
                <stop offset="40%" stopColor="#F7B955" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#E59A23" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Subtle Azimuthal Sky Grid */}
            {[-10, -5, 0, 5, 10, 15, 20, 25].map((el) => {
              const y = elToY(el);
              const isZero = el === 0;
              return (
                <g key={el}>
                  <line
                    x1={MARGIN_LEFT}
                    y1={y}
                    x2={PANO_W - 12}
                    y2={y}
                    stroke={isZero ? 'var(--border-active)' : 'rgba(38, 42, 52, 0.45)'}
                    strokeWidth={isZero ? 1.0 : 0.5}
                    strokeDasharray={isZero ? undefined : '2,4'}
                  />
                  <text
                    x={MARGIN_LEFT - 4}
                    y={y + 2.5}
                    fill={isZero ? 'var(--accent-solar)' : 'var(--text-muted)'}
                    fontSize="7"
                    textAnchor="end"
                    fontFamily="var(--font-mono)"
                  >
                    {el > 0 ? `+${el}°` : `${el}°`}
                  </text>
                </g>
              );
            })}

            {/* Azimuth Vertical Grid Lines */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360].map((az) => {
              const x = azToX(az);
              return (
                <g key={az}>
                  <line
                    x1={x}
                    y1={elToY(EL_MAX)}
                    x2={x}
                    y2={bottomY}
                    stroke="rgba(38, 42, 52, 0.45)"
                    strokeWidth="0.5"
                    strokeDasharray="2,4"
                  />
                  <text
                    x={x}
                    y={bottomY + 12}
                    fill="var(--text-muted)"
                    fontSize="6.5"
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                  >
                    {az}°
                  </text>
                </g>
              );
            })}

            {/* Red Hatched Obstruction Zones */}
            {obstructionPathD && (
              <path d={obstructionPathD} fill="url(#crimsonHatch)" stroke="#D9463E" strokeWidth="0.6" strokeDasharray="2,2" />
            )}

            {/* 24-hr Diurnal Sun Trajectory Wave */}
            {(() => {
              let sunD = '';
              sunTrajectory.forEach((p, idx) => {
                const x = azToX(p.az);
                const y = elToY(p.el);
                if (idx === 0) sunD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
                else sunD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
              });
              return (
                <path
                  d={sunD}
                  fill="none"
                  stroke="var(--accent-solar)"
                  strokeWidth="1.8"
                  opacity="0.9"
                />
              );
            })()}

            {/* Earth Libration Figure-8 Loop */}
            {(() => {
              let libD = '';
              earthLibrationLoop.forEach((p, idx) => {
                const x = azToX(p.az);
                const y = elToY(p.el);
                if (idx === 0) libD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
                else libD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
              });
              return (
                <path
                  d={libD}
                  fill="none"
                  stroke="var(--accent-earth)"
                  strokeWidth="1.5"
                  strokeDasharray="2,2"
                  opacity="0.8"
                />
              );
            })()}

            {/* LOLA Basalt Mountain Silhouette Fill */}
            {terrainPathD && (
              <path
                d={terrainPathD}
                fill="url(#basaltRidgeGrad)"
                stroke="#4A5264"
                strokeWidth="1.6"
              />
            )}

            {/* Obstacle Label */}
            <g transform={`translate(${azToX(45)}, ${bottomY - 14})`}>
              <text fill="#D9463E" fontSize="6" fontFamily="var(--font-mono)" fontWeight="bold">
                /// OBSTACLE /
              </text>
              <text y="7" fill="#D9463E" fontSize="6" fontFamily="var(--font-mono)" fontWeight="bold">
                TERRAIN SHADOW
              </text>
            </g>

            {/* Vertical Amber Crosshair at Sun Azimuth */}
            {(() => {
              const sunX = azToX(currentSun.azimuthDeg);
              const sunY = elToY(currentSun.elevationDeg);
              return (
                <g>
                  {/* Vertical Crosshair Line */}
                  <line
                    x1={sunX}
                    y1={elToY(EL_MAX)}
                    x2={sunX}
                    y2={bottomY}
                    stroke="var(--accent-solar)"
                    strokeWidth="1.5"
                  />

                  {/* Sun Disk Marker */}
                  <circle cx={sunX} cy={sunY} r="14" fill="url(#sunGlowPanorama)" />
                  <circle cx={sunX} cy={sunY} r="5" fill="var(--accent-solar-hi)" stroke="#090A0D" strokeWidth="1.2" />
                </g>
              );
            })()}

            {/* Earth Marker on Horizon */}
            {(() => {
              const earthX = azToX(currentEarth.azimuthDeg);
              const earthY = elToY(currentEarth.elevationDeg);
              return (
                <g transform={`translate(${earthX}, ${earthY})`}>
                  <circle cx="0" cy="0" r="10" fill="rgba(40, 158, 142, 0.4)" />
                  <circle cx="0" cy="0" r="4.5" fill="var(--accent-earth-hi)" stroke="#090A0D" strokeWidth="1" />
                </g>
              );
            })()}

            {/* Axis Label */}
            <text
              x={PANO_W / 2}
              y={PANO_H - 3}
              fill="var(--text-muted)"
              fontSize="6.5"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
            >
              AZIMUTH (°)
            </text>
          </svg>

          {/* Floating High-Contrast Live Flux Callout Box */}
          <div
            className="skyline-callout-box"
            style={{
              top: '12px',
              left: `${Math.min(PANO_W - 200, Math.max(MARGIN_LEFT + 20, azToX(currentSun.azimuthDeg) - 110))}px`,
            }}
          >
            <div className="skyline-callout-line1">
              LIVE FLUX: {liveVertFlux} W/m²
            </div>
            <div className="skyline-callout-line2">
              VERTICAL ARRAY <span style={{ color: 'var(--text-muted)' }}>vs</span> {liveHorizFlux} W/m² HORIZONTAL
            </div>
          </div>
        </div>

        {/* Right 32%: Polar Radar Sky-Dome */}
        <div style={{ flex: '0 0 32%', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', top: '4px', left: '8px', fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
            POLAR RADAR SKY-DOME
          </div>

          <svg viewBox={`0 0 ${DOME_SIZE} ${DOME_SIZE}`} style={{ width: '92%', height: '92%' }}>
            {/* Background radar circles */}
            <circle cx={DOME_CX} cy={DOME_CY} r={DOME_R} fill="#11141B" stroke="var(--border-hairline)" strokeWidth="1.2" />
            <circle cx={DOME_CX} cy={DOME_CY} r={DOME_R * (2/3)} fill="none" stroke="rgba(74, 82, 100, 0.3)" strokeWidth="0.6" strokeDasharray="2,3" />
            <circle cx={DOME_CX} cy={DOME_CY} r={DOME_R * (1/3)} fill="none" stroke="rgba(74, 82, 100, 0.3)" strokeWidth="0.6" strokeDasharray="2,3" />

            {/* Compass Axes */}
            <line x1={DOME_CX} y1={DOME_CY - DOME_R} x2={DOME_CX} y2={DOME_CY + DOME_R} stroke="rgba(74, 82, 100, 0.4)" strokeWidth="0.6" />
            <line x1={DOME_CX - DOME_R} y1={DOME_CY} x2={DOME_CX + DOME_R} y2={DOME_CY} stroke="rgba(74, 82, 100, 0.4)" strokeWidth="0.6" />

            {/* Cardinal Degrees text */}
            <text x={DOME_CX} y={DOME_CY - DOME_R - 3} fill="var(--text-muted)" fontSize="6" textAnchor="middle" fontFamily="var(--font-mono)">90°</text>
            <text x={DOME_CX + DOME_R + 5} y={DOME_CY + 2} fill="var(--text-muted)" fontSize="6" fontFamily="var(--font-mono)">0°</text>
            <text x={DOME_CX} y={DOME_CY + DOME_R + 8} fill="var(--text-muted)" fontSize="6" textAnchor="middle" fontFamily="var(--font-mono)">270°</text>
            <text x={DOME_CX - DOME_R - 10} y={DOME_CY + 2} fill="var(--text-muted)" fontSize="6" fontFamily="var(--font-mono)">180°</text>

            {/* Horizon Silhouette Polygon in Polar Coordinates */}
            {domeTerrainPolygon && (
              <polygon points={domeTerrainPolygon} fill="rgba(40, 158, 142, 0.15)" stroke="var(--accent-earth)" strokeWidth="1" />
            )}

            {/* Sun Overhead Position */}
            {(() => {
              const { x, y } = domePolarToXY(currentSun.azimuthDeg, currentSun.elevationDeg);
              return (
                <g transform={`translate(${x}, ${y})`}>
                  <circle cx="0" cy="0" r="5" fill="var(--accent-solar-hi)" />
                  <text x="7" y="2" fill="var(--accent-solar-hi)" fontSize="6" fontFamily="var(--font-mono)" fontWeight="bold">Sun</text>
                </g>
              );
            })()}

            {/* Earth Overhead Position */}
            {(() => {
              const { x, y } = domePolarToXY(currentEarth.azimuthDeg, currentEarth.elevationDeg);
              return (
                <g transform={`translate(${x}, ${y})`}>
                  <circle cx="0" cy="0" r="4" fill="var(--accent-earth-hi)" />
                  <text x="6" y="2" fill="var(--accent-earth-hi)" fontSize="6" fontFamily="var(--font-mono)" fontWeight="bold">Earth</text>
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* Bottom Area: Solar Mast Height Controller + 6-Card Telemetry Grid */}
      <div className="solar-mast-control-bar">
        <span style={{ fontSize: '0.66rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
          SOLAR MAST HEIGHT
        </span>

        {/* Mast Slider Bar */}
        <div className="mast-slider-container">
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>0m</span>
          <input
            type="range"
            min="0"
            max="15"
            step="0.5"
            value={mastHeightMeters}
            onChange={(e) => setMastHeightMeters(parseFloat(e.target.value))}
            className="range-tactical"
            style={{
              flex: 1,
              '--range-fill': `${(mastHeightMeters / 15) * 100}%`,
            } as React.CSSProperties}
          />
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>15m</span>
        </div>

        {/* Clearance Badge & Quick Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 'bold', color: 'var(--accent-solar-hi)' }}>
            {mastHeightMeters.toFixed(1)}m
          </span>
          <span
            style={{
              fontSize: '0.58rem',
              fontWeight: 'bold',
              color: currentSunClear ? 'var(--accent-earth-hi)' : 'var(--status-hazard)',
              backgroundColor: 'rgba(9, 10, 13, 0.75)',
              padding: '0.15rem 0.45rem',
              borderRadius: '2px',
              border: '1px solid var(--border-hairline)',
            }}
          >
            {currentSunClear ? 'ACTIVE — CLEARS RIM SHADOW' : 'OCCULTED BY CRATER RIM'}
          </span>
          <button
            className="btn-tactical-secondary"
            style={{ padding: '0.15rem 0.45rem', fontSize: '0.60rem' }}
            onClick={() => setMastHeightMeters(Math.max(0, mastHeightMeters - 1))}
          >
            -
          </button>
          <button
            className="btn-tactical-secondary"
            style={{ padding: '0.15rem 0.45rem', fontSize: '0.60rem' }}
            onClick={() => setMastHeightMeters(Math.min(15, mastHeightMeters + 1))}
          >
            +
          </button>
        </div>
      </div>

      {/* 6-Card High-Density Telemetry Grid */}
      <div className="telemetry-grid-6">
        <div className="telemetry-cell">
          <span className="telemetry-cell-label">Solar Array Flux</span>
          <span className="telemetry-cell-value" style={{ color: 'var(--accent-solar-hi)' }}>
            {liveVertFlux} W/m²
          </span>
        </div>

        <div className="telemetry-cell">
          <span className="telemetry-cell-label">DTE Comm Link</span>
          <span className="telemetry-cell-value" style={{ color: currentDteActive ? 'var(--accent-earth-hi)' : 'var(--status-hazard)' }}>
            {currentDteActive ? `LOCKED (${powerAndLink.dteLinkMarginDb.toFixed(1)} dB)` : 'BLOCKED'}
          </span>
        </div>

        <div className="telemetry-cell">
          <span className="telemetry-cell-label">Local Terrain Slope</span>
          <span className="telemetry-cell-value">
            {activeSiteSlope.toFixed(1)}° {activeSiteSlope < 8 ? '(SAFE)' : '(HAZARD)'}
          </span>
        </div>

        <div className="telemetry-cell">
          <span className="telemetry-cell-label">Sun Elevation</span>
          <span className="telemetry-cell-value" style={{ color: currentSun.elevationDeg > 0 ? 'var(--accent-solar-hi)' : 'var(--status-hazard)' }}>
            {currentSun.elevationDeg > 0 ? `+${currentSun.elevationDeg.toFixed(2)}°` : `${currentSun.elevationDeg.toFixed(2)}°`}
          </span>
        </div>

        <div className="telemetry-cell">
          <span className="telemetry-cell-label">Earth Elevation</span>
          <span className="telemetry-cell-value" style={{ color: 'var(--accent-earth-hi)' }}>
            +{currentEarth.elevationDeg.toFixed(2)}°
          </span>
        </div>

        <div className="telemetry-cell">
          <span className="telemetry-cell-label">Horizon Obstruction</span>
          <span className="telemetry-cell-value" style={{ color: currentSunClear ? 'var(--accent-earth-hi)' : 'var(--status-hazard)' }}>
            {currentSunClear ? '0.0% (CLEAR)' : '100% (SHADOW)'}
          </span>
        </div>
      </div>
    </div>
  );
};