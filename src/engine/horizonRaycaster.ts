/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ALRAKIS // SELENE-NAV — 360° Topographic Horizon Raycaster
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Implements line-of-sight horizon calculation, adjustable solar mast height,
 * 360° terrain skyline obstruction queries, and live countdowns to local
 * sunset (solar blackout) and Earthset (DTE comm link loss).
 *
 * Mathematical model per Master Engineering Specification Section 4.2:
 *   alpha_i(d, theta) = arctan( [ (h_i - (h_0 + h_mast)) - (d^2 / (2 * R_Moon)) ] / d )
 *   H_topo(theta) = max_{d in (0, 150 km]} [ alpha_i(d, theta) ]
 *
 * Team Alrakis (Muhammad Awad) · 2026 NASA Space Apps Challenge · Virtual Islamabad
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { R_MOON_KM, SOLAR_ANGULAR_RADIUS_DEG, DTE_MARGIN_DEG } from './lunarEphemeris';

/** Radial sample along an azimuth ray from the observer */
export interface TerrainSample {
  distanceMeters: number;
  elevationMeters: number;
}

/** Precomputed 360-degree horizon silhouette */
export interface HorizonProfile360 {
  siteId: string;
  siteName: string;
  observerElevationKm: number;
  /** Array of 360 elevation angles in degrees (index 0 to 359 corresponds to azimuth 0° to 359°) */
  elevationProfileDeg: number[];
}

/** Result of a countdown search for horizon crossing */
export interface HorizonCrossingCountdown {
  target: 'sun' | 'earth';
  isCurrentlyVisible: boolean;
  /** Milliseconds until next horizon crossing (set or rise), or null if permanent */
  timeToCrossingMs: number | null;
  /** Formatted human-readable string (e.g. "142h 18m" or "PERMANENT ILLUMINATION") */
  formattedCountdown: string;
  /** Next crossing timestamp */
  nextCrossingDate: Date | null;
  /** Whether the body is setting (true) or rising (false) at next crossing */
  isSetting: boolean;
}

/**
 * Computes the elevation angle of a distant terrain point taking into account:
 * 1. Zero atmospheric refraction (airless lunar environment)
 * 2. Spherical curvature drop over horizontal distance d
 * 3. Solar mast / rover antenna elevation above ground (0m to 15m)
 */
export function computeRayElevation(
  observerElevM: number,
  mastHeightM: number,
  targetTerrainElevM: number,
  distM: number,
): number {
  if (distM <= 0) return 0;
  const rMoonM = R_MOON_KM * 1000.0;
  const deltaH = targetTerrainElevM - (observerElevM + mastHeightM);
  const curvatureDrop = (distM * distM) / (2.0 * rMoonM);
  const effectiveH = deltaH - curvatureDrop;
  return Math.atan2(effectiveH, distM) * (180.0 / Math.PI);
}

/**
 * Looks up the terrain elevation angle at a fractional azimuth from a 360-degree profile.
 * Performs smooth circular interpolation.
 */
export function getInterpolatedHorizonElevation(
  azimuthDeg: number,
  profile360: number[],
  mastHeightM: number = 0,
): number {
  if (!profile360 || profile360.length === 0) return 0;
  
  // Normalize azimuth to [0, 360)
  const normAz = ((azimuthDeg % 360) + 360) % 360;
  const idx0 = Math.floor(normAz) % 360;
  const idx1 = (idx0 + 1) % 360;
  const fraction = normAz - idx0;

  const baseElev0 = profile360[idx0];
  const baseElev1 = profile360[idx1];
  const baseElev = baseElev0 * (1 - fraction) + baseElev1 * fraction;

  // Mast height reduction factor: raising the mast lowers the apparent horizon
  // For typical terrain distance of ~10 km, delta_elev ≈ -arctan(mast / dist) ≈ -(mast / 10000) * (180/pi)
  // An adjustable mast from 0m to 15m reduces the obstruction horizon slightly
  const mastAdjustmentDeg = (mastHeightM / 10000.0) * (180.0 / Math.PI);
  return Math.max(0, baseElev - mastAdjustmentDeg);
}

/**
 * Evaluates whether the Sun or Earth is obstructed by the local topographic skyline.
 */
export function evaluateLineOfSight(
  bodyAzimuthDeg: number,
  bodyElevationDeg: number,
  profile360: number[],
  target: 'sun' | 'earth',
  mastHeightM: number = 0,
): { isClear: boolean; horizonElevationDeg: number; marginDeg: number } {
  const horizonElev = getInterpolatedHorizonElevation(bodyAzimuthDeg, profile360, mastHeightM);
  
  if (target === 'sun') {
    // Upper limb of Sun must clear horizon
    const effectiveElev = bodyElevationDeg + SOLAR_ANGULAR_RADIUS_DEG;
    const isClear = effectiveElev > horizonElev;
    return {
      isClear,
      horizonElevationDeg: horizonElev,
      marginDeg: effectiveElev - horizonElev,
    };
  } else {
    // Earth requires safety margin against multipath interference
    const requiredElev = horizonElev + DTE_MARGIN_DEG;
    const isClear = bodyElevationDeg > requiredElev;
    return {
      isClear,
      horizonElevationDeg: horizonElev,
      marginDeg: bodyElevationDeg - requiredElev,
    };
  }
}

/**
 * Formats a duration in milliseconds into tactical avionics format: "XXh YYm"
 */
export function formatTacticalDuration(ms: number | null): string {
  if (ms === null) return '--h --m';
  if (ms < 0) return '00h 00m';
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}
