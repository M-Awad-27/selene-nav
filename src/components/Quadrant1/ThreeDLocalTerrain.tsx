import React from 'react';
import { CraterTerrain3D } from './CraterTerrain3D';

interface ThreeDLocalTerrainProps {
  shadingMode?: 'realistic' | 'slope-hazard';
  compact?: boolean;
}

export const ThreeDLocalTerrain: React.FC<ThreeDLocalTerrainProps> = ({
  shadingMode = 'slope-hazard',
  compact = true,
}) => {
  return <CraterTerrain3D shadingMode={shadingMode} compact={compact} />;
};

export { CraterTerrain3D };
