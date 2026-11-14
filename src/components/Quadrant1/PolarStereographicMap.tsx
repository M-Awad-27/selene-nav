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

// Deterministic Pseudo-Random Generator for 85 Secondary Craters
function createSecondaryCraters() {
  const craters: { lat: number; lon: number; radiusKm: number }[] = [];
  let seed = 42;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < 88; i++) {
    const lat = -80.0 - rnd() * 9.5;
    const lon = rnd() * 360.0 - 180.0;
    const radiusKm = 4.0 + rnd() * 14.0;
    craters.push({ lat, lon, radiusKm });
  }
  return craters;
}

const SECONDARY_CRATERS = createSecondaryCraters();

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

  // 1. Generate Gritty High-Contrast Regolith Albedo & Hillshade Texture Buffer (Offscreen)
  useEffect(() => {
    const size = VIEWBOX_SIZE;
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const octx = offscreen.getContext('2d');
    if (!octx) return;

    // A. Deep Void Background
    octx.fillStyle = '#090A0D';
    octx.fillRect(0, 0, size, size);

    const plateRadius = CENTER - 26;

    // B. Pixel-Level Regolith Albedo & Hillshade Texture Generator
    // Multi-octave pseudo-fractal noise with directional hillshading from Azimuth 135°
    const imgData = octx.createImageData(size, size);
    const data = imgData.data;

    // Directional light vector from Azimuth 135° (top-right to bottom-left)
    const sunAngle = (135.0 * Math.PI) / 180.0;
    const lx = Math.sin(sunAngle); // ~0.707
    const ly = -Math.cos(sunAngle); // ~0.707

    // Fast deterministic 2D noise generator
    const hash = (x: number, y: number) => {
      const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };

    const smoothNoise = (x: number, y: number) => {
      const i = Math.floor(x);
      const j = Math.floor(y);
      const fx = x - i;
      const fy = y - j;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);

      const a = hash(i, j);
      const b = hash(i + 1, j);
      const c = hash(i, j + 1);
      const d = hash(i + 1, j + 1);

      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };

    const fbm = (x: number, y: number) => {
      return (
        0.50 * smoothNoise(x, y) +
        0.28 * smoothNoise(x * 2.2, y * 2.2) +
        0.14 * smoothNoise(x * 4.5, y * 4.5) +
        0.08 * smoothNoise(x * 9.0, y * 9.0)
      );
    };

    for (let py = 0; py < size; py += 2) {
      const dy = py - CENTER;
      for (let px = 0; px < size; px += 2) {
        const dx = px - CENTER;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= plateRadius) {
          // Normalize coordinates
          const nx = dx / plateRadius;
          const ny = dy / plateRadius;

          // Heightfield: macro-depression at pole + mountain massifs + multi-octave regolith roughness
          const scale = 7.5;
          const h = fbm(nx * scale + 10, ny * scale + 10);
          const hR = fbm((nx + 0.015) * scale + 10, ny * scale + 10);
          const hU = fbm(nx * scale + 10, (ny + 0.015) * scale + 10);

          // Hillshade gradient
          const dhdx = (hR - h) / 0.015;
          const dhdy = (hU - h) / 0.015;
          const hillshade = 0.5 + 0.45 * (dhdx * lx + dhdy * ly);

          // Lunar Basalt & Anorthosite Regolith Palette (#1E222A to #6E7582)
          // Gritty dark-grey/silver basalt
          const normDist = dist / plateRadius;
          const limbDarkening = 1.0 - Math.pow(normDist, 3.5) * 0.45;
          const intensity = Math.max(0.12, Math.min(0.92, (0.28 + h * 0.42 + hillshade * 0.38) * limbDarkening));

          const r = Math.floor(30 + intensity * 80);
          const g = Math.floor(34 + intensity * 83);
          const b = Math.floor(42 + intensity * 88);

          // Write 2x2 pixel block for crisp resolution and high performance
          for (let oy = 0; oy < 2; oy++) {
            for (let ox = 0; ox < 2; ox++) {
              const idx = ((py + oy) * size + (px + ox)) * 4;
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
              data[idx + 3] = 255;
            }
          }
        }
      }
    }

    octx.putImageData(imgData, 0, 0);
    offscreenCanvasRef.current = offscreen;
  }, []);

  // 2. Draw Realistic LOLA Craters, Shadow Crescents, PSRs and Massifs onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = VIEWBOX_SIZE;
    canvas.width = size;
    canvas.height = size;

    // Draw precomputed gritty regolith albedo base
    if (offscreenCanvasRef.current) {
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
    } else {
      ctx.fillStyle = '#1A1D24';
      ctx.fillRect(0, 0, size, size);
    }

    const plateRadius = CENTER - 26;

    ctx.save();
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, plateRadius, 0, Math.PI * 2);
    ctx.clip();

    // Fixed Sun Direction Vector: Azimuth 135° (standard LOLA hillshading convention)
    const sunAzRad = (135.0 * Math.PI) / 180.0;
    const sunDx = Math.sin(sunAzRad); // ~0.707
    const sunDy = -Math.cos(sunAzRad); // ~0.707

    // A. Draw 85 Secondary Craters (Flat floor #161920, sunlit rim #9BA3B0, shadow crescent #090A0D)
    SECONDARY_CRATERS.forEach((sc) => {
      const { svgX, svgY } = projectToSvg(sc.lat, sc.lon);
      const rPx = Math.max(3.5, (sc.radiusKm / RHO_MAX_KM) * (CENTER - 28));

      // Crater floor
      ctx.fillStyle = '#161920';
      ctx.beginPath();
      ctx.arc(svgX, svgY, rPx, 0, Math.PI * 2);
      ctx.fill();

      // Leeward dark shadow crescent (#090A0D)
      ctx.fillStyle = '#090A0D';
      ctx.beginPath();
      ctx.arc(svgX - sunDx * rPx * 0.25, svgY - sunDy * rPx * 0.25, rPx * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Sunlit outer rim highlight (#9BA3B0)
      ctx.strokeStyle = '#9BA3B0';
      ctx.lineWidth = Math.max(1.0, rPx * 0.22);
      ctx.beginPath();
      ctx.arc(svgX + sunDx * rPx * 0.1, svgY + sunDy * rPx * 0.1, rPx, sunAzRad - Math.PI * 0.45, sunAzRad + Math.PI * 0.45);
      ctx.stroke();
    });

    // B. Draw Cryo-Indigo Permanently Shadowed Region (PSR) Central Basin
    const psrBasinCoords = [
      projectToSvg(-89.9, 0),
      projectToSvg(-89.3, 70),
      projectToSvg(-87.8, 50),
      projectToSvg(-86.8, 72),
      projectToSvg(-87.1, 125),
      projectToSvg(-88.8, 140),
      projectToSvg(-89.4, -30),
      projectToSvg(-88.3, -65),
      projectToSvg(-87.2, -10),
      projectToSvg(-87.7, 25),
    ];

    ctx.save();
    ctx.beginPath();
    psrBasinCoords.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.svgX, pt.svgY);
      else ctx.lineTo(pt.svgX, pt.svgY);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(20, 42, 78, 0.72)';
    ctx.fill();
    ctx.strokeStyle = '#289E8E';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // C. Draw Major South Pole Craters with Full Realistic Morphology
    MAJOR_SOUTH_POLE_CRATERS.forEach((crater) => {
      const { svgX, svgY } = projectToSvg(crater.lat, crater.lon);
      const rPx = Math.max(12, (crater.radiusKm / RHO_MAX_KM) * (CENTER - 28));

      // 1. Crater outer cast shadow on leeward ground
      const castShadowGrad = ctx.createRadialGradient(
        svgX - sunDx * rPx * 0.5,
        svgY - sunDy * rPx * 0.5,
        rPx * 0.6,
        svgX,
        svgY,
        rPx * 1.45
      );
      castShadowGrad.addColorStop(0, 'rgba(9, 10, 13, 0.85)');
      castShadowGrad.addColorStop(0.65, 'rgba(9, 10, 13, 0.45)');
      castShadowGrad.addColorStop(1, 'rgba(9, 10, 13, 0)');
      ctx.fillStyle = castShadowGrad;
      ctx.beginPath();
      ctx.arc(svgX, svgY, rPx * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // 2. Textured Flat Crater Floor (#161920)
      ctx.fillStyle = '#161920';
      ctx.beginPath();
      ctx.arc(svgX, svgY, rPx * 0.95, 0, Math.PI * 2);
      ctx.fill();

      // 3. Steep Dark Inner Shadow Crescent on Opposite Wall (#090A0D)
      ctx.fillStyle = '#090A0D';
      ctx.beginPath();
      ctx.arc(svgX - sunDx * rPx * 0.32, svgY - sunDy * rPx * 0.32, rPx * 0.82, 0, Math.PI * 2);
      ctx.fill();

      // 4. Cryo-Indigo Permanently Shadowed Region Floor (if applicable)
      if (crater.hasPsr) {
        ctx.fillStyle = 'rgba(20, 42, 78, 0.72)';
        ctx.beginPath();
        ctx.arc(svgX - sunDx * rPx * 0.15, svgY - sunDy * rPx * 0.15, rPx * 0.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#289E8E';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 5. Central Mountain Peak (if applicable)
      if (crater.hasPeak) {
        ctx.fillStyle = '#090A0D';
        ctx.beginPath();
        ctx.arc(svgX - 1.5, svgY - 1.5, Math.max(2, rPx * 0.12), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#9BA3B0';
        ctx.beginPath();
        ctx.arc(svgX + 1, svgY + 1, Math.max(1.8, rPx * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. Bright Sunlit Outer Rim Wall on Sunward Side (#9BA3B0)
      ctx.strokeStyle = '#9BA3B0';
      ctx.lineWidth = Math.max(2.2, rPx * 0.15);
      ctx.beginPath();
      ctx.arc(
        svgX + sunDx * rPx * 0.08,
        svgY + sunDy * rPx * 0.08,
        rPx,
        sunAzRad - Math.PI * 0.52,
        sunAzRad + Math.PI * 0.52
      );
      ctx.stroke();

      // Highlight peak on the rim crest
      ctx.strokeStyle = '#CCD5E2';
      ctx.lineWidth = Math.max(1.0, rPx * 0.07);
      ctx.beginPath();
      ctx.arc(
        svgX + sunDx * rPx * 0.08,
        svgY + sunDy * rPx * 0.08,
        rPx,
        sunAzRad - Math.PI * 0.25,
        sunAzRad + Math.PI * 0.25
      );
      ctx.stroke();
    });

    // D. Prominent Massif Ridges (Malapert Massif & Mons Mouton)
    const malapert = projectToSvg(-86.0, 0.0);
    ctx.strokeStyle = 'rgba(247, 185, 85, 0.85)';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.ellipse(malapert.svgX, malapert.svgY, 26, 11, -Math.PI / 5, 0, Math.PI * 2);
    ctx.stroke();

    const mouton = projectToSvg(-84.6, -30.0);
    ctx.strokeStyle = 'rgba(155, 163, 176, 0.85)';
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.ellipse(mouton.svgX, mouton.svgY, 24, 13, Math.PI / 4, 0, Math.PI * 2);
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

  // 3. Dense 360° Raycast Fan (120 rays, 3° increments, 0.6px width)
  // Colored #E59A23 (amber) until crater rim obstruction, and #D9463E (vermilion) behind rim obstruction
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

      // Detect if ray intersects any major crater rim
      let minObstructionDist = maxLen;
      let hasObstruction = false;

      // Active site local rim distance (e.g. Shackleton rim is ~22px from center)
      const isShackletonArea = Math.abs(activeCoord.lat + 89.54) < 0.3;
      if (isShackletonArea) {
        // Rays heading out of the rim are blocked by opposite rim between az 160°..340°
        if (az > 140 && az < 330) {
          minObstructionDist = 24 + Math.sin(azRad * 2) * 6;
          hasObstruction = true;
        }
      }

      // Check intersection against other major craters
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
        {/* High-Contrast LOLA Grayscale Canvas */}
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
                {/* Unblocked segment (amber #E59A23) */}
                <line
                  x1={ray.x1}
                  y1={ray.y1}
                  x2={ray.xSplit}
                  y2={ray.ySplit}
                  stroke="#E59A23"
                  strokeWidth="0.6"
                  opacity="0.65"
                />
                {/* Obstructed shadow segment (vermilion #D9463E) */}
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
                fill="#289E8E"
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
