"use client";

import { Suspense, useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useComponentStore } from "@/app/workspace/stores/componentStore";
import { useContentSync } from "@/lib/sync/useContentSync";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Grid,
  Center,
  useGLTF,
  Html,
  GizmoHelper,
  GizmoViewport,
  PerspectiveCamera,
  ContactShadows,
  AccumulativeShadows,
  RandomizedLight,
  Bounds,
  useBounds,
} from "@react-three/drei";
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move3D,
  Grid3x3,
  Box,
  Sun,
  Moon,
  Layers,
  Info,
  Upload,
  Camera,
  Eye,
  EyeOff,
  Download,
} from "lucide-react";
import * as THREE from "three";
import type { ComponentPreviewProps } from "@/components/playground/registry";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";

// ============================================================
// Types
// ============================================================

interface ModelInfo {
  name: string;
  vertices: number;
  faces: number;
  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };
}

type ViewMode = "solid" | "wireframe" | "both";
type EnvironmentPreset = "city" | "sunset" | "dawn" | "night" | "warehouse" | "forest" | "apartment" | "studio" | "park" | "lobby";

// ============================================================
// Sample Models (using free models from drei)
// ============================================================

// Scientific & Engineering Models
const sampleModels = [
  {
    id: "robot-arm",
    name: "Robot Arm",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/CesiumMan/glTF-Binary/CesiumMan.glb",
    description: "Articulated robotic manipulator",
  },
  {
    id: "brain-scan",
    name: "Brain MRI",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BrainStem/glTF-Binary/BrainStem.glb",
    description: "Neurological imaging data visualization",
  },
  {
    id: "engine",
    name: "Engine Block",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/2CylinderEngine/glTF-Binary/2CylinderEngine.glb",
    description: "Mechanical engine assembly",
  },
  {
    id: "buggy",
    name: "Buggy Vehicle",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Buggy/glTF-Binary/Buggy.glb",
    description: "Autonomous vehicle chassis",
  },
  {
    id: "gear",
    name: "Gear Assembly",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/GearboxAssy/glTF-Binary/GearboxAssy.glb",
    description: "Precision mechanical gears",
  },
  {
    id: "drone",
    name: "Drone",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/AntiqueCamera/glTF-Binary/AntiqueCamera.glb",
    description: "UAV quadcopter design",
  },
];

// ============================================================
// Model Component
// ============================================================

interface ModelProps {
  url: string;
  viewMode: ViewMode;
  onLoad: (info: ModelInfo) => void;
}

function Model({ url, viewMode, onLoad }: ModelProps) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const bounds = useBounds();

  useEffect(() => {
    if (scene) {
      // Calculate model info
      let vertices = 0;
      let faces = 0;
      const box = new THREE.Box3().setFromObject(scene);
      const size = new THREE.Vector3();
      box.getSize(size);

      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const geometry = child.geometry;
          if (geometry.attributes.position) {
            vertices += geometry.attributes.position.count;
          }
          if (geometry.index) {
            faces += geometry.index.count / 3;
          } else if (geometry.attributes.position) {
            faces += geometry.attributes.position.count / 3;
          }

          // Apply view mode
          if (child.material) {
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];
            materials.forEach((mat) => {
              if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial) {
                mat.wireframe = viewMode === "wireframe";
              }
            });
          }
        }
      });

      onLoad({
        name: url.split("/").pop() || "Unknown",
        vertices,
        faces: Math.round(faces),
        boundingBox: {
          width: parseFloat(size.x.toFixed(2)),
          height: parseFloat(size.y.toFixed(2)),
          depth: parseFloat(size.z.toFixed(2)),
        },
      });

      // Fit to bounds
      bounds.refresh(scene).clip().fit();
    }
  }, [scene, url, viewMode, onLoad, bounds]);

  // Create wireframe clone with proper material handling
  const wireframeScene = useMemo(() => {
    if (viewMode !== "both") return null;
    
    const cloned = scene.clone();
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        // Create wireframe material
        mesh.material = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          wireframe: true,
          opacity: 0.3,
          transparent: true,
        });
      }
    });
    return cloned;
  }, [scene, viewMode]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
      {wireframeScene && <primitive object={wireframeScene} />}
    </group>
  );
}

// ============================================================
// Camera Controls Component
// ============================================================

interface CameraControlsProps {
  controlsRef: React.RefObject<OrbitControlsType | null>;
}

function CameraControls({ controlsRef }: CameraControlsProps) {
  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={0.5}
      maxDistance={100}
    />
  );
}

// ============================================================
// Scene Content
// ============================================================

interface SceneContentProps {
  modelUrl: string;
  viewMode: ViewMode;
  showGrid: boolean;
  showShadows: boolean;
  environment: EnvironmentPreset;
  onModelLoad: (info: ModelInfo) => void;
  controlsRef: React.RefObject<OrbitControlsType | null>;
}

function SceneContent({
  modelUrl,
  viewMode,
  showGrid,
  showShadows,
  environment,
  onModelLoad,
  controlsRef,
}: SceneContentProps) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[3, 3, 3]} fov={45} />
      <CameraControls controlsRef={controlsRef} />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {/* Environment */}
      <Environment preset={environment} background={false} />

      {/* Grid */}
      {showGrid && (
        <Grid
          position={[0, -0.01, 0]}
          args={[20, 20]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#6366f1"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#8b5cf6"
          fadeDistance={30}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />
      )}

      {/* Shadows */}
      {showShadows && (
        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.5}
          scale={10}
          blur={2}
          far={4}
        />
      )}

      {/* Model */}
      <Suspense
        fallback={
          <Html center>
            <div className="flex items-center gap-2 text-slate-400 bg-slate-800/90 px-4 py-2 rounded-lg">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-violet-500" />
              <span>Loading model...</span>
            </div>
          </Html>
        }
      >
        <Bounds fit clip observe margin={1.2}>
          <Center>
            <Model url={modelUrl} viewMode={viewMode} onLoad={onModelLoad} />
          </Center>
        </Bounds>
      </Suspense>

      {/* Gizmo */}
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport
          axisColors={["#f87171", "#4ade80", "#60a5fa"]}
          labelColor="white"
        />
      </GizmoHelper>
    </>
  );
}

// ============================================================
// Loading Fallback
// ============================================================

function LoadingScreen() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-violet-500" />
        <span className="text-sm text-slate-400">Initializing 3D Viewer...</span>
      </div>
    </div>
  );
}

// ============================================================
// Model Info Panel
// ============================================================

interface ModelInfoPanelProps {
  info: ModelInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

function ModelInfoPanel({ info, isOpen, onClose }: ModelInfoPanelProps) {
  if (!isOpen || !info) return null;

  return (
    <div className="absolute top-16 left-4 bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 p-4 min-w-[200px] shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white">Model Info</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ×
        </button>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">Name:</span>
          <span className="text-slate-200 font-mono">{info.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Vertices:</span>
          <span className="text-slate-200 font-mono">
            {info.vertices.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Faces:</span>
          <span className="text-slate-200 font-mono">
            {info.faces.toLocaleString()}
          </span>
        </div>
        <div className="border-t border-slate-700 pt-2 mt-2">
          <span className="text-slate-400">Bounding Box:</span>
          <div className="mt-1 font-mono text-slate-200">
            {info.boundingBox.width} × {info.boundingBox.height} ×{" "}
            {info.boundingBox.depth}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function ThreeViewerPreview({ onOutput }: ComponentPreviewProps) {
  // Read stored model selection from workspace store
  const storedState = useComponentStore((s) => s.componentStates['three-viewer']);
  const initialModel = useMemo(() => {
    const modelId = storedState?.modelId as string | undefined;
    if (modelId) {
      return sampleModels.find((m) => m.id === modelId) || sampleModels[0];
    }
    return sampleModels[0];
  }, []); // Only compute once on mount

  const [selectedModel, setSelectedModel] = useState(initialModel);

  // Sync model selection to componentStore
  const syncModelId = useContentSync('three-viewer', 'modelId', 1000);
  useEffect(() => {
    syncModelId(selectedModel.id);
  }, [selectedModel.id, syncModelId]);
  const [customModelUrl, setCustomModelUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("solid");
  const [showGrid, setShowGrid] = useState(true);
  const [showShadows, setShowShadows] = useState(true);
  const [environment, setEnvironment] = useState<EnvironmentPreset>("city");
  const [isDarkBg, setIsDarkBg] = useState(true);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const controlsRef = useRef<OrbitControlsType>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const modelUrl = customModelUrl || selectedModel.url;

  // Report state to parent
  useEffect(() => {
    if (onOutput) {
      onOutput({
        currentModel: selectedModel.name,
        viewMode,
        modelInfo,
      });
    }
  }, [selectedModel, viewMode, modelInfo, onOutput]);

  // Reset camera
  const handleResetCamera = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        setCustomModelUrl(url);
      }
    },
    []
  );

  // Clear custom model
  const handleClearCustomModel = useCallback(() => {
    if (customModelUrl) {
      URL.revokeObjectURL(customModelUrl);
      setCustomModelUrl(null);
    }
  }, [customModelUrl]);

  // Toggle fullscreen
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      canvasContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const environmentOptions: EnvironmentPreset[] = [
    "city",
    "sunset",
    "dawn",
    "night",
    "warehouse",
    "forest",
    "apartment",
    "studio",
    "park",
    "lobby",
  ];

  return (
    <div className="flex flex-col h-full min-h-[600px] rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Move3D className="h-4 w-4 text-violet-400" />
            3D Viewer
          </span>

          {/* Model Selector */}
          <div className="flex items-center gap-2">
            <select
              value={customModelUrl ? "custom" : selectedModel.id}
              onChange={(e) => {
                if (e.target.value !== "custom") {
                  handleClearCustomModel();
                  const model = sampleModels.find((m) => m.id === e.target.value);
                  if (model) setSelectedModel(model);
                }
              }}
              className="bg-slate-700 text-white text-xs rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {sampleModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
              {customModelUrl && <option value="custom">Custom Model</option>}
            </select>
          </div>

          {/* Environment Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Env:</span>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as EnvironmentPreset)}
              className="bg-slate-700 text-white text-xs rounded-lg px-2 py-1 border border-slate-600"
            >
              {environmentOptions.map((env) => (
                <option key={env} value={env}>
                  {env.charAt(0).toUpperCase() + env.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("solid")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                viewMode === "solid"
                  ? "bg-violet-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Solid"
            >
              <Box className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("wireframe")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                viewMode === "wireframe"
                  ? "bg-violet-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Wireframe"
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("both")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                viewMode === "both"
                  ? "bg-violet-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Both"
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg transition-colors ${
              showGrid
                ? "bg-violet-500/20 text-violet-400"
                : "bg-slate-700 text-slate-400 hover:text-white"
            }`}
            title="Toggle Grid"
          >
            <Grid3x3 className="h-3.5 w-3.5" />
          </button>

          {/* Shadows Toggle */}
          <button
            onClick={() => setShowShadows(!showShadows)}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg transition-colors ${
              showShadows
                ? "bg-violet-500/20 text-violet-400"
                : "bg-slate-700 text-slate-400 hover:text-white"
            }`}
            title="Toggle Shadows"
          >
            {showShadows ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Background Toggle */}
          <button
            onClick={() => setIsDarkBg(!isDarkBg)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
            title="Toggle Background"
          >
            {isDarkBg ? (
              <Moon className="h-3.5 w-3.5" />
            ) : (
              <Sun className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Info Toggle */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg transition-colors ${
              showInfo
                ? "bg-violet-500/20 text-violet-400"
                : "bg-slate-700 text-slate-400 hover:text-white"
            }`}
            title="Model Info"
          >
            <Info className="h-3.5 w-3.5" />
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleResetCamera}
            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
            title="Reset Camera"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Upload */}
          <label className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            Upload
            <input
              type="file"
              accept=".gltf,.glb,.obj"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={canvasContainerRef}
        className={`relative flex-1 ${isDarkBg ? "bg-slate-950" : "bg-gradient-to-br from-slate-200 to-slate-300"}`}
      >
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1,
          }}
          camera={{ position: [3, 3, 3], fov: 45 }}
        >
          <color attach="background" args={[isDarkBg ? "#0a0a0f" : "#e2e8f0"]} />
          <SceneContent
            modelUrl={modelUrl}
            viewMode={viewMode}
            showGrid={showGrid}
            showShadows={showShadows}
            environment={environment}
            onModelLoad={setModelInfo}
            controlsRef={controlsRef}
          />
        </Canvas>

        {/* Model Info Panel */}
        <ModelInfoPanel
          info={modelInfo}
          isOpen={showInfo}
          onClose={() => setShowInfo(false)}
        />

        {/* Fullscreen Button */}
        <button
          onClick={handleToggleFullscreen}
          className="absolute bottom-4 right-4 p-2 bg-slate-800/80 backdrop-blur-sm rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          <Camera className="h-4 w-4" />
        </button>

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 text-xs text-slate-500 bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded-lg">
          <span className="text-slate-400">Controls:</span> Left-click drag to
          rotate • Scroll to zoom • Right-click drag to pan
        </div>
      </div>

      {/* Footer / Model Description */}
      <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {customModelUrl ? (
              <span className="flex items-center gap-2">
                <span className="text-violet-400">Custom Model</span>
                <button
                  onClick={handleClearCustomModel}
                  className="text-red-400 hover:text-red-300"
                >
                  (Remove)
                </button>
              </span>
            ) : (
              <span>{selectedModel.description}</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>
              Supported formats:{" "}
              <span className="text-slate-400">.gltf, .glb, .obj</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
