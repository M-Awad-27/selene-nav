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
  const setPersona = useMissionStore((s) => s.setPersona);
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
        const fallback = CURATED_LANDING_SITES.map((s, idx) => ({
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
    <div className="flight-deck-shell">
      {/* ── Top Command Bar (56px) ── */}
      <MissionHeader
        onOpenJplModal={() => setIsJplModalOpen(true)}
        onOpenScenarioModal={() => setIsScenarioModalOpen(true)}
      />

      {/* ── Main Workspace Row (1fr) ── */}
      <main className="flight-deck-workspace">
        {/* Left Panel: Procedural LOLA Crater Relief Map & Raycast Fan (5 cols) */}
        <section className="bento-panel" id="q1-polar-map">
          <PolarStereographicMap />
        </section>

        {/* Right Panel: 360° Horizon Skyline + Polar Radar Sky-Dome (7 cols) */}
        <section className="bento-panel" id="q2-horizon">
          <HorizonPanorama />
        </section>
      </main>

      {/* ── Bottom Dock Row (185px) ── */}
      <footer className="flight-deck-dock">
        {/* Bottom-Left: 708-Hour Lunar Synodic Timeline (8 cols) */}
        <section style={{ height: '100%', minHeight: 0 }}>
          <SynodicTimeline />
        </section>

        {/* Bottom-Right: Contingency Diff Matrix (4 cols) */}
        <section style={{ height: '100%', minHeight: 0 }}>
          <ContingencyMatrix />
        </section>
      </footer>

      {/* ── Educator & Public Explorer Overlay Drawer (when Persona 02 is active) ── */}
      {persona === 'educator' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(9, 10, 13, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '2rem 1rem',
            overflowY: 'auto',
          }}
          onClick={() => setPersona('flight-dynamics')}
        >
          <div
            style={{ width: '100%', maxWidth: '1240px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.4rem' }}>
              <button
                className="btn-tactical-primary"
                style={{ padding: '0.35rem 0.8rem', fontSize: '0.68rem' }}
                onClick={() => setPersona('flight-dynamics')}
              >
                ✕ RETURN TO FLIGHT DYNAMICS DECK
              </button>
            </div>
            <EducatorPanel />
          </div>
        </div>
      )}

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