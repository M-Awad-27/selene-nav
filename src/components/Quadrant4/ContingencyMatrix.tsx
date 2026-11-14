import React, { useMemo } from 'react';
import { useMissionStore } from '../../store/missionStore';
import {
  generateEphemerisTimeline,
  analyzeTimeline,
} from '../../engine/lunarEphemeris';

export const ContingencyMatrix: React.FC = () => {
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const compareSiteId = useMissionStore((s) => s.compareSiteId);
  const setCompareSiteId = useMissionStore((s) => s.setCompareSiteId);
  const launchSlipDays = useMissionStore((s) => s.launchSlipDays);
  const setLaunchSlipDays = useMissionStore((s) => s.setLaunchSlipDays);
  const sitesRegistry = useMissionStore((s) => s.sitesRegistry);
  const horizonProfiles = useMissionStore((s) => s.horizonProfiles);
  const timelineStart = useMissionStore((s) => s.timelineStart);

  // Site A (Nominal)
  const siteA = sitesRegistry.find((s) => s.id === selectedSiteId) || sitesRegistry[0];
  // Site B (Contingency)
  const siteB = sitesRegistry.find((s) => s.id === compareSiteId) || sitesRegistry[1] || siteA;

  // Profiles
  const profileA = horizonProfiles[siteA?.id || ''] || [];
  const profileB = horizonProfiles[siteB?.id || ''] || [];

  // Compute metrics for Site A
  const metricsA = useMemo(() => {
    if (!siteA) return null;
    const start = timelineStart;
    const end = new Date(start.getTime() + 708 * 3600000);
    const coordA = { latDeg: siteA.lat, lonDeg: siteA.lon, elevationKm: siteA.elevationKm };
    const timeline = generateEphemerisTimeline(coordA, start, end, 120, profileA);
    return analyzeTimeline(timeline, siteA.slopeDeg);
  }, [siteA, timelineStart, profileA]);

  // Compute metrics for Site B (with launch slip offset)
  const metricsB = useMemo(() => {
    if (!siteB) return null;
    const start = new Date(timelineStart.getTime() + launchSlipDays * 24 * 3600000);
    const end = new Date(start.getTime() + 708 * 3600000);
    const coordB = { latDeg: siteB.lat, lonDeg: siteB.lon, elevationKm: siteB.elevationKm };
    const timeline = generateEphemerisTimeline(coordB, start, end, 120, profileB);
    return analyzeTimeline(timeline, siteB.slopeDeg);
  }, [siteB, timelineStart, launchSlipDays, profileB]);

  if (!siteA || !siteB || !metricsA || !metricsB) {
    return <div className="bento-panel font-mono text-muted" style={{ padding: '0.8rem' }}>Computing contingency telemetry...</div>;
  }

  // Deltas: B - A
  const deltaScore = metricsB.score - metricsA.score;
  const deltaSun = (metricsB.solarFraction - metricsA.solarFraction) * 100;
  const deltaDte = (metricsB.dteFraction - metricsA.dteFraction) * 100;
  const deltaEclipse = metricsB.maxEclipseHours - metricsA.maxEclipseHours;

  const handleExportBriefing = () => {
    const report = `================================================================================
ALRAKIS // SELENE-NAV — MISSION CONTINGENCY EVALUATION BRIEFING
NASA Space Apps Challenge 2026 · Virtual Islamabad Chapter · Team Alrakis
================================================================================
Generated at UTC: ${new Date().toISOString()}
Simulation Window: 708-Hour Lunar Synodic Month (Epoch: ${timelineStart.toISOString()})
Launch Slip Offset: +${launchSlipDays} Days (${launchSlipDays * 24} Hours)

[NOMINAL TARGET - SITE A]
Name: ${siteA.name} (${siteA.program})
Coordinates: Lat ${siteA.lat}°S, Lon ${siteA.lon}°E, Alt ${siteA.elevationKm} km
Solar Sunlight Fraction: ${(metricsA.solarFraction * 100).toFixed(1)}%
Direct-to-Earth Comm: ${(metricsA.dteFraction * 100).toFixed(1)}%
Max Continuous Eclipse: ${metricsA.maxEclipseHours.toFixed(1)}h
Composite Feasibility Score: ${metricsA.score} / 100

[CONTINGENCY TARGET - SITE B]
Name: ${siteB.name} (${siteB.program})
Coordinates: Lat ${siteB.lat}°S, Lon ${siteB.lon}°E, Alt ${siteB.elevationKm} km
Solar Sunlight Fraction: ${(metricsB.solarFraction * 100).toFixed(1)}%
Direct-to-Earth Comm: ${(metricsB.dteFraction * 100).toFixed(1)}%
Max Continuous Eclipse: ${metricsB.maxEclipseHours.toFixed(1)}h
Composite Feasibility Score: ${metricsB.score} / 100

[DELTA METRIC COMPARISON (B - A)]
Δ Composite Score: ${deltaScore >= 0 ? '+' : ''}${deltaScore} pts
Δ Solar Illumination: ${deltaSun >= 0 ? '+' : ''}${deltaSun.toFixed(1)}%
Δ Direct-to-Earth Comm: ${deltaDte >= 0 ? '+' : ''}${deltaDte.toFixed(1)}%
Δ Max Eclipse Duration: ${deltaEclipse > 0 ? '+' : ''}${deltaEclipse.toFixed(1)}h
`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ALRAKIS_CONTINGENCY_BRIEFING_${siteA.name.replace(/\s+/g, '_')}_VS_${siteB.name.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bento-panel" style={{ height: '100%' }}>
      <div className="corner-tr" />
      <div className="corner-bl" />

      {/* Header */}
      <div className="bento-panel-header">
        <span>CONTINGENCY DIFF MATRIX</span>
        <button
          className="btn-tactical-secondary"
          style={{ padding: '0.12rem 0.45rem', fontSize: '0.58rem' }}
          onClick={handleExportBriefing}
          title="Download official contingency evaluation briefing text release"
        >
          [EXPORT BRIEFING]
        </button>
      </div>

      {/* Dock Content Body */}
      <div className="contingency-dock-container">
        {/* Scenario Header Selection Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '3px' }}>
          {/* Site A (Nominal) */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.60rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>SCENARIO A: </span>
            <strong style={{ color: 'var(--accent-solar-hi)' }}>{siteA.name.split(' ')[0]}</strong>
          </div>

          {/* Site B (Contingency Selector) */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.60rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--text-muted)' }}>SCENARIO B:</span>
            <select
              value={compareSiteId}
              onChange={(e) => setCompareSiteId(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-surface-2)',
                color: 'var(--accent-earth-hi)',
                border: '1px solid var(--border-hairline)',
                fontSize: '0.58rem',
                fontFamily: 'var(--font-mono)',
                padding: '1px 3px',
                borderRadius: '2px',
                outline: 'none',
              }}
            >
              {sitesRegistry.map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === selectedSiteId}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 1: Δ POWER / SOLAR ILLUMINATION */}
        <div className="contingency-row-bar">
          <span style={{ width: '75px', color: 'var(--text-secondary)' }}>Δ POWER %:</span>
          <div className="contingency-progress-track">
            <div
              className="contingency-progress-fill"
              style={{
                width: `${Math.max(10, Math.min(100, metricsB.solarFraction * 100))}%`,
                backgroundColor: deltaSun >= 0 ? 'var(--accent-solar-hi)' : 'var(--status-hazard)',
              }}
            />
          </div>
          <span style={{ width: '85px', textAlign: 'right', fontWeight: 'bold', color: deltaSun >= 0 ? 'var(--accent-solar-hi)' : 'var(--status-hazard)' }}>
            {deltaSun >= 0 ? `+${deltaSun.toFixed(1)}%` : `${deltaSun.toFixed(1)}%`} POWER
          </span>
        </div>

        {/* Row 2: Δ ECLIPSE DURATION */}
        <div className="contingency-row-bar">
          <span style={{ width: '75px', color: 'var(--text-secondary)' }}>Δ ECLIPSE:</span>
          <div className="contingency-progress-track">
            <div
              className="contingency-progress-fill"
              style={{
                width: `${Math.max(10, Math.min(100, (metricsB.maxEclipseHours / 350) * 100))}%`,
                backgroundColor: deltaEclipse <= 0 ? 'var(--accent-earth-hi)' : 'var(--status-hazard)',
              }}
            />
          </div>
          <span style={{ width: '85px', textAlign: 'right', fontWeight: 'bold', color: deltaEclipse <= 0 ? 'var(--accent-earth-hi)' : 'var(--status-hazard)' }}>
            {deltaEclipse >= 0 ? `+${deltaEclipse.toFixed(1)}h` : `${deltaEclipse.toFixed(1)}h`} ECLIPSE
          </span>
        </div>

        {/* Row 3: DTE COMM COVERAGE */}
        <div className="contingency-row-bar">
          <span style={{ width: '75px', color: 'var(--text-secondary)' }}>DTE COMM:</span>
          <div className="contingency-progress-track">
            <div
              className="contingency-progress-fill"
              style={{
                width: `${(metricsB.dteFraction * 100).toFixed(0)}%`,
                backgroundColor: 'var(--accent-earth-hi)',
              }}
            />
          </div>
          <span style={{ width: '85px', textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-earth-hi)' }}>
            {(metricsB.dteFraction * 100).toFixed(1)}% COMM
          </span>
        </div>

        {/* Row 4: COMPOSITE FEASIBILITY SCORE */}
        <div className="contingency-row-bar">
          <span style={{ width: '75px', color: 'var(--text-secondary)' }}>FEASIBILITY:</span>
          <div className="contingency-progress-track">
            <div
              className="contingency-progress-fill"
              style={{
                width: `${metricsB.score}%`,
                backgroundColor: metricsB.score >= 70 ? 'var(--accent-solar-hi)' : 'var(--status-hazard)',
              }}
            />
          </div>
          <span style={{ width: '85px', textAlign: 'right', fontWeight: 'bold', color: metricsB.score >= 70 ? 'var(--accent-solar-hi)' : 'var(--status-hazard)' }}>
            {metricsB.score} / 100
          </span>
        </div>

        {/* Launch Slip Days Selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-hairline)', paddingTop: '2px', marginTop: 'auto' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: 'var(--text-muted)' }}>
            LAUNCH SLIP OFFSET:
          </span>
          <div style={{ display: 'flex', gap: '3px' }}>
            {[0, 7, 14, 29].map((days) => (
              <button
                key={days}
                style={{
                  padding: '0.12rem 0.35rem',
                  fontSize: '0.55rem',
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: launchSlipDays === days ? 'var(--accent-solar)' : 'var(--bg-surface-2)',
                  color: launchSlipDays === days ? '#090A0D' : 'var(--text-secondary)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '1px',
                  fontWeight: launchSlipDays === days ? 'bold' : 'normal',
                  cursor: 'pointer',
                }}
                onClick={() => setLaunchSlipDays(days)}
              >
                +{days}d
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};