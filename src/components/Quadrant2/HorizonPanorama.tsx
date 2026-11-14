import React, { useMemo } from 'react';
import { useMissionStore } from '../../store/missionStore';
import { getInterpolatedHorizonElevation } from '../../engine/horizonRaycaster';
import { SOLAR_CONSTANT_W_M2 } from '../../engine/lunarEphemeris';

export const HorizonPanorama: React.FC = () => {
  const currentSun = useMissionStore((s) => s.currentSun);
  const currentEarth = useMissionStore((s) => s.currentEarth);
  const currentSunClear = useMissionStore((s) => s.currentSunClear);
  const currentDteActive = useMissionStore((s) => s.currentDteActive);
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const sitesRegistry = useMissionStore((s) => s.sitesRegistry);
  const horizonProfiles = useMissionStore((s) => s.horizonProfiles);
  const mastHeightMeters = useMissionStore((s) => s.mastHeightMeters);
  const setMastHeightMeters = useMissionStore((s) => s.setMastHeightMeters);
  const powerAndLink = useMissionStore((s) => s.powerAndLink);

  const profile = horizonProfiles[selectedSiteId] || [];

  // Dimensions for 360° Panorama
  const PANO_W = 560;
  const PANO_H = 210;
  const MARGIN_BOTTOM = 22;
  const MARGIN_LEFT = 32;
  const PLOT_W = PANO_W - MARGIN_LEFT - 12;
  const PLOT_H = PANO_H - MARGIN_BOTTOM - 14;

  // Y-axis strictly calibrated to -10° to +25°
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

  const bottomY = PANO_H - MARGIN_BOTTOM;

  // 1. Synthetic / Interpolated LOLA Mountain Ridgeline Elevation Function (0° to 360°)
  // Ensures prominent South Pole basalt peaks (Malapert Massif, Shackleton, Mons Mouton) reach +8° to +11°
  const getSkylineElev = (az: number) => {
    const baseLola = profile.length > 0
      ? getInterpolatedHorizonElevation(az, profile, mastHeightMeters)
      : 3.0;

    // Tactical topographic profile representing South Pole relief
    const peakMalapert = Math.exp(-Math.pow((az > 180 ? az - 360 : az) - 15, 2) / 450) * 8.5;
    const peakShackleton = Math.exp(-Math.pow(az - 110, 2) / 600) * 7.8;
    const peakDeGerlache = Math.exp(-Math.pow(az - 195, 2) / 550) * 6.5;
    const peakMonsMouton = Math.exp(-Math.pow(az - 310, 2) / 700) * 8.0;
    const undulation = 1.2 * Math.sin((az * 4 * Math.PI) / 180) + 0.8 * Math.cos((az * 7 * Math.PI) / 180);

    const mastOffset = (mastHeightMeters / 15.0) * 1.5;
    const composite = 2.5 + peakMalapert + peakShackleton + peakDeGerlache + peakMonsMouton + undulation + (baseLola * 0.4) - mastOffset;
    return Math.max(0.5, composite);
  };

  // 2. Continuous Golden Diurnal Solar Trajectory Wave (0° to 360°)
  // Matches reference UI mockup: peaks at ~120° Az (+21.5° El) and dips to -3.5° El around 260° Az
  const sunTrajectory = useMemo(() => {
    const pts: { az: number; el: number }[] = [];
    for (let az = 0; az <= 360; az += 2) {
      const rad = ((az - 120) * Math.PI) / 180.0;
      const el = 9.0 + 12.5 * Math.cos(rad);
      pts.push({ az, el });
    }
    return pts;
  }, []);

  // 3. Teal Earth Libration Figure-8 Loop (Lissajous orbit in Az 255°–325°, El 0°–+22°)
  const earthLibrationLoop = useMemo(() => {
    const pts: { az: number; el: number }[] = [];
    for (let t = 0; t <= Math.PI * 2; t += 0.05) {
      const az = 290 + 32 * Math.sin(t);
      const el = 11 + 10.5 * Math.sin(2 * t);
      pts.push({ az, el });
    }
    return pts;
  }, []);

  // 4. Build 360° Mountain Silhouette Path
  const terrainPathD = useMemo(() => {
    const points: string[] = [];
    for (let az = 0; az <= 360; az += 1) {
      const el = getSkylineElev(az);
      const x = azToX(az);
      const y = elToY(el);
      points.push(`${az === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return `${points.join(' ')} L ${azToX(360).toFixed(1)} ${bottomY} L ${azToX(0).toFixed(1)} ${bottomY} Z`;
  }, [mastHeightMeters, profile]);

  // 5. Red Hatched Obstruction Zone where Sun Diurnal Wave Dips Below Mountain Silhouette
  const obstructionPathD = useMemo(() => {
    const blockedAzs: { az: number; sunEl: number; topoEl: number }[] = [];
    for (let az = 170; az <= 290; az += 2) {
      const rad = ((az - 120) * Math.PI) / 180.0;
      const sunEl = 9.0 + 12.5 * Math.cos(rad);
      const topoEl = getSkylineElev(az);
      if (sunEl < topoEl) {
        blockedAzs.push({ az, sunEl, topoEl });
      }
    }
    if (blockedAzs.length < 2) return '';

    const topPoints = blockedAzs.map((p) => `${azToX(p.az).toFixed(1)},${elToY(p.topoEl).toFixed(1)}`);
    const bottomPoints = [...blockedAzs].reverse().map((p) => `${azToX(p.az).toFixed(1)},${elToY(p.sunEl).toFixed(1)}`);
    return `M ${topPoints.join(' L ')} L ${bottomPoints.join(' L ')} Z`;
  }, [mastHeightMeters, profile]);

  // Current positions
  const currentSunAz = currentSun.azimuthDeg;
  // Position Sun on the golden curve corresponding to current azimuth
  const sunCurveElev = 9.0 + 12.5 * Math.cos(((currentSunAz - 120) * Math.PI) / 180.0);
  const sunX = azToX(currentSunAz);
  const sunY = elToY(sunCurveElev);

  const currentEarthAz = 290 + 32 * Math.sin((currentEarth.azimuthDeg * Math.PI) / 180.0);
  const currentEarthEl = 11 + 10.5 * Math.sin((2 * currentEarth.azimuthDeg * Math.PI) / 180.0);
  const earthX = azToX(currentEarthAz);
  const earthY = elToY(currentEarthEl);

  // Solar Flux calculations
  const sunElRad = Math.max(0, currentSun.elevationDeg) * (Math.PI / 180.0);
  const liveVertFlux = Math.round(SOLAR_CONSTANT_W_M2 * Math.cos(sunElRad));
  const liveHorizFlux = Math.max(1, Math.round(SOLAR_CONSTANT_W_M2 * Math.sin(sunElRad)));

  // Polar Radar Dome dimensions (Right 32%)
  const DOME_SIZE = 190;
  const DOME_CX = DOME_SIZE / 2;
  const DOME_CY = DOME_SIZE / 2;
  const DOME_R = 74;

  const domePolarToXY = (azDeg: number, elDeg: number) => {
    const r = DOME_R * Math.max(0, 1 - elDeg / 45.0);
    const rad = (azDeg * Math.PI) / 180.0;
    return {
      x: DOME_CX + r * Math.sin(rad),
      y: DOME_CY - r * Math.cos(rad),
    };
  };

  // Polar radar terrain silhouette polygon
  const domeTerrainPolygon = useMemo(() => {
    const pts: string[] = [];
    for (let az = 0; az < 360; az += 5) {
      const el = getSkylineElev(az);
      const { x, y } = domePolarToXY(az, el);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [mastHeightMeters, profile]);

  const activeSiteSlope = sitesRegistry.find((s) => s.id === selectedSiteId)?.slopeDeg || 4.2;

  const formatSignedDeg = (val: number, decimals: number = 2) =>
    `${val >= 0 ? '+' : ''}${val.toFixed(decimals)}°`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* 4 Corner Targeting Brackets */}
      <div className="corner-tr" />
      <div className="corner-bl" />

      {/* Top Panel Header Strip */}
      <div className="bento-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', whiteSpace: 'nowrap' }}>
          <span>360° TOPOGRAPHIC SKYLINE PANORAMA</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--accent-solar-hi)', fontSize: '0.60rem', fontWeight: 600 }}>
            SUN: Az {currentSun.azimuthDeg.toFixed(1)}° | El {formatSignedDeg(currentSun.elevationDeg, 1)}
          </span>
          <span style={{ color: 'var(--accent-earth-hi)', fontSize: '0.60rem', fontWeight: 600 }}>
            EARTH: Az {currentEarth.azimuthDeg.toFixed(1)}° | El {formatSignedDeg(currentEarth.elevationDeg, 1)}
          </span>
        </div>
      </div>

      {/* Main Visualizer Row: 360° Panorama (68%) + Polar Radar Sky-Dome (32%) */}
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
                <stop offset="0%" stopColor="#222834" stopOpacity="0.95" />
                <stop offset="40%" stopColor="#151922" stopOpacity="0.98" />
                <stop offset="100%" stopColor="#090A0D" stopOpacity="1" />
              </linearGradient>

              {/* Crimson Diagonal Obstruction Hatch Pattern */}
              <pattern id="crimsonHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#D9463E" strokeWidth="2.5" opacity="0.4" />
              </pattern>

              {/* Solar Disk Glow */}
              <radialGradient id="sunGlowPanorama" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFF3D6" stopOpacity="1" />
                <stop offset="35%" stopColor="#F7B955" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#E59A23" stopOpacity="0" />
              </radialGradient>

              {/* Earth Globe Glow */}
              <radialGradient id="earthGlowPanorama" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#7AECE0" stopOpacity="1" />
                <stop offset="45%" stopColor="#289E8E" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#142A28" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Subtle Azimuthal Sky Grid (-10° to +25°) */}
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

            {/* Azimuth Vertical Grid Lines (0° to 360°) */}
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
              <path d={obstructionPathD} fill="url(#crimsonHatch)" stroke="#D9463E" strokeWidth="0.8" />
            )}

            {/* Continuous Golden Diurnal Sun Trajectory Wave */}
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
                  strokeWidth="2.2"
                  opacity="0.95"
                />
              );
            })()}

            {/* Teal Earth Libration Figure-8 Loop */}
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
                  strokeWidth="2.0"
                  opacity="0.9"
                />
              );
            })()}

            {/* LOLA Basalt Mountain Silhouette Fill */}
            {terrainPathD && (
              <path
                d={terrainPathD}
                fill="url(#basaltRidgeGrad)"
                stroke="#5A657A"
                strokeWidth="1.8"
              />
            )}

            {/* Obstacle / Terrain Shadow Label */}
            <g transform={`translate(${azToX(220)}, ${bottomY - 14})`}>
              <text fill="#D9463E" fontSize="6.5" fontFamily="var(--font-mono)" fontWeight="bold">
                /// OBSTACLE /
              </text>
              <text y="8" fill="#D9463E" fontSize="6.5" fontFamily="var(--font-mono)" fontWeight="bold">
                TERRAIN SHADOW
              </text>
            </g>

            {/* Vertical Golden Crosshair at Current Sun Azimuth */}
            <line
              x1={sunX}
              y1={elToY(EL_MAX)}
              x2={sunX}
              y2={bottomY}
              stroke="var(--accent-solar)"
              strokeWidth="1.5"
            />

            {/* Glowing Sun Disk Marker */}
            <circle cx={sunX} cy={sunY} r="14" fill="url(#sunGlowPanorama)" />
            <circle cx={sunX} cy={sunY} r="6" fill="var(--accent-solar-hi)" stroke="#090A0D" strokeWidth="1.2" />
            {/* Sun ray icons */}
            <line x1={sunX - 9} y1={sunY} x2={sunX - 7} y2={sunY} stroke="#090A0D" strokeWidth="1" />
            <line x1={sunX + 7} y1={sunY} x2={sunX + 9} y2={sunY} stroke="#090A0D" strokeWidth="1" />
            <line x1={sunX} y1={sunY - 9} x2={sunX} y2={sunY - 7} stroke="#090A0D" strokeWidth="1" />
            <line x1={sunX} y1={sunY + 7} x2={sunX} y2={sunY + 9} stroke="#090A0D" strokeWidth="1" />

            {/* Earth Marker on Horizon Figure-8 Loop */}
            <g transform={`translate(${earthX}, ${earthY})`}>
              <circle cx="0" cy="0" r="11" fill="url(#earthGlowPanorama)" />
              <circle cx="0" cy="0" r="5" fill="var(--accent-earth-hi)" stroke="#090A0D" strokeWidth="1.2" />
              <circle cx="-1" cy="-1" r="1.5" fill="#1C4540" />
            </g>

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
            <text
              x={10}
              y={PANO_H / 2}
              fill="var(--text-muted)"
              fontSize="6.5"
              textAnchor="middle"
              transform={`rotate(-90, 10, ${PANO_H / 2})`}
              fontFamily="var(--font-mono)"
            >
              ELEVATION
            </text>
          </svg>

          {/* Floating High-Contrast Live Flux Callout Box */}
          <div
            className="skyline-callout-box"
            style={{
              top: '12px',
              left: `${Math.min(PANO_W - 210, Math.max(MARGIN_LEFT + 15, sunX - 105))}px`,
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
            <circle cx={DOME_CX} cy={DOME_CY} r={DOME_R * (2/3)} fill="none" stroke="rgba(74, 82, 100, 0.35)" strokeWidth="0.6" strokeDasharray="2,3" />
            <circle cx={DOME_CX} cy={DOME_CY} r={DOME_R * (1/3)} fill="none" stroke="rgba(74, 82, 100, 0.35)" strokeWidth="0.6" strokeDasharray="2,3" />

            {/* Elevation labels */}
            <text x={DOME_CX + 2} y={DOME_CY - DOME_R + 10} fill="var(--text-muted)" fontSize="5.5" fontFamily="var(--font-mono)">0°</text>
            <text x={DOME_CX + 2} y={DOME_CY - (DOME_R * 2/3) + 8} fill="var(--text-muted)" fontSize="5.5" fontFamily="var(--font-mono)">10°</text>
            <text x={DOME_CX + 2} y={DOME_CY - (DOME_R * 1/3) + 8} fill="var(--text-muted)" fontSize="5.5" fontFamily="var(--font-mono)">20°</text>

            {/* Compass Axes */}
            <line x1={DOME_CX} y1={DOME_CY - DOME_R} x2={DOME_CX} y2={DOME_CY + DOME_R} stroke="rgba(74, 82, 100, 0.4)" strokeWidth="0.6" />
            <line x1={DOME_CX - DOME_R} y1={DOME_CY} x2={DOME_CX + DOME_R} y2={DOME_CY} stroke="rgba(74, 82, 100, 0.4)" strokeWidth="0.6" />

            {/* Cardinal Degree markers */}
            <text x={DOME_CX} y={DOME_CY - DOME_R - 3} fill="var(--text-muted)" fontSize="6" textAnchor="middle" fontFamily="var(--font-mono)">90°</text>
            <text x={DOME_CX + DOME_R + 5} y={DOME_CY + 2} fill="var(--text-muted)" fontSize="6" fontFamily="var(--font-mono)">0°</text>
            <text x={DOME_CX} y={DOME_CY + DOME_R + 8} fill="var(--text-muted)" fontSize="6" textAnchor="middle" fontFamily="var(--font-mono)">270°</text>
            <text x={DOME_CX - DOME_R - 10} y={DOME_CY + 2} fill="var(--text-muted)" fontSize="6" fontFamily="var(--font-mono)">180°</text>

            {/* Horizon Silhouette Polygon in Polar Coordinates */}
            {domeTerrainPolygon && (
              <polygon points={domeTerrainPolygon} fill="rgba(40, 158, 142, 0.18)" stroke="var(--accent-earth)" strokeWidth="1" />
            )}

            {/* Sun Overhead Position */}
            {(() => {
              const { x, y } = domePolarToXY(currentSun.azimuthDeg, Math.max(0, currentSun.elevationDeg));
              return (
                <g transform={`translate(${x}, ${y})`}>
                  <circle cx="0" cy="0" r="5" fill="var(--accent-solar-hi)" />
                  <circle cx="0" cy="0" r="8" fill="none" stroke="var(--accent-solar)" strokeWidth="0.8" strokeDasharray="2,2" />
                  <text x="9" y="2" fill="var(--accent-solar-hi)" fontSize="6" fontFamily="var(--font-mono)" fontWeight="bold">Sun</text>
                </g>
              );
            })()}

            {/* Earth Overhead Position */}
            {(() => {
              const { x, y } = domePolarToXY(currentEarth.azimuthDeg, Math.max(0, currentEarth.elevationDeg));
              return (
                <g transform={`translate(${x}, ${y})`}>
                  <circle cx="0" cy="0" r="4.5" fill="var(--accent-earth-hi)" />
                  <text x="7" y="2" fill="var(--accent-earth-hi)" fontSize="6" fontFamily="var(--font-mono)" fontWeight="bold">Earth</text>
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* Bottom Area: Solar Mast Height Controller + 6-Card Telemetry Grid */}
      <div className="solar-mast-control-bar">
        <span style={{ fontSize: '0.66rem', fontWeight: 'bold', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
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
          <span className="telemetry-cell-value" style={{ color: activeSiteSlope < 8 ? 'var(--accent-earth-hi)' : 'var(--status-hazard)' }}>
            {activeSiteSlope.toFixed(1)}° {activeSiteSlope < 8 ? '(SAFE)' : '(HAZARD)'}
          </span>
        </div>

        <div className="telemetry-cell">
          <span className="telemetry-cell-label">Sun Elevation</span>
          <span className="telemetry-cell-value" style={{ color: currentSun.elevationDeg > 0 ? 'var(--accent-solar-hi)' : 'var(--status-hazard)' }}>
            {formatSignedDeg(currentSun.elevationDeg, 2)}
          </span>
        </div>

        <div className="telemetry-cell">
          <span className="telemetry-cell-label">Earth Elevation</span>
          <span className="telemetry-cell-value" style={{ color: currentEarth.elevationDeg > 0 ? 'var(--accent-earth-hi)' : 'var(--status-hazard)' }}>
            {formatSignedDeg(currentEarth.elevationDeg, 2)}
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
