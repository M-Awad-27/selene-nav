import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useMissionStore } from '../../store/missionStore';
import { SOLAR_CONSTANT_W_M2 } from '../../engine/lunarEphemeris';

type SimPhase = 'pdl' | 'touchdown' | 'rover';

export const DescentRoverSimulator: React.FC = () => {
  const isSimulationOpen = useMissionStore((s) => s.isSimulationOpen);
  const setIsSimulationOpen = useMissionStore((s) => s.setIsSimulationOpen);
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const sitesRegistry = useMissionStore((s) => s.sitesRegistry);
  const customCoordinate = useMissionStore((s) => s.customCoordinate);
  const mastHeightMeters = useMissionStore((s) => s.mastHeightMeters);
  const currentSun = useMissionStore((s) => s.currentSun);
  const currentEarth = useMissionStore((s) => s.currentEarth);
  const currentDteActive = useMissionStore((s) => s.currentDteActive);
  const simulationDate = useMissionStore((s) => s.simulationDate);

  // Active target site
  const site = useMemo(() => {
    if (customCoordinate) {
      return {
        name: `Custom [${customCoordinate.latDeg.toFixed(2)}°, ${customCoordinate.lonDeg.toFixed(2)}°]`,
        lat: customCoordinate.latDeg,
        lon: customCoordinate.lonDeg,
        elevationKm: customCoordinate.elevationKm,
        slopeDeg: 4.2,
      };
    }
    const found = sitesRegistry.find((s) => s.id === selectedSiteId);
    return found || {
      name: 'Shackleton Rim',
      lat: -89.54,
      lon: 137.0,
      elevationKm: 1.25,
      slopeDeg: 4.2,
    };
  }, [selectedSiteId, sitesRegistry, customCoordinate]);

  // Phase & Playback state
  const [activePhase, setActivePhase] = useState<SimPhase>('pdl');
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState<number>(1); // 1x, 2x, 5x, 10x

  // Phase 1 Time: T-180s to T-0s (0 to 180)
  const [pdlTime, setPdlTime] = useState<number>(0);

  // Phase 2 Deployment Progress: 0% to 100%
  const [deployProgress, setDeployProgress] = useState<number>(0);

  // Phase 3 Rover Traverse Progress: 0 to 100%
  const [roverProgress, setRoverProgress] = useState<number>(0);
  const [activeWaypointIdx, setActiveWaypointIdx] = useState<number>(0);

  // Trajectory Profile Canvas
  const trajectoryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const navballCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const roverCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-advance loop when playing
  useEffect(() => {
    if (!isPlaying || !isSimulationOpen) return;

    const interval = setInterval(() => {
      if (activePhase === 'pdl') {
        setPdlTime((t) => {
          const next = t + 0.5 * simSpeed;
          if (next >= 180) {
            setIsPlaying(false);
            return 180;
          }
          return next;
        });
      } else if (activePhase === 'touchdown') {
        setDeployProgress((p) => {
          const next = p + 1.2 * simSpeed;
          if (next >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return next;
        });
      } else if (activePhase === 'rover') {
        setRoverProgress((p) => {
          const next = p + 0.8 * simSpeed;
          if (next >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return next;
        });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, isSimulationOpen, activePhase, simSpeed]);

  // Keep waypoint in sync with rover progress
  useEffect(() => {
    if (roverProgress < 25) setActiveWaypointIdx(0);
    else if (roverProgress < 50) setActiveWaypointIdx(1);
    else if (roverProgress < 75) setActiveWaypointIdx(2);
    else setActiveWaypointIdx(3);
  }, [roverProgress]);

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 1: POWERED DESCENT PHYSICS SOLVER
  // ──────────────────────────────────────────────────────────────────────────
  // t: 0 -> 180 seconds
  const pdlPhysics = useMemo(() => {
    const t = pdlTime; // 0 to 180s

    let stage: 1 | 2 | 3 = 1;
    let stageName = 'STAGE 1: HIGH-GATE BRAKING BURN';
    let altM = 15000;
    let downrangeM = 30000;
    let vx = 1600; // m/s horizontal
    let vz = -65;  // m/s vertical
    let pitchDeg = 18; // degrees from horizontal
    let throttlePct = 95;
    let lidarScanActive = false;
    let enginePlumeScale = 1.0;

    if (t < 100) {
      // Stage 1: Braking Burn (15 km -> 3 km)
      stage = 1;
      stageName = 'STAGE 1: HIGH-GATE BRAKING BURN';
      const f = t / 100;
      altM = 15000 - f * 12000; // 15,000m -> 3,000m
      downrangeM = 30000 - f * 25000; // 30 km -> 5 km
      vx = 1600 - f * 1350; // 1600 -> 250 m/s
      vz = -65 + f * 40;   // -65 -> -25 m/s
      pitchDeg = 18 + f * 27; // 18° -> 45°
      throttlePct = 95 - f * 15; // 95% -> 80%
      lidarScanActive = false;
      enginePlumeScale = 0.95;
    } else if (t < 155) {
      // Stage 2: Pitch-Up & LiDAR Scan (3 km -> 150 m)
      stage = 2;
      stageName = 'STAGE 2: PITCH-UP & HAZARD DETECTION LIDAR SCAN';
      const f = (t - 100) / 55;
      altM = 3000 - f * 2850; // 3,000m -> 150m
      downrangeM = 5000 - f * 4700; // 5,000m -> 300m
      vx = 250 - f * 238; // 250 -> 12 m/s
      vz = -25 + f * 20;  // -25 -> -5 m/s
      pitchDeg = 45 + f * 40; // 45° -> 85° (nearly upright)
      throttlePct = 80 - f * 35; // 80% -> 45%
      lidarScanActive = true;
      enginePlumeScale = 0.65;
    } else {
      // Stage 3: Terminal Vertical Descent (150 m -> 0 m)
      stage = 3;
      stageName = 'STAGE 3: TERMINAL VERTICAL DESCENT';
      const f = Math.min(1, (t - 155) / 25);
      altM = Math.max(0, 150 - f * 150);
      downrangeM = Math.max(0, 300 - f * 300);
      vx = Math.max(0, 12 - f * 12);
      vz = altM <= 1.5 ? 0 : -1.2; // constant rate -1.2 m/s
      pitchDeg = 88 + f * 2; // 90° upright
      throttlePct = altM <= 1.5 ? 0 : 35 - f * 10;
      lidarScanActive = true;
      enginePlumeScale = altM <= 1.5 ? 0 : 0.35;
    }

    const propRemainingKg = Math.max(85, 820 - t * 4.05);
    const propPct = (propRemainingKg / 820) * 100;

    return {
      tSeconds: t,
      tRemaining: Math.max(0, 180 - t),
      stage,
      stageName,
      altM: Math.round(altM),
      downrangeM: Math.round(downrangeM),
      vx: Math.round(vx * 10) / 10,
      vz: Math.round(vz * 10) / 10,
      pitchDeg: Math.round(pitchDeg * 10) / 10,
      throttlePct: Math.round(throttlePct),
      propRemainingKg: Math.round(propRemainingKg),
      propPct: Math.round(propPct * 10) / 10,
      lidarScanActive,
      enginePlumeScale,
      isLanded: t >= 180,
    };
  }, [pdlTime]);

  // ──────────────────────────────────────────────────────────────────────────
  // DRAW TRAJECTORY PROFILE CANVAS (ALTITUDE VS DOWNRANGE)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activePhase !== 'pdl') return;
    const canvas = trajectoryCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Deep void space background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#090A0D');
    bgGrad.addColorStop(0.7, '#0D1017');
    bgGrad.addColorStop(1, '#151922');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Padding
    const padL = 50;
    const padR = 25;
    const padT = 30;
    const padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Coordinate transforms:
    // Downrange: 30 km (left) -> 0 km (right)
    const xToPx = (drM: number) => padL + (1 - drM / 30000) * plotW;
    // Altitude: 0 m (bottom) -> 15000 m (top)
    const yToPx = (altM: number) => padT + (1 - altM / 15000) * plotH;

    // Grid lines
    ctx.strokeStyle = 'rgba(74, 82, 100, 0.25)';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([3, 4]);

    // Alt lines (0, 3k, 6k, 9k, 12k, 15k)
    for (let alt = 0; alt <= 15000; alt += 3000) {
      const y = yToPx(alt);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();

      ctx.fillStyle = 'var(--text-muted)';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${alt / 1000}km`, padL - 6, y + 3);
    }

    // Downrange lines (30km, 20km, 10km, 0km)
    for (let dr = 0; dr <= 30000; dr += 10000) {
      const x = xToPx(dr);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, h - padB);
      ctx.stroke();

      ctx.fillStyle = 'var(--text-muted)';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${dr / 1000}km`, x, h - padB + 14);
    }
    ctx.setLineDash([]);

    // ── LOLA Mountain Cross-Section Terrain Underneath Trajectory ──
    ctx.beginPath();
    ctx.moveTo(padL, h - padB);
    for (let px = padL; px <= w - padR; px += 4) {
      const normX = (px - padL) / plotW; // 0 to 1
      // Topographic cross-section of South Pole Massif and Crater Rims
      const peak1 = Math.exp(-Math.pow(normX - 0.35, 2) / 0.015) * 2800; // Malapert ridge
      const peak2 = Math.exp(-Math.pow(normX - 0.72, 2) / 0.008) * 1900; // Outer crater rim
      const craterFloor = normX > 0.85 ? -400 : 0;
      const noise = Math.sin(normX * 35) * 80 + Math.cos(normX * 70) * 45;
      const terrainAlt = Math.max(0, 350 + peak1 + peak2 + craterFloor + noise);
      const ty = yToPx(terrainAlt);
      ctx.lineTo(px, ty);
    }
    ctx.lineTo(w - padR, h - padB);
    ctx.closePath();

    const terrainGrad = ctx.createLinearGradient(0, yToPx(3500), 0, h - padB);
    terrainGrad.addColorStop(0, '#262D3B');
    terrainGrad.addColorStop(0.5, '#191E28');
    terrainGrad.addColorStop(1, '#0F1218');
    ctx.fillStyle = terrainGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(164, 175, 191, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // ── Pre-Computed Nominal Flight Trajectory Arc ──
    ctx.beginPath();
    for (let t = 0; t <= 180; t += 2) {
      let alt = 0;
      let dr = 0;
      if (t < 100) {
        const f = t / 100;
        alt = 15000 - f * 12000;
        dr = 30000 - f * 25000;
      } else if (t < 155) {
        const f = (t - 100) / 55;
        alt = 3000 - f * 2850;
        dr = 5000 - f * 4700;
      } else {
        const f = (t - 155) / 25;
        alt = Math.max(0, 150 - f * 150);
        dr = Math.max(0, 300 - f * 300);
      }
      const x = xToPx(dr);
      const y = yToPx(alt);
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(76, 201, 184, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Current Lander Position & Plume ──
    const landerX = xToPx(pdlPhysics.downrangeM);
    const landerY = yToPx(pdlPhysics.altM);

    // Hazard scanning LiDAR cone when active (Stage 2 & 3)
    if (pdlPhysics.lidarScanActive) {
      const coneHeight = Math.min(180, (h - padB) - landerY);
      const coneWidth = coneHeight * 0.48;

      const coneGrad = ctx.createLinearGradient(landerX, landerY, landerX, landerY + coneHeight);
      coneGrad.addColorStop(0, 'rgba(76, 201, 184, 0.55)');
      coneGrad.addColorStop(1, 'rgba(76, 201, 184, 0.02)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(landerX, landerY + 4);
      ctx.lineTo(landerX - coneWidth, landerY + coneHeight);
      ctx.lineTo(landerX + coneWidth, landerY + coneHeight);
      ctx.closePath();
      ctx.fillStyle = coneGrad;
      ctx.fill();

      // Sweeping LiDAR laser scan line
      const sweepY = landerY + ((Date.now() / 8) % coneHeight);
      ctx.strokeStyle = '#4CC9B8';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      const sweepFrac = (sweepY - landerY) / coneHeight;
      const swW = coneWidth * sweepFrac;
      ctx.moveTo(landerX - swW, sweepY);
      ctx.lineTo(landerX + swW, sweepY);
      ctx.stroke();
      ctx.restore();
    }

    // Engine Thrust Vector Plume
    if (pdlPhysics.enginePlumeScale > 0) {
      const plumeLen = 22 * pdlPhysics.enginePlumeScale;
      ctx.save();
      ctx.translate(landerX, landerY);
      ctx.rotate(((-pdlPhysics.pitchDeg + 90) * Math.PI) / 180);

      const plumeGrad = ctx.createLinearGradient(0, 0, 0, plumeLen);
      plumeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      plumeGrad.addColorStop(0.3, 'rgba(247, 185, 85, 0.85)');
      plumeGrad.addColorStop(0.8, 'rgba(217, 70, 62, 0.65)');
      plumeGrad.addColorStop(1, 'rgba(217, 70, 62, 0)');

      ctx.beginPath();
      ctx.moveTo(-3, 4);
      ctx.lineTo(0, 4 + plumeLen);
      ctx.lineTo(3, 4);
      ctx.fillStyle = plumeGrad;
      ctx.fill();
      ctx.restore();
    }

    // Regolith dust dispersion plume at touchdown
    if (pdlPhysics.isLanded) {
      ctx.save();
      for (let i = 0; i < 18; i++) {
        const dustX = landerX + (Math.sin(i * 1.8) * 35);
        const dustY = landerY - Math.abs(Math.cos(i * 1.4) * 16);
        ctx.fillStyle = 'rgba(200, 210, 225, 0.45)';
        ctx.beginPath();
        ctx.arc(dustX, dustY, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Lander Icon
    ctx.save();
    ctx.translate(landerX, landerY);
    ctx.rotate(((-pdlPhysics.pitchDeg + 90) * Math.PI) / 180);

    // Lander octagonal body
    ctx.fillStyle = '#E59A23';
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(6, -4);
    ctx.lineTo(8, 2);
    ctx.lineTo(6, 6);
    ctx.lineTo(-6, 6);
    ctx.lineTo(-8, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ECE9E2';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 4 Landing gear legs
    ctx.strokeStyle = '#ECE9E2';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-6, 4); ctx.lineTo(-12, 10); ctx.lineTo(-14, 10);
    ctx.moveTo(6, 4); ctx.lineTo(12, 10); ctx.lineTo(14, 10);
    ctx.stroke();

    ctx.restore();

    // Target Touchdown Reticle at ground (0m)
    const targetX = xToPx(0);
    const targetY = yToPx(0);
    ctx.strokeStyle = '#F7B955';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#F7B955';
    ctx.beginPath();
    ctx.arc(targetX, targetY, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'var(--accent-solar-hi)';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TARGET', targetX, targetY + 16);
  }, [activePhase, pdlPhysics]);

  // ──────────────────────────────────────────────────────────────────────────
  // DRAW ARTIFICIAL HORIZON / NAVBALL ATTITUDE INDICATOR
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activePhase !== 'pdl') return;
    const canvas = navballCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - 6;

    ctx.clearRect(0, 0, w, h);

    // Circular Clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Rotate by roll (simulated ~0° roll) and pitch
    ctx.translate(cx, cy);
    const pitchOffset = (pdlPhysics.pitchDeg - 45) * 0.9;
    ctx.translate(0, -pitchOffset);

    // Sky (cyan/blue) & Ground (brown/grey)
    ctx.fillStyle = '#1E3A5F'; // Sky
    ctx.fillRect(-r * 2, -r * 3, r * 4, r * 3);
    ctx.fillStyle = '#3E2A1A'; // Ground
    ctx.fillRect(-r * 2, 0, r * 4, r * 3);

    // Horizon line
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();

    // Pitch ladder bars (-30, -15, +15, +30)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.0;
    [-30, -15, 15, 30].forEach((deg) => {
      const y = -deg * 1.5;
      ctx.beginPath();
      ctx.moveTo(-16, y); ctx.lineTo(16, y);
      ctx.stroke();
    });

    ctx.restore();

    // Fixed Outer Reticle & Bezel
    ctx.strokeStyle = '#4A5264';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Center Crosshair Wings
    ctx.strokeStyle = '#F7B955';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy); ctx.lineTo(cx - 8, cy); ctx.lineTo(cx - 4, cy + 4);
    ctx.moveTo(cx + 20, cy); ctx.lineTo(cx + 8, cy); ctx.lineTo(cx + 4, cy + 4);
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.stroke();
  }, [activePhase, pdlPhysics.pitchDeg]);

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 3: DRAW ROVER SURFACE TRAVERSE CANVAS
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activePhase !== 'rover') return;
    const canvas = roverCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Lunar terrain background
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    bgGrad.addColorStop(0, '#262D38');
    bgGrad.addColorStop(0.7, '#181C24');
    bgGrad.addColorStop(1, '#0C0E12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Deep PSR Shadow Zone (Right half of the crater basin)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w * 0.72, h * 0.52, w * 0.35, h * 0.42, Math.PI / 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(11, 26, 48, 0.78)';
    ctx.fill();
    ctx.strokeStyle = '#4CC9B8';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#4CC9B8';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText('PERMANENTLY SHADOWED REGION (PSR)', w * 0.52, h * 0.22);
    ctx.font = '7.5px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(76, 201, 184, 0.7)';
    ctx.fillText('CRYO-TEMP: 40 K (-233°C) · ICE DEPOSITS', w * 0.52, h * 0.28);
    ctx.restore();

    // 4 Key Waypoints
    const waypoints = [
      { x: w * 0.15, y: h * 0.65, label: 'WP-01: LANDER RIM' },
      { x: w * 0.35, y: h * 0.50, label: 'WP-02: CONNECTING RIDGE' },
      { x: w * 0.56, y: h * 0.42, label: 'WP-03: PSR CREST DROP' },
      { x: w * 0.82, y: h * 0.68, label: 'WP-04: DEEP PSR FLOOR' },
    ];

    // Traverse Track Line
    ctx.beginPath();
    waypoints.forEach((wp, i) => {
      if (i === 0) ctx.moveTo(wp.x, wp.y);
      else ctx.lineTo(wp.x, wp.y);
    });
    ctx.strokeStyle = 'rgba(247, 185, 85, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Waypoint Markers
    waypoints.forEach((wp, i) => {
      const isReached = roverProgress >= (i * 30);
      const isActive = activeWaypointIdx === i;

      ctx.beginPath();
      ctx.arc(wp.x, wp.y, isActive ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#F7B955' : isReached ? '#4CC9B8' : '#4A5264';
      ctx.fill();
      ctx.strokeStyle = '#090A0D';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = isActive ? '#F7B955' : '#ECE9E2';
      ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(wp.label, wp.x, wp.y - 8);
    });

    // Current Rover Position interpolated along waypoints
    const totalWps = waypoints.length - 1;
    const globalFrac = roverProgress / 100;
    const segIdx = Math.min(totalWps - 1, Math.floor(globalFrac * totalWps));
    const segFrac = (globalFrac * totalWps) - segIdx;

    const pA = waypoints[segIdx];
    const pB = waypoints[segIdx + 1];
    const roverX = pA.x + (pB.x - pA.x) * segFrac;
    const roverY = pA.y + (pB.y - pA.y) * segFrac;

    // Rover Headlight Beams in Dark Zone
    if (roverProgress > 50) {
      const beamGrad = ctx.createRadialGradient(roverX, roverY, 2, roverX + 35, roverY, 45);
      beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
      beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.beginPath();
      ctx.moveTo(roverX, roverY);
      ctx.arc(roverX, roverY, 45, -Math.PI / 6, Math.PI / 6);
      ctx.closePath();
      ctx.fillStyle = beamGrad;
      ctx.fill();
    }

    // Rover Vehicle Icon (6-wheel chassis)
    ctx.save();
    ctx.translate(roverX, roverY);
    ctx.fillStyle = '#ECE9E2';
    ctx.fillRect(-8, -5, 16, 10);
    ctx.fillStyle = '#E59A23';
    ctx.fillRect(-6, -3, 6, 6);
    // Wheels
    ctx.fillStyle = '#4A5264';
    [-8, 0, 8].forEach((wx) => {
      ctx.fillRect(wx - 2, -7, 4, 3);
      ctx.fillRect(wx - 2, 4, 4, 3);
    });
    // Mast
    ctx.strokeStyle = '#4CC9B8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, 0); ctx.lineTo(8, -8);
    ctx.stroke();
    ctx.restore();
  }, [activePhase, roverProgress, activeWaypointIdx]);

  if (!isSimulationOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(9, 10, 13, 0.95)',
        backdropFilter: 'blur(12px)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 14px',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* ── Top Header Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-hairline)',
          paddingBottom: '8px',
          marginBottom: '8px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 'bold', fontSize: '0.95rem', letterSpacing: '0.06em' }}>
            ALRAKIS // POWERED DESCENT & ROVER SIMULATION DECK
          </span>
          <span className="badge-precomputed" style={{ fontSize: '0.58rem', padding: '0.12rem 0.45rem' }}>
            AEROSPACE DIGITAL TWIN [v2.6]
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--accent-solar-hi)' }}>
            TARGET: {site.name.toUpperCase()} ({site.lat.toFixed(2)}°S, {site.lon.toFixed(2)}°E)
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.60rem', color: 'var(--text-muted)' }}>
            | EPOCH: {simulationDate.toISOString().replace('T', ' ').slice(0, 19)} UTC | SUN EL: {currentSun.elevationDeg >= 0 ? '+' : ''}{currentSun.elevationDeg.toFixed(1)}° | EARTH EL: {currentEarth.elevationDeg >= 0 ? '+' : ''}{currentEarth.elevationDeg.toFixed(1)}° ({currentDteActive ? 'DTE LOCK' : 'OCCULTED'})
          </span>
        </div>

        <button
          className="btn-tactical-primary"
          style={{ padding: '0.25rem 0.7rem', fontSize: '0.64rem' }}
          onClick={() => setIsSimulationOpen(false)}
        >
          ✕ CLOSE SIMULATION
        </button>
      </div>

      {/* ── Phase Switcher Tabs + Master Playback Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-surface-2)',
          border: '1px solid var(--border-hairline)',
          padding: '4px 10px',
          borderRadius: '2px',
          marginBottom: '8px',
          flexShrink: 0,
        }}
      >
        {/* Phase Tabs */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className={activePhase === 'pdl' ? 'persona-btn-active' : 'persona-btn-inactive'}
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.62rem' }}
            onClick={() => { setActivePhase('pdl'); setIsPlaying(false); }}
          >
            01 // POWERED DESCENT & LANDING
          </button>
          <button
            className={activePhase === 'touchdown' ? 'persona-btn-active' : 'persona-btn-inactive'}
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.62rem' }}
            onClick={() => { setActivePhase('touchdown'); setIsPlaying(false); }}
          >
            02 // TOUCHDOWN & MAST DEPLOYMENT
          </button>
          <button
            className={activePhase === 'rover' ? 'persona-btn-active' : 'persona-btn-inactive'}
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.62rem' }}
            onClick={() => { setActivePhase('rover'); setIsPlaying(false); }}
          >
            03 // POLAR ROVER SURFACE TRAVERSE
          </button>
        </div>

        {/* Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn-tactical-secondary"
            style={{ padding: '0.22rem 0.55rem', fontSize: '0.62rem' }}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
          </button>
          <button
            className="btn-tactical-secondary"
            style={{ padding: '0.22rem 0.45rem', fontSize: '0.62rem' }}
            onClick={() => {
              setIsPlaying(false);
              if (activePhase === 'pdl') setPdlTime(0);
              else if (activePhase === 'touchdown') setDeployProgress(0);
              else setRoverProgress(0);
            }}
          >
            ↺ RESET
          </button>

          {/* Speed Selector */}
          <div style={{ display: 'flex', gap: '2px', fontFamily: 'var(--font-mono)', fontSize: '0.58rem' }}>
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                style={{
                  background: simSpeed === s ? 'var(--accent-solar)' : 'transparent',
                  color: simSpeed === s ? '#090A0D' : 'var(--text-muted)',
                  border: '1px solid var(--border-hairline)',
                  padding: '2px 5px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
                onClick={() => setSimSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Real-time Clock Indicator */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', minWidth: '90px', textAlign: 'right' }}>
            {activePhase === 'pdl' && (
              <span style={{ color: pdlPhysics.isLanded ? 'var(--status-safe)' : 'var(--accent-solar-hi)' }}>
                {pdlPhysics.isLanded ? 'T-00.0s (TOUCHDOWN)' : `T-${pdlPhysics.tRemaining.toFixed(1)}s`}
              </span>
            )}
            {activePhase === 'touchdown' && (
              <span style={{ color: 'var(--accent-earth-hi)' }}>
                {`DEPLOY: ${Math.round(deployProgress)}%`}
              </span>
            )}
            {activePhase === 'rover' && (
              <span style={{ color: 'var(--accent-solar-hi)' }}>
                {`TRAVERSE: ${Math.round(roverProgress)}%`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Interactive Simulation Area ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '8px' }}>
        {/* Left Side: Dynamic Phase Visualizer Canvas */}
        <div
          className="bento-panel"
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div className="bento-panel-header">
            <span>
              {activePhase === 'pdl' && 'DESCENT TRAJECTORY PROFILE (ALTITUDE VS DOWNRANGE)'}
              {activePhase === 'touchdown' && 'TOUCHDOWN FEASIBILITY & TELESCOPIC MAST DEPLOYMENT'}
              {activePhase === 'rover' && '2.5 KM POLAR ROVER TRAVERSE (RIM TO PSR ICE TRAP)'}
            </span>
            <span style={{ color: 'var(--accent-solar)', fontSize: '0.60rem' }}>
              {activePhase === 'pdl' && pdlPhysics.stageName}
              {activePhase === 'touchdown' && `STABILITY MARGIN: ${(12.0 - site.slopeDeg).toFixed(1)}° (PASS)`}
              {activePhase === 'rover' && `WAYPOINT ${activeWaypointIdx + 1}/4 ACTIVE`}
            </span>
          </div>

          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {/* Phase 1 Canvas */}
            {activePhase === 'pdl' && (
              <canvas
                ref={trajectoryCanvasRef}
                width={820}
                height={420}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            )}

            {/* Phase 2: Touchdown & Mast Deployment Animation */}
            {activePhase === 'touchdown' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: '#0B0D12',
                  padding: '1rem',
                  boxSizing: 'border-box',
                }}
              >
                {/* SVG Animated Lander with Extending Solar Mast */}
                <svg width="420" height="260" viewBox="0 0 420 260" style={{ overflow: 'visible' }}>
                  {/* Ground Surface with Slope */}
                  <line
                    x1="20"
                    y1={210 - Math.tan((site.slopeDeg * Math.PI) / 180) * 160}
                    x2="400"
                    y2={210 + Math.tan((site.slopeDeg * Math.PI) / 180) * 160}
                    stroke="#4A5264"
                    strokeWidth="3"
                  />
                  {/* Ground Fill */}
                  <polygon
                    points={`20,${210 - Math.tan((site.slopeDeg * Math.PI) / 180) * 160} 400,${210 + Math.tan((site.slopeDeg * Math.PI) / 180) * 160} 400,260 20,260`}
                    fill="#151922"
                  />

                  {/* Lander Body rotated to local slope */}
                  <g transform={`translate(210, 200) rotate(${site.slopeDeg})`}>
                    {/* 4 Landing Legs */}
                    <line x1="-30" y1="-10" x2="-65" y2="10" stroke="#ECE9E2" strokeWidth="3" />
                    <line x1="30" y1="-10" x2="65" y2="10" stroke="#ECE9E2" strokeWidth="3" />
                    <ellipse cx="-65" cy="10" rx="8" ry="3" fill="#A4AFBF" />
                    <ellipse cx="65" cy="10" rx="8" ry="3" fill="#A4AFBF" />

                    {/* Lander Main Bus */}
                    <polygon points="-35,-40 35,-40 45, -5 35, 5 -35, 5 -45, -5" fill="#E59A23" stroke="#ECE9E2" strokeWidth="2" />

                    {/* Extending Vertical Telescopic Solar Mast */}
                    {(() => {
                      const maxMastPx = 110;
                      const currentMastPx = (deployProgress / 100) * maxMastPx;
                      const effectiveHeightM = (deployProgress / 100) * mastHeightMeters;
                      const isClearOfShadow = effectiveHeightM >= 3.5;

                      return (
                        <g>
                          {/* Telescopic pole */}
                          <line x1="0" y1="-40" x2="0" y2={-40 - currentMastPx} stroke="#FFFFFF" strokeWidth="3" />

                          {/* Solar Array Panel at Tip */}
                          <g transform={`translate(0, ${-40 - currentMastPx})`}>
                            <rect
                              x="-22"
                              y="-28"
                              width="44"
                              height="28"
                              fill={isClearOfShadow ? '#1E3A5F' : '#0B0D12'}
                              stroke={isClearOfShadow ? '#F7B955' : '#4A5264'}
                              strokeWidth="2"
                              rx="2"
                            />
                            {/* Grid cells on panel */}
                            <line x1="-11" y1="-28" x2="-11" y2="0" stroke="rgba(247, 185, 85, 0.45)" strokeWidth="1" />
                            <line x1="0" y1="-28" x2="0" y2="0" stroke="rgba(247, 185, 85, 0.45)" strokeWidth="1" />
                            <line x1="11" y1="-28" x2="11" y2="0" stroke="rgba(247, 185, 85, 0.45)" strokeWidth="1" />
                            <line x1="-22" y1="-14" x2="22" y2="-14" stroke="rgba(247, 185, 85, 0.45)" strokeWidth="1" />

                            {/* Sunlight Grazing Rays */}
                            {isClearOfShadow && (
                              <g>
                                <line x1="-80" y1="-35" x2="-25" y2="-14" stroke="#F7B955" strokeWidth="2" strokeDasharray="5,3" />
                                <text x="-70" y="-40" fill="#F7B955" fontSize="8" fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                                  SUNLIGHT (1,360 W/m²)
                                </text>
                              </g>
                            )}
                          </g>

                          {/* High-Gain Antenna tracking Earth */}
                          <g transform="translate(25, -45)">
                            <line x1="0" y1="0" x2="16" y2="-20" stroke="#4CC9B8" strokeWidth="2" />
                            <path d="M 12,-26 Q 24,-20 18,-12" stroke="#4CC9B8" strokeWidth="2.5" fill="none" />
                            <circle cx="16" cy="-20" r="2" fill="#4CC9B8" />
                          </g>
                        </g>
                      );
                    })()}
                  </g>
                </svg>

                {/* Status Bar */}
                <div style={{ display: 'flex', gap: '2rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>EXTENDED HEIGHT: </span>
                    <strong style={{ color: 'var(--accent-solar-hi)' }}>
                      {((deployProgress / 100) * mastHeightMeters).toFixed(1)}m / {mastHeightMeters.toFixed(1)}m
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>SOLAR ARRAY FLUX: </span>
                    <strong style={{ color: deployProgress > 40 ? 'var(--status-safe)' : 'var(--status-hazard)' }}>
                      {deployProgress > 40 ? `${SOLAR_CONSTANT_W_M2} W/m² (NOMINAL)` : '0 W/m² (IN SHADOW)'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>EARTH DTE S-BAND: </span>
                    <strong style={{ color: currentDteActive ? 'var(--accent-earth-hi)' : 'var(--status-hazard)' }}>
                      {currentDteActive ? 'LINK LOCKED [256 kbps]' : 'OCCULTED BY CRATER RIM'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 3 Canvas */}
            {activePhase === 'rover' && (
              <canvas
                ref={roverCanvasRef}
                width={820}
                height={420}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            )}
          </div>
        </div>

        {/* Right Side: High-Density Avionics Gauges & Digital Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0, overflowY: 'auto' }}>
          {/* Phase 1: PDL Gauges */}
          {activePhase === 'pdl' && (
            <>
              {/* Artificial Horizon Navball */}
              <div className="bento-panel" style={{ padding: '8px' }}>
                <div className="bento-panel-header" style={{ marginBottom: '4px' }}>
                  <span>ATTITUDE / NAVBALL INDICATOR</span>
                  <span style={{ color: 'var(--accent-solar-hi)' }}>PITCH: {pdlPhysics.pitchDeg}°</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <canvas ref={navballCanvasRef} width={130} height={130} style={{ display: 'block' }} />
                </div>
              </div>

              {/* Real-time Telemetry Grid */}
              <div className="telemetry-grid-bento" style={{ gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <div className="telemetry-card-bento">
                  <span className="telemetry-card-label">ALTITUDE</span>
                  <span className="telemetry-card-val" style={{ color: 'var(--accent-solar-hi)' }}>
                    {pdlPhysics.altM >= 1000 ? `${(pdlPhysics.altM / 1000).toFixed(2)} km` : `${pdlPhysics.altM} m`}
                  </span>
                </div>
                <div className="telemetry-card-bento">
                  <span className="telemetry-card-label">VERTICAL Vz</span>
                  <span className="telemetry-card-val" style={{ color: pdlPhysics.vz < -10 ? 'var(--status-hazard)' : 'var(--status-safe)' }}>
                    {pdlPhysics.vz} m/s
                  </span>
                </div>
                <div className="telemetry-card-bento">
                  <span className="telemetry-card-label">HORIZONTAL Vx</span>
                  <span className="telemetry-card-val" style={{ color: 'var(--accent-earth-hi)' }}>
                    {pdlPhysics.vx} m/s
                  </span>
                </div>
                <div className="telemetry-card-bento">
                  <span className="telemetry-card-label">THROTTLE</span>
                  <span className="telemetry-card-val" style={{ color: 'var(--accent-solar)' }}>
                    {pdlPhysics.throttlePct}%
                  </span>
                </div>
                <div className="telemetry-card-bento">
                  <span className="telemetry-card-label">PROPELLANT</span>
                  <span className="telemetry-card-val">
                    {pdlPhysics.propRemainingKg} kg ({pdlPhysics.propPct}%)
                  </span>
                </div>
                <div className="telemetry-card-bento">
                  <span className="telemetry-card-label">DOWNRANGE</span>
                  <span className="telemetry-card-val">
                    {(pdlPhysics.downrangeM / 1000).toFixed(2)} km
                  </span>
                </div>
              </div>

              {/* LiDAR Hazard Scan Matrix */}
              <div className="bento-panel" style={{ padding: '8px' }}>
                <div className="bento-panel-header" style={{ marginBottom: '6px' }}>
                  <span>LIDAR HAZARD DETECTION MATRIX</span>
                  <span style={{ color: pdlPhysics.lidarScanActive ? 'var(--status-safe)' : 'var(--text-muted)' }}>
                    {pdlPhysics.lidarScanActive ? 'ACTIVE SCAN' : 'STANDBY'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
                  {[
                    ['safe', 'safe', 'hazard', 'hazard', 'safe'],
                    ['safe', 'safe', 'moderate', 'safe', 'safe'],
                    ['moderate', 'safe', 'safe', 'safe', 'safe'],
                    ['hazard', 'moderate', 'safe', 'safe', 'safe'],
                    ['safe', 'safe', 'safe', 'safe', 'safe'],
                  ].flat().map((zone, idx) => (
                    <div
                      key={idx}
                      style={{
                        height: '18px',
                        borderRadius: '1px',
                        backgroundColor:
                          !pdlPhysics.lidarScanActive
                            ? 'var(--bg-surface-2)'
                            : zone === 'safe'
                            ? 'rgba(40, 158, 142, 0.45)'
                            : zone === 'moderate'
                            ? 'rgba(229, 154, 35, 0.45)'
                            : 'rgba(217, 70, 62, 0.45)',
                        border: '1px solid var(--border-hairline)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.48rem',
                        fontFamily: 'var(--font-mono)',
                        color: zone === 'safe' ? '#4CC9B8' : zone === 'moderate' ? '#F7B955' : '#D9463E',
                      }}
                    >
                      {pdlPhysics.lidarScanActive ? (zone === 'safe' ? 'OK' : zone === 'moderate' ? 'SLOPE' : 'HAZ') : '--'}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Phase 2: Touchdown Checklist */}
          {activePhase === 'touchdown' && (
            <div className="bento-panel" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="bento-panel-header">
                <span>POST-TOUCHDOWN SYSTEMS INTEGRITY</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.66rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px', background: 'var(--bg-surface-2)' }}>
                  <span>TIP-OVER STABILITY:</span>
                  <strong style={{ color: 'var(--status-safe)' }}>STABLE (TILT: {site.slopeDeg}° / MAX: 12°)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px', background: 'var(--bg-surface-2)' }}>
                  <span>FOOTPAD LOAD SENSORS:</span>
                  <strong style={{ color: 'var(--accent-earth-hi)' }}>BALANCED (avg 4.9 kN)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px', background: 'var(--bg-surface-2)' }}>
                  <span>VERTICAL SOLAR ARRAY:</span>
                  <strong style={{ color: deployProgress === 100 ? 'var(--status-safe)' : 'var(--accent-solar-hi)' }}>
                    {deployProgress === 100 ? 'LOCKED AT 8.5m' : 'EXTENDING...'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px', background: 'var(--bg-surface-2)' }}>
                  <span>EARTH LOS COMM LINK:</span>
                  <strong style={{ color: currentDteActive ? 'var(--status-safe)' : 'var(--status-hazard)' }}>
                    {currentDteActive ? 'S-BAND DSN ACTIVE' : 'RELAY SAT REQUIRED'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px', background: 'var(--bg-surface-2)' }}>
                  <span>REGOLITH DUST LEVEL:</span>
                  <strong style={{ color: 'var(--status-safe)' }}>DISPERSED (CLEAR)</strong>
                </div>
              </div>

              <button
                className="btn-tactical-primary"
                style={{ marginTop: '8px', padding: '0.4rem', fontSize: '0.64rem' }}
                onClick={() => {
                  setActivePhase('rover');
                  setRoverProgress(0);
                  setIsPlaying(true);
                }}
              >
                PROCEED TO PHASE 3: ROVER TRAVERSE ▶
              </button>
            </div>
          )}

          {/* Phase 3: Rover Digital Twin Telemetry */}
          {activePhase === 'rover' && (
            <div className="bento-panel" style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="bento-panel-header">
                <span>ROVER DIGITAL TWIN TELEMETRY</span>
                <span style={{ color: 'var(--accent-solar-hi)' }}>VIPER-CLASS CHASSIS</span>
              </div>

              {/* Waypoints Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[
                  { name: 'WP-01: Lander Egress Ridge', dist: '0 m', slope: '4.2°', solar: '100%', temp: '+40°C' },
                  { name: 'WP-02: Connecting Saddle', dist: '450 m', slope: '6.8°', solar: '45%', temp: '-50°C' },
                  { name: 'WP-03: PSR Rim Crest & Drop', dist: '1,200 m', slope: '13.5°', solar: '0%', temp: '-160°C' },
                  { name: 'WP-04: Deep PSR Floor Ice Trap', dist: '2,100 m', slope: '2.5°', solar: '0%', temp: '40 K (-233°C)' },
                ].map((wp, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '4px 6px',
                      background: activeWaypointIdx === i ? 'rgba(247, 185, 85, 0.12)' : 'var(--bg-surface-2)',
                      border: `1px solid ${activeWaypointIdx === i ? 'var(--accent-solar)' : 'var(--border-hairline)'}`,
                      borderRadius: '2px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.60rem',
                    }}
                    onClick={() => {
                      setActiveWaypointIdx(i);
                      setRoverProgress(i * 33);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ color: activeWaypointIdx === i ? 'var(--accent-solar-hi)' : 'var(--text-primary)' }}>
                        {wp.name}
                      </strong>
                      <span style={{ color: 'var(--text-muted)' }}>{wp.dist}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.54rem' }}>
                      <span>SLOPE: {wp.slope}</span>
                      <span>SOLAR: {wp.solar}</span>
                      <span>TEMP: {wp.temp}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Real-time Rover Telemetry Cards */}
              <div className="telemetry-grid-bento" style={{ gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <div className="telemetry-card-bento">
                  <span className="telemetry-card-label">SOLAR GENERATION</span>
                  <span className="telemetry-card-val" style={{ color: roverProgress > 50 ? 'var(--status-hazard)' : 'var(--accent-solar-hi)' }}>
                    {roverProgress > 50 ? '0 W (IN SHADOW)' : '320 W (SUNLIT)'}
                  </span>
                </div>
                <div className="telemetry-card-bento">
                  <span className="telemetry-card-label">BATTERY SoC</span>
                  <span className="telemetry-card-val" style={{ color: roverProgress > 75 ? 'var(--status-hazard)' : 'var(--status-safe)' }}>
                    {Math.max(38, Math.round(100 - roverProgress * 0.62))}%
                  </span>
                </div>
                <div className="telemetry-card-bento">
                  <span className="telemetry-card-label">CRYO SURVIVAL</span>
                  <span className="telemetry-card-val" style={{ color: 'var(--accent-earth-hi)' }}>
                    {roverProgress > 50 ? '04h 12m' : 'NOMINAL'}
                  </span>
                </div>
                <div className="telemetry-card-bento">
                  <span className="telemetry-card-label">ICE DETECTION</span>
                  <span className="telemetry-card-val" style={{ color: roverProgress > 75 ? '#38BDF8' : 'var(--text-muted)' }}>
                    {roverProgress > 75 ? '5.4 wt% H2O' : '0.0 wt%'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
