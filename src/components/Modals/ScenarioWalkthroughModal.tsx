import React from 'react';
import { useMissionStore } from '../../store/missionStore';

interface ScenarioWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScenarioWalkthroughModal: React.FC<ScenarioWalkthroughModalProps> = ({ isOpen, onClose }) => {
  const setSelectedSiteId = useMissionStore((s) => s.setSelectedSiteId);
  const setCompareSiteId = useMissionStore((s) => s.setCompareSiteId);
  const setLaunchSlipDays = useMissionStore((s) => s.setLaunchSlipDays);
  const setMastHeightMeters = useMissionStore((s) => s.setMastHeightMeters);
  const setSimulationDate = useMissionStore((s) => s.setSimulationDate);
  const setTimelineStart = useMissionStore((s) => s.setTimelineStart);

  if (!isOpen) return null;

  const scenarios = [
    {
      id: 'artemis-nominal',
      tag: '01 // NOMINAL MISSION',
      title: 'Artemis III South Pole Landing (Shackleton Rim)',
      badge: 'PEAK OF ETERNAL LIGHT',
      badgeColor: 'var(--accent-solar-hi)',
      description:
        'Lander touches down on the illuminated crest of Shackleton crater rim. Sun skims horizontally at 2.1° elevation, delivering 1,360 W/m² to vertical solar arrays while the interior floor rests in 40 Kelvin eternal shadow.',
      actionLabel: 'EXECUTE NOMINAL SCENARIO',
      apply: () => {
        setSelectedSiteId('shackleton-rim');
        setMastHeightMeters(5.0);
        const d = new Date('2026-11-15T00:00:00Z');
        setTimelineStart(d);
        setSimulationDate(d);
        onClose();
      },
    },
    {
      id: 'contingency-slip',
      tag: '02 // CONTINGENCY TRADE',
      title: 'Hardware Delay: +14-Day Launch Slip Matrix',
      badge: 'SITE-SWAP ACTIVE',
      badgeColor: 'var(--accent-earth-hi)',
      description:
        'A two-week launch delay plunges Shackleton into local crater shadow. The Contingency Diff Engine evaluates Malapert Massif as the alternate site, proving a +18 point feasibility boost with 94% Direct-to-Earth communication availability.',
      actionLabel: 'LOAD CONTINGENCY DIFF',
      apply: () => {
        setSelectedSiteId('shackleton-rim');
        setCompareSiteId('malapert-massif');
        setLaunchSlipDays(14);
        onClose();
      },
    },
    {
      id: 'viper-recon',
      tag: '03 // COLD-TRAP ROVER',
      title: 'VIPER Water-Ice Reconnaissance (Nobile Rim 1)',
      badge: 'VOLATILE PROSPECTING',
      badgeColor: 'var(--surface-psr)',
      description:
        'Direct reconnaissance near South Pole cryogenic ice traps. Low local slopes (4.9°) allow rover ingress into micro-cold traps while maintaining line-of-sight to high-elevation DTE relay nodes.',
      actionLabel: 'LOAD VIPER RECON TARGET',
      apply: () => {
        setSelectedSiteId('nobile-rim-1');
        setMastHeightMeters(3.5);
        onClose();
      },
    },
    {
      id: 'mast-elevation',
      tag: '04 // MAST CLEARANCE',
      title: 'Dynamic Mast Extension: Shadow Clearance (0m → 12m)',
      badge: 'AVIONICS SIMULATION',
      badgeColor: 'var(--accent-solar)',
      description:
        'Demonstrates how deploying an adjustable solar mast from 0m to 12m lowers the apparent topographic horizon by 0.12°, lifting the solar array out of mountain rim shadow and restoring 816 Watts of electrical generation.',
      actionLabel: 'SIMULATE MAST DEPLOYMENT',
      apply: () => {
        setSelectedSiteId('haworth-crater-rim');
        setMastHeightMeters(12.0);
        onClose();
      },
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(9, 10, 13, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '92%',
          maxWidth: '820px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-surface-1)',
          border: '1px solid var(--border-active)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.9)',
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            backgroundColor: 'var(--bg-surface-2)',
            borderBottom: '1px solid var(--border-hairline)',
            borderLeft: '4px solid var(--accent-solar)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="badge-precomputed">GUIDED MISSION SCENARIOS</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 'bold' }}>
              ALRAKIS // FLIGHT DYNAMICS EVALUATION SUITE
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.2rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body / Scenarios Grid */}
        <div
          style={{
            padding: '1.25rem',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '1rem',
          }}
        >
          {scenarios.map((sc) => (
            <div
              key={sc.id}
              style={{
                backgroundColor: 'var(--bg-surface-2)',
                border: '1px solid var(--border-hairline)',
                borderRadius: '3px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.2s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                    {sc.tag}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.58rem',
                      padding: '2px 6px',
                      borderRadius: '2px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${sc.badgeColor}`,
                      color: sc.badgeColor,
                    }}
                  >
                    {sc.badge}
                  </span>
                </div>

                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {sc.title}
                </div>

                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
                  {sc.description}
                </p>
              </div>

              <button
                className="btn-tactical-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.5rem', fontSize: '0.70rem' }}
                onClick={sc.apply}
              >
                {sc.actionLabel}
              </button>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.6rem 1.25rem',
            backgroundColor: 'var(--bg-surface-2)',
            borderTop: '1px solid var(--border-hairline)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
            Calibrated for Space Apps 2026 Virtual Islamabad Judging Protocol
          </span>
          <button className="btn-tactical-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.68rem' }} onClick={onClose}>
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
