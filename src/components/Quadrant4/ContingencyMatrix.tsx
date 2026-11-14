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

  // Compute metrics for Site A (Nominal launch window)
  const metricsA = useMemo(() => {
    if (!siteA) return null;
    const start = timelineStart;
    const end = new Date(start.getTime() + 708 * 3600000);
    const coordA = { latDeg: siteA.lat, lonDeg: siteA.lon, elevationKm: siteA.elevationKm };
    const timeline = generateEphemerisTimeline(coordA, start, end, 120, profileA);
    return analyzeTimeline(timeline, siteA.slopeDeg);
  }, [siteA, timelineStart, profileA]);

  // Compute metrics for Site B (With launch slip offset if selected)
  const metricsB = useMemo(() => {
    if (!siteB) return null;
    const start = new Date(timelineStart.getTime() + launchSlipDays * 24 * 3600000);
    const end = new Date(start.getTime() + 708 * 3600000);
    const coordB = { latDeg: siteB.lat, lonDeg: siteB.lon, elevationKm: siteB.elevationKm };
    const timeline = generateEphemerisTimeline(coordB, start, end, 120, profileB);
    return analyzeTimeline(timeline, siteB.slopeDeg);
  }, [siteB, timelineStart, launchSlipDays, profileB]);

  if (!siteA || !siteB || !metricsA || !metricsB) {
    return <div className="panel-body font-mono text-muted">Calculating contingency telemetry...</div>;
  }

  // Deltas: B - A
  const deltaScore = metricsB.score - metricsA.score;
  const deltaSun = (metricsB.solarFraction - metricsA.solarFraction) * 100;
  const deltaDte = (metricsB.dteFraction - metricsA.dteFraction) * 100;
  const deltaEclipse = metricsB.maxEclipseHours - metricsA.maxEclipseHours;
  const deltaSlope = siteB.slopeDeg - siteA.slopeDeg;

  const sunHoursA = (metricsA.solarFraction * 708).toFixed(0);
  const sunHoursB = (metricsB.solarFraction * 708).toFixed(0);
  const dteHoursA = (metricsA.dteFraction * 708).toFixed(0);
  const dteHoursB = (metricsB.dteFraction * 708).toFixed(0);

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
Local Slope Hazard: ${siteA.slopeDeg}° (${siteA.slopeDeg > 10 ? 'HAZARDOUS' : 'NOMINAL'})
Solar Sunlight Hours: ${sunHoursA}h / 708h (${(metricsA.solarFraction * 100).toFixed(1)}%)
Direct-to-Earth Comm: ${dteHoursA}h / 708h (${(metricsA.dteFraction * 100).toFixed(1)}%)
Max Continuous Eclipse: ${metricsA.maxEclipseHours.toFixed(1)}h
Composite Feasibility Score: ${metricsA.score} / 100

[CONTINGENCY TARGET - SITE B]
Name: ${siteB.name} (${siteB.program})
Coordinates: Lat ${siteB.lat}°S, Lon ${siteB.lon}°E, Alt ${siteB.elevationKm} km
Local Slope Hazard: ${siteB.slopeDeg}° (${siteB.slopeDeg > 10 ? 'HAZARDOUS' : 'NOMINAL'})
Solar Sunlight Hours: ${sunHoursB}h / 708h (${(metricsB.solarFraction * 100).toFixed(1)}%)
Direct-to-Earth Comm: ${dteHoursB}h / 708h (${(metricsB.dteFraction * 100).toFixed(1)}%)
Max Continuous Eclipse: ${metricsB.maxEclipseHours.toFixed(1)}h
Composite Feasibility Score: ${metricsB.score} / 100

[DELTA METRIC COMPARISON (B - A)]
Δ Composite Score: ${deltaScore >= 0 ? '+' : ''}${deltaScore} pts
Δ Solar Illumination: ${deltaSun >= 0 ? '+' : ''}${deltaSun.toFixed(1)}% (${(parseFloat(sunHoursB) - parseFloat(sunHoursA)).toFixed(0)}h)
Δ Direct-to-Earth Comm: ${deltaDte >= 0 ? '+' : ''}${deltaDte.toFixed(1)}% (${(parseFloat(dteHoursB) - parseFloat(dteHoursA)).toFixed(0)}h)
Δ Max Eclipse Duration: ${deltaEclipse > 0 ? '+' : ''}${deltaEclipse.toFixed(1)}h
Δ Terrain Slope: ${deltaSlope > 0 ? '+' : ''}${deltaSlope.toFixed(1)}°

OPERATIONAL RECOMMENDATION:
${deltaScore >= 0
  ? `CONTINGENCY FEASIBLE: Site B improves mission score by +${deltaScore} points under a +${launchSlipDays}-day launch delay.`
  : `CAUTION: Nominal Site A provides superior overall margin despite a +${launchSlipDays}-day slip.`}

DATA SOURCES & DISCLOSURE:
Topography: NASA GSFC LOLA 80m DEM (Polar Stereographic GDR)
Ephemerides: Analytical Airless Ephemeris verified via NASA JPL Horizons API (coord@301)
License: MIT Open-Source · Team Lead: Muhammad Awad (mawad27727@gmail.com)
================================================================================`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SELENE_NAV_BRIEFING_${siteA.name.replace(/\s+/g, '_')}_VS_${siteB.name.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Subheader: Contingency Selectors */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.4rem 0.8rem',
          borderBottom: '1px solid var(--border-hairline)',
          backgroundColor: 'var(--bg-surface-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge-precomputed">SITE-SWAP DIFF ENGINE</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            SITE A vs SITE B
          </span>
        </div>

        {/* Launch Slip Days Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            LAUNCH SLIP:
          </span>
          {[0, 7, 14, 29].map((days) => (
            <button
              key={days}
              className="persona-toggle-option"
              style={{
                padding: '0.15rem 0.4rem',
                fontSize: '0.60rem',
                backgroundColor: launchSlipDays === days ? 'var(--bg-surface-1)' : undefined,
                color: launchSlipDays === days ? 'var(--accent-solar-hi)' : undefined,
              }}
              onClick={() => setLaunchSlipDays(days)}
            >
              {days === 0 ? 'NOMINAL' : `+${days}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Main Diff Table */}
      <div style={{ flex: 1, padding: '0.6rem 0.8rem', overflowY: 'auto' }}>
        <table className="table-tactical">
          <thead>
            <tr>
              <th style={{ width: '38%' }}>METRIC</th>
              <th style={{ width: '22%', color: 'var(--accent-solar)' }}>
                [A] {siteA.name.split(' ')[0]}
              </th>
              <th style={{ width: '24%' }}>
                <select
                  value={compareSiteId}
                  onChange={(e) => setCompareSiteId(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-void)',
                    color: 'var(--accent-earth-hi)',
                    border: '1px solid var(--border-hairline)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                >
                  {sitesRegistry.map((s) => (
                    <option key={s.id} value={s.id}>
                      [B] {s.name}
                    </option>
                  ))}
                </select>
              </th>
              <th style={{ width: '16%', textAlign: 'right' }}>DELTA (Δ)</th>
            </tr>
          </thead>
          <tbody>
            {/* Feasibility Score */}
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <td style={{ fontWeight: 'bold' }}>FEASIBILITY SCORE</td>
              <td style={{ fontWeight: 'bold', color: 'var(--accent-solar-hi)' }}>
                {metricsA.score}/100
              </td>
              <td style={{ fontWeight: 'bold', color: 'var(--accent-earth-hi)' }}>
                {metricsB.score}/100
              </td>
              <td
                style={{
                  textAlign: 'right',
                  fontWeight: 'bold',
                  color: deltaScore >= 0 ? 'var(--accent-earth-hi)' : 'var(--status-hazard)',
                }}
              >
                {deltaScore >= 0 ? `+${deltaScore}` : deltaScore}
              </td>
            </tr>

            {/* Solar Fraction */}
            <tr>
              <td>Solar Sunlight Fraction</td>
              <td>{(metricsA.solarFraction * 100).toFixed(1)}% <span style={{ color: 'var(--text-muted)' }}>({sunHoursA}h)</span></td>
              <td>{(metricsB.solarFraction * 100).toFixed(1)}% <span style={{ color: 'var(--text-muted)' }}>({sunHoursB}h)</span></td>
              <td
                style={{
                  textAlign: 'right',
                  color: deltaSun >= 0 ? 'var(--accent-earth-hi)' : 'var(--status-hazard)',
                }}
              >
                {deltaSun >= 0 ? `+${deltaSun.toFixed(1)}%` : `${deltaSun.toFixed(1)}%`}
              </td>
            </tr>

            {/* Max Eclipse */}
            <tr>
              <td>Max Continuous Eclipse</td>
              <td>{metricsA.maxEclipseHours.toFixed(1)}h</td>
              <td>{metricsB.maxEclipseHours.toFixed(1)}h</td>
              <td
                style={{
                  textAlign: 'right',
                  color: deltaEclipse <= 0 ? 'var(--accent-earth-hi)' : 'var(--status-hazard)',
                }}
              >
                {deltaEclipse > 0 ? `+${deltaEclipse.toFixed(1)}h` : `${deltaEclipse.toFixed(1)}h`}
              </td>
            </tr>

            {/* DTE Comm Link */}
            <tr>
              <td>Direct-to-Earth (DTE) Link</td>
              <td>{(metricsA.dteFraction * 100).toFixed(1)}% <span style={{ color: 'var(--text-muted)' }}>({dteHoursA}h)</span></td>
              <td>{(metricsB.dteFraction * 100).toFixed(1)}% <span style={{ color: 'var(--text-muted)' }}>({dteHoursB}h)</span></td>
              <td
                style={{
                  textAlign: 'right',
                  color: deltaDte >= 0 ? 'var(--accent-earth-hi)' : 'var(--status-hazard)',
                }}
              >
                {deltaDte >= 0 ? `+${deltaDte.toFixed(1)}%` : `${deltaDte.toFixed(1)}%`}
              </td>
            </tr>

            {/* Surface Slope Hazard */}
            <tr>
              <td>Local Terrain Slope</td>
              <td style={{ color: siteA.slopeDeg > 10 ? 'var(--status-hazard)' : undefined }}>
                {siteA.slopeDeg.toFixed(1)}°
              </td>
              <td style={{ color: siteB.slopeDeg > 10 ? 'var(--status-hazard)' : undefined }}>
                {siteB.slopeDeg.toFixed(1)}°
              </td>
              <td
                style={{
                  textAlign: 'right',
                  color: deltaSlope <= 0 ? 'var(--accent-earth-hi)' : 'var(--status-hazard)',
                }}
              >
                {deltaSlope > 0 ? `+${deltaSlope.toFixed(1)}°` : `${deltaSlope.toFixed(1)}°`}
              </td>
            </tr>

            {/* Vertical Solar Mast Flux */}
            <tr>
              <td>Vertical Mast Flux (Peak)</td>
              <td style={{ color: 'var(--accent-solar-hi)' }}>1,360 W/m²</td>
              <td style={{ color: 'var(--accent-solar-hi)' }}>1,360 W/m²</td>
              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>NOMINAL</td>
            </tr>
          </tbody>
        </table>

        {/* Tactical Recommendation Badge & Export Action */}
        <div
          style={{
            marginTop: '0.6rem',
            padding: '0.4rem 0.6rem',
            backgroundColor: 'var(--bg-surface-2)',
            border: '1px solid var(--border-hairline)',
            borderLeft: `3px solid ${deltaScore >= 0 ? 'var(--accent-earth)' : 'var(--status-hazard)'}`,
            borderRadius: '2px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
              {deltaScore >= 0
                ? 'RECOMMENDATION: SITE B CONTINGENCY FEASIBLE'
                : 'CAUTION: NOMINAL SITE A EXHIBITS SUPERIOR METRICS'}
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
              {launchSlipDays > 0 ? `Accounted for +${launchSlipDays}-day orbital delay. ` : ''}
              {deltaScore >= 0
                ? `Site B improves composite score by +${deltaScore} pts with ${(metricsB.solarFraction * 100).toFixed(0)}% solar illumination.`
                : `Site A provides ${(metricsA.solarFraction * 100).toFixed(0)}% solar fraction vs ${(metricsB.solarFraction * 100).toFixed(0)}% at Site B.`}
            </div>
          </div>

          <button
            className="btn-tactical-primary"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.65rem', flexShrink: 0 }}
            onClick={handleExportBriefing}
            title="Download formatted NASA Artemis mission contingency report"
          >
            EXPORT BRIEFING
          </button>
        </div>
      </div>
    </div>
  );
};
