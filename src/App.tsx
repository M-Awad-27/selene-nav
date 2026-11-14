import { useEffect, useState } from 'react';
import { useMissionStore } from './store/missionStore';
import { MissionHeader } from './components/Header/MissionHeader';
import { PolarStereographicMap } from './components/Quadrant1/PolarStereographicMap';
import { HorizonPanorama } from './components/Quadrant2/HorizonPanorama';
import { SynodicTimeline } from './components/Quadrant3/SynodicTimeline';
import { ContingencyMatrix } from './components/Quadrant4/ContingencyMatrix';
import { EducatorPanel } from './components/Educator/EducatorPanel';
import { JplInspectorModal } from './components/Modals/JplInspectorModal';
import { ScenarioWalkthroughModal } from './components/Modals/ScenarioWalkthroughModal';
import { CURATED_LANDING_SITES } from './engine/lunarEphemeris';
import './styles/selene-tactical.css';

export function App() {
  const [isJplModalOpen, setIsJplModalOpen] = useState(false);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const persona = useMissionStore((s) => s.persona);
  const setSitesRegistry = useMissionStore((s) => s.setSitesRegistry);
  const setHorizonProfiles = useMissionStore((s) => s.setHorizonProfiles);

  // Initialize data on mount
  useEffect(() => {
    // 1. Load curated landing sites
    fetch('/data/landing_sites_registry.json')
      .then((res) => {
        if (!res.ok) throw new Error('Registry fetch error');
        return res.json();
      })
      .then((data) => {
        setSitesRegistry(data);
      })
      .catch(() => {
        // Fallback to inline curated sites
        const fallback = CURATED_LANDING_SITES.map((s, idx) => ({
          id: s.name.toLowerCase().replace(/\s+/g, '-'),
          name: s.name,
          program: s.program,
          category: s.program.includes('Artemis') ? 'artemis-polar' : 'historic-benchmark',
          lat: s.coordinate.latDeg,
          lon: s.coordinate.lonDeg,
          elevationKm: s.coordinate.elevationKm,
          slopeDeg: 5.0 + (idx % 4) * 2.0,
          profile: s.operationalProfile,
          targetHighlight: 'Curated lunar target',
          nominalSunFraction: 0.75,
          nominalDteFraction: 0.70,
        }));
        setSitesRegistry(fallback);
      });

    // 2. Load 360° LOLA Horizon profiles
    fetch('/data/lola_horizon_profiles.json')
      .then((res) => {
        if (!res.ok) throw new Error('Horizon fetch error');
        return res.json();
      })
      .then((data) => {
        const profilesMap: Record<string, number[]> = {};
        if (data.sites) {
          for (const key of Object.keys(data.sites)) {
            profilesMap[key] = data.sites[key].profile360;
          }
        }
        setHorizonProfiles(profilesMap);
      })
      .catch(() => {
        console.warn('Using analytical flat horizon fallback');
      });
  }, [setSitesRegistry, setHorizonProfiles]);

  return (
    <div className="app-shell">
      {/* ── Top Bar: Mission Control Header & Persona Switcher ── */}
      <MissionHeader
        onOpenJplModal={() => setIsJplModalOpen(true)}
        onOpenScenarioModal={() => setIsScenarioModalOpen(true)}
      />

      {/* ── Optional Educator Deck Ribbon when in Persona 02 ── */}
      {persona === 'educator' && <EducatorPanel />}

      {/* ── Viewport Grid: All 4 Engineering Quadrants ── */}
      <main className="viewport-grid">
        {/* Quadrant 1: South Pole Stereographic Map & Hazard Overlay */}
        <section className="panel" id="q1-polar-map">
          <div className="panel-header">
            <span className="panel-id">Q1</span>
            <span className="panel-title">SOUTH POLE STEREOGRAPHIC MAP</span>
          </div>
          <PolarStereographicMap />
        </section>

        {/* Quadrant 2: 360° Lander's-Eye Topographic Horizon Panorama */}
        <section className="panel" id="q2-horizon">
          <div className="panel-header">
            <span className="panel-id">Q2</span>
            <span className="panel-title">360° HORIZON PANORAMA & SKYLINE RAYCASTER</span>
          </div>
          <HorizonPanorama />
        </section>

        {/* Quadrant 3: 708-Hour Lunar Synodic Timeline Scrubber */}
        <section className="panel" id="q3-timeline">
          <div className="panel-header">
            <span className="panel-id">Q3</span>
            <span className="panel-title">708-HR SYNODIC TIMELINE SCRUBBER</span>
          </div>
          <SynodicTimeline />
        </section>

        {/* Quadrant 4: Contingency Diff Matrix (Site-Swap & Launch-Delay) */}
        <section className="panel" id="q4-contingency">
          <div className="panel-header">
            <span className="panel-id">Q4</span>
            <span className="panel-title">CONTINGENCY DIFF MATRIX (SITE SWAP & LAUNCH DELAY)</span>
          </div>
          <ContingencyMatrix />
        </section>
      </main>

      {/* ── Footer: Data Sources, Disclosures & Badges ── */}
      <footer className="mission-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="badge-precomputed">PRE-COMPUTED LOLA 80M DEM</span>
          <span className="badge-live">LIVE JPL HORIZONS API COMPLIANT</span>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          TEAM ALRAKIS (MUHAMMAD AWAD) · NASA SPACE APPS 2026 (VIRTUAL ISLAMABAD) · MIT LICENSE · AI-ASSISTED ARCHITECTURE
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent-solar-hi)' }}>
          AIRLESS TOPOCENTRIC SOLVER v2.6
        </div>
      </footer>

      {/* ── NASA JPL Horizons Ephemeris Verifier Modal ── */}
      <JplInspectorModal
        isOpen={isJplModalOpen}
        onClose={() => setIsJplModalOpen(false)}
      />

      {/* ── Interactive Scenario Walkthrough Modal ── */}
      <ScenarioWalkthroughModal
        isOpen={isScenarioModalOpen}
        onClose={() => setIsScenarioModalOpen(false)}
      />
    </div>
  );
}

export default App;
