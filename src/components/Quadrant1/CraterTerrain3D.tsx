import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useMissionStore } from '../../store/missionStore';

interface CraterTerrain3DProps {
  shadingMode?: 'realistic' | 'slope-hazard';
  compact?: boolean;
}

export const CraterTerrain3D: React.FC<CraterTerrain3DProps> = ({
  shadingMode = 'slope-hazard',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const sitesRegistry = useMissionStore((s) => s.sitesRegistry);
  const currentSun = useMissionStore((s) => s.currentSun);
  const currentEarth = useMissionStore((s) => s.currentEarth);
  const mastHeightMeters = useMissionStore((s) => s.mastHeightMeters);

  // Rotation angles: pitch fixed near 55°, yaw rotates smoothly or via drag
  const [yaw, setYaw] = useState<number>(0.65);
  const [pitch, setPitch] = useState<number>(0.96); // ~55°
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);

  const site = sitesRegistry.find((s) => s.id === selectedSiteId) || sitesRegistry[0] || {
    id: 'shackleton-rim',
    name: 'Shackleton Rim',
    elevationKm: 1.25,
    slopeDeg: 4.2,
  };

  // 1. Precompute 28 x 28 Isometric Heightmap Grid
  const GRID_SIZE = 28;
  const heightmap = useMemo(() => {
    const grid: { u: number; v: number; z: number }[][] = [];
    const siteSeed = site.id === 'shackleton-rim' ? 1.0 : site.id === 'malapert-massif' ? 2.2 : 0.8;

    for (let i = 0; i < GRID_SIZE; i++) {
      const row: { u: number; v: number; z: number }[] = [];
      const u = (i - (GRID_SIZE - 1) / 2) / ((GRID_SIZE - 1) / 2); // -1 .. 1

      for (let j = 0; j < GRID_SIZE; j++) {
        const v = (j - (GRID_SIZE - 1) / 2) / ((GRID_SIZE - 1) / 2); // -1 .. 1

        // Crater Rim & Bowl Model
        const rCrater = Math.sqrt(Math.pow(u - 0.25, 2) + Math.pow(v + 0.15, 2));
        const R_RIM = 0.58;

        // Bowl depression inside crater
        let zBowl = 0;
        if (rCrater < R_RIM) {
          zBowl = -4.2 * Math.pow(1 - rCrater / R_RIM, 1.6);
        }

        // Rim mountain crest
        const zRim = 3.6 * Math.exp(-Math.pow(rCrater - R_RIM, 2) / 0.038) * siteSeed;

        // Regional connecting ridge / massif slope
        const zRidge = 2.4 * Math.exp(-Math.pow(u * 1.2 + v * 0.4, 2) / 0.24) * Math.cos(v * 2.2);

        // Micro-topography / rugged regolith noise
        const zNoise =
          0.38 * Math.sin(u * 9 + v * 7) +
          0.22 * Math.cos(u * 18 - v * 14) +
          0.12 * Math.sin(u * 32 + v * 28);

        const z = zBowl + zRim + zRidge + zNoise;
        row.push({ u, v, z });
      }
      grid.push(row);
    }
    return grid;
  }, [site.id]);

  // 2. Precompute Quad Polygons with Local Slope Angles
  const quads = useMemo(() => {
    const list: {
      i: number;
      j: number;
      v0: { u: number; v: number; z: number };
      v1: { u: number; v: number; z: number };
      v2: { u: number; v: number; z: number };
      v3: { u: number; v: number; z: number };
      centerU: number;
      centerV: number;
      centerZ: number;
      slopeDeg: number;
    }[] = [];

    const step = 2.0 / (GRID_SIZE - 1);

    for (let i = 0; i < GRID_SIZE - 1; i++) {
      for (let j = 0; j < GRID_SIZE - 1; j++) {
        const v0 = heightmap[i][j];
        const v1 = heightmap[i + 1][j];
        const v2 = heightmap[i + 1][j + 1];
        const v3 = heightmap[i][j + 1];

        // Central height and gradients
        const centerU = (v0.u + v1.u + v2.u + v3.u) / 4.0;
        const centerV = (v0.v + v1.v + v2.v + v3.v) / 4.0;
        const centerZ = (v0.z + v1.z + v2.z + v3.z) / 4.0;

        const dzDu = (v1.z + v2.z - v0.z - v3.z) / (2.0 * step);
        const dzDv = (v3.z + v2.z - v0.z - v1.z) / (2.0 * step);
        const grad = Math.sqrt(dzDu * dzDu + dzDv * dzDv);
        const slopeDeg = Math.min(35.0, (Math.atan(grad * 0.28) * 180.0) / Math.PI);

        list.push({
          i,
          j,
          v0,
          v1,
          v2,
          v3,
          centerU,
          centerV,
          centerZ,
          slopeDeg,
        });
      }
    }
    return list;
  }, [heightmap]);

  // Mouse interaction handlers for 3D rotation
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    setYaw((y) => y + dx * 0.012);
    setPitch((p) => Math.max(0.35, Math.min(1.35, p + dy * 0.008)));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // 3. Render Loop (Canvas 2D Isometric Projection)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let currentYaw = yaw;

    const render = () => {
      // Auto-orbit slowly when not dragging
      if (!isDraggingRef.current) {
        currentYaw += 0.0025;
      }

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = rect.width || 220;
      const height = rect.height || 140;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep void background with subtle gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#090A0D');
      bgGrad.addColorStop(1, '#0D1016');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Projection parameters
      const cx = width / 2;
      const cy = height * 0.58;
      const scaleX = Math.min(width, height) * 0.68;
      const scaleY = scaleX * 0.55;

      const cosY = Math.cos(currentYaw);
      const sinY = Math.sin(currentYaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      // Project 3D vertex to 2D isometric screen space
      const projectVertex = (u: number, v: number, z: number) => {
        // Yaw rotation
        const rx = u * cosY - v * sinY;
        const ry = u * sinY + v * cosY;
        const rz = z;

        // Isometric pitch projection
        const sx = cx + rx * scaleX;
        const sy = cy + (ry * cosP - rz * sinP) * scaleY;
        const depth = rx * sinY + ry * cosY - rz * 0.5;

        return { sx, sy, depth };
      };

      // Sort quads by depth (Painter's algorithm: draw farthest quads first)
      const sortedQuads = quads
        .map((q) => {
          const p = projectVertex(q.centerU, q.centerV, q.centerZ);
          return { ...q, depth: p.depth };
        })
        .sort((a, b) => a.depth - b.depth);

      // Draw Quad Polygons
      sortedQuads.forEach((quad) => {
        const p0 = projectVertex(quad.v0.u, quad.v0.v, quad.v0.z);
        const p1 = projectVertex(quad.v1.u, quad.v1.v, quad.v1.z);
        const p2 = projectVertex(quad.v2.u, quad.v2.v, quad.v2.z);
        const p3 = projectVertex(quad.v3.u, quad.v3.v, quad.v3.z);

        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.lineTo(p3.sx, p3.sy);
        ctx.closePath();

        if (shadingMode === 'slope-hazard') {
          // Heatmap: Safe (<5°) -> Teal, Moderate (5°-10°) -> Amber, Hazard (>10°) -> Vermilion
          if (quad.slopeDeg < 5.0) {
            ctx.fillStyle = 'rgba(40, 158, 142, 0.18)';
            ctx.strokeStyle = 'rgba(40, 158, 142, 0.65)';
          } else if (quad.slopeDeg < 10.0) {
            ctx.fillStyle = 'rgba(229, 154, 35, 0.24)';
            ctx.strokeStyle = 'rgba(229, 154, 35, 0.75)';
          } else {
            ctx.fillStyle = 'rgba(217, 70, 62, 0.35)';
            ctx.strokeStyle = 'rgba(217, 70, 62, 0.9)';
          }
        } else {
          // Realistic lunar shade
          const lightIntensity = Math.max(0.08, Math.min(0.85, 0.35 + quad.centerZ * 0.12));
          ctx.fillStyle = `rgba(180, 195, 215, ${lightIntensity * 0.25})`;
          ctx.strokeStyle = `rgba(140, 160, 190, ${lightIntensity * 0.55})`;
        }

        ctx.fill();
        ctx.lineWidth = 0.55;
        ctx.stroke();
      });

      // 4. Center Lander Mast & Dual Vector Beams at (u=0, v=0)
      const centerZ = heightmap[Math.floor(GRID_SIZE / 2)][Math.floor(GRID_SIZE / 2)].z;
      const basePos = projectVertex(0, 0, centerZ);
      const mastHeightPx = 18 + (mastHeightMeters / 15.0) * 8;
      const mastTipY = basePos.sy - mastHeightPx;

      // Lander Octagonal Base Pad
      ctx.fillStyle = 'rgba(247, 185, 85, 0.75)';
      ctx.beginPath();
      ctx.ellipse(basePos.sx, basePos.sy, 5.5, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Vertical Mast Pole
      ctx.beginPath();
      ctx.moveTo(basePos.sx, basePos.sy);
      ctx.lineTo(basePos.sx, mastTipY);
      ctx.strokeStyle = '#F7B955';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Mast Tip Glowing Beacon
      ctx.beginPath();
      ctx.arc(basePos.sx, mastTipY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(basePos.sx, mastTipY, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(247, 185, 85, 0.4)';
      ctx.fill();

      // A. Golden Solar Vector Beam (shooting upward-left at Sun elevation)
      const sunBeamLength = 48;
      const sunElClamped = Math.max(-2, Math.min(15, currentSun.elevationDeg));
      const sunBeamAngleRad = Math.PI * 1.15 - (sunElClamped * Math.PI) / 180.0 * 0.5;
      const sunEndX = basePos.sx + Math.cos(sunBeamAngleRad) * sunBeamLength;
      const sunEndY = mastTipY + Math.sin(sunBeamAngleRad) * sunBeamLength * 0.65;

      const sunGrad = ctx.createLinearGradient(basePos.sx, mastTipY, sunEndX, sunEndY);
      sunGrad.addColorStop(0, '#FFE082');
      sunGrad.addColorStop(0.5, 'rgba(247, 185, 85, 0.85)');
      sunGrad.addColorStop(1, 'rgba(229, 154, 35, 0)');

      ctx.beginPath();
      ctx.moveTo(basePos.sx, mastTipY);
      ctx.lineTo(sunEndX, sunEndY);
      ctx.strokeStyle = sunGrad;
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Sun Vector Arrowhead
      ctx.beginPath();
      ctx.arc(sunEndX, sunEndY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#F7B955';
      ctx.fill();

      // B. Cyan-Teal Direct-to-Earth Comm Vector Beam (shooting upward-right)
      const earthBeamLength = 52;
      const earthElClamped = Math.max(0, Math.min(15, currentEarth.elevationDeg));
      const earthBeamAngleRad = -Math.PI * 0.22 - (earthElClamped * Math.PI) / 180.0 * 0.4;
      const earthEndX = basePos.sx + Math.cos(earthBeamAngleRad) * earthBeamLength;
      const earthEndY = mastTipY + Math.sin(earthBeamAngleRad) * earthBeamLength * 0.65;

      const earthGrad = ctx.createLinearGradient(basePos.sx, mastTipY, earthEndX, earthEndY);
      earthGrad.addColorStop(0, '#7AECE0');
      earthGrad.addColorStop(0.5, 'rgba(40, 158, 142, 0.85)');
      earthGrad.addColorStop(1, 'rgba(20, 50, 48, 0)');

      ctx.beginPath();
      ctx.moveTo(basePos.sx, mastTipY);
      ctx.lineTo(earthEndX, earthEndY);
      ctx.strokeStyle = earthGrad;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Earth Vector Arrowhead
      ctx.beginPath();
      ctx.arc(earthEndX, earthEndY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#4CC9B8';
      ctx.fill();

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [quads, heightmap, shadingMode, mastHeightMeters, pitch]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};
