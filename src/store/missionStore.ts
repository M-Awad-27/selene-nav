/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ALRAKIS // SELENE-NAV — Mission Control Telemetry Store
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Unified reactive state store coordinating:
 * - Active landing site selection (from 12 curated sites or custom pin)
 * - Current UTC simulation timestamp & 708-hour timeline scrubber
 * - Solar mast height slider (0–15 m)
 * - Persona mode: Flight Dynamics Engineer (01) vs Educator & Explorer (02)
 * - Contingency comparison targets (Site A vs Site B, Launch slip delta)
 * - Preloaded 360° LOLA terrain horizon profiles
 *
 * Team Alrakis (Muhammad Awad) · 2026 NASA Space Apps Challenge · Virtual Islamabad
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand';
import {
  LunarCoordinate,
  computeTopocentricPosition,
  computeIlluminationFraction,
  CelestialPosition,
  CURATED_LANDING_SITES,
} from '../engine/lunarEphemeris';
import {
  getInterpolatedHorizonElevation,
  evaluateLineOfSight,
  formatTacticalDuration,
  HorizonCrossingCountdown,
} from '../engine/horizonRaycaster';
import {
  evaluatePowerAndLinkBudget,
  PowerAndLinkStatus,
} from '../engine/powerAndLinkBudget';

export type PersonaMode = 'flight-dynamics' | 'educator';

export interface SiteRegistryItem {
  id: string;
  name: string;
  program: string;
  category: string;
  lat: number;
  lon: number;
  elevationKm: number;
  slopeDeg: number;
  profile: string;
  targetHighlight: string;
  nominalSunFraction: number;
  nominalDteFraction: number;
}

interface MissionState {
  // ── Persona ──
  persona: PersonaMode;
  setPersona: (mode: PersonaMode) => void;

  // ── Mission Simulation Deck ──
  isSimulationOpen: boolean;
  setIsSimulationOpen: (open: boolean) => void;

  // ── Time & Playback ──
  simulationDate: Date;
  timelineStart: Date;
  timelineHours: number; // usually 708 hours (1 synodic month)
  isPlaying: boolean;
  playbackSpeed: number; // 1x, 60x, 720x
  setSimulationDate: (date: Date) => void;
  setTimelineStart: (date: Date) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;

  // ── Landing Site ──
  selectedSiteId: string;
  customCoordinate: LunarCoordinate | null;
  mastHeightMeters: number;
  setSelectedSiteId: (siteId: string) => void;
  setCustomCoordinate: (coord: LunarCoordinate | null) => void;
  setMastHeightMeters: (height: number) => void;

  // ── Contingency Comparison (Quadrant 4) ──
  compareSiteId: string;
  launchSlipDays: number; // 0, 7, 14, 29
  setCompareSiteId: (siteId: string) => void;
  setLaunchSlipDays: (days: number) => void;

  // ── Preloaded Data ──
  sitesRegistry: SiteRegistryItem[];
  horizonProfiles: Record<string, number[]>;
  setSitesRegistry: (sites: SiteRegistryItem[]) => void;
  setHorizonProfiles: (profiles: Record<string, number[]>) => void;

  // ── Derived Ephemeris & Telemetry ──
  currentSun: CelestialPosition;
  currentEarth: CelestialPosition;
  currentIlluminationFraction: number;
  currentSunClear: boolean;
  currentDteActive: boolean;
  powerAndLink: PowerAndLinkStatus;
  sunsetCountdown: HorizonCrossingCountdown;
  earthsetCountdown: HorizonCrossingCountdown;

  // Update loop
  recomputeTelemetry: () => void;
}

// Initial mission launch window: Artemis III window near late 2026
const INITIAL_DATE = new Date('2026-11-15T00:00:00Z');

export const useMissionStore = create<MissionState>((set, get) => ({
  persona: 'flight-dynamics',
  setPersona: (mode) => set({ persona: mode }),

  isSimulationOpen: false,
  setIsSimulationOpen: (open) => set({ isSimulationOpen: open }),

  simulationDate: INITIAL_DATE,
  timelineStart: INITIAL_DATE,
  timelineHours: 708,
  isPlaying: false,
  playbackSpeed: 60,
  setSimulationDate: (date) => {
    set({ simulationDate: date });
    get().recomputeTelemetry();
  },
  setTimelineStart: (date) => {
    set({ timelineStart: date });
    get().recomputeTelemetry();
  },
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  selectedSiteId: 'shackleton-rim',
  customCoordinate: null,
  mastHeightMeters: 5.0,
  setSelectedSiteId: (siteId) => {
    set({ selectedSiteId: siteId, customCoordinate: null });
    get().recomputeTelemetry();
  },
  setCustomCoordinate: (coord) => {
    set({ customCoordinate: coord });
    get().recomputeTelemetry();
  },
  setMastHeightMeters: (height) => {
    set({ mastHeightMeters: height });
    get().recomputeTelemetry();
  },

  compareSiteId: 'malapert-massif',
  launchSlipDays: 0,
  setCompareSiteId: (siteId) => set({ compareSiteId: siteId }),
  setLaunchSlipDays: (days) => set({ launchSlipDays: days }),

  sitesRegistry: CURATED_LANDING_SITES.map((s, idx) => ({
    id: s.name.toLowerCase().replace(/\s+/g, '-'),
    name: s.name,
    program: s.program,
    category: s.program.includes('Artemis') ? 'artemis-polar' : 'historic-benchmark',
    lat: s.coordinate.latDeg,
    lon: s.coordinate.lonDeg,
    elevationKm: s.coordinate.elevationKm,
    slopeDeg: 4.2 + (idx % 4) * 1.5,
    profile: s.operationalProfile,
    targetHighlight: 'Curated lunar target',
    nominalSunFraction: 0.75,
    nominalDteFraction: 0.70,
  })),
  horizonProfiles: {},
  setSitesRegistry: (sites) => {
    set({ sitesRegistry: sites });
    get().recomputeTelemetry();
  },
  setHorizonProfiles: (profiles) => {
    set({ horizonProfiles: profiles });
    get().recomputeTelemetry();
  },

  // Telemetry defaults
  currentSun: { azimuthDeg: 0, elevationDeg: 1.5, distanceKm: 149597870 },
  currentEarth: { azimuthDeg: 180, elevationDeg: 6.0, distanceKm: 384400 },
  currentIlluminationFraction: 1.0,
  currentSunClear: true,
  currentDteActive: true,
  powerAndLink: {
    verticalFluxWm2: 1360,
    horizontalFluxWm2: 35,
    powerGeneratedVerticalWatts: 816,
    powerGeneratedHorizontalWatts: 21,
    netPowerWatts: 656,
    dteLinkMarginDb: 13.0,
    estimatedSurfaceTempKelvin: 220,
  },
  sunsetCountdown: {
    target: 'sun',
    isCurrentlyVisible: true,
    timeToCrossingMs: 3600000 * 48,
    formattedCountdown: '48h 00m',
    nextCrossingDate: null,
    isSetting: true,
  },
  earthsetCountdown: {
    target: 'earth',
    isCurrentlyVisible: true,
    timeToCrossingMs: 3600000 * 112,
    formattedCountdown: '112h 00m',
    nextCrossingDate: null,
    isSetting: true,
  },

  recomputeTelemetry: () => {
    const state = get();
    const {
      simulationDate,
      selectedSiteId,
      customCoordinate,
      mastHeightMeters,
      horizonProfiles,
      sitesRegistry,
    } = state;

    // Determine coordinate
    let siteCoord: LunarCoordinate;
    if (customCoordinate) {
      siteCoord = customCoordinate;
    } else {
      const reg = sitesRegistry.find((s) => s.id === selectedSiteId);
      if (reg) {
        siteCoord = {
          latDeg: reg.lat,
          lonDeg: reg.lon,
          elevationKm: reg.elevationKm,
        };
      } else {
        siteCoord = { latDeg: -89.54, lonDeg: 137.0, elevationKm: 1.25 };
      }
    }

    // 1. Calculate topocentric Sun & Earth
    const sun = computeTopocentricPosition(simulationDate, siteCoord, 'sun');
    const earth = computeTopocentricPosition(simulationDate, siteCoord, 'earth');

    // 2. Horizon silhouette
    const profile = horizonProfiles[selectedSiteId] || [];
    const sunLos = evaluateLineOfSight(sun.azimuthDeg, sun.elevationDeg, profile, 'sun', mastHeightMeters);
    const earthLos = evaluateLineOfSight(earth.azimuthDeg, earth.elevationDeg, profile, 'earth', mastHeightMeters);

    const horizonSunElev = getInterpolatedHorizonElevation(sun.azimuthDeg, profile, mastHeightMeters);
    const illumFrac = computeIlluminationFraction(sun.elevationDeg, horizonSunElev);
    const dteActive = earthLos.isClear;

    // 3. Power & Link Budget
    const power = evaluatePowerAndLinkBudget(sun.elevationDeg, earth.elevationDeg, illumFrac, dteActive);

    // 4. Horizon Crossing Countdowns (Fast Coarse + Bisection Search for 60 FPS)
    const coarseStepHours = 3.0; // Coarse search over 720 hours (30 days)
    const maxCoarseSteps = 240;
    let timeToSunsetMs: number | null = null;
    let timeToEarthsetMs: number | null = null;
    const currentSunVis = sunLos.isClear;
    const currentEarthVis = earthLos.isClear;

    for (let i = 1; i < maxCoarseSteps; i++) {
      const checkDate = new Date(simulationDate.getTime() + i * coarseStepHours * 3600000);

      // Sun crossing
      if (timeToSunsetMs === null) {
        const s = computeTopocentricPosition(checkDate, siteCoord, 'sun');
        const sLos = evaluateLineOfSight(s.azimuthDeg, s.elevationDeg, profile, 'sun', mastHeightMeters);
        if (sLos.isClear !== currentSunVis) {
          // Bisection refine between (i-1) and i
          let tLow = (i - 1) * coarseStepHours * 3600000;
          let tHigh = i * coarseStepHours * 3600000;
          for (let b = 0; b < 6; b++) {
            const tMid = (tLow + tHigh) / 2;
            const midDate = new Date(simulationDate.getTime() + tMid);
            const sm = computeTopocentricPosition(midDate, siteCoord, 'sun');
            const smLos = evaluateLineOfSight(sm.azimuthDeg, sm.elevationDeg, profile, 'sun', mastHeightMeters);
            if (smLos.isClear === currentSunVis) {
              tLow = tMid;
            } else {
              tHigh = tMid;
            }
          }
          timeToSunsetMs = tHigh;
        }
      }

      // Earth crossing
      if (timeToEarthsetMs === null) {
        const e = computeTopocentricPosition(checkDate, siteCoord, 'earth');
        const eLos = evaluateLineOfSight(e.azimuthDeg, e.elevationDeg, profile, 'earth', mastHeightMeters);
        if (eLos.isClear !== currentEarthVis) {
          // Bisection refine between (i-1) and i
          let tLow = (i - 1) * coarseStepHours * 3600000;
          let tHigh = i * coarseStepHours * 3600000;
          for (let b = 0; b < 6; b++) {
            const tMid = (tLow + tHigh) / 2;
            const midDate = new Date(simulationDate.getTime() + tMid);
            const em = computeTopocentricPosition(midDate, siteCoord, 'earth');
            const emLos = evaluateLineOfSight(em.azimuthDeg, em.elevationDeg, profile, 'earth', mastHeightMeters);
            if (emLos.isClear === currentEarthVis) {
              tLow = tMid;
            } else {
              tHigh = tMid;
            }
          }
          timeToEarthsetMs = tHigh;
        }
      }

      if (timeToSunsetMs !== null && timeToEarthsetMs !== null) break;
    }

    set({
      currentSun: sun,
      currentEarth: earth,
      currentIlluminationFraction: illumFrac,
      currentSunClear: sunLos.isClear,
      currentDteActive: dteActive,
      powerAndLink: power,
      sunsetCountdown: {
        target: 'sun',
        isCurrentlyVisible: currentSunVis,
        timeToCrossingMs: timeToSunsetMs,
        formattedCountdown: timeToSunsetMs
          ? formatTacticalDuration(timeToSunsetMs)
          : (currentSunVis ? 'PERMANENT LIGHT' : 'PERMANENT SHADOW'),
        nextCrossingDate: timeToSunsetMs ? new Date(simulationDate.getTime() + timeToSunsetMs) : null,
        isSetting: currentSunVis,
      },
      earthsetCountdown: {
        target: 'earth',
        isCurrentlyVisible: currentEarthVis,
        timeToCrossingMs: timeToEarthsetMs,
        formattedCountdown: timeToEarthsetMs
          ? formatTacticalDuration(timeToEarthsetMs)
          : (currentEarthVis ? 'CONTINUOUS DTE' : 'OCCULTED / FAR SIDE'),
        nextCrossingDate: timeToEarthsetMs ? new Date(simulationDate.getTime() + timeToEarthsetMs) : null,
        isSetting: currentEarthVis,
      },
    });
  },
}));
