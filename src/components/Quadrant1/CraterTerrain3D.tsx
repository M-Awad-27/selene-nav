import React, { useRef, useEffect } from 'react';
import { useMissionStore } from '../../store/missionStore';

interface CraterTerrain3DProps {
  shadingMode?: 'realistic' | 'slope-hazard';
  compact?: boolean;
}

export const CraterTerrain3D: React.FC<CraterTerrain3DProps> = ({
  shadingMode = 'slope-hazard',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentSun = useMissionStore((s) => s.currentSun);
  const currentEarth = useMissionStore((s) => s.currentEarth);
  const mastHeightMeters = useMissionStore((s) => s.mastHeightMeters);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number | null = null;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = rect.width || 220;
      const h = rect.height || 140;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Clean transparent background with subtle gradient
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, 'rgba(9, 10, 13, 0.4)');
      bg.addColorStop(1, 'rgba(13, 16, 22, 0.7)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 18 x 18 Isometric Grid
      const N = 18;
      const cos30 = Math.cos((30.0 * Math.PI) / 180.0); // ~0.866
      const sin30 = Math.sin((30.0 * Math.PI) / 180.0); // 0.500

      const scale = Math.min(w, h) * 0.38;
      const zScale = 16.0;
      const cx = w * 0.50;
      const cy = h * 0.44;

      // Mathematical Crater-and-Ridge Height Function z(x, y)
      // z(x, y) = -2.2 * exp(-(r*r)/0.18) + 1.4 * exp(-((r - 0.55)^2)/0.04) + 0.25 * sin(x*4)*cos(y*4)
      const getZ = (x: number, y: number) => {
        const r2 = x * x + y * y;
        const r = Math.sqrt(r2);
        const bowl = -2.2 * Math.exp(-r2 / 0.18);
        const rim = 1.4 * Math.exp(-Math.pow(r - 0.55, 2) / 0.04);
        const micro = 0.25 * Math.sin(x * 4.0) * Math.cos(y * 4.0);
        return bowl + rim + micro;
      };

      // 2D grid vertices
      const step = 2.0 / (N - 1);
      const grid: { x: number; y: number; z: number; isoX: number; isoY: number }[][] = [];

      for (let i = 0; i < N; i++) {
        const row = [];
        const gx = -1.0 + i * step;
        for (let j = 0; j < N; j++) {
          const gy = -1.0 + j * step;
          const gz = getZ(gx, gy);

          // Isometric 3D Projection
          const isoX = cx + (gx - gy) * cos30 * scale;
          const isoY = cy + (gx + gy) * sin30 * scale - gz * zScale;
          row.push({ x: gx, y: gy, z: gz, isoX, isoY });
        }
        grid.push(row);
      }

      // Draw quads sorted from back to front (Painter's algorithm: i + j order)
      for (let sum = 0; sum <= 2 * (N - 2); sum++) {
        for (let i = 0; i < N - 1; i++) {
          const j = sum - i;
          if (j >= 0 && j < N - 1) {
            const p0 = grid[i][j];
            const p1 = grid[i + 1][j];
            const p2 = grid[i + 1][j + 1];
            const p3 = grid[i][j + 1];

            // Local slope calculation in degrees
            const dzx = Math.abs(p1.z - p0.z);
            const dzy = Math.abs(p3.z - p0.z);
            const slopeDeg = (Math.atan(Math.sqrt(dzx * dzx + dzy * dzy) / step) * 180.0) / Math.PI;

            ctx.beginPath();
            ctx.moveTo(p0.isoX, p0.isoY);
            ctx.lineTo(p1.isoX, p1.isoY);
            ctx.lineTo(p2.isoX, p2.isoY);
            ctx.lineTo(p3.isoX, p3.isoY);
            ctx.closePath();

            // Dark translucent cell fill
            ctx.fillStyle = 'rgba(17, 19, 24, 0.65)';
            ctx.fill();

            // Wireframe lines colored by local slope angle
            if (shadingMode === 'slope-hazard') {
              if (slopeDeg < 5.0) {
                ctx.strokeStyle = '#289E8E'; // Teal — Safe (<5°)
              } else if (slopeDeg < 10.0) {
                ctx.strokeStyle = '#E59A23'; // Amber — Moderate (5°-10°)
              } else {
                ctx.strokeStyle = '#D9463E'; // Vermilion — Steep Rim Hazard (>10°)
              }
            } else {
              ctx.strokeStyle = 'rgba(180, 195, 215, 0.55)';
            }

            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Landing site position on the rim (at x = 0.38, y = 0.38 where r ≈ 0.55)
      const rimX = 0.38;
      const rimY = 0.38;
      const rimZ = getZ(rimX, rimY);
      const landerIsoX = cx + (rimX - rimY) * cos30 * scale;
      const landerIsoY = cy + (rimX + rimY) * sin30 * scale - rimZ * zScale;

      // Vertical Lander Mast at Landing Site Point
      const mastHeightPx = 18.0 + (mastHeightMeters / 15.0) * 10.0;
      const tipIsoY = landerIsoY - mastHeightPx;

      // Lander Base Platform
      ctx.fillStyle = '#E59A23';
      ctx.beginPath();
      ctx.ellipse(landerIsoX, landerIsoY, 5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.9;
      ctx.stroke();

      // Vertical Mast Pole
      ctx.beginPath();
      ctx.moveTo(landerIsoX, landerIsoY);
      ctx.lineTo(landerIsoX, tipIsoY);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Mast Tip Light Beacon
      ctx.beginPath();
      ctx.arc(landerIsoX, tipIsoY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(landerIsoX, tipIsoY, 5.0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(247, 185, 85, 0.45)';
      ctx.fill();

      // Golden Sun Ray Vector Arrow (from Sun's elevation/azimuth)
      const sunElevRad = (Math.max(-2, currentSun.elevationDeg) * Math.PI) / 180.0;
      const sunBeamLen = 42;
      const sunVecAngle = Math.PI * 1.18 - sunElevRad * 0.45;
      const sunEndX = landerIsoX + Math.cos(sunVecAngle) * sunBeamLen;
      const sunEndY = tipIsoY + Math.sin(sunVecAngle) * sunBeamLen * 0.7;

      ctx.beginPath();
      ctx.moveTo(landerIsoX, tipIsoY);
      ctx.lineTo(sunEndX, sunEndY);
      ctx.strokeStyle = '#F7B955';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Sun Vector Arrowhead
      ctx.beginPath();
      ctx.arc(sunEndX, sunEndY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#F7B955';
      ctx.fill();

      // Cyan DTE Comm Vector Arrow (pointing toward Earth)
      const earthElevRad = (Math.max(0, currentEarth.elevationDeg) * Math.PI) / 180.0;
      const earthBeamLen = 46;
      const earthVecAngle = -Math.PI * 0.20 - earthElevRad * 0.4;
      const earthEndX = landerIsoX + Math.cos(earthVecAngle) * earthBeamLen;
      const earthEndY = tipIsoY + Math.sin(earthVecAngle) * earthBeamLen * 0.7;

      ctx.beginPath();
      ctx.moveTo(landerIsoX, tipIsoY);
      ctx.lineTo(earthEndX, earthEndY);
      ctx.strokeStyle = '#4CC9B8';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Earth Vector Arrowhead
      ctx.beginPath();
      ctx.arc(earthEndX, earthEndY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#4CC9B8';
      ctx.fill();

      ctx.restore();
    };

    render();
    window.addEventListener('resize', render);
    return () => {
      window.removeEventListener('resize', render);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [currentSun, currentEarth, mastHeightMeters, shadingMode]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </div>
  );
};
