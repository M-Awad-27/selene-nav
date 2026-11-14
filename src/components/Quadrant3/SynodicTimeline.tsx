import React, { useEffect, useMemo, useRef } from 'react';
import { useMissionStore } from '../../store/missionStore';
import {
  generateEphemerisTimeline,
  analyzeTimeline,
} from '../../engine/lunarEphemeris';

export const SynodicTimeline: React.FC = () => {
  const simulationDate = useMissionStore((s) => s.simulationDate);
  const setSimulationDate = useMissionStore((s) => s.setSimulationDate);
  const timelineStart = useMissionStore((s) => s.timelineStart);
  const timelineHours = useMissionStore((s) => s.timelineHours);
  const isPlaying = useMissionStore((s) => s.isPlaying);
  const setIsPlaying = useMissionStore((s) => s.setIsPlaying);
  const playbackSpeed = useMissionStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useMissionStore((s) => s.setPlaybackSpeed);

  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const sitesRegistry = useMissionStore((s) => s.sitesRegistry);
  const customCoordinate = useMissionStore((s) => s.customCoordinate);
  const horizonProfiles = useMissionStore((s) => s.horizonProfiles);

  const animFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(performance.now());

  // Determine site coordinates
  const siteCoord = useMemo(() => {
    if (customCoordinate) return customCoordinate;
    const reg = sitesRegistry.find((s) => s.id === selectedSiteId);
    if (reg) {
      return { latDeg: reg.lat, lonDeg: reg.lon, elevationKm: reg.elevationKm };
    }
    return { latDeg: -89.54, lonDeg: 137.0, elevationKm: 1.25 };
  }, [customCoordinate, selectedSiteId, sitesRegistry]);

  const profile = horizonProfiles[selectedSiteId] || [];

  // Generate 708-hour timeline snapshots (sampled every 2 hours = ~354 bins for performance)
  const timelineData = useMemo(() => {
    const endDate = new Date(timelineStart.getTime() + timelineHours * 3600000);
    return generateEphemerisTimeline(siteCoord, timelineStart, endDate, 120, profile);
  }, [siteCoord, timelineStart, timelineHours, profile]);

  // Feasibility summary metrics
  const siteSlope = sitesRegistry.find((s) => s.id === selectedSiteId)?.slopeDeg || 5.0;
  const metrics = useMemo(() => {
    return analyzeTimeline(timelineData, siteSlope);
  }, [timelineData, siteSlope]);

  // Animation playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastTickRef.current = performance.now();

    const loop = (now: number) => {
      const dtSec = (now - lastTickRef.current) / 1000.0;
      lastTickRef.current = now;

      // dtSec * playbackSpeed is hours advanced per real second
      const msAdvance = dtSec * playbackSpeed * 3600 * 1000;
      const currentMs = useMissionStore.getState().simulationDate.getTime();
      const startMs = timelineStart.getTime();
      const maxMs = startMs + timelineHours * 3600000;

      let nextMs = currentMs + msAdvance;
      if (nextMs > maxMs) {
        nextMs = startMs; // loop around
      }

      setSimulationDate(new Date(nextMs));
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, timelineStart, timelineHours, setSimulationDate]);

  // Current progress fraction along the 708-hr synodic bar (0 to 1)
  const totalMs = timelineHours * 3600000;
  const currentElapsedMs = Math.max(0, Math.min(totalMs, simulationDate.getTime() - timelineStart.getTime()));
  const playheadFraction = currentElapsedMs / totalMs;

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frac = parseFloat(e.target.value);
    const newMs = timelineStart.getTime() + frac * totalMs;
    setSimulationDate(new Date(newMs));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Subheader: Playback Controls & Date Picker */}
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
          {/* Play/Pause Button */}
          <button
            className="btn-tactical-primary"
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.65rem' }}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? '⏸ PAUSE' : '▶ RUN'}
          </button>

          {/* Speed Selector */}
          <div style={{ display: 'flex', border: '1px solid var(--border-hairline)', borderRadius: '2px' }}>
            {[1, 60, 720].map((spd) => (
              <button
                key={spd}
                className="persona-toggle-option"
                style={{
                  padding: '0.2rem 0.45rem',
                  fontSize: '0.60rem',
                  backgroundColor: playbackSpeed === spd ? 'var(--bg-surface-1)' : undefined,
                  color: playbackSpeed === spd ? 'var(--accent-solar-hi)' : undefined,
                }}
                onClick={() => setPlaybackSpeed(spd)}
              >
                {spd}x
              </button>
            ))}
          </div>

          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            LUNAR SYNODIC CYCLE (708 HOURS / 29.5 DAYS)
          </span>
        </div>

        {/* Current Date Readout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            UTC:
          </span>
          <span
            style={{
              fontSize: '0.70rem',
              color: 'var(--accent-solar-hi)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 'bold',
            }}
          >
            {simulationDate.toISOString().replace('.000Z', ' UTC').replace('T', ' ')}
          </span>
        </div>
      </div>

      {/* Gantt Strips & Scrubber Body */}
      <div style={{ flex: 1, padding: '0.8rem 1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.6rem' }}>
        {/* Scrubber slider track */}
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={playheadFraction}
            onChange={handleScrubberChange}
            className="range-tactical"
            style={{ width: '100%', cursor: 'pointer' }}
          />
          {/* Hour markers */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.60rem',
              color: 'var(--text-muted)',
              marginTop: '2px',
            }}
          >
            <span>T+0h (0d)</span>
            <span>T+177h (7.4d)</span>
            <span>T+354h (14.8d)</span>
            <span>T+531h (22.1d)</span>
            <span>T+708h (29.5d)</span>
          </div>
        </div>

        {/* Strip 1: Solar Illumination Gantt */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.62rem',
              marginBottom: '2px',
            }}
          >
            <span style={{ color: 'var(--accent-solar-hi)' }}>☀️ SOLAR ILLUMINATION WINDOWS</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Fraction: {(metrics.solarFraction * 100).toFixed(1)}% | Max Eclipse: {metrics.maxEclipseHours.toFixed(1)}h
            </span>
          </div>
          <div
            style={{
              height: '16px',
              backgroundColor: '#090A0D',
              border: '1px solid var(--border-hairline)',
              borderRadius: '2px',
              display: 'flex',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {timelineData.map((pt, idx) => {
              const isLit = pt.illuminationFraction > 0.05;
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    backgroundColor: isLit ? 'var(--accent-solar)' : '#140D0B',
                    opacity: isLit ? Math.max(0.35, pt.illuminationFraction) : 0.8,
                  }}
                  title={`T+${idx * 2}h: Sun El ${pt.sun.elevationDeg.toFixed(1)}° (${isLit ? 'Lit' : 'Shadow'})`}
                />
              );
            })}
            {/* Playhead indicator */}
            <div
              style={{
                position: 'absolute',
                left: `${playheadFraction * 100}%`,
                top: 0,
                bottom: 0,
                width: '2px',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 0 4px #FFFFFF',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* Strip 2: Direct-to-Earth (DTE) Comm Link Gantt */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.62rem',
              marginBottom: '2px',
            }}
          >
            <span style={{ color: 'var(--accent-earth-hi)' }}>📡 DIRECT-TO-EARTH (DTE) S-BAND LINK</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Link Coverage: {(metrics.dteFraction * 100).toFixed(1)}%
            </span>
          </div>
          <div
            style={{
              height: '16px',
              backgroundColor: '#090A0D',
              border: '1px solid var(--border-hairline)',
              borderRadius: '2px',
              display: 'flex',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {timelineData.map((pt, idx) => {
              const isComm = pt.isDTE;
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    backgroundColor: isComm ? 'var(--accent-earth)' : '#0C1717',
                    opacity: isComm ? 0.9 : 0.5,
                  }}
                  title={`T+${idx * 2}h: Earth El ${pt.earth.elevationDeg.toFixed(1)}° (${isComm ? 'LOS Lock' : 'Occulted'})`}
                />
              );
            })}
            {/* Playhead indicator */}
            <div
              style={{
                position: 'absolute',
                left: `${playheadFraction * 100}%`,
                top: 0,
                bottom: 0,
                width: '2px',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 0 4px #FFFFFF',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
