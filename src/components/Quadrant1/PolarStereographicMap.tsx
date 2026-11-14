import React, { useState } from 'react';
import { useMissionStore, SiteRegistryItem } from '../../store/missionStore';
import { polarStereographicProject, R_MOON_KM } from '../../engine/lunarEphemeris';

export const PolarStereographicMap: React.FC = () => {
  const sitesRegistry = useMissionStore((s) => s.sitesRegistry);
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const setSelectedSiteId = useMissionStore((s) => s.setSelectedSiteId);
  const customCoordinate = useMissionStore((s) => s.customCoordinate);
  const setCustomCoordinate = useMissionStore((s) => s.setCustomCoordinate);
  const currentSun = useMissionStore((s) => s.currentSun);
  const currentEarth = useMissionStore((s) => s.currentEarth);

  const [hoveredSite, setHoveredSite] = useState<SiteRegistryItem | null>(null);
  const [mapMode, setMapMode] = useState<'2d' | 'synthetic-dem'>('2d');

  // Map scale and center
  // At latitude -80 deg, phi = -80, (90 + phi)/2 = 5 deg.
  // rho_max = 2 * 1737.4 * tan(5 deg) ≈ 3474.8 * 0.087488 ≈ 304 km
  const RHO_MAX_KM = 2 * R_MOON_KM * Math.tan((10.0 * Math.PI) / 360.0);
  const VIEWBOX_SIZE = 640;
  const CENTER = VIEWBOX_SIZE / 2;
  const SCALE = (CENTER - 30) / RHO_MAX_KM;

  const projectToSvg = (lat: number, lon: number) => {
    const { x, y } = polarStereographicProject(lat, lon);
    // In SVG: X is right, Y is up (so svgY = CENTER - y * SCALE)
    return {
      svgX: CENTER + x * SCALE,
      svgY: CENTER - y * SCALE,
    };
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scaleX = VIEWBOX_SIZE / rect.width;
    const scaleY = VIEWBOX_SIZE / rect.height;

    const svgX = clickX * scaleX;
    const svgY = clickY * scaleY;

    // Invert polar stereographic projection
    const xKm = (svgX - CENTER) / SCALE;
    const yKm = (CENTER - svgY) / SCALE;
    const rhoKm = Math.sqrt(xKm * xKm + yKm * yKm);

    if (rhoKm > RHO_MAX_KM * 1.05) return; // outside 80°S

    const lambdaRad = Math.atan2(xKm, yKm);
    let lonDeg = (lambdaRad * 180.0) / Math.PI;
    if (lonDeg > 180) lonDeg -= 360;

    const halfAngleRad = Math.atan(rhoKm / (2 * R_MOON_KM));
    const latDeg = (halfAngleRad * 2 * 180.0) / Math.PI - 90.0;

    setCustomCoordinate({
      latDeg: Math.round(latDeg * 100) / 100,
      lonDeg: Math.round(lonDeg * 100) / 100,
      elevationKm: 0.5,
    });
  };

  // Concentric latitude rings: 80°S, 82°S, 84°S, 86°S, 88°S
  const latRings = [-80, -82, -84, -86, -88];

  const selectedSite = customCoordinate
    ? {
        id: 'custom-pin',
        name: `Custom [${customCoordinate.latDeg.toFixed(2)}°, ${customCoordinate.lonDeg.toFixed(2)}°]`,
        program: 'User Custom Vector',
        elevationKm: customCoordinate.elevationKm,
        slopeDeg: 5.0,
        profile: 'Custom user-dropped coordinate at Lunar South Pole',
        targetHighlight: 'Calculated in real-time via airless ephemeris engine',
      }
    : sitesRegistry.find((s) => s.id === selectedSiteId) || sitesRegistry[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Subheader controls */}
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
          <span className="badge-precomputed">LOLA 80M POLAR STEREOGRAPHIC</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            80°S – 90°S VIEWPORT
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className={`btn-tactical-secondary ${mapMode === '2d' ? 'active' : ''}`}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem' }}
            onClick={() => setMapMode('2d')}
          >
            2D RADAR
          </button>
          <button
            className={`btn-tactical-secondary ${mapMode === 'synthetic-dem' ? 'active' : ''}`}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem' }}
            onClick={() => setMapMode('synthetic-dem')}
          >
            SLOPE HEATMAP
          </button>
        </div>
      </div>

      {/* Main Map Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <svg
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          style={{ width: '100%', height: '100%', maxHeight: '420px', cursor: 'crosshair', userSelect: 'none' }}
          onClick={handleSvgClick}
        >
          <defs>
            {/* Radar glow gradient */}
            <radialGradient id="polarRadarGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#141D30" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#0E131E" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#090A0D" stopOpacity="1" />
            </radialGradient>
            {/* Crater pattern */}
            <pattern id="craterGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#262A34" strokeWidth="0.5" strokeDasharray="2,4" />
            </pattern>
          </defs>

          {/* Background circular plate */}
          <circle cx={CENTER} cy={CENTER} r={CENTER - 25} fill="url(#polarRadarGlow)" stroke="var(--border-hairline)" strokeWidth="1.5" />
          <circle cx={CENTER} cy={CENTER} r={CENTER - 25} fill="url(#craterGrid)" opacity="0.6" />

          {/* Concentric latitude rings */}
          {latRings.map((lat) => {
            const { x } = polarStereographicProject(lat, 90);
            const radius = x * SCALE;
            return (
              <g key={lat}>
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={radius}
                  fill="none"
                  stroke="#262A34"
                  strokeWidth="0.8"
                  strokeDasharray="4,4"
                />
                <text
                  x={CENTER + 4}
                  y={CENTER - radius + 11}
                  fill="var(--text-muted)"
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                >
                  {Math.abs(lat)}°S
                </text>
              </g>
            );
          })}

          {/* Longitude radials */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((lon) => {
            const angleRad = (lon * Math.PI) / 180;
            const rMax = CENTER - 25;
            const x2 = CENTER + rMax * Math.sin(angleRad);
            const y2 = CENTER - rMax * Math.cos(angleRad);
            return (
              <g key={lon}>
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={x2}
                  y2={y2}
                  stroke="#1F232D"
                  strokeWidth="0.8"
                />
                <text
                  x={x2 + (Math.sin(angleRad) * 14)}
                  y={y2 - (Math.cos(angleRad) * 10) + 4}
                  fill="var(--text-muted)"
                  fontSize="7"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                >
                  {lon}°
                </text>
              </g>
            );
          })}

          {/* Permanently Shadowed Regions (PSR) schematic overlays */}
          <g className="psr-layer" opacity={mapMode === 'synthetic-dem' ? '0.4' : '0.85'}>
            {/* Shackleton Interior PSR */}
            <circle
              cx={projectToSvg(-89.54, 137.0).svgX}
              cy={projectToSvg(-89.54, 137.0).svgY}
              r="14"
              className="psr-fill"
            />
            {/* Faustini PSR */}
            <ellipse
              cx={projectToSvg(-87.3, 77.0).svgX}
              cy={projectToSvg(-87.3, 77.0).svgY}
              rx="18"
              ry="12"
              className="psr-fill"
            />
            {/* Haworth PSR */}
            <circle
              cx={projectToSvg(-87.45, -5.0).svgX}
              cy={projectToSvg(-87.45, -5.0).svgY}
              r="16"
              className="psr-fill"
            />
            {/* Cabeus PSR */}
            <circle
              cx={projectToSvg(-84.9, -35.5).svgX}
              cy={projectToSvg(-84.9, -35.5).svgY}
              r="22"
              className="psr-fill"
            />
          </g>

          {/* South Pole crosshair marker */}
          <line x1={CENTER - 8} y1={CENTER} x2={CENTER + 8} y2={CENTER} stroke="var(--accent-solar)" strokeWidth="1" />
          <line x1={CENTER} y1={CENTER - 8} x2={CENTER} y2={CENTER + 8} stroke="var(--accent-solar)" strokeWidth="1" />
          <circle cx={CENTER} cy={CENTER} r="1.5" fill="var(--accent-solar)" />

          {/* Solar incident illumination vector arrow */}
          {(() => {
            const azRad = (currentSun.azimuthDeg * Math.PI) / 180;
            const arrowLen = 45;
            const startX = CENTER - Math.sin(azRad) * (CENTER - 35);
            const startY = CENTER + Math.cos(azRad) * (CENTER - 35);
            const endX = startX + Math.sin(azRad) * arrowLen;
            const endY = startY - Math.cos(azRad) * arrowLen;
            return (
              <g opacity="0.85">
                <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="var(--accent-solar-hi)" strokeWidth="2" strokeDasharray="3,2" />
                <circle cx={startX} cy={startY} r="3" fill="var(--accent-solar-hi)" />
                <text x={startX} y={startY - 6} fill="var(--accent-solar-hi)" fontSize="8" fontFamily="var(--font-mono)" textAnchor="middle">
                  SUN ☀️
                </text>
              </g>
            );
          })()}

          {/* Curated Landing Site Markers */}
          {sitesRegistry.map((site) => {
            const { svgX, svgY } = projectToSvg(site.lat, site.lon);
            const isSelected = selectedSiteId === site.id && !customCoordinate;
            const isArtemis = site.category === 'artemis-polar';

            return (
              <g
                key={site.id}
                transform={`translate(${svgX}, ${svgY})`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSiteId(site.id);
                }}
                onMouseEnter={() => setHoveredSite(site)}
                onMouseLeave={() => setHoveredSite(null)}
              >
                {/* Active pulse ring */}
                {isSelected && (
                  <circle
                    cx="0"
                    cy="0"
                    r="9"
                    fill="none"
                    stroke="var(--accent-solar-hi)"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                    opacity="0.8"
                  />
                )}
                {/* Site diamond pin */}
                <polygon
                  points="0,-5 5,0 0,5 -5,0"
                  fill={isSelected ? 'var(--accent-solar-hi)' : isArtemis ? 'var(--accent-solar)' : 'var(--accent-earth)'}
                  stroke="#090A0D"
                  strokeWidth="1"
                />
                <circle cx="0" cy="0" r="1.5" fill="#090A0D" />

                {/* Site short label */}
                <text
                  x="7"
                  y="3"
                  fill={isSelected ? 'var(--accent-solar-hi)' : 'var(--text-secondary)'}
                  fontSize="7"
                  fontFamily="var(--font-mono)"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                >
                  {site.name.split(' ')[0]}
                </text>
              </g>
            );
          })}

          {/* Custom Coordinate Pin */}
          {customCoordinate && (
            <g
              transform={`translate(${projectToSvg(customCoordinate.latDeg, customCoordinate.lonDeg).svgX}, ${projectToSvg(customCoordinate.latDeg, customCoordinate.lonDeg).svgY})`}
            >
              <circle cx="0" cy="0" r="8" fill="none" stroke="var(--status-hazard)" strokeWidth="1.5" />
              <polygon points="0,-6 6,0 0,6 -6,0" fill="var(--status-hazard)" />
              <text x="9" y="3" fill="var(--status-hazard)" fontSize="8" fontFamily="var(--font-mono)" fontWeight="bold">
                CUSTOM PIN
              </text>
            </g>
          )}
        </svg>

        {/* Hover / Tooltip HUD */}
        {(hoveredSite || selectedSite) && (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              backgroundColor: 'rgba(17, 19, 24, 0.92)',
              border: '1px solid var(--border-hairline)',
              borderLeft: '3px solid var(--accent-solar)',
              padding: '0.45rem 0.75rem',
              borderRadius: '2px',
              pointerEvents: 'none',
              maxWidth: '280px',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600 }}>
              {(hoveredSite || selectedSite)?.name}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', marginTop: '2px' }}>
              Lat: {(hoveredSite || selectedSite)?.lat?.toFixed(2)}° | Lon: {(hoveredSite || selectedSite)?.lon?.toFixed(2)}°
            </div>
            <div style={{ color: 'var(--accent-earth-hi)', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', marginTop: '2px' }}>
              Slope: {(hoveredSite || selectedSite)?.slopeDeg}° | Elev: {(hoveredSite || selectedSite)?.elevationKm} km
            </div>
          </div>
        )}
      </div>

      {/* Quick Select Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '0.3rem',
          padding: '0.4rem 0.6rem',
          overflowX: 'auto',
          backgroundColor: 'var(--bg-surface-1)',
          borderTop: '1px solid var(--border-hairline)',
        }}
      >
        {sitesRegistry.slice(0, 6).map((site) => (
          <button
            key={site.id}
            className={`btn-tactical-secondary ${selectedSiteId === site.id && !customCoordinate ? 'active' : ''}`}
            style={{
              padding: '0.2rem 0.45rem',
              fontSize: '0.60rem',
              whiteSpace: 'nowrap',
              borderLeftColor: selectedSiteId === site.id ? 'var(--accent-solar)' : undefined,
            }}
            onClick={() => setSelectedSiteId(site.id)}
          >
            {site.name}
          </button>
        ))}
      </div>
    </div>
  );
};
