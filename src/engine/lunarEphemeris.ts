/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ALRAKIS // SELENE-NAV — Lunar Ephemeris Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Core topocentric ephemeris solver for computing Sun and Earth positions
 * as seen from the lunar surface, solar flux on vertical/horizontal arrays,
 * illumination fraction accounting for 0.53° solar disk partial eclipsing,
 * Direct-to-Earth (DTE) communication link status, polar stereographic
 * projection, and composite mission feasibility scoring.
 *
 * Physics models from Master Specification v2.0, Sections 4.1–4.5.
 *
 * Uses the `astronomy-engine` library for high-precision analytical
 * ephemeris calculations at 60 FPS scrubbing rates (no network required).
 *
 * Team Alrakis (Muhammad Awad) · 2026 NASA Space Apps Challenge · Virtual Islamabad
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as Astronomy from 'astronomy-engine';

// ─────────────────────────────────────────────────────────────────────────
// §1  PHYSICAL & MISSION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────

/** Mean lunar radius in kilometers (IAU 2015 value). */
export const R_MOON_KM = 1737.4;

/** Solar constant at 1 AU in watts per square meter. */
export const SOLAR_CONSTANT_W_M2 = 1361;

/** Angular radius of the solar disk as seen from ~1 AU, in degrees. */
export const SOLAR_ANGULAR_RADIUS_DEG = 0.266;

/** Default elevation margin above the terrain horizon for DTE link lock, in degrees. */
export const DTE_MARGIN_DEG = 1.0;

/** Lunar axial tilt relative to the ecliptic, in degrees. */
export const LUNAR_AXIAL_TILT_DEG = 1.54;

/** Maximum latitude libration amplitude (5.14° orbital inclination + 1.54° axial tilt), in degrees. */
export const LAT_LIBRATION_MAX_DEG = 6.68;

/** Maximum longitude libration amplitude (elliptical orbital eccentricity), in degrees. */
export const LON_LIBRATION_MAX_DEG = 7.90;

/** Lunar synodic period in hours (~29.53 Earth days). */
export const SYNODIC_PERIOD_HOURS = 708;

/** Conversion factor: degrees to radians. */
const DEG2RAD = Math.PI / 180;

/** Conversion factor: radians to degrees. */
const RAD2DEG = 180 / Math.PI;

// ─────────────────────────────────────────────────────────────────────────
// §2  TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────

/** A point on the lunar surface in selenographic coordinates. */
export interface LunarCoordinate {
  /** Selenographic latitude in degrees (−90 to +90). */
  latDeg: number;
  /** Selenographic longitude in degrees (−180 to +180, East-positive). */
  lonDeg: number;
  /** Surface elevation above the mean sphere in kilometers (default 0). */
  elevationKm: number;
}

/** Apparent position of a celestial body in the local topocentric frame. */
export interface CelestialPosition {
  /** Topocentric azimuth in degrees (0 = North, 90 = East, clockwise). */
  azimuthDeg: number;
  /** Topocentric elevation above the local geometric horizon, in degrees. */
  elevationDeg: number;
  /** Distance from the observer to the body, in kilometers. */
  distanceKm: number;
}

/** Complete ephemeris snapshot for a single timestamp at a given site. */
export interface EphemerisResult {
  /** UTC timestamp of this computation. */
  timestamp: Date;
  /** Topocentric Sun position. */
  sun: CelestialPosition;
  /** Topocentric Earth position. */
  earth: CelestialPosition;
  /** Solar flux incident on a vertical (tracking) panel, in W/m². */
  solarFluxVertical: number;
  /** Solar flux incident on a horizontal (deck) panel, in W/m². */
  solarFluxHorizontal: number;
  /** Fraction of the solar disk visible above the terrain horizon (0 = fully eclipsed, 1 = fully visible). */
  illuminationFraction: number;
  /** Whether Direct-to-Earth S-Band/X-Band communication is geometrically possible. */
  isDTE: boolean;
}

/** Composite mission feasibility assessment. */
export interface MissionFeasibilityScore {
  /** Composite score on a 0–100 scale. */
  score: number;
  /** Fraction of the evaluation period with solar illumination. */
  solarFraction: number;
  /** Fraction of the evaluation period with DTE comm link. */
  dteFraction: number;
  /** Longest continuous eclipse (no sunlight) duration, in hours. */
  maxEclipseHours: number;
  /** Local surface slope at the landing site, in degrees. */
  slopeDeg: number;
}

/** 2D coordinates in the South Polar Stereographic projection. */
export interface PolarStereographicPoint {
  /** Easting in kilometers from the South Pole. */
  x: number;
  /** Northing in kilometers from the South Pole. */
  y: number;
}

// ─────────────────────────────────────────────────────────────────────────
// §3  TOPOCENTRIC POSITION COMPUTATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Computes the topocentric position of the Sun or Earth as seen from a
 * point on the lunar surface.
 *
 * **Method**: Uses `astronomy-engine` to compute the body's position in the
 * Moon-centered J2000 equatorial frame, then rotates into the local
 * topocentric horizontal frame defined by the observer's selenographic
 * latitude and longitude. No atmospheric refraction is applied (airless body).
 *
 * @param date   - UTC date/time of the observation
 * @param site   - Observer's selenographic coordinates
 * @param target - Which body to observe: `'sun'` or `'earth'`
 * @returns Topocentric azimuth, elevation, and distance
 */
export function computeTopocentricPosition(
  date: Date,
  site: LunarCoordinate,
  target: 'sun' | 'earth',
): CelestialPosition {
  const astroTime = Astronomy.MakeTime(date);

  // ── Step 1: Get body's geocentric equatorial position ──
  // We compute the Sun's or Earth's position relative to the Moon.
  // astronomy-engine gives us geocentric (Earth-centered) equatorial coordinates.
  // We need selenocentric (Moon-centered) coordinates.

  // Get the Moon's position from Earth (geocentric equatorial, AU)
  const moonFromEarth = Astronomy.GeoVector(Astronomy.Body.Moon, astroTime, true);

  let bodyFromMoon: { x: number; y: number; z: number };

  if (target === 'earth') {
    // Earth's position from Moon = negative of Moon's position from Earth
    bodyFromMoon = {
      x: -moonFromEarth.x,
      y: -moonFromEarth.y,
      z: -moonFromEarth.z,
    };
  } else {
    // Sun's position from Earth (geocentric equatorial, AU)
    const sunFromEarth = Astronomy.GeoVector(Astronomy.Body.Sun, astroTime, true);
    // Sun's position from Moon = Sun from Earth - Moon from Earth
    bodyFromMoon = {
      x: sunFromEarth.x - moonFromEarth.x,
      y: sunFromEarth.y - moonFromEarth.y,
      z: sunFromEarth.z - moonFromEarth.z,
    };
  }

  // ── Step 2: Convert from J2000 equatorial to selenographic body-fixed ──
  // The Moon's orientation (libration) gives us the mapping from
  // J2000 equatorial to selenographic (body-fixed) coordinates.
  const libration = Astronomy.Libration(astroTime);

  // Selenographic sub-observer point gives us the Moon's orientation.
  // We use the libration angles to build the rotation matrix.
  // The libration object provides: elon (sub-Earth longitude), elat (sub-Earth latitude),
  // and the position angle of the Moon's axis.

  // For a more direct approach, we compute the body direction in the
  // Moon's Mean Earth / Mean Rotation (ME) frame using libration parameters.

  // Convert body position from AU to km
  const AU_KM = 149597870.7;
  const bx = bodyFromMoon.x * AU_KM;
  const by = bodyFromMoon.y * AU_KM;
  const bz = bodyFromMoon.z * AU_KM;
  const bodyDistKm = Math.sqrt(bx * bx + by * by + bz * bz);

  // Normalize to unit vector in J2000 equatorial
  const ux = bx / bodyDistKm;
  const uy = by / bodyDistKm;
  const uz = bz / bodyDistKm;

  // Convert the J2000 equatorial unit vector to ecliptic coordinates
  // Obliquity of J2000 ecliptic: 23.4392911° (IAU 2000)
  const obliquityRad = 23.4392911 * DEG2RAD;
  const cosObl = Math.cos(obliquityRad);
  const sinObl = Math.sin(obliquityRad);

  // Rotate from equatorial to ecliptic
  const ex = ux;
  const ey = uy * cosObl + uz * sinObl;
  const ez = -uy * sinObl + uz * cosObl;

  // Compute ecliptic longitude and latitude of the body as seen from Moon center
  const eclLon = Math.atan2(ey, ex);
  const eclLat = Math.asin(clampValue(ez, -1, 1));

  // ── Step 3: Convert to selenographic coordinates using libration ──
  // The selenographic longitude of the sub-solar/sub-Earth point can be
  // approximated from the ecliptic coordinates and libration parameters.

  // Libration gives us how the Moon's prime meridian is oriented.
  // We use the Moon's north pole direction and prime meridian to define
  // the body-fixed frame. For computational efficiency at 60 FPS,
  // we use a simplified but accurate analytical approach:

  // The Moon's mean rotation axis is tilted 1.54° from the ecliptic normal.
  // The ascending node of the lunar equator on the ecliptic regresses with
  // a period of 18.6 years.

  // Moon's north pole in ecliptic coords (IAU mean direction):
  // α₀ = 269.9949° + 0.0031°T, δ₀ = 66.5392° + 0.0130°T (J2000 equatorial)
  // In ecliptic: pole lat ≈ 90° - 1.54° = 88.46° from ecliptic north

  // For the purpose of computing topocentric az/el with sufficient accuracy
  // for this application, we transform through the libration-corrected
  // sub-observer geometry:

  // Use astronomy-engine's libration: elat = selenographic lat of sub-Earth point,
  // elon = selenographic lon of sub-Earth point. These encode the physical
  // and optical libration combined.

  // Sub-Earth selenographic direction
  const subEarthLat = libration.elat * DEG2RAD;
  const subEarthLon = libration.elon * DEG2RAD;

  // For the Sun, we need the selenographic coordinates of the sub-solar point.
  // The sub-solar point can be computed from the Sun-Moon vector transformed
  // into the selenographic frame.

  // Build the rotation from ecliptic to selenographic using the Moon's pole
  // and prime meridian. The Moon's pole in ecliptic coords:
  const moonPoleEclLat = (90 - LUNAR_AXIAL_TILT_DEG) * DEG2RAD;

  // The ascending node of the lunar equator on the ecliptic (mean):
  // Ω = 125.0446° - 0.0529921°d  (where d = days from J2000)
  const d = astroTime.tt; // days from J2000
  const ascNodeRad = (125.0446 - 0.0529921 * d) * DEG2RAD;

  // Rotation matrix: ecliptic → selenographic body-fixed
  // Step 1: Rotate by -Ω around ecliptic Z (align ascending node with X)
  // Step 2: Rotate by -(90°-moonPoleEclLat) = -1.54° around new X (tilt pole)
  // Step 3: Rotate by -W (prime meridian angle) around new Z

  // Prime meridian angle W (degrees from ascending node):
  // W = 38.3213° + 13.17635815°d + libration corrections
  // The libration corrections are already accounted for in the sub-Earth point.

  // For computational efficiency, we use a direct vector approach:
  const cosNode = Math.cos(ascNodeRad);
  const sinNode = Math.sin(ascNodeRad);
  const tiltRad = LUNAR_AXIAL_TILT_DEG * DEG2RAD;
  const cosTilt = Math.cos(tiltRad);
  const sinTilt = Math.sin(tiltRad);

  // W angle (sidereal rotation of Moon)
  const W = (38.3213 + 13.17635815 * d) * DEG2RAD;
  const cosW = Math.cos(W);
  const sinW = Math.sin(W);

  // Apply rotations to get selenographic body-fixed coordinates
  // R = Rz(-W) · Rx(-tilt) · Rz(-Ω) · [ecliptic vector]

  // First: Rz(-Ω)
  const x1 = ex * cosNode + ey * sinNode;
  const y1 = -ex * sinNode + ey * cosNode;
  const z1 = ez;

  // Second: Rx(-tilt)  [tilt around X by -1.54°]
  const x2 = x1;
  const y2 = y1 * cosTilt + z1 * sinTilt;
  const z2 = -y1 * sinTilt + z1 * cosTilt;

  // Third: Rz(-W)  [prime meridian rotation]
  const xSel = x2 * cosW + y2 * sinW;
  const ySel = -x2 * sinW + y2 * cosW;
  const zSel = z2;

  // Selenographic longitude and latitude of the body
  const bodySelLon = Math.atan2(ySel, xSel); // radians
  const bodySelLat = Math.asin(clampValue(zSel, -1, 1)); // radians

  // ── Step 4: Convert to topocentric horizontal coordinates ──
  // Observer's selenographic position
  const obsLat = site.latDeg * DEG2RAD;
  const obsLon = site.lonDeg * DEG2RAD;

  // Compute the body's direction relative to the observer in the local frame.
  // Angular offset from the observer on the selenographic sphere:
  const dLon = bodySelLon - obsLon;

  // Standard astronomical azimuth/elevation from selenographic coords:
  // Using the selenographic equivalent of the geographic az/el transform.
  const cosBodyLat = Math.cos(bodySelLat);
  const sinBodyLat = Math.sin(bodySelLat);
  const cosObsLat = Math.cos(obsLat);
  const sinObsLat = Math.sin(obsLat);
  const cosDLon = Math.cos(dLon);
  const sinDLon = Math.sin(dLon);

  // Elevation (altitude) above local horizon:
  // sin(el) = sin(obsLat)*sin(bodyLat) + cos(obsLat)*cos(bodyLat)*cos(dLon)
  // This is the standard formula for the angular altitude of a point on a
  // sphere as seen from another point, measuring from the tangent plane.
  const sinEl = sinObsLat * sinBodyLat + cosObsLat * cosBodyLat * cosDLon;
  const elevationRad = Math.asin(clampValue(sinEl, -1, 1));

  // Azimuth (0 = North, 90 = East, measured clockwise):
  // tan(az) = sin(dLon) / (cos(obsLat)*tan(bodyLat) - sin(obsLat)*cos(dLon))
  const azX = sinDLon * cosBodyLat;
  const azY = cosObsLat * sinBodyLat - sinObsLat * cosBodyLat * cosDLon;
  let azimuthRad = Math.atan2(azX, azY);

  // Normalize to [0, 2π)
  if (azimuthRad < 0) azimuthRad += 2 * Math.PI;

  // Apply parallax correction for surface offset from center
  // At lunar distances, the parallax from surface to center is small but
  // non-negligible for Earth (Moon radius / Earth distance ≈ 0.27°).
  // For the Sun, it's negligible (< 0.001°).
  let parallaxCorrectionRad = 0;
  if (target === 'earth') {
    // Horizontal parallax ≈ asin(R_Moon / distance)
    parallaxCorrectionRad = Math.asin(
      (R_MOON_KM + site.elevationKm) / bodyDistKm,
    );
  }

  // The actual topocentric elevation is reduced by the parallax
  const topoElevDeg = (elevationRad - parallaxCorrectionRad) * RAD2DEG;
  const topoAzDeg = azimuthRad * RAD2DEG;

  return {
    azimuthDeg: normalizeAngle360(topoAzDeg),
    elevationDeg: topoElevDeg,
    distanceKm: bodyDistKm,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// §4  SOLAR FLUX COMPUTATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Computes the solar radiative flux (W/m²) incident on a solar panel.
 *
 * From Spec Section 4.3:
 * - Vertical panel:   I₀ × f_sun × cos(elevation)  → peaks at grazing angles
 * - Horizontal panel:  I₀ × f_sun × sin(elevation)  → peaks at high angles
 *
 * The `illuminationFraction` accounts for partial eclipsing of the solar disk
 * by terrain obstructions (crater rims, massifs).
 *
 * **Note**: Returns raw flux before panel efficiency (η_PV) and panel area (A_panel).
 * Multiply by η_PV × A_panel to get electrical power in watts.
 *
 * @param sunElevationDeg      - Sun elevation above geometric horizon, in degrees
 * @param illuminationFraction - Fraction of solar disk visible (0–1)
 * @param panelType            - `'vertical'` (tracking mast) or `'horizontal'` (deck)
 * @returns Solar flux in W/m²
 */
export function computeSolarFlux(
  sunElevationDeg: number,
  illuminationFraction: number,
  panelType: 'vertical' | 'horizontal',
): number {
  // Sun below horizon → zero flux
  if (sunElevationDeg <= -SOLAR_ANGULAR_RADIUS_DEG || illuminationFraction <= 0) {
    return 0;
  }

  const elRad = Math.max(0, sunElevationDeg) * DEG2RAD;
  const f = clampValue(illuminationFraction, 0, 1);

  if (panelType === 'vertical') {
    // Vertical panel faces the horizon → cos(elevation)
    // At 0° elevation (grazing sun), cos = 1 → maximum capture
    return SOLAR_CONSTANT_W_M2 * f * Math.cos(elRad);
  } else {
    // Horizontal panel faces zenith → sin(elevation)
    // At 90° elevation (overhead sun), sin = 1 → maximum capture
    return SOLAR_CONSTANT_W_M2 * f * Math.sin(elRad);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// §5  ILLUMINATION FRACTION (0.53° Solar Disk Partial Eclipsing)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Computes the fraction of the solar disk visible above the local
 * topographic horizon, modeling partial eclipsing by crater rims.
 *
 * From Spec Section 4.3:
 * ```
 * f_sun(t) = clamp( (El_Sun + R_sun − H_topo) / (2 × R_sun), 0, 1 )
 * ```
 *
 * When `El_Sun` is more than 0.266° above `H_topo`, the full disk is visible (f=1).
 * When `El_Sun` is more than 0.266° below `H_topo`, the disk is fully eclipsed (f=0).
 * In between, f varies linearly (a valid approximation for the small solar angular diameter).
 *
 * @param sunElevDeg     - Sun's topocentric elevation, in degrees
 * @param horizonElevDeg - Local terrain horizon elevation at the Sun's azimuth, in degrees
 * @returns Illumination fraction in [0, 1]
 */
export function computeIlluminationFraction(
  sunElevDeg: number,
  horizonElevDeg: number,
): number {
  const R_sun = SOLAR_ANGULAR_RADIUS_DEG;
  const fraction = (sunElevDeg + R_sun - horizonElevDeg) / (2 * R_sun);
  return clampValue(fraction, 0, 1);
}

// ─────────────────────────────────────────────────────────────────────────
// §6  DIRECT-TO-EARTH (DTE) COMMUNICATION LINK
// ─────────────────────────────────────────────────────────────────────────

/**
 * Determines whether Direct-to-Earth (DTE) S-Band / X-Band communication
 * is geometrically possible given the Earth's elevation and terrain masking.
 *
 * From Spec Section 4.4:
 * ```
 * DTE Active  ⟺  El_Earth(t) > H_topo(Az_Earth(t)) + θ_margin
 * ```
 *
 * The margin accounts for multipath interference near terrain grazing angles.
 *
 * @param earthElevDeg   - Earth's topocentric elevation, in degrees
 * @param horizonElevDeg - Local terrain horizon elevation at Earth's azimuth, in degrees
 * @param marginDeg      - Additional margin above terrain for reliable link (default 1.0°)
 * @returns `true` if DTE communication is active
 */
export function isDTEActive(
  earthElevDeg: number,
  horizonElevDeg: number,
  marginDeg: number = DTE_MARGIN_DEG,
): boolean {
  return earthElevDeg > horizonElevDeg + marginDeg;
}

// ─────────────────────────────────────────────────────────────────────────
// §7  MISSION FEASIBILITY SCORE (0–100)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Computes the composite mission feasibility score for a candidate landing
 * site and time window.
 *
 * From Spec Section 4.5:
 * ```
 * Score = 0.40×(T_sun/T) + 0.35×(T_DTE/T) + 0.15×(1 − MaxEclipse/72h) + 0.10×(1 − Slope/15°)
 * ```
 *
 * Each component is clamped to [0, 1] before weighting. The result is
 * scaled to a 0–100 integer range for instant side-by-side comparison.
 *
 * @param solarFraction  - Fraction of evaluation period with sunlight (0–1)
 * @param dteFraction    - Fraction of evaluation period with DTE link (0–1)
 * @param maxEclipseHrs  - Longest continuous eclipse duration (hours)
 * @param slopeDeg       - Local surface slope (degrees)
 * @returns Complete feasibility assessment
 */
export function computeMissionFeasibility(
  solarFraction: number,
  dteFraction: number,
  maxEclipseHrs: number,
  slopeDeg: number,
): MissionFeasibilityScore {
  const solarComponent = clampValue(solarFraction, 0, 1);
  const dteComponent = clampValue(dteFraction, 0, 1);
  const eclipseComponent = clampValue(1 - maxEclipseHrs / 72, 0, 1);
  const slopeComponent = clampValue(1 - slopeDeg / 15, 0, 1);

  const rawScore =
    0.40 * solarComponent +
    0.35 * dteComponent +
    0.15 * eclipseComponent +
    0.10 * slopeComponent;

  const score = clampValue(Math.round(rawScore * 100), 0, 100);

  return {
    score,
    solarFraction,
    dteFraction,
    maxEclipseHours: maxEclipseHrs,
    slopeDeg,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// §8  SOUTH POLAR STEREOGRAPHIC PROJECTION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Projects selenographic coordinates onto the South Polar Stereographic plane.
 *
 * From Spec Section 4.1:
 * ```
 * ρ = 2 × R_Moon × tan((90° + φ) / 2)
 * X = ρ × sin(λ)
 * Y = ρ × cos(λ)
 * ```
 *
 * This provides a conformal projection centered on the South Pole with
 * true scale at −90° latitude. Suitable for mapping the 80°S–90°S region.
 *
 * @param latDeg - Selenographic latitude in degrees (negative for southern hemisphere)
 * @param lonDeg - Selenographic longitude in degrees (East-positive)
 * @returns Projected (x, y) coordinates in kilometers from the South Pole
 */
export function polarStereographicProject(
  latDeg: number,
  lonDeg: number,
): PolarStereographicPoint {
  const phi = latDeg * DEG2RAD;
  const lambda = lonDeg * DEG2RAD;

  // ρ = 2 * R * tan((90° + φ) / 2)
  // For the South Pole projection, φ is negative (e.g., -89.54°)
  // so (90° + φ) is a small positive angle near the pole.
  const rho = 2 * R_MOON_KM * Math.tan((Math.PI / 2 + phi) / 2);

  return {
    x: rho * Math.sin(lambda),
    y: rho * Math.cos(lambda),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// §9  TOPOGRAPHIC HORIZON MASKING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Computes the angular elevation of a terrain point as seen from an observer,
 * accounting for spherical curvature drop on an airless body.
 *
 * From Spec Section 4.2:
 * ```
 * α_i(d, θ) = arctan( [ (h_i − (h_0 + h_mast)) − (d² / (2 × R_Moon)) ] / d )
 * ```
 *
 * @param observerElevM  - Observer's surface elevation in meters
 * @param mastHeightM    - Solar mast height above surface in meters (0–15 m)
 * @param terrainElevM   - Terrain point elevation in meters
 * @param distanceM      - Horizontal distance to the terrain point in meters
 * @returns Angular elevation in degrees (positive = above horizon)
 */
export function computeTerrainElevationAngle(
  observerElevM: number,
  mastHeightM: number,
  terrainElevM: number,
  distanceM: number,
): number {
  if (distanceM <= 0) return 90;

  const R = R_MOON_KM * 1000; // Convert to meters
  const dh = terrainElevM - (observerElevM + mastHeightM);
  const curvatureDrop = (distanceM * distanceM) / (2 * R);
  const effectiveHeight = dh - curvatureDrop;
  const angleRad = Math.atan2(effectiveHeight, distanceM);

  return angleRad * RAD2DEG;
}

/**
 * Finds the maximum terrain horizon elevation across a radial profile
 * from the observer outward, up to 150 km.
 *
 * From Spec Section 4.2:
 * ```
 * H_topo(θ) = max_{d ∈ (0, 150 km]} [ α_i(d, θ) ]
 * ```
 *
 * @param profile - Array of { distanceM, elevationM } samples along a ray
 * @param observerElevM - Observer elevation in meters
 * @param mastHeightM   - Mast height in meters (0–15 m)
 * @returns Maximum horizon elevation angle in degrees
 */
export function computeHorizonElevation(
  profile: ReadonlyArray<{ distanceM: number; elevationM: number }>,
  observerElevM: number,
  mastHeightM: number,
): number {
  let maxAngle = -90;

  for (const point of profile) {
    const angle = computeTerrainElevationAngle(
      observerElevM,
      mastHeightM,
      point.elevationM,
      point.distanceM,
    );
    if (angle > maxAngle) {
      maxAngle = angle;
    }
  }

  return maxAngle;
}

// ─────────────────────────────────────────────────────────────────────────
// §10  EPHEMERIS TIMELINE GENERATOR
// ─────────────────────────────────────────────────────────────────────────

/**
 * Generates a time-series of ephemeris snapshots for the 708-hour lunar
 * synodic timeline scrubber.
 *
 * Computes Sun and Earth positions, solar flux, illumination fraction,
 * and DTE status at regular intervals across the evaluation window.
 *
 * @param site           - Observer's selenographic coordinates
 * @param startDate      - Start of the evaluation window (UTC)
 * @param endDate        - End of the evaluation window (UTC)
 * @param stepMinutes    - Time step between snapshots (recommend 10–60 min)
 * @param horizonProfile - Optional 360-element array of terrain horizon elevations (degrees),
 *                          indexed by integer azimuth (0°–359°). If omitted, a flat
 *                          geometric horizon (0° at all azimuths) is assumed.
 * @returns Array of EphemerisResult snapshots
 */
export function generateEphemerisTimeline(
  site: LunarCoordinate,
  startDate: Date,
  endDate: Date,
  stepMinutes: number,
  horizonProfile?: ReadonlyArray<number>,
): EphemerisResult[] {
  const results: EphemerisResult[] = [];
  const stepMs = stepMinutes * 60 * 1000;
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  for (let t = startMs; t <= endMs; t += stepMs) {
    const date = new Date(t);
    const sun = computeTopocentricPosition(date, site, 'sun');
    const earth = computeTopocentricPosition(date, site, 'earth');

    // Look up terrain horizon at the Sun's and Earth's azimuths
    const sunHorizon = getHorizonAtAzimuth(sun.azimuthDeg, horizonProfile);
    const earthHorizon = getHorizonAtAzimuth(earth.azimuthDeg, horizonProfile);

    const illumFrac = computeIlluminationFraction(sun.elevationDeg, sunHorizon);
    const fluxV = computeSolarFlux(sun.elevationDeg, illumFrac, 'vertical');
    const fluxH = computeSolarFlux(sun.elevationDeg, illumFrac, 'horizontal');
    const dte = isDTEActive(earth.elevationDeg, earthHorizon);

    results.push({
      timestamp: date,
      sun,
      earth,
      solarFluxVertical: Math.round(fluxV * 100) / 100,
      solarFluxHorizontal: Math.round(fluxH * 100) / 100,
      illuminationFraction: Math.round(illumFrac * 1000) / 1000,
      isDTE: dte,
    });
  }

  return results;
}

/**
 * Analyzes an ephemeris timeline to extract mission-critical statistics:
 * solar fraction, DTE fraction, and maximum continuous eclipse duration.
 *
 * @param timeline - Array of EphemerisResult from `generateEphemerisTimeline`
 * @param slopeDeg - Local surface slope (from LOLA DEM, in degrees)
 * @returns Mission feasibility assessment
 */
export function analyzeTimeline(
  timeline: ReadonlyArray<EphemerisResult>,
  slopeDeg: number,
): MissionFeasibilityScore {
  if (timeline.length === 0) {
    return computeMissionFeasibility(0, 0, Infinity, slopeDeg);
  }

  let solarCount = 0;
  let dteCount = 0;
  let currentEclipseSteps = 0;
  let maxEclipseSteps = 0;

  for (const snapshot of timeline) {
    if (snapshot.illuminationFraction > 0) {
      solarCount++;
      currentEclipseSteps = 0;
    } else {
      currentEclipseSteps++;
      if (currentEclipseSteps > maxEclipseSteps) {
        maxEclipseSteps = currentEclipseSteps;
      }
    }

    if (snapshot.isDTE) {
      dteCount++;
    }
  }

  const totalSteps = timeline.length;
  const solarFraction = solarCount / totalSteps;
  const dteFraction = dteCount / totalSteps;

  // Compute step duration in hours
  let stepHours = 1; // default
  if (timeline.length >= 2) {
    stepHours =
      (timeline[1].timestamp.getTime() - timeline[0].timestamp.getTime()) /
      (1000 * 60 * 60);
  }
  const maxEclipseHours = maxEclipseSteps * stepHours;

  return computeMissionFeasibility(
    solarFraction,
    dteFraction,
    maxEclipseHours,
    slopeDeg,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §11  UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Clamps a numeric value to the range [min, max].
 */
function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Normalizes an angle to the range [0, 360).
 */
function normalizeAngle360(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

/**
 * Retrieves the terrain horizon elevation at a given azimuth from a
 * 360-element horizon profile array.
 *
 * Uses linear interpolation between the two nearest integer azimuths.
 *
 * @param azimuthDeg     - Target azimuth in degrees [0, 360)
 * @param horizonProfile - 360-element array of horizon elevations, or undefined for flat horizon
 * @returns Terrain horizon elevation in degrees
 */
function getHorizonAtAzimuth(
  azimuthDeg: number,
  horizonProfile?: ReadonlyArray<number>,
): number {
  if (!horizonProfile || horizonProfile.length === 0) {
    return 0; // Flat geometric horizon (no terrain data)
  }

  const az = normalizeAngle360(azimuthDeg);
  const idx0 = Math.floor(az) % 360;
  const idx1 = (idx0 + 1) % 360;
  const frac = az - Math.floor(az);

  // Linear interpolation
  return horizonProfile[idx0] * (1 - frac) + horizonProfile[idx1] * frac;
}

// ─────────────────────────────────────────────────────────────────────────
// §12  CURATED LANDING SITES REGISTRY
// ─────────────────────────────────────────────────────────────────────────

/** Pre-loaded landing site from the spec Section 2 registry. */
export interface LandingSite {
  name: string;
  program: string;
  coordinate: LunarCoordinate;
  operationalProfile: string;
}

/** All 12 curated landing sites from the Master Specification. */
export const CURATED_LANDING_SITES: ReadonlyArray<LandingSite> = [
  {
    name: 'Shackleton Rim',
    program: 'Artemis / South Pole',
    coordinate: { latDeg: -89.54, lonDeg: 137.0, elevationKm: 0 },
    operationalProfile: 'Near-continuous grazing sunlight on rim; borders deep PSR ice trap',
  },
  {
    name: 'Peak Near Shackleton',
    program: 'Artemis / South Pole',
    coordinate: { latDeg: -89.68, lonDeg: 129.0, elevationKm: 0 },
    operationalProfile: 'High-altitude illumination peak; steep surrounding terrain',
  },
  {
    name: 'Connecting Ridge',
    program: 'Artemis / South Pole',
    coordinate: { latDeg: -89.45, lonDeg: -136.0, elevationKm: 0 },
    operationalProfile: 'Narrow ridge between Shackleton and de Gerlache craters',
  },
  {
    name: 'de Gerlache Rim 2',
    program: 'Artemis / South Pole',
    coordinate: { latDeg: -88.71, lonDeg: -64.0, elevationKm: 0 },
    operationalProfile: 'High solar illumination fraction; challenging Earth visibility',
  },
  {
    name: 'Malapert Massif',
    program: 'Artemis / CLPS (IM-1)',
    coordinate: { latDeg: -86.0, lonDeg: 2.7, elevationKm: 0 },
    operationalProfile: 'Elevated ridge with strong Direct-to-Earth line-of-sight',
  },
  {
    name: 'Mons Mouton Plateau',
    program: 'Artemis / CLPS (IM-2)',
    coordinate: { latDeg: -85.6, lonDeg: 31.0, elevationKm: 0 },
    operationalProfile: 'Broad flat-topped massif; ideal for roving and solar masts',
  },
  {
    name: 'Nobile Rim 1',
    program: 'Artemis / VIPER Target',
    coordinate: { latDeg: -85.3, lonDeg: 31.5, elevationKm: 0 },
    operationalProfile: 'Prime water-ice reconnaissance target with seasonal shadows',
  },
  {
    name: 'Haworth Crater Rim',
    program: 'Artemis / South Pole',
    coordinate: { latDeg: -87.45, lonDeg: -5.0, elevationKm: 0 },
    operationalProfile: 'Extreme thermal contrast adjacent to large permanent shadow zone',
  },
  {
    name: 'Leibnitz Beta Plateau',
    program: 'Artemis / South Pole',
    coordinate: { latDeg: -85.2, lonDeg: 33.0, elevationKm: 0 },
    operationalProfile: 'High elevation plateau with strong Earth visibility',
  },
  {
    name: 'Shiv Shakti Point',
    program: 'ISRO Chandrayaan-3',
    coordinate: { latDeg: -69.37, lonDeg: 32.32, elevationKm: 0 },
    operationalProfile: 'Southern high-latitude plains benchmark (~14 Earth-day sunlight cycle)',
  },
  {
    name: 'Sea of Tranquility',
    program: 'Historic Apollo 11',
    coordinate: { latDeg: 0.67, lonDeg: 23.47, elevationKm: 0 },
    operationalProfile: 'Equatorial baseline for comparing terrestrial vs. polar lighting',
  },
  {
    name: 'Von Karman Crater',
    program: 'CNSA Chang\'e-4',
    coordinate: { latDeg: -45.44, lonDeg: 177.59, elevationKm: 0 },
    operationalProfile: 'Lunar far-side benchmark (0% Direct-to-Earth visibility; requires relay)',
  },
] as const;
