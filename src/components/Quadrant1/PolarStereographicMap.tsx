import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useMissionStore } from '../../store/missionStore';
import { polarStereographicProject, R_MOON_KM } from '../../engine/lunarEphemeris';
import { CraterTerrain3D } from './CraterTerrain3D';

// Major South Pole Craters with Geodetic Coordinates & PSR Status
const MAJOR_SOUTH_POLE_CRATERS = [
  { name: 'Shackleton', lat: -89.54, lon: 137.0, radiusKm: 21.0, hasPsr: true, hasPeak: false },
  { name: 'Shoemaker', lat: -88.10, lon: 45.0, radiusKm: 50.0, hasPsr: true, hasPeak: true },
  { name: 'Faustini', lat: -87.30, lon: 77.0, radiusKm: 39.0, hasPsr: true, hasPeak: false },
  { name: 'Haworth', lat: -87.45, lon: -5.0, radiusKm: 35.0, hasPsr: true, hasPeak: false },
  { name: 'de Gerlache', lat: -88.50, lon: -88.0, radiusKm: 32.0, hasPsr: true, hasPeak: false },
  { name: 'Cabeus', lat: -84.90, lon: -35.5, radiusKm: 100.0, hasPsr: true, hasPeak: true },
  { name: 'Amundsen', lat: -84.50, lon: 83.0, radiusKm: 105.0, hasPsr: true, hasPeak: true },
  { name: 'Nobile', lat: -85.20, lon: 53.0, radiusKm: 73.0, hasPsr: true, hasPeak: true },
  { name: 'Peak Near Shackleton', lat: -89.68, lon: 129.0, radiusKm: 13.0, hasPsr: false, hasPeak: false },
];

export const PolarStereographicMap: React.FC = () => {
  const sitesRegistry = useMissionStore((s) => s.sitesRegistry);
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const setSelectedSiteId = useMissionStore((s) => s.setSelectedSiteId);
  const customCoordinate = useMissionStore((s) => s.customCoordinate);
  const setCustomCoordinate = useMissionStore((s) => s.setCustomCoordinate);
  const currentSun = useMissionStore((s) => s.currentSun);
  const currentDteActive = useMissionStore((s) => s.currentDteActive);

  const [isCoordInputOpen, setIsCoordInputOpen] = useState(false);
  const [insetHazardMode, setInsetHazardMode] = useState<'realistic' | 'slope-hazard'>('slope-hazard');
  const [inputLat, setInputLat] = useState('-89.54');
  const [inputLon, setInputLon] = useState('137.00');
  const [inputElev, setInputElev] = useState('1.25');

  const lunarImageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  const formatSignedDeg = (val: number, decimals: number = 2) =>
    `${val >= 0 ? '+' : ''}${val.toFixed(decimals)}°`;

  // Draw Base Lunar Globe (using /lunar-south-pole.jpg with Procedural Fallback)
  const drawGlobe = (sourceImg?: HTMLImageElement | null) => {
    const size = VIEWBOX_SIZE;
    const plateRadius = CENTER - 26;
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const octx = offscreen.getContext('2d');
    if (!octx) return;

    // Void background outside the circular globe
    octx.fillStyle = '#090A0D';
    octx.fillRect(0, 0, size, size);

    // Clip to circular stereographic globe
    octx.save();
    octx.beginPath();
    octx.arc(CENTER, CENTER, plateRadius, 0, Math.PI * 2);
    octx.clip();

    if (sourceImg && sourceImg.complete && sourceImg.naturalWidth > 0) {
      // 1. Draw High-Resolution Lunar South Pole Hillshade Texture
      octx.drawImage(
        sourceImg,
        CENTER - plateRadius,
        CENTER - plateRadius,
        plateRadius * 2,
        plateRadius * 2
      );

      // 2. Subtle radial vignette around outer 80°S limb edge for seamless contrast
      const vignette = octx.createRadialGradient(
        CENTER,
        CENTER,
        plateRadius * 0.70,
        CENTER,
        CENTER,
        plateRadius
      );
      vignette.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(0.75, 'rgba(9, 10, 13, 0.28)');
      vignette.addColorStop(1.0, 'rgba(9, 10, 13, 0.68)');
      octx.fillStyle = vignette;
      octx.fillRect(0, 0, size, size);

      // 3. Render Cryo-Indigo Permanently Shadowed Region (PSR) dashed contours
      MAJOR_SOUTH_POLE_CRATERS.filter((c) => c.hasPsr).forEach((c) => {
        const { svgX, svgY } = projectToSvg(c.lat, c.lon);
        const rPx = Math.max(12, (c.radiusKm / RHO_MAX_KM) * (CENTER - 28));

        // Cryo-Indigo pool fill
        octx.fillStyle = 'rgba(22, 65, 118, 0.65)';
        octx.beginPath();
        octx.arc(svgX, svgY, rPx * 0.60, 0, Math.PI * 2);
        octx.fill();

        // Bright cyan-teal dashed border
        octx.strokeStyle = '#4CC9B8';
        octx.lineWidth = 1.4;
        octx.setLineDash([4, 3]);
        octx.beginPath();
        octx.arc(svgX, svgY, rPx * 0.60, 0, Math.PI * 2);
        octx.stroke();
        octx.setLineDash([]);

        // Crisp 'PSR' label
        if (rPx > 11) {
          octx.font = 'bold 7.5px "JetBrains Mono", monospace';
          octx.fillStyle = '#4CC9B8';
          octx.textAlign = 'center';
          octx.fillText('PSR', svgX, svgY + 2.5);
          octx.textAlign = 'start';
        }
      });
    } else {
      // ── High-Albedo Procedural Fallback (if image is loading or unavailable) ──
      const baseGrad = octx.createRadialGradient(CENTER, CENTER, 0, CENTER, CENTER, plateRadius);
      baseGrad.addColorStop(0.0, '#68707E');
      baseGrad.addColorStop(0.35, '#5C6472');
      baseGrad.addColorStop(0.65, '#525A68');
      baseGrad.addColorStop(1.0, '#363C48');
      octx.fillStyle = baseGrad;
      octx.fillRect(0, 0, size, size);

      const sunAzRad = (135.0 * Math.PI) / 180.0;
      const sunDirX = Math.cos(sunAzRad);
      const sunDirY = Math.sin(sunAzRad);

      // Craters list
      const fullCraterList = MAJOR_SOUTH_POLE_CRATERS.map((c) => {
        const p = polarStereographicProject(c.lat, c.lon);
        return {
          cx: CENTER + p.x * SCALE,
          cy: CENTER - p.y * SCALE,
          r: Math.max(14, (c.radiusKm / RHO_MAX_KM) * (CENTER - 28)),
          psr: c.hasPsr,
        };
      });

      fullCraterList.forEach((cr) => {
        const { cx: ccx, cy: ccy, r: crR } = cr;
        // Sunlit inner wall
        octx.save();
        octx.beginPath();
        octx.arc(ccx, ccy, crR, 0, Math.PI * 2);
        octx.clip();
        octx.fillStyle = '#B8C2D0';
        octx.fill();

        // Shadowed floor
        octx.fillStyle = '#0B0E14';
        octx.beginPath();
        octx.arc(ccx - sunDirX * 0.22 * crR, ccy - sunDirY * 0.22 * crR, crR * 0.92, 0, Math.PI * 2);
        octx.fill();
        octx.restore();

        // Rim stroke
        octx.strokeStyle = 'rgba(230, 236, 245, 0.55)';
        octx.lineWidth = 1.2;
        octx.beginPath();
        octx.arc(ccx, ccy, crR, sunAzRad - Math.PI * 0.5, sunAzRad + Math.PI * 0.5);
        octx.stroke();

        if (cr.psr) {
          octx.fillStyle = 'rgba(22, 65, 118, 0.72)';
          octx.beginPath();
          octx.arc(ccx, ccy, crR * 0.58, 0, Math.PI * 2);
          octx.fill();

          octx.strokeStyle = '#4CC9B8';
          octx.lineWidth = 1.4;
          octx.setLineDash([4, 3]);
          octx.beginPath();
          octx.arc(ccx, ccy, crR * 0.58, 0, Math.PI * 2);
          octx.stroke();
          octx.setLineDash([]);
        }
      });
    }

    octx.restore();
    offscreenCanvasRef.current = offscreen;

    // Direct paint to visible canvas
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(offscreen, 0, 0);
      }
    }
  };

  // Cache and load /lunar-south-pole.jpg for instant, flicker-free rendering
  useEffect(() => {
    if (lunarImageRef.current && lunarImageRef.current.complete) {
      drawGlobe(lunarImageRef.current);
      return;
    }

    const img = new Image();
    img.src = '/lunar-south-pole.jpg';
    img.onload = () => {
      lunarImageRef.current = img;
      drawGlobe(img);
    };
    img.onerror = () => {
      console.warn('Fallback to procedural lunar relief');
      drawGlobe(null);
    };

    // Draw initial state immediately
    drawGlobe(null);
  }, []);

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

  // 3. Dense 360° Raycast Fan (120 rays, 3° increments, 0.6px width)
  const raycastRays = useMemo(() => {
    const list: {
      az: number;
      x1: number;
      y1: number;
      xSplit: number;
      ySplit: number;
      x2: number;
      y2: number;
      hasObstruction: boolean;
    }[] = [];

    const maxLen = 185;

    for (let idx = 0; idx < 120; idx++) {
      const az = idx * 3;
      const azRad = (az * Math.PI) / 180.0;
      const dirX = Math.sin(azRad);
      const dirY = -Math.cos(azRad);

      const xEnd = activePos.svgX + dirX * maxLen;
      const yEnd = activePos.svgY + dirY * maxLen;

      let minObstructionDist = maxLen;
      let hasObstruction = false;

      // Active site rim distance
      const isShackletonArea = Math.abs(activeCoord.lat + 89.54) < 0.3;
      if (isShackletonArea) {
        if (az > 140 && az < 330) {
          minObstructionDist = 24 + Math.sin(azRad * 2) * 6;
          hasObstruction = true;
        }
      }

      MAJOR_SOUTH_POLE_CRATERS.forEach((c) => {
        const cPos = projectToSvg(c.lat, c.lon);
        const rPx = (c.radiusKm / RHO_MAX_KM) * (CENTER - 28);
        const toCraterX = cPos.svgX - activePos.svgX;
        const toCraterY = cPos.svgY - activePos.svgY;
        const proj = toCraterX * dirX + toCraterY * dirY;

        if (proj > 8 && proj < maxLen) {
          const perpDist = Math.abs(toCraterX * -dirY + toCraterY * dirX);
          if (perpDist < rPx * 0.85) {
            const hitDist = proj - Math.sqrt(Math.max(0, rPx * rPx - perpDist * perpDist));
            if (hitDist > 10 && hitDist < minObstructionDist) {
              minObstructionDist = hitDist;
              hasObstruction = true;
            }
          }
        }
      });

      const splitDist = hasObstruction ? minObstructionDist : maxLen;
      const xSplit = activePos.svgX + dirX * splitDist;
      const ySplit = activePos.svgY + dirY * splitDist;

      list.push({
        az,
        x1: activePos.svgX,
        y1: activePos.svgY,
        xSplit,
        ySplit,
        x2: xEnd,
        y2: yEnd,
        hasObstruction,
      });
    }
    return list;
  }, [activePos.svgX, activePos.svgY, activeCoord.lat]);

  // Benchmark Non-Selected Site Badges
  const benchmarkSites = [
    { name: 'Malapert Massif', lat: -86.0, lon: 0.0 },
    { name: 'Mons Mouton', lat: -84.6, lon: -30.0 },
    { name: 'Peak Near Shackleton', lat: -89.68, lon: 129.0 },
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
        {/* High-Contrast Grayscale LOLA Relief Canvas */}
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
          {/* Concentric Latitude Rings (80°S to 90°S) */}
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
                  stroke={isPrime ? 'var(--accent-earth)' : 'rgba(74, 82, 100, 0.35)'}
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

          {/* Dense 360° Raycast Fan (120 rays, 0.6px width: #E59A23 amber unblocked, #D9463E vermilion obstructed) */}
          <g>
            {raycastRays.map((ray, i) => (
              <g key={i}>
                <line
                  x1={ray.x1}
                  y1={ray.y1}
                  x2={ray.xSplit}
                  y2={ray.ySplit}
                  stroke="#E59A23"
                  strokeWidth="0.6"
                  opacity="0.65"
                />
                {ray.hasObstruction && (
                  <line
                    x1={ray.xSplit}
                    y1={ray.ySplit}
                    x2={ray.x2}
                    y2={ray.y2}
                    stroke="#D9463E"
                    strokeWidth="0.6"
                    opacity="0.45"
                  />
                )}
              </g>
            ))}
          </g>

          {/* PSR Micro-Labels inside Cold Traps */}
          {MAJOR_SOUTH_POLE_CRATERS.filter((c) => c.hasPsr).map((c) => {
            const p = projectToSvg(c.lat, c.lon);
            return (
              <text
                key={c.name}
                x={p.svgX}
                y={p.svgY + 2.5}
                fill="rgba(40, 158, 142, 0.75)"
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

          {/* Benchmark Site Markers (Inactive Sites: 11px bold JetBrains Mono inside dark pill badge with 1px solid #4A5264) */}
          {benchmarkSites.map((siteItem) => {
            const { svgX, svgY } = projectToSvg(siteItem.lat, siteItem.lon);
            const badgeW = siteItem.name.length * 7.5 + 16;
            const badgeH = 20;
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
                <g transform="translate(8, -10)">
                  <rect
                    x="0"
                    y="0"
                    width={badgeW}
                    height={badgeH}
                    fill="rgba(17, 19, 24, 0.88)"
                    stroke="#4A5264"
                    strokeWidth="1"
                    rx="4"
                  />
                  <text
                    x={badgeW / 2}
                    y="14"
                    fill="#ECE9E2"
                    fontSize="11"
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {siteItem.name}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Active Target Reticle & Crisp Pill Badge (11px bold JetBrains Mono inside dark pill badge with 1px solid #E59A23) */}
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

            {/* Crisp Active Target Badge */}
            <g transform="translate(18, -14)">
              <rect
                x="0"
                y="0"
                width={150}
                height="32"
                fill="rgba(17, 19, 24, 0.88)"
                stroke="#E59A23"
                strokeWidth="1"
                rx="4"
              />
              <text
                x="10"
                y="15"
                fill="#ECE9E2"
                fontSize="11"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="bold"
              >
                {selectedSite.name}
              </text>
              <text
                x="10"
                y="27"
                fill="#A4AFBF"
                fontSize="9"
                fontFamily="'JetBrains Mono', monospace"
              >
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
            <strong className="solar">{currentSun.azimuthDeg.toFixed(1)}° / {formatSignedDeg(currentSun.elevationDeg, 1)}</strong>
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

        {/* Bottom-Right Inset — True 3D Isometric Crater Hologram */}
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
            <CraterTerrain3D shadingMode={insetHazardMode} compact={true} />
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
              SOLAR VECTORS ({formatSignedDeg(currentSun.elevationDeg, 1)})
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
