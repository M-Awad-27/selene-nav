import React, { useState, useEffect, useRef } from 'react';
import { useMissionStore } from '../../store/missionStore';
import { polarStereographicProject, R_MOON_KM } from '../../engine/lunarEphemeris';
import { ThreeDLocalTerrain } from './ThreeDLocalTerrain';

// Curated South Pole Craters for Procedural Hillshaded Relief
const SOUTH_POLE_CRATERS = [
  { name: 'Shackleton', lat: -89.54, lon: 137.0, radiusKm: 21.0, depthKm: 4.2, hasPsr: true },
  { name: 'Shoemaker', lat: -88.10, lon: 45.0, radiusKm: 50.0, depthKm: 3.5, hasPsr: true },
  { name: 'Faustini', lat: -87.30, lon: 77.0, radiusKm: 39.0, depthKm: 3.1, hasPsr: true },
  { name: 'Haworth', lat: -87.45, lon: -5.0, radiusKm: 35.0, depthKm: 3.8, hasPsr: true },
  { name: 'de Gerlache', lat: -88.50, lon: -88.0, radiusKm: 32.0, depthKm: 2.9, hasPsr: true },
  { name: 'Cabeus', lat: -84.90, lon: -35.5, radiusKm: 100.0, depthKm: 4.0, hasPsr: true },
  { name: 'Nobile', lat: -85.20, lon: 53.0, radiusKm: 73.0, depthKm: 3.2, hasPsr: true },
  { name: 'Amundsen', lat: -84.50, lon: 83.0, radiusKm: 105.0, depthKm: 4.8, hasPsr: true },
  { name: 'Slater', lat: -88.10, lon: 110.0, radiusKm: 25.0, depthKm: 2.5, hasPsr: true },
  { name: 'Wiechert', lat: -84.30, lon: 165.0, radiusKm: 41.0, depthKm: 2.8, hasPsr: false },
  { name: 'Idel\'son', lat: -81.20, lon: 110.0, radiusKm: 60.0, depthKm: 3.0, hasPsr: false },
];

export const PolarStereographicMap: React.FC = () => {
  const sitesRegistry = useMissionStore((s) => s.sitesRegistry);
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const setSelectedSiteId = useMissionStore((s) => s.setSelectedSiteId);
  const customCoordinate = useMissionStore((s) => s.customCoordinate);
  const setCustomCoordinate = useMissionStore((s) => s.setCustomCoordinate);
  const currentSun = useMissionStore((s) => s.currentSun);
  const currentDteActive = useMissionStore((s) => s.currentDteActive);
  const horizonProfiles = useMissionStore((s) => s.horizonProfiles);

  const [isCoordInputOpen, setIsCoordInputOpen] = useState(false);
  const [insetHazardMode, setInsetHazardMode] = useState<'realistic' | 'slope-hazard'>('slope-hazard');
  const [inputLat, setInputLat] = useState('-89.54');
  const [inputLon, setInputLon] = useState('137.00');
  const [inputElev, setInputElev] = useState('1.25');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Map projection scale
  const RHO_MAX_KM = 2 * R_MOON_KM * Math.tan((10.0 * Math.PI) / 360.0); // 80°S border ≈ 304 km
  const VIEWBOX_SIZE = 640;
  const CENTER = VIEWBOX_SIZE / 2;
  const SCALE = (CENTER - 28) / RHO_MAX_KM;

  const projectToSvg = (lat: number, lon: number) => {
    const { x, y } = polarStereographicProject(lat, lon);
    return {
      svgX: CENTER + x * SCALE,
      svgY: CENTER - y * SCALE,
    };
  };

  const selectedSite = customCoordinate
    ? {
        id: 'custom-pin',
        name: `Custom [${customCoordinate.latDeg.toFixed(2)}°, ${customCoordinate.lonDeg.toFixed(2)}°]`,
        program: 'User Custom Vector',
        lat: customCoordinate.latDeg,
        lon: customCoordinate.lonDeg,
        elevationKm: customCoordinate.elevationKm,
        slopeDeg: 4.2,
      }
    : (sitesRegistry.find((s) => s.id === selectedSiteId) || sitesRegistry[0] || {
        id: 'shackleton-rim',
        name: 'Shackleton Rim',
        program: 'Artemis / South Pole',
        lat: -89.54,
        lon: 137.0,
        elevationKm: 1.25,
        slopeDeg: 4.2,
      });

  const activeCoord = {
    lat: selectedSite.lat,
    lon: selectedSite.lon,
  };

  const activePos = projectToSvg(activeCoord.lat, activeCoord.lon);

  // Procedural LOLA Hillshade Relief Canvas Painting
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = VIEWBOX_SIZE;
    canvas.width = size;
    canvas.height = size;

    // 1. Deep space void
    ctx.fillStyle = '#090A0D';
    ctx.fillRect(0, 0, size, size);

    // 2. Lunar Regolith Plate (80°S boundary circle)
    const plateRadius = CENTER - 26;
    const plateGrad = ctx.createRadialGradient(CENTER, CENTER, 10, CENTER, CENTER, plateRadius);
    plateGrad.addColorStop(0, '#1E232D');
    plateGrad.addColorStop(0.45, '#171B23');
    plateGrad.addColorStop(0.85, '#11141B');
    plateGrad.addColorStop(1.0, '#090A0D');

    ctx.save();
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, plateRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = plateGrad;
    ctx.fill();

    // 3. Subtle Regolith Micro-crater noise texture
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < 400; i++) {
      const rx = CENTER + (Math.random() - 0.5) * plateRadius * 1.9;
      const ry = CENTER + (Math.random() - 0.5) * plateRadius * 1.9;
      const rr = Math.random() * 2.5 + 0.8;
      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Sun incident light angle
    const sunAzRad = (currentSun.azimuthDeg * Math.PI) / 180.0;
    const sunDx = Math.sin(sunAzRad);
    const sunDy = -Math.cos(sunAzRad);

    // 5. Draw Major South Pole Craters with Sun-directional Hillshading
    SOUTH_POLE_CRATERS.forEach((crater) => {
      const { svgX, svgY } = projectToSvg(crater.lat, crater.lon);
      const rPx = Math.max(6, (crater.radiusKm / RHO_MAX_KM) * (CENTER - 28));

      // A. Outer rim shadow on the leeward side
      const shadowGrad = ctx.createRadialGradient(
        svgX - sunDx * rPx * 0.4,
        svgY - sunDy * rPx * 0.4,
        rPx * 0.7,
        svgX,
        svgY,
        rPx * 1.45
      );
      shadowGrad.addColorStop(0, 'rgba(9, 10, 13, 0)');
      shadowGrad.addColorStop(0.6, 'rgba(9, 10, 13, 0.75)');
      shadowGrad.addColorStop(1, 'rgba(9, 10, 13, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(svgX, svgY, rPx * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // B. Outer rim highlight on the sunward side
      const rimHighlight = ctx.createLinearGradient(
        svgX - sunDx * rPx,
        svgY - sunDy * rPx,
        svgX + sunDx * rPx,
        svgY + sunDy * rPx
      );
      rimHighlight.addColorStop(0, 'rgba(236, 233, 226, 0.65)');
      rimHighlight.addColorStop(0.35, 'rgba(180, 190, 205, 0.25)');
      rimHighlight.addColorStop(0.7, 'rgba(20, 24, 32, 0)');
      ctx.strokeStyle = rimHighlight;
      ctx.lineWidth = Math.max(1.8, rPx * 0.12);
      ctx.beginPath();
      ctx.arc(svgX, svgY, rPx, 0, Math.PI * 2);
      ctx.stroke();

      // C. Crater interior depression (dark bowl)
      const bowlGrad = ctx.createRadialGradient(
        svgX + sunDx * rPx * 0.35,
        svgY + sunDy * rPx * 0.35,
        rPx * 0.1,
        svgX,
        svgY,
        rPx * 0.95
      );
      bowlGrad.addColorStop(0, '#07090C');
      bowlGrad.addColorStop(0.55, '#0C0F16');
      bowlGrad.addColorStop(0.85, '#222834');
      bowlGrad.addColorStop(1.0, '#353D4C');
      ctx.fillStyle = bowlGrad;
      ctx.beginPath();
      ctx.arc(svgX, svgY, rPx * 0.95, 0, Math.PI * 2);
      ctx.fill();

      // D. Cryo-Indigo Permanently Shadowed Region (PSR) cold trap floor
      if (crater.hasPsr) {
        ctx.fillStyle = 'rgba(20, 29, 48, 0.85)';
        ctx.beginPath();
        ctx.arc(svgX + sunDx * rPx * 0.1, svgY + sunDy * rPx * 0.1, rPx * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40, 158, 142, 0.55)';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // 6. Massif Ridges (Malapert Massif & Mons Mouton high ground highlights)
    const malapert = projectToSvg(-86.0, 0.0);
    ctx.strokeStyle = 'rgba(247, 185, 85, 0.45)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(malapert.svgX, malapert.svgY, 24, 10, -Math.PI / 6, 0, Math.PI * 2);
    ctx.stroke();

    const mouton = projectToSvg(-84.6, -30.0);
    ctx.strokeStyle = 'rgba(236, 233, 226, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(mouton.svgX, mouton.svgY, 22, 14, Math.PI / 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }, [currentSun.azimuthDeg]);

  // Click on map to drop custom pin
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scaleX = VIEWBOX_SIZE / rect.width;
    const scaleY = VIEWBOX_SIZE / rect.height;

    const svgX = clickX * scaleX;
    const svgY = clickY * scaleY;

    const xKm = (svgX - CENTER) / SCALE;
    const yKm = (CENTER - svgY) / SCALE;
    const rhoKm = Math.sqrt(xKm * xKm + yKm * yKm);

    if (rhoKm > RHO_MAX_KM * 1.02) return;

    const lambdaRad = Math.atan2(xKm, yKm);
    let lonDeg = (lambdaRad * 180.0) / Math.PI;
    if (lonDeg > 180) lonDeg -= 360;

    const halfAngleRad = Math.atan(rhoKm / (2 * R_MOON_KM));
    const latDeg = (halfAngleRad * 2 * 180.0) / Math.PI - 90.0;

    setCustomCoordinate({
      latDeg: Math.round(latDeg * 100) / 100,
      lonDeg: Math.round(lonDeg * 100) / 100,
      elevationKm: 0.8,
    });
  };

  const handleApplyCoordinates = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(inputLat);
    const lon = parseFloat(inputLon);
    const elev = parseFloat(inputElev);
    if (!isNaN(lat) && !isNaN(lon) && !isNaN(elev)) {
      setCustomCoordinate({
        latDeg: Math.max(-90, Math.min(-80, lat)),
        lonDeg: ((lon % 360) + 540) % 360 - 180,
        elevationKm: elev,
      });
      setIsCoordInputOpen(false);
    }
  };

  // Concentric latitude rings
  const latRings = [-80, -82.5, -85, -87.5, -90];

  // 360° Radial Raycast Fan (120 rays, 3° increments)
  const currentProfile = horizonProfiles[selectedSiteId] || [];
  const raycastRays = Array.from({ length: 120 }).map((_, idx) => {
    const az = idx * 3;
    const azRad = (az * Math.PI) / 180.0;
    const maxLen = 175; // px outward radius
    const horizonElev = currentProfile[az % currentProfile.length] ?? 2.5;
    const isBlocked = horizonElev > 2.0;
    const rayLen = isBlocked ? maxLen * 0.72 : maxLen;

    const x2 = activePos.svgX + Math.sin(azRad) * rayLen;
    const y2 = activePos.svgY - Math.cos(azRad) * rayLen;

    return {
      az,
      x1: activePos.svgX,
      y1: activePos.svgY,
      x2,
      y2,
      isBlocked,
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* 4 Corner Targeting Brackets */}
      <div className="corner-tr" />
      <div className="corner-bl" />

      {/* Panel Top Header Strip */}
      <div className="bento-panel-header">
        <span>SOUTH POLE STEREOGRAPHIC MAP (80°S to 90°S)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="badge-precomputed" style={{ fontSize: '0.58rem', padding: '0.1rem 0.4rem' }}>
            LOLA 80M DEM
          </span>
          <button
            className="btn-tactical-secondary"
            style={{ padding: '0.15rem 0.45rem', fontSize: '0.60rem' }}
            onClick={() => setIsCoordInputOpen(!isCoordInputOpen)}
            title="Inject custom latitude and longitude coordinates"
          >
            {isCoordInputOpen ? '✕ CLOSE' : '+ COORD'}
          </button>
        </div>
      </div>

      {/* Optional Coordinate Injection Drawer */}
      {isCoordInputOpen && (
        <form
          onSubmit={handleApplyCoordinates}
          style={{
            backgroundColor: 'var(--bg-surface-2)',
            borderBottom: '1px solid var(--border-hairline)',
            padding: '0.35rem 0.7rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.62rem',
            zIndex: 30,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>LAT:</span>
            <input
              type="text"
              value={inputLat}
              onChange={(e) => setInputLat(e.target.value)}
              className="input-tactical"
              style={{ width: '60px', padding: '2px 4px', fontSize: '0.62rem' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>LON:</span>
            <input
              type="text"
              value={inputLon}
              onChange={(e) => setInputLon(e.target.value)}
              className="input-tactical"
              style={{ width: '60px', padding: '2px 4px', fontSize: '0.62rem' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>ALT:</span>
            <input
              type="text"
              value={inputElev}
              onChange={(e) => setInputElev(e.target.value)}
              className="input-tactical"
              style={{ width: '48px', padding: '2px 4px', fontSize: '0.62rem' }}
            />
          </div>
          <button type="submit" className="btn-tactical-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.60rem' }}>
            SET
          </button>
        </form>
      )}

      {/* Main Map Viewport Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {/* Procedural Hillshade Canvas Background */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />

        {/* Interactive SVG Overlay */}
        <svg
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            cursor: 'crosshair',
            userSelect: 'none',
          }}
          onClick={handleSvgClick}
        >
          {/* Concentric Latitude Rings */}
          {latRings.map((lat) => {
            const { x } = polarStereographicProject(lat, 90);
            const radius = x * SCALE;
            const isPole = lat === -90;
            return (
              <g key={lat}>
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={radius}
                  fill="none"
                  stroke={isPole ? 'var(--accent-solar)' : 'rgba(236, 233, 226, 0.22)'}
                  strokeWidth={isPole ? 1.2 : 0.6}
                  strokeDasharray={isPole ? undefined : '3,4'}
                />
                {!isPole && (
                  <text
                    x={CENTER - radius + 4}
                    y={CENTER - 4}
                    fill="var(--text-muted)"
                    fontSize="7.5"
                    fontFamily="var(--font-mono)"
                  >
                    {Math.abs(lat)}°S
                  </text>
                )}
              </g>
            );
          })}

          {/* Longitude Spokes */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((lon) => {
            const angleRad = (lon * Math.PI) / 180;
            const rMax = CENTER - 26;
            const x2 = CENTER + rMax * Math.sin(angleRad);
            const y2 = CENTER - rMax * Math.cos(angleRad);
            const isPrime = lon === 0;

            return (
              <g key={lon}>
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={x2}
                  y2={y2}
                  stroke={isPrime ? 'var(--accent-earth)' : 'rgba(74, 82, 100, 0.28)'}
                  strokeWidth={isPrime ? 1.2 : 0.5}
                  strokeDasharray={isPrime ? undefined : '2,4'}
                />
                <text
                  x={x2 + Math.sin(angleRad) * 11}
                  y={y2 - Math.cos(angleRad) * 11 + 3}
                  fill={isPrime ? 'var(--accent-earth-hi)' : 'var(--text-muted)'}
                  fontSize="7"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontWeight={isPrime ? 'bold' : 'normal'}
                >
                  {lon === 0 ? '0°' : lon === 90 ? '90°' : lon === 180 ? '180°' : lon === 270 ? '-90°' : `${lon}°`}
                </text>
              </g>
            );
          })}

          {/* 360° Radial Raycast Fan from Active Target Pin */}
          <g opacity="0.85">
            {raycastRays.map((ray, i) => (
              <line
                key={i}
                x1={ray.x1}
                y1={ray.y1}
                x2={ray.x2}
                y2={ray.y2}
                stroke={ray.isBlocked ? 'rgba(217, 70, 62, 0.45)' : 'rgba(76, 201, 184, 0.35)'}
                strokeWidth={ray.isBlocked ? 0.7 : 0.5}
              />
            ))}
          </g>

          {/* PSR Polygon Labels */}
          {SOUTH_POLE_CRATERS.filter((c) => c.hasPsr).map((c) => {
            const p = projectToSvg(c.lat, c.lon);
            return (
              <text
                key={c.name}
                x={p.svgX}
                y={p.svgY + 2.5}
                fill="rgba(76, 201, 184, 0.7)"
                fontSize="6"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
                fontWeight="bold"
                pointerEvents="none"
              >
                PSR
              </text>
            );
          })}

          {/* Curated Landing Site Markers */}
          {sitesRegistry.map((siteItem) => {
            const { svgX, svgY } = projectToSvg(siteItem.lat, siteItem.lon);
            const isSelected = selectedSiteId === siteItem.id && !customCoordinate;

            return (
              <g
                key={siteItem.id}
                transform={`translate(${svgX}, ${svgY})`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSiteId(siteItem.id);
                }}
              >
                {/* Yellow site marker flag */}
                <circle cx="0" cy="0" r="3.5" fill={isSelected ? 'var(--accent-solar-hi)' : '#E59A23'} stroke="#090A0D" strokeWidth="1" />
                {!isSelected && (
                  <g transform="translate(6, -2)">
                    <rect x="0" y="-8" width={siteItem.name.length * 5.2 + 8} height="12" fill="rgba(17, 19, 24, 0.88)" stroke="#262A34" strokeWidth="0.8" rx="1" />
                    <text x="4" y="0" fill="var(--text-primary)" fontSize="6.5" fontFamily="var(--font-mono)">
                      {siteItem.name}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Active Target Reticle (Concentric Avionics Rings) */}
          <g transform={`translate(${activePos.svgX}, ${activePos.svgY})`}>
            {/* Outer rotating reticle */}
            <circle cx="0" cy="0" r="22" fill="none" stroke="var(--accent-solar)" strokeWidth="1.2" strokeDasharray="6,4" />
            <circle cx="0" cy="0" r="14" fill="none" stroke="var(--accent-earth-hi)" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx="0" cy="0" r="4" fill="none" stroke="var(--accent-solar-hi)" strokeWidth="1.5" />
            <circle cx="0" cy="0" r="1.5" fill="var(--accent-solar-hi)" />

            {/* Crosshair ticks */}
            <line x1="-28" y1="0" x2="-22" y2="0" stroke="var(--accent-solar)" strokeWidth="1" />
            <line x1="22" y1="0" x2="28" y2="0" stroke="var(--accent-solar)" strokeWidth="1" />
            <line x1="0" y1="-28" x2="0" y2="-22" stroke="var(--accent-solar)" strokeWidth="1" />
            <line x1="0" y1="22" x2="0" y2="28" stroke="var(--accent-solar)" strokeWidth="1" />

            {/* Selected Target Label Flag */}
            <g transform="translate(18, -10)">
              <rect
                x="0"
                y="-10"
                width={125}
                height="18"
                fill="rgba(17, 19, 24, 0.94)"
                stroke="var(--accent-solar)"
                strokeWidth="1"
                rx="1"
              />
              <text x="6" y="-1" fill="var(--accent-solar-hi)" fontSize="7" fontFamily="var(--font-mono)" fontWeight="bold">
                {selectedSite.name}
              </text>
              <text x="6" y="6" fill="var(--text-secondary)" fontSize="5.5" fontFamily="var(--font-mono)">
                ({activeCoord.lat.toFixed(2)}°, {activeCoord.lon.toFixed(2)}°)
              </text>
            </g>
          </g>
        </svg>

        {/* Top-Right Floating Glassmorphic Telemetry HUD Card */}
        <div className="floating-hud-card">
          <div className="floating-hud-title">
            {selectedSite.name.toUpperCase().slice(0, 18)}
          </div>
          <div className="floating-hud-row">
            <span>COORDS:</span>
            <strong>{activeCoord.lat.toFixed(2)}°, {activeCoord.lon.toFixed(2)}°</strong>
          </div>
          <div className="floating-hud-row">
            <span>SUN AZ/EL:</span>
            <strong className="solar">{currentSun.azimuthDeg.toFixed(1)}° / {currentSun.elevationDeg > 0 ? `+${currentSun.elevationDeg.toFixed(1)}°` : `${currentSun.elevationDeg.toFixed(1)}°`}</strong>
          </div>
          <div className="floating-hud-row">
            <span>EARTH LOS:</span>
            <strong className="cyan">{currentDteActive ? 'LOCKED' : 'OCCULTED'}</strong>
          </div>
          <div className="floating-hud-row">
            <span>LOCAL SLOPE:</span>
            <strong>{selectedSite.slopeDeg ? `${selectedSite.slopeDeg.toFixed(1)}°` : '4.2°'}</strong>
          </div>
        </div>

        {/* Bottom-Right Inset — 3D Local Crater Hologram */}
        <div className="inset-3d-hologram">
          <div className="inset-3d-header">
            <span>3D LOCAL CRATER HOLOGRAM</span>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                color: insetHazardMode === 'slope-hazard' ? 'var(--status-hazard)' : 'var(--accent-earth)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.52rem',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
              onClick={() => setInsetHazardMode(insetHazardMode === 'slope-hazard' ? 'realistic' : 'slope-hazard')}
            >
              {insetHazardMode === 'slope-hazard' ? 'HAZARD HEATMAP' : 'LUNAR SHADE'}
            </button>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <ThreeDLocalTerrain shadingMode={insetHazardMode} />
            {/* Status overlay badges */}
            <div
              style={{
                position: 'absolute',
                bottom: '3px',
                left: '4px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.52rem',
                color: 'var(--accent-solar-hi)',
                backgroundColor: 'rgba(9, 10, 13, 0.8)',
                padding: '1px 4px',
                borderRadius: '1px',
                pointerEvents: 'none',
              }}
            >
              SOLAR VECTORS ({currentSun.elevationDeg > 0 ? `+${currentSun.elevationDeg.toFixed(1)}°` : `${currentSun.elevationDeg.toFixed(1)}°`})
            </div>
            <div
              style={{
                position: 'absolute',
                top: '3px',
                right: '4px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.50rem',
                color: 'var(--accent-earth-hi)',
                backgroundColor: 'rgba(9, 10, 13, 0.8)',
                padding: '1px 4px',
                borderRadius: '1px',
                pointerEvents: 'none',
              }}
            >
              DTE COMM LINK
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};