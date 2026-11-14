import React, { useEffect, useMemo, useRef } from 'react';
import { useMissionStore } from '../../store/missionStore';
import { generateEphemerisTimeline } from '../../engine/lunarEphemeris';

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

  // Generate 708-hour timeline snapshots (sampled every 2 hours)
  const timelineData = useMemo(() => {
    const endDate = new Date(timelineStart.getTime() + timelineHours * 3600000);
    return generateEphemerisTimeline(siteCoord, timelineStart, endDate, 120, profile);
  }, [siteCoord, timelineStart, timelineHours, profile]);

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

      const msAdvance = dtSec * playbackSpeed * 3600 * 1000;
      const currentMs = useMissionStore.getState().simulationDate.getTime();
      const startMs = timelineStart.getTime();
      const maxMs = startMs + timelineHours * 3600000;

      let nextMs = currentMs + msAdvance;
      if (nextMs > maxMs) {
        nextMs = startMs;
      }

      setSimulationDate(new Date(nextMs));
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, timelineStart, timelineHours, setSimulationDate]);

  const totalMs = timelineHours * 3600000;
  const currentElapsedMs = Math.max(0, Math.min(totalMs, simulationDate.getTime() - timelineStart.getTime()));
  const playheadFraction = currentElapsedMs / totalMs;

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frac = parseFloat(e.target.value);
    const newMs = timelineStart.getTime() + frac * totalMs;
    setSimulationDate(new Date(newMs));
  };

  const handleStep = (hours: number) => {
    const newMs = simulationDate.getTime() + hours * 3600000;
    const startMs = timelineStart.getTime();
    const maxMs = startMs + timelineHours * 3600000;
    const clampedMs = Math.max(startMs, Math.min(maxMs, newMs));
    setSimulationDate(new Date(clampedMs));
  };

  // Format PKT time string (UTC+5)
  const formatPktDate = (d: Date) => {
    const pktMs = d.getTime() + 5 * 3600000;
    const pktDate = new Date(pktMs);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[pktDate.getUTCMonth()];
    const day = pktDate.getUTCDate();
    const year = pktDate.getUTCFullYear();
    const hours = String(pktDate.getUTCHours()).padStart(2, '0');
    const mins = String(pktDate.getUTCMinutes()).padStart(2, '0');
    return `${month} ${day}, ${year} - ${hours}:${mins} PKT`;
  };

  return (
    <div className="bento-panel" style={{ height: '100%' }}>
      <div className="corner-tr" />
      <div className="corner-bl" />

      {/* Header */}
      <div className="bento-panel-header">
        <span>708-HOUR LUNAR SYNODIC TIMELINE</span>
        <span style={{ fontSize: '0.60rem', color: 'var(--text-muted)' }}>
          SYNODIC PERIOD: 29.53059 DAYS
        </span>
      </div>

      {/* Timeline Body */}
      <div style={{ flex: 1, padding: '0.45rem 0.8rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Date Headers Strip across 708 Hours */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--text-secondary)' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Nov 2026</span>
          <span>NOV 10 7:35 PKT</span>
          <span>NOV 11 5:35 PKT</span>
          <span>NOV 12 4:35 PKT</span>
          <span>NOV 13 1:35 PKT</span>
          <span style={{ color: 'var(--accent-solar-hi)', fontWeight: 'bold' }}>NOV 14 11:55 PKT</span>
          <span>NOV 15 1:35 PKT</span>
          <span>NOV 16 9:15 PKT</span>
          <span>NOV 17 1:55 PKT</span>
          <span>NOV 18 1:35 PKT</span>
          <span>NOV 19 1:35 PKT</span>
        </div>

        {/* Stacked Gantt Strip 1: Solar Illumination Windows (28px height) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.56rem', marginBottom: '2px' }}>
            <span style={{ color: 'var(--accent-solar-hi)', fontWeight: 'bold' }}>SOLAR ILLUMINATION WINDOWS</span>
            <span style={{ color: 'var(--text-muted)' }}>708H SYNODIC CYCLE</span>
          </div>
          <div className="gantt-strip-stacked">
            {timelineData.map((pt, idx) => {
              const isLit = pt.illuminationFraction > 0.05;
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    backgroundColor: isLit ? 'var(--accent-solar)' : '#140D0B',
                    opacity: isLit ? Math.max(0.4, pt.illuminationFraction) : 0.85,
                  }}
                  title={`T+${idx * 2}h: Sun El ${pt.sun.elevationDeg.toFixed(1)}° (${isLit ? 'Illuminated' : 'Crater Rim Shadow'})`}
                />
              );
            })}
            {/* Playhead Marker */}
            <div
              style={{
                position: 'absolute',
                left: `${playheadFraction * 100}%`,
                top: 0,
                bottom: 0,
                width: '2px',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 0 6px #FFFFFF',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* Stacked Gantt Strip 2: Direct-to-Earth (DTE) Visibility (28px height) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.56rem', marginBottom: '2px' }}>
            <span style={{ color: 'var(--accent-earth-hi)', fontWeight: 'bold' }}>DIRECT-TO-EARTH (DTE) VISIBILITY</span>
            <span style={{ color: 'var(--text-muted)' }}>S-BAND COMM LINK</span>
          </div>
          <div className="gantt-strip-stacked">
            {timelineData.map((pt, idx) => {
              const hasDte = pt.isDTE;
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    backgroundColor: hasDte ? 'var(--accent-earth)' : '#0A1412',
                    opacity: hasDte ? 0.9 : 0.8,
                  }}
                  title={`T+${idx * 2}h: Earth El ${pt.earth.elevationDeg.toFixed(1)}° (${hasDte ? 'Active LOS' : 'Terrain Occulted'})`}
                />
              );
            })}
            {/* Playhead Marker */}
            <div
              style={{
                position: 'absolute',
                left: `${playheadFraction * 100}%`,
                top: 0,
                bottom: 0,
                width: '2px',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 0 6px #FFFFFF',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* Scrubber slider track */}
        <div style={{ position: 'relative', width: '100%', margin: '2px 0' }}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={playheadFraction}
            onChange={handleScrubberChange}
            className="range-tactical"
            style={{ width: '100%', cursor: 'pointer', height: '4px' }}
          />
        </div>

        {/* Bottom Playback & Centered Date Readout Strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1px' }}>
          {/* Controls: Step / Play / Speed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              className="btn-tactical-secondary"
              style={{ padding: '0.18rem 0.45rem', fontSize: '0.60rem' }}
              onClick={() => handleStep(-12)}
              title="Step backward 12 hours"
            >
              ⏮
            </button>
            <button
              className="btn-tactical-primary"
              style={{ padding: '0.18rem 0.65rem', fontSize: '0.62rem' }}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              className="btn-tactical-secondary"
              style={{ padding: '0.18rem 0.45rem', fontSize: '0.60rem' }}
              onClick={() => handleStep(12)}
              title="Step forward 12 hours"
            >
              ⏭
            </button>

            {/* Speeds */}
            <div style={{ display: 'flex', border: '1px solid var(--border-hairline)', borderRadius: '2px', marginLeft: '0.3rem' }}>
              {[1, 60, 720].map((spd) => (
                <button
                  key={spd}
                  style={{
                    padding: '0.12rem 0.35rem',
                    fontSize: '0.55rem',
                    fontFamily: 'var(--font-mono)',
                    border: 'none',
                    backgroundColor: playbackSpeed === spd ? 'var(--bg-surface-2)' : 'transparent',
                    color: playbackSpeed === spd ? 'var(--accent-solar-hi)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setPlaybackSpeed(spd)}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Centered Tactical Date Indicator */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              fontWeight: '800',
              color: 'var(--text-primary)',
              letterSpacing: '0.06em',
            }}
          >
            &lt; {formatPktDate(simulationDate)} &gt;
          </div>

          {/* Status Indicator */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text-secondary)' }}>
            PLAYHEAD: T+{(playheadFraction * 708).toFixed(1)}h
          </div>
        </div>
      </div>
    </div>
  );
};