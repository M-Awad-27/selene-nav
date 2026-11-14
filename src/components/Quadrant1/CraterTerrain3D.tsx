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

      // 26 x 26 Isometric Grid
      const N = 26;
      const cos30 = Math.cos((30.0 * Math.PI) / 180.0);
      const sin30 = Math.sin((30.0 * Math.PI) / 180.0);

      const scale = Math.min(w, h) * 0.36;
      const zScale = 14.0;
      const cx = w * 0.50;
      const cy = h * 0.46;

      // Smooth Crater-and-Ridge Height Function
      const getZ = (x: number, y: number) => {
        const r2 = x * x + y * y;
        const r = Math.sqrt(r2);
        const bowl = -2.2 * Math.exp(-r2 / 0.18);
        const rim = 1.4 * Math.exp(-Math.pow(r - 0.55, 2) / 0.04);
        const micro = 0.25 * Math.sin(x * 4.0) * Math.cos(y * 4.0);
        return bowl + rim + micro;
      };

      const step = 2.0 / (N - 1);
      const grid: { x: number; y: number; z: number; isoX: number; isoY: number }[][] = [];

      for (let i = 0; i < N; i++) {
        const row = [];
        const gx = -1.0 + i * step;
        for (let j = 0; j < N; j++) {
          const gy = -1.0 + j * step;
          const gz = getZ(gx, gy);
          const isoX = cx + (gx - gy) * cos30 * scale;
          const isoY = cy + (gx + gy) * sin30 * scale - gz * zScale;
          row.push({ x: gx, y: gy, z: gz, isoX, isoY });
        }
        grid.push(row);
      }

      // Draw subtle isometric base bounding-box grid underneath
      ctx.save();
      const baseZ = -2.2; // deepest point
      const corners = [
        [-1, -1], [1, -1], [1, 1], [-1, 1]
      ].map(([gx, gy]) => ({
        isoX: cx + (gx - gy) * cos30 * scale,
        isoY: cy + (gx + gy) * sin30 * scale - baseZ * zScale,
      }));
      ctx.beginPath();
      ctx.moveTo(corners[0].isoX, corners[0].isoY);
      for (let k = 1; k < 4; k++) ctx.lineTo(corners[k].isoX, corners[k].isoY);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(74, 82, 100, 0.35)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      // Grid lines on base
      for (let k = 0; k < N; k += 4) {
        const t = -1.0 + k * step;
        const a1x = cx + (t - (-1)) * cos30 * scale;
        const a1y = cy + (t + (-1)) * sin30 * scale - baseZ * zScale;
        const a2x = cx + (t - 1) * cos30 * scale;
        const a2y = cy + (t + 1) * sin30 * scale - baseZ * zScale;
        ctx.beginPath(); ctx.moveTo(a1x, a1y); ctx.lineTo(a2x, a2y);
        ctx.strokeStyle = 'rgba(74, 82, 100, 0.18)'; ctx.lineWidth = 0.4; ctx.stroke();

        const b1x = cx + ((-1) - t) * cos30 * scale;
        const b1y = cy + ((-1) + t) * sin30 * scale - baseZ * zScale;
        const b2x = cx + (1 - t) * cos30 * scale;
        const b2y = cy + (1 + t) * sin30 * scale - baseZ * zScale;
        ctx.beginPath(); ctx.moveTo(b1x, b1y); ctx.lineTo(b2x, b2y);
        ctx.stroke();
      }
      ctx.restore();

      // Draw quads sorted from back to front (Painter's algorithm)
      for (let sum = 0; sum <= 2 * (N - 2); sum++) {
        for (let i = 0; i < N - 1; i++) {
          const j = sum - i;
          if (j >= 0 && j < N - 1) {
            const p0 = grid[i][j];
            const p1 = grid[i + 1][j];
            const p2 = grid[i + 1][j + 1];
            const p3 = grid[i][j + 1];

            // Radial distance from crater center for zone classification
            const midX = (p0.x + p1.x + p2.x + p3.x) / 4;
            const midY = (p0.y + p1.y + p2.y + p3.y) / 4;
            const rNorm = Math.sqrt(midX * midX + midY * midY);

            // Physical slope: use finite difference of z over the step
            // The z function spans roughly -2.2 to +1.4 over 2 units
            // Real lunar 20km patch: step ≈ 0.77km, dz max ≈ 0.5km → slope ~33°
            // We want the visual distribution: floor=cyan, plateau=teal, flank=amber, rim=red
            const dzx = (p1.z - p0.z);
            const dzy = (p3.z - p0.z);
            const gradMag = Math.sqrt(dzx * dzx + dzy * dzy) / step;
            // Scale gradient to physical: multiply by realistic terrain scaling
            // 20km patch, z range ~3.6 units mapped to ~3km real → z_real = z * 0.83km
            // slope = atan(dz_real / dx_real) where dx_real = step * 10km
            const physGrad = gradMag * 0.83 / 10.0;
            const slopeDeg = (Math.atan(physGrad) * 180.0) / Math.PI;

            ctx.beginPath();
            ctx.moveTo(p0.isoX, p0.isoY);
            ctx.lineTo(p1.isoX, p1.isoY);
            ctx.lineTo(p2.isoX, p2.isoY);
            ctx.lineTo(p3.isoX, p3.isoY);
            ctx.closePath();

            if (shadingMode === 'slope-hazard') {
              // Zone-based coloring matching reference mockup
              if (rNorm < 0.28) {
                // Deep Crater Floor — Cryo Cyan-Blue
                ctx.fillStyle = 'rgba(14, 116, 144, 0.35)';
                ctx.fill();
                ctx.strokeStyle = '#38BDF8';
              } else if (slopeDeg < 5.0) {
                // Safe Flat Rim & Outer Plateau — Tactical Emerald/Teal
                ctx.fillStyle = 'rgba(40, 158, 142, 0.28)';
                ctx.fill();
                ctx.strokeStyle = '#2DD4BF';
              } else if (slopeDeg < 10.0) {
                // Moderate Rim Slope — Kapton Solar Amber
                ctx.fillStyle = 'rgba(229, 154, 35, 0.32)';
                ctx.fill();
                ctx.strokeStyle = '#F7B955';
              } else {
                // Steep Inner Crater Wall Hazard — Eclipse Vermilion
                ctx.fillStyle = 'rgba(217, 70, 62, 0.38)';
                ctx.fill();
                ctx.strokeStyle = '#F43F5E';
              }
            } else {
              ctx.fillStyle = 'rgba(17, 19, 24, 0.65)';
              ctx.fill();
              ctx.strokeStyle = 'rgba(180, 195, 215, 0.55)';
            }

            ctx.lineWidth = 0.7;
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

      // Golden Sun Ray Vector Arrow — thick 2px glowing beam
      const sunElevRad = (Math.max(-2, currentSun.elevationDeg) * Math.PI) / 180.0;
      const sunBeamLen = 48;
      const sunVecAngle = Math.PI * 1.18 - sunElevRad * 0.45;
      const sunEndX = landerIsoX + Math.cos(sunVecAngle) * sunBeamLen;
      const sunEndY = tipIsoY + Math.sin(sunVecAngle) * sunBeamLen * 0.7;

      // Glow behind sun beam
      ctx.beginPath();
      ctx.moveTo(landerIsoX, tipIsoY);
      ctx.lineTo(sunEndX, sunEndY);
      ctx.strokeStyle = 'rgba(247, 185, 85, 0.25)';
      ctx.lineWidth = 5;
      ctx.stroke();
      // Main beam
      ctx.beginPath();
      ctx.moveTo(landerIsoX, tipIsoY);
      ctx.lineTo(sunEndX, sunEndY);
      ctx.strokeStyle = '#F7B955';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Sun node glow
      ctx.beginPath();
      ctx.arc(sunEndX, sunEndY, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(247, 185, 85, 0.35)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sunEndX, sunEndY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#F7B955';
      ctx.fill();

      // Cyan DTE Comm Link Beam — thick 2px dashed beam
      const earthElevRad = (Math.max(0, currentEarth.elevationDeg) * Math.PI) / 180.0;
      const earthBeamLen = 52;
      const earthVecAngle = -Math.PI * 0.20 - earthElevRad * 0.4;
      const earthEndX = landerIsoX + Math.cos(earthVecAngle) * earthBeamLen;
      const earthEndY = tipIsoY + Math.sin(earthVecAngle) * earthBeamLen * 0.7;

      // Glow behind earth beam
      ctx.beginPath();
      ctx.moveTo(landerIsoX, tipIsoY);
      ctx.lineTo(earthEndX, earthEndY);
      ctx.strokeStyle = 'rgba(76, 201, 184, 0.2)';
      ctx.lineWidth = 4;
      ctx.setLineDash([]);
      ctx.stroke();
      // Main dashed beam
      ctx.beginPath();
      ctx.moveTo(landerIsoX, tipIsoY);
      ctx.lineTo(earthEndX, earthEndY);
      ctx.strokeStyle = '#4CC9B8';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Earth node
      ctx.beginPath();
      ctx.arc(earthEndX, earthEndY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#4CC9B8';
      ctx.fill();

      // "DTE COMM LINK" label near earth endpoint
      ctx.font = 'bold 5.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#4CC9B8';
      ctx.fillText('DTE COMM', earthEndX - 18, earthEndY - 6);
      ctx.fillText('LINK', earthEndX - 8, earthEndY + 1);

      // Site info text
      ctx.font = '5px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(236, 233, 226, 0.6)';
      ctx.fillText(`Site: Shackleton Rim · Elev:`, 4, h - 14);
      ctx.fillText(`1.25 km`, 4, h - 7);

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
