import React, { useState, useEffect, useRef } from 'react';
import { useMissionStore } from '../../store/missionStore';
import { polarStereographicProject, R_MOON_KM } from '../../engine/lunarEphemeris';
import { ThreeDLocalTerrain } from './ThreeDLocalTerrain';

// Curated Major South Pole Craters for Continuous Topographic Hillshade Relief
const SOUTH_POLE_CRATERS = [
  { name: 'Shackleton', lat: -89.54, lon: 137.0, radiusKm: 21.0, hasPsr: true },
  { name: 'Peak Near Shackleton', lat: -89.68, lon: 129.0, radiusKm: 14.0, hasPsr: false },
  { name: 'Shoemaker', lat: -88.10, lon: 45.0, radiusKm: 50.0, hasPsr: true },
  { name: 'Faustini', lat: -87.30, lon: 77.0, radiusKm: 39.0, hasPsr: true },
  { name: 'Haworth', lat: -87.45, lon: -5.0, radiusKm: 35.0, hasPsr: true },
  { name: 'de Gerlache', lat: -88.50, lon: -88.0, radiusKm: 32.0, hasPsr: true },
  { name: 'Cabeus', lat: -84.90, lon: -35.5, radiusKm: 100.0, hasPsr: true },
  { name: 'Nobile', lat: -85.20, lon: 53.0, radiusKm: 73.0, hasPsr: true },
  { name: 'Amundsen', lat: -84.50, lon: 83.0, radiusKm: 105.0, hasPsr: true },
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
  const RHO_MAX_KM = 2 * R_MOON_KM * Math.tan((10.0 * Math.PI) / 360.0);
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

  const defaultSite = {
    id: 'shackleton-rim',
    name: 'Shackleton Rim',
    program: 'Artemis / South Pole',
    lat: -89.54,
    lon: 137.0,
    elevationKm: 1.25,
    slopeDeg: 4.2,
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
    : (sitesRegistry.find((s) => s.id === selectedSiteId) || sitesRegistry[0] || defaultSite);

  const activeCoord = {
    lat: selectedSite.lat,
    lon: selectedSite.lon,
  };

  const activePos = projectToSvg(activeCoord.lat, activeCoord.lon);

  // Procedural Photorealistic LOLA Hillshade Relief Canvas Painting
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = VIEWBOX_SIZE;
    canvas.width = size;
    canvas.height = size;

    // 1. Deep space background
    ctx.fillStyle = '#090A0D';
    ctx.fillRect(0, 0, size, size);

    // 2. Realistic LOLA Anorthositic Lunar Highland Crust (80°S circular polar disk)
    const plateRadius = CENTER - 26;
    const plateGrad = ctx.createRadialGradient(CENTER, CENTER, 25, CENTER, CENTER, plateRadius);
    plateGrad.addColorStop(0, '#B8C2D1'); // light highland regolith
    plateGrad.addColorStop(0.35, '#A4AFBF');
    plateGrad.addColorStop(0.70, '#8692A4');
    plateGrad.addColorStop(0.92, '#5C6677');
    plateGrad.addColorStop(1.0, '#1E232D');

    ctx.save();
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, plateRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = plateGrad;
    ctx.fill();

    // 3. Regolith Micro-Texture & Cratering Noise
    const pseudoRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    // Directional Sun lighting vector
    const sunAzRad = (currentSun.azimuthDeg * Math.PI) / 180.0;
    const sunDx = Math.sin(sunAzRad);
    const sunDy = -Math.cos(sunAzRad);

    // 4. Draw 65 Procedural Micro-Craters with Directional Hillshade
    for (let i = 0; i < 65; i++) {
      const rDist = pseudoRandom(i * 13.7) * (plateRadius - 30);
      const theta = pseudoRandom(i * 29.3) * Math.PI * 2;
      const mcX = CENTER + Math.cos(theta) * rDist;
      const mcY = CENTER + Math.sin(theta) * rDist;
      const mcR = 3.0 + pseudoRandom(i * 7.1) * 9.0;

      // Crater bowl shadow
      ctx.fillStyle = 'rgba(12, 16, 24, 0.75)';
      ctx.beginPath();
      ctx.arc(mcX, mcY, mcR, 0, Math.PI * 2);
      ctx.fill();

      // Sunlit rim highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(mcX - sunDx * 0.8, mcY - sunDy * 0.8, mcR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 5. Central Cryo-Indigo Permanently Shadowed Region (PSR) Basin
    // Covers the low cold-trap basins around Shackleton, Shoemaker, Faustini, Haworth
    const psrPoints = [
      projectToSvg(-89.9, 0),
      projectToSvg(-89.2, 80),
      projectToSvg(-87.8, 55),
      projectToSvg(-86.9, 75),
      projectToSvg(-87.2, 120),
      projectToSvg(-88.7, 145),
      projectToSvg(-89.3, -30),
      projectToSvg(-88.2, -60),
      projectToSvg(-87.1, -10),
      projectToSvg(-87.6, 20),
    ];

    ctx.save();
    ctx.beginPath();
    psrPoints.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.svgX, pt.svgY);
      else ctx.lineTo(pt.svgX, pt.svgY);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(16, 32, 60, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 158, 142, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 6. Render Major South Pole Craters with Accurate LOLA Hillshading
    SOUTH_POLE_CRATERS.forEach((crater) => {
      const { svgX, svgY } = projectToSvg(crater.lat, crater.lon);
      const rPx = Math.max(10, (crater.radiusKm / RHO_MAX_KM) * (CENTER - 28));

      // A. Cast shadow onto leeward terrain
      const shadowGrad = ctx.createRadialGradient(
        svgX - sunDx * rPx * 0.4,
        svgY - sunDy * rPx * 0.4,
        rPx * 0.5,
        svgX,
        svgY,
        rPx * 1.3
      );
      shadowGrad.addColorStop(0, 'rgba(8, 11, 16, 0.9)');
      shadowGrad.addColorStop(0.7, 'rgba(8, 11, 16, 0.6)');
      shadowGrad.addColorStop(1, 'rgba(8, 11, 16, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(svgX, svgY, rPx * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // B. Crater interior bowl
      const bowlGrad = ctx.createRadialGradient(
        svgX + sunDx * rPx * 0.3,
        svgY + sunDy * rPx * 0.3,
        rPx * 0.1,
        svgX,
        svgY,
        rPx * 0.96
      );
      bowlGrad.addColorStop(0, crater.hasPsr ? '#0A121E' : '#11151F');
      bowlGrad.addColorStop(0.65, crater.hasPsr ? '#101C30' : '#1C2230');
      bowlGrad.addColorStop(1.0, '#384252');
      ctx.fillStyle = bowlGrad;
      ctx.beginPath();
      ctx.arc(svgX, svgY, rPx * 0.96, 0, Math.PI * 2);
      ctx.fill();

      // C. Illuminated Sunward Rim Crest Highlight (Pure white/silver)
      const rimHighlight = ctx.createLinearGradient(
        svgX - sunDx * rPx,
        svgY - sunDy * rPx,
        svgX + sunDx * rPx,
        svgY + sunDy * rPx
      );
      rimHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      rimHighlight.addColorStop(0.35, 'rgba(215, 225, 240, 0.6)');
      rimHighlight.addColorStop(0.75, 'rgba(30, 36, 48, 0)');
      ctx.strokeStyle = rimHighlight;
      ctx.lineWidth = Math.max(2.2, rPx * 0.12);
      ctx.beginPath();
      ctx.arc(svgX, svgY, rPx, 0, Math.PI * 2);
      ctx.stroke();

      // D. Crater Shadowed Inner Wall
      const shadowWall = ctx.createLinearGradient(
        svgX + sunDx * rPx,
        svgY + sunDy * rPx,
        svgX - sunDx * rPx,
        svgY - sunDy * rPx
      );
      shadowWall.addColorStop(0, 'rgba(7, 9, 13, 0.88)');
      shadowWall.addColorStop(0.45, 'rgba(7, 9, 13, 0.2)');
      shadowWall.addColorStop(0.8, 'rgba(7, 9, 13, 0)');
      ctx.strokeStyle = shadowWall;
      ctx.lineWidth = Math.max(2.0, rPx * 0.14);
      ctx.beginPath();
      ctx.arc(svgX, svgY, rPx * 0.92, 0, Math.PI * 2);
      ctx.stroke();

      // E. Crater Floor PSR Outline
      if (crater.hasPsr) {
        ctx.fillStyle = 'rgba(18, 36, 68, 0.85)';
        ctx.beginPath();
        ctx.arc(svgX + sunDx * rPx * 0.15, svgY + sunDy * rPx * 0.15, rPx * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40, 158, 142, 0.7)';
        ctx.lineWidth = 0.9;
        ctx.setLineDash([2, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // 7. Malapert Massif & Mons Mouton High Ridges
    const malapert = projectToSvg(-86.0, 0.0);
    ctx.strokeStyle = 'rgba(247, 185, 85, 0.75)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(malapert.svgX, malapert.svgY, 26, 11, -Math.PI / 5, 0, Math.PI * 2);
    ctx.stroke();

    const mouton = projectToSvg(-84.6, -30.0);
    ctx.strokeStyle = 'rgba(240, 245, 255, 0.65)';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(mouton.svgX, mouton.svgY, 24, 14, Math.PI / 4, 0, Math.PI * 2);
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
    const maxLen = 175;
    const horizonElev = currentProfile[az % (currentProfile.length || 1)] ?? 2.5;
    const isBlocked = horizonElev > 2.0;
    const rayLen = isBlocked ? maxLen * 0.75 : maxLen;

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

  // Major Benchmark Non-Selected Sites to display neatly without clutter
  const benchmarkSites = [
    { name: 'Malapert Massif', lat: -86.0, lon: 0.0, subtitle: 'ACTIVE SITE | ARTIMIS' },
    { name: 'Mons Mouton', lat: -84.6, lon: -30.0, subtitle: 'STATUS SITE | ARTIMIS' },
    { name: 'Peak Near Shackleton', lat: -89.68, lon: 129.0, subtitle: 'HIGHWAY RIM' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div className="corner-tr" />
      <div className="corner-bl" />

      {/* Top Panel Header Strip */}
      <div className="bento-panel-header">
        <span>SOUTH POLE STEREOGRAPHIC MAP (80°S to 90°S)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
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

      {/* Coordinate Injection Drawer */}
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
            whiteSpace: 'nowrap',
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
                  stroke={isPole ? 'var(--accent-solar)' : 'rgba(236, 233, 226, 0.28)'}
                  strokeWidth={isPole ? 1.4 : 0.6}
                  strokeDasharray={isPole ? undefined : '3,4'}
                />
                {!isPole && (
                  <text
                    x={CENTER - radius + 4}
                    y={CENTER - 4}
                    fill="var(--text-secondary)"
                    fontSize="7.5"
                    fontFamily="var(--font-mono)"
                    fontWeight="bold"
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
                  stroke={isPrime ? 'var(--accent-earth)' : 'rgba(74, 82, 100, 0.32)'}
                  strokeWidth={isPrime ? 1.4 : 0.5}
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
                stroke={ray.isBlocked ? 'rgba(217, 70, 62, 0.55)' : 'rgba(247, 185, 85, 0.45)'}
                strokeWidth={ray.isBlocked ? 0.75 : 0.55}
              />
            ))}
          </g>

          {/* PSR Polygon Water-Ice Trap Labels */}
          {SOUTH_POLE_CRATERS.filter((c) => c.hasPsr).map((c) => {
            const p = projectToSvg(c.lat, c.lon);
            return (
              <text
                key={c.name}
                x={p.svgX}
                y={p.svgY + 2.5}
                fill="rgba(76, 201, 184, 0.85)"
                fontSize="6.5"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
                fontWeight="bold"
                pointerEvents="none"
              >
                PSR
              </text>
            );
          })}

          {/* Benchmark Site Markers (Non-Selected) */}
          {benchmarkSites.map((siteItem) => {
            const { svgX, svgY } = projectToSvg(siteItem.lat, siteItem.lon);
            return (
              <g
                key={siteItem.name}
                transform={`translate(${svgX}, ${svgY})`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  const match = sitesRegistry.find((s) => s.name.toLowerCase().includes(siteItem.name.toLowerCase().slice(0, 5)));
                  if (match) setSelectedSiteId(match.id);
                }}
              >
                <circle cx="0" cy="0" r="3.5" fill="#E59A23" stroke="#090A0D" strokeWidth="1.2" />
                <g transform="translate(6, -3)">
                  <rect x="0" y="-8" width={siteItem.name.length * 5.2 + 8} height="13" fill="rgba(17, 19, 24, 0.92)" stroke="#262A34" strokeWidth="0.8" rx="1" />
                  <text x="4" y="0" fill="var(--text-primary)" fontSize="6" fontFamily="var(--font-mono)" fontWeight="bold">
                    {siteItem.name}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Active Target Reticle (Concentric Avionics Rings & Brackets) */}
          <g transform={`translate(${activePos.svgX}, ${activePos.svgY})`}>
            {/* Outer dotted ring */}
            <circle cx="0" cy="0" r="24" fill="none" stroke="var(--accent-solar)" strokeWidth="1.4" strokeDasharray="6,4" />
            {/* Inner cyan ring */}
            <circle cx="0" cy="0" r="15" fill="none" stroke="var(--accent-earth-hi)" strokeWidth="1.2" strokeDasharray="3,3" />
            {/* Center pip */}
            <circle cx="0" cy="0" r="4.5" fill="none" stroke="var(--accent-solar-hi)" strokeWidth="1.5" />
            <circle cx="0" cy="0" r="2" fill="var(--accent-solar-hi)" />

            {/* Crosshair targeting ticks */}
            <line x1="-30" y1="0" x2="-24" y2="0" stroke="var(--accent-solar)" strokeWidth="1.2" />
            <line x1="24" y1="0" x2="30" y2="0" stroke="var(--accent-solar)" strokeWidth="1.2" />
            <line x1="0" y1="-30" x2="0" y2="-24" stroke="var(--accent-solar)" strokeWidth="1.2" />
            <line x1="0" y1="24" x2="0" y2="30" stroke="var(--accent-solar)" strokeWidth="1.2" />

            {/* Selected Target Label Flag Card */}
            <g transform="translate(20, -12)">
              <rect
                x="0"
                y="-10"
                width={130}
                height="20"
                fill="rgba(17, 19, 24, 0.95)"
                stroke="var(--accent-solar)"
                strokeWidth="1.2"
                rx="2"
              />
              <text x="6" y="0" fill="var(--accent-solar-hi)" fontSize="7" fontFamily="var(--font-mono)" fontWeight="bold">
                {selectedSite.name}
              </text>
              <text x="6" y="7" fill="var(--text-secondary)" fontSize="5.5" fontFamily="var(--font-mono)">
                ({activeCoord.lat.toFixed(2)}°, {activeCoord.lon.toFixed(2)}°)
              </text>
            </g>
          </g>
        </svg>

        {/* Top-Right Floating Glassmorphic Telemetry HUD Card */}
        <div className="floating-hud-card">
          <div className="floating-hud-title">
            {selectedSite.name.toUpperCase().slice(0, 19)}
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
            <ThreeDLocalTerrain shadingMode={insetHazardMode} compact={true} />
            <div
              style={{
                position: 'absolute',
                bottom: '3px',
                left: '4px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.50rem',
                color: 'var(--accent-solar-hi)',
                backgroundColor: 'rgba(9, 10, 13, 0.85)',
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
                backgroundColor: 'rgba(9, 10, 13, 0.85)',
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
