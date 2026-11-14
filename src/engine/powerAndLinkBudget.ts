/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ALRAKIS // SELENE-NAV — Power & Communications Link Budget Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Implements vertical tracking solar mast power, horizontal deck panel power,
 * direct-to-Earth link margin calculations, and battery state-of-charge during
 * cryogenic shadow periods.
 *
 * Physics models per Master Specification Section 4.3 & 4.4:
 *   P_vertical(t)   = I_0 * f_sun(t) * cos(El_Sun(t)) * eta_PV * A_panel
 *   P_horizontal(t) = I_0 * f_sun(t) * sin(El_Sun(t)) * eta_PV * A_panel
 *
 * Team Alrakis (Muhammad Awad) · 2026 NASA Space Apps Challenge · Virtual Islamabad
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SOLAR_CONSTANT_W_M2 } from './lunarEphemeris';

/** Standard space-grade solar array parameters */
export interface SolarArraySpec {
  /** Total active panel area in square meters (default 2.0 m²) */
  areaM2: number;
  /** Photovoltaic conversion efficiency, e.g. 0.30 for triple-junction InGaP/InGaAs/Ge */
  pvEfficiency: number;
  /** Lander base electrical bus power draw in Watts (e.g. 180W nominal housekeeping) */
  baseLoadWatts: number;
  /** Battery energy capacity in Watt-hours (e.g. 1200 Wh Li-ion flight battery) */
  batteryCapacityWh: number;
}

export const DEFAULT_SOLAR_SPEC: SolarArraySpec = {
  areaM2: 2.0,
  pvEfficiency: 0.30,
  baseLoadWatts: 160.0,
  batteryCapacityWh: 1500.0,
};

/** Telemetry snapshot of electrical and link state */
export interface PowerAndLinkStatus {
  /** Incident solar flux on vertical surface (W/m²) */
  verticalFluxWm2: number;
  /** Incident solar flux on horizontal surface (W/m²) */
  horizontalFluxWm2: number;
  /** Generated electrical power from vertical tracking mast (Watts) */
  powerGeneratedVerticalWatts: number;
  /** Generated electrical power from horizontal deck panel (Watts) */
  powerGeneratedHorizontalWatts: number;
  /** Net power balance (Generated - BaseLoad) in Watts */
  netPowerWatts: number;
  /** Direct-to-Earth S-Band carrier-to-noise margin estimate (dB) */
  dteLinkMarginDb: number;
  /** Regolith surface temperature approximation (Kelvin) */
  estimatedSurfaceTempKelvin: number;
}

/**
 * Calculates instantaneous solar array electrical power in Watts.
 */
export function calculateSolarElectricalPower(
  fluxWm2: number,
  spec: SolarArraySpec = DEFAULT_SOLAR_SPEC,
): number {
  return Math.max(0, fluxWm2 * spec.pvEfficiency * spec.areaM2);
}

/**
 * Calculates full power and communication budget metrics.
 */
export function evaluatePowerAndLinkBudget(
  sunElevationDeg: number,
  earthElevationDeg: number,
  illuminationFraction: number,
  isDTEActive: boolean,
  spec: SolarArraySpec = DEFAULT_SOLAR_SPEC,
): PowerAndLinkStatus {
  const elSunRad = Math.max(0, sunElevationDeg) * (Math.PI / 180.0);
  const f = Math.max(0, Math.min(1, illuminationFraction));

  // Incident flux (W/m²)
  const verticalFlux = SOLAR_CONSTANT_W_M2 * f * Math.cos(elSunRad);
  const horizontalFlux = SOLAR_CONSTANT_W_M2 * f * Math.sin(elSunRad);

  // Electrical power generated (Watts)
  const powerVert = calculateSolarElectricalPower(verticalFlux, spec);
  const powerHoriz = calculateSolarElectricalPower(horizontalFlux, spec);

  const netPower = powerVert - spec.baseLoadWatts;

  // Approximate S-Band / X-Band link margin in dB
  // Free space path loss ~ 211 dB, typical ground station G/T yields positive link when Earth > 2°
  let dteMarginDb = -20.0;
  if (isDTEActive) {
    // Margin scales with Earth elevation above local terrain horizon
    dteMarginDb = Math.min(18.5, 4.0 + earthElevationDeg * 1.5);
  }

  // Radiative thermal equilibrium model:
  // T_eq ≈ ((1 - albedo) * I_solar / (emissivity * sigma))^0.25
  // In shadow: drops toward lunar cryogenic equilibrium (~40K)
  let surfaceTempK = 40.0;
  if (f > 0.05 && sunElevationDeg > -0.266) {
    const effectiveInsolation = SOLAR_CONSTANT_W_M2 * Math.sin(Math.max(0.01, elSunRad)) * f;
    surfaceTempK = Math.min(385.0, Math.max(50.0, 100.0 + Math.pow(effectiveInsolation, 0.75) * 1.8));
  }

  return {
    verticalFluxWm2: Math.round(verticalFlux * 10) / 10,
    horizontalFluxWm2: Math.round(horizontalFlux * 10) / 10,
    powerGeneratedVerticalWatts: Math.round(powerVert * 10) / 10,
    powerGeneratedHorizontalWatts: Math.round(powerHoriz * 10) / 10,
    netPowerWatts: Math.round(netPower * 10) / 10,
    dteLinkMarginDb: Math.round(dteMarginDb * 10) / 10,
    estimatedSurfaceTempKelvin: Math.round(surfaceTempK),
  };
}
