import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useMissionStore } from '../../store/missionStore';

interface ThreeDLocalTerrainProps {
  shadingMode: 'realistic' | 'slope-hazard';
}

export const ThreeDLocalTerrain: React.FC<ThreeDLocalTerrainProps> = ({ shadingMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const sitesRegistry = useMissionStore((s) => s.sitesRegistry);
  const currentSun = useMissionStore((s) => s.currentSun);
  const mastHeightMeters = useMissionStore((s) => s.mastHeightMeters);
  const currentSunClear = useMissionStore((s) => s.currentSunClear);

  const [isInteracting, setIsInteracting] = useState(false);

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const mastMeshRef = useRef<THREE.Mesh | null>(null);
  const mastTipGlowRef = useRef<THREE.PointLight | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);

  // Camera orbit state
  const orbitRef = useRef({
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    radius: 40,
    isDragging: false,
    prevX: 0,
    prevY: 0,
    target: new THREE.Vector3(0, 0, 0),
  });

  const site = sitesRegistry.find((s) => s.id === selectedSiteId) || sitesRegistry[0];

  // Initialize Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 320;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090a0d); // --bg-void
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 500);
    cameraRef.current = camera;

    // 3. Renderer with shadow maps
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // 4. Ambient light (airless deep-space faint Earth-shine)
    const ambientLight = new THREE.AmbientLight(0x181e28, 0.15);
    scene.add(ambientLight);

    // 5. Directional Sun Light
    const sunLight = new THREE.DirectionalLight(0xfff3db, 2.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    const d = 25;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // 6. Build Terrain Mesh
    const gridRes = 80;
    const terrainSize = 36;
    const geom = new THREE.PlaneGeometry(terrainSize, terrainSize, gridRes, gridRes);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    // Displace vertices to represent landing site crater / massif topography
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const distFromCenter = Math.sqrt(x * x + z * z);

      let y = 0;
      if (selectedSiteId.includes('shackleton') || selectedSiteId.includes('haworth')) {
        // Deep crater depression on one side with elevated rim
        const craterCenterDist = Math.sqrt((x - 8) * (x - 8) + (z - 8) * (z - 8));
        const rimRadius = 10;
        if (craterCenterDist < rimRadius) {
          // Inside crater bowl
          y = -4.5 * Math.cos((craterCenterDist / rimRadius) * (Math.PI / 2));
        } else {
          // Rim falloff & surrounding massifs
          y = 1.8 * Math.exp(-Math.pow((craterCenterDist - rimRadius) / 4.0, 2));
        }
      } else if (selectedSiteId.includes('malapert') || selectedSiteId.includes('mons-mouton')) {
        // High elevated plateau / massif ridge
        y = 3.5 * Math.exp(-(x * x + z * z) / 80.0) + Math.cos(x * 0.4) * 0.8;
      } else {
        // Standard rolling polar plains & ridges
        y = Math.sin(x * 0.25) * 1.2 + Math.cos(z * 0.25) * 1.2 + Math.sin((x + z) * 0.5) * 0.4;
      }

      // Add high-frequency regolith roughness
      y += (Math.sin(x * 1.5) * Math.cos(z * 1.5)) * 0.25;
      pos.setY(i, y);
    }
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: shadingMode === 'slope-hazard' ? 0x289e8e : 0x4a5264,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
    });

    const terrainMesh = new THREE.Mesh(geom, mat);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    scene.add(terrainMesh);
    terrainMeshRef.current = terrainMesh;

    // 7. Lander Position Indicator (Pin at center origin)
    const landerGroup = new THREE.Group();
    
    // Lander base cylinder
    const baseGeom = new THREE.CylinderGeometry(0.6, 0.8, 0.4, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xe59a23, metalness: 0.8, roughness: 0.2 });
    const landerBase = new THREE.Mesh(baseGeom, baseMat);
    landerBase.position.y = 0.2;
    landerBase.castShadow = true;
    landerGroup.add(landerBase);

    // Solar mast rod
    const mastGeom = new THREE.CylinderGeometry(0.08, 0.08, 2.0, 8);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0xece9e2, metalness: 0.5, roughness: 0.3 });
    const mastMesh = new THREE.Mesh(mastGeom, mastMat);
    mastMesh.position.y = 1.2;
    mastMesh.castShadow = true;
    landerGroup.add(mastMesh);
    mastMeshRef.current = mastMesh;

    // Mast tip solar sensor beacon
    const tipGeom = new THREE.SphereGeometry(0.2, 8, 8);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xf7b955 });
    const tipMesh = new THREE.Mesh(tipGeom, tipMat);
    tipMesh.position.y = 2.2;
    landerGroup.add(tipMesh);

    // Tip glow light
    const tipLight = new THREE.PointLight(0xf7b955, 0.8, 4);
    tipLight.position.y = 2.2;
    landerGroup.add(tipLight);
    mastTipGlowRef.current = tipLight;

    scene.add(landerGroup);

    // 8. Animation & Render loop
    let animId: number;
    const render = () => {
      animId = requestAnimationFrame(render);
      if (cameraRef.current && rendererRef.current && sceneRef.current) {
        const orbit = orbitRef.current;
        // Update camera position on sphere
        cameraRef.current.position.x = orbit.target.x + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta);
        cameraRef.current.position.y = orbit.target.y + orbit.radius * Math.cos(orbit.phi);
        cameraRef.current.position.z = orbit.target.z + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta);
        cameraRef.current.lookAt(orbit.target);

        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    render();

    // 9. Resize handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geom.dispose();
      mat.dispose();
    };
  }, [selectedSiteId, shadingMode]);

  // Update Sun Directional Light based on real-time Ephemeris
  useEffect(() => {
    if (!sunLightRef.current) return;
    const azRad = (currentSun.azimuthDeg * Math.PI) / 180.0;
    const elRad = (currentSun.elevationDeg * Math.PI) / 180.0;
    const dist = 45;

    // Polar Sun coordinates: Y is vertical elevation, X and Z are horizontal
    const x = dist * Math.sin(azRad) * Math.cos(elRad);
    const y = Math.max(0.5, dist * Math.sin(elRad)); // keep slightly above horizon for grazing shadows
    const z = -dist * Math.cos(azRad) * Math.cos(elRad);

    sunLightRef.current.position.set(x, y, z);

    // Sun intensity drops to zero if Sun is below geometric horizon
    if (currentSun.elevationDeg <= -0.266) {
      sunLightRef.current.intensity = 0;
    } else {
      sunLightRef.current.intensity = Math.min(2.8, 1.2 + currentSun.elevationDeg * 0.4);
    }
  }, [currentSun]);

  // Update Mast Height (0–15m scaled) & Illumination Glow
  useEffect(() => {
    if (mastMeshRef.current) {
      const scaledHeight = Math.max(0.6, (mastHeightMeters / 15.0) * 3.5);
      mastMeshRef.current.scale.set(1, scaledHeight / 2.0, 1);
      mastMeshRef.current.position.y = 0.2 + scaledHeight / 2.0;
    }
    if (mastTipGlowRef.current) {
      mastTipGlowRef.current.color.setHex(currentSunClear ? 0xf7b955 : 0xd9463e);
      mastTipGlowRef.current.intensity = currentSunClear ? 1.2 : 0.2;
    }
  }, [mastHeightMeters, currentSunClear]);

  // Mouse Orbit Drag Controls
  const handleMouseDown = (e: React.MouseEvent) => {
    orbitRef.current.isDragging = true;
    orbitRef.current.prevX = e.clientX;
    orbitRef.current.prevY = e.clientY;
    setIsInteracting(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!orbitRef.current.isDragging) return;
    const dx = e.clientX - orbitRef.current.prevX;
    const dy = e.clientY - orbitRef.current.prevY;
    orbitRef.current.prevX = e.clientX;
    orbitRef.current.prevY = e.clientY;

    const orbit = orbitRef.current;
    orbit.theta -= dx * 0.008;
    orbit.phi = Math.max(0.1, Math.min(Math.PI / 2.05, orbit.phi - dy * 0.008));
  };

  const handleMouseUp = () => {
    orbitRef.current.isDragging = false;
    setIsInteracting(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const orbit = orbitRef.current;
    orbit.radius = Math.max(12, Math.min(90, orbit.radius + e.deltaY * 0.05));
  };

  const handleResetCamera = () => {
    orbitRef.current.theta = Math.PI / 4;
    orbitRef.current.phi = Math.PI / 3;
    orbitRef.current.radius = 40;
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '280px',
        userSelect: 'none',
        overflow: 'hidden',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Three.js canvas container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: isInteracting ? 'grabbing' : 'grab' }} />

      {/* Orbit & Viewport HUD Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '10px',
          backgroundColor: 'rgba(17, 19, 24, 0.88)',
          border: '1px solid var(--border-hairline)',
          borderLeft: '3px solid var(--accent-solar)',
          padding: '0.35rem 0.65rem',
          borderRadius: '2px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.62rem',
          pointerEvents: 'none',
          backdropFilter: 'blur(4px)',
        }}
      >
        <div style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
          3D LOCAL TERRAIN PATCH (20×20 KM)
        </div>
        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
          Site: {site?.name} · Elev: {site?.elevationKm} km
        </div>
        <div style={{ color: 'var(--accent-solar-hi)', marginTop: '2px' }}>
          Sun Vector: Az {currentSun.azimuthDeg.toFixed(1)}° | El {currentSun.elevationDeg.toFixed(1)}°
        </div>
      </div>

      {/* Reset Camera Button */}
      <div style={{ position: 'absolute', bottom: '8px', right: '10px', display: 'flex', gap: '0.3rem' }}>
        <button
          className="btn-tactical-secondary"
          style={{ padding: '0.2rem 0.5rem', fontSize: '0.60rem' }}
          onClick={handleResetCamera}
        >
          RESET 3D CAM
        </button>
      </div>
    </div>
  );
};
