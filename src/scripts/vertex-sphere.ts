import * as THREE from "three";
import { navigate } from "astro:transitions/client";
import { gsap } from "gsap";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SimplexNoise } from "three/addons/math/SimplexNoise.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const MAX_PIXEL_RATIO = 1.25;
const SPHERE_RADIUS = 0.5;
const MIN_RADIUS = 0.0075;
const GROWTH_DELAY_SECONDS = 1.5;
const GROWTH_DURATION_SECONDS = 1;
const MAX_ROTATION_SPEED = 3.2;
const MIN_ROTATION_SPEED = 0.12;
const NOISE_FREQUENCY = 1.2;
const NOISE_SPEED = 1;
const NOISE_STRENGTH = 0.1;
const HOLD_SCALE = 2;
const NEXT_FRAME_PATH = "/what-really-matters";
const CLICK_MOVE_THRESHOLD = 6;
let teardown: (() => void) | undefined;

const pointVertexShader = `
uniform float uPixelRatio;
uniform float uPointSize;

void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = uPointSize * uPixelRatio * (5.5 / -viewPosition.z);
}
`;

const pointFragmentShader = `
void main() {
    vec2 point = gl_PointCoord - 0.5;
    float distanceToCenter = length(point);

    if (distanceToCenter > 0.5) discard;

    float edge = 1.0 - smoothstep(0.38, 0.5, distanceToCenter);
    vec3 core = vec3(1.15, 1.22, 1.5);
    gl_FragColor = vec4(core, edge);
}
`;

function createVertexGeometry() {
  const sphere = new THREE.IcosahedronGeometry(SPHERE_RADIUS, 6);
  const positions = new THREE.BufferGeometry();
  positions.setAttribute("position", sphere.getAttribute("position").clone());
  sphere.dispose();

  const merged = mergeVertices(positions);
  positions.dispose();

  return merged;
}

function positionCamera(camera: THREE.PerspectiveCamera) {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.position.z = 5.5 * Math.max(1, 0.72 / aspect);
  camera.updateProjectionMatrix();
}

function setupVertexSphere() {
  const root = document.querySelector<HTMLElement>("[data-vertex-sphere]");
  const canvas = document.querySelector<HTMLCanvasElement>("#webgl-canvas");

  if (!root || !canvas) return;

  const interactionCanvas = canvas;
  const abortController = new AbortController();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pageMain = document.querySelector<HTMLElement>("main");
  const previousMainPointerEvents = pageMain?.style.pointerEvents ?? "";
  const previousCanvasPointerEvents = interactionCanvas.style.pointerEvents;
  const previousCanvasCursor = interactionCanvas.style.cursor;
  pageMain?.style.setProperty("pointer-events", "none");
  interactionCanvas.style.pointerEvents = "auto";
  interactionCanvas.style.cursor = "grab";
  const renderer = new THREE.WebGLRenderer({
    canvas: interactionCanvas,
    alpha: false,
    antialias: false,
    powerPreference: "high-performance",
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const sourceGeometry = createVertexGeometry();
  const positions = sourceGeometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  const basePositions = new Float32Array(positions.array);
  const simplex = new SimplexNoise();
  const dotMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: 1 },
      uPointSize: { value: 4.5 },
    },
    vertexShader: pointVertexShader,
    fragmentShader: pointFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
  const dots = new THREE.Points(sourceGeometry, dotMaterial);
  const growth = {
    radius: reducedMotion.matches ? SPHERE_RADIUS : MIN_RADIUS,
  };
  dots.scale.setScalar(growth.radius / SPHERE_RADIUS);
  scene.add(dots);
  const hitGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, 16, 12);
  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const hitSphere = new THREE.Mesh(hitGeometry, hitMaterial);
  hitSphere.scale.copy(dots.scale);
  scene.add(hitSphere);

  const controls = new OrbitControls(camera, interactionCanvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.rotateSpeed = 0.65;
  controls.cursorStyle = "grab";

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let noiseTime = 0;
  let noiseAmount = 0;
  let noiseActive = false;
  let holdScale = 1;
  let pointerDownOnSphere = false;
  let pointerDownX = 0;
  let pointerDownY = 0;

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.42,
      0.3,
      0.72,
    ),
  );

  let previousTime = performance.now();
  const growthTween = reducedMotion.matches
    ? undefined
    : gsap.to(growth, {
        radius: SPHERE_RADIUS,
        delay: GROWTH_DELAY_SECONDS,
        duration: GROWTH_DURATION_SECONDS,
        ease: "power2.out",
      });

  function intersectsSphere(event: PointerEvent) {
    const rect = interactionCanvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);

    return raycaster.intersectObject(hitSphere, false).length > 0;
  }

  function updateHover(event: PointerEvent) {
    noiseActive = intersectsSphere(event);
    interactionCanvas.style.cursor = noiseActive ? "pointer" : "grab";
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) return;

    pointerDownOnSphere = intersectsSphere(event);
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;

    if (!pointerDownOnSphere) return;
    interactionCanvas.style.cursor = "grabbing";
  }

  function handlePointerUp(event: PointerEvent) {
    const movement = Math.hypot(
      event.clientX - pointerDownX,
      event.clientY - pointerDownY,
    );
    const shouldNavigate =
      pointerDownOnSphere &&
      movement <= CLICK_MOVE_THRESHOLD &&
      intersectsSphere(event);

    pointerDownOnSphere = false;
    updateHover(event);

    if (shouldNavigate) {
      navigate(NEXT_FRAME_PATH, { sourceElement: interactionCanvas });
    }
  }

  function handlePointerLeave() {
    noiseActive = false;
    pointerDownOnSphere = false;
    interactionCanvas.style.cursor = "grab";
  }

  function updateTopology(delta: number) {
    const targetNoiseAmount = noiseActive ? 1 : 0;
    noiseAmount +=
      (targetNoiseAmount - noiseAmount) *
      Math.min(1, delta * (noiseActive ? 18 : 7));

    if (noiseAmount < 0.001 && !noiseActive) {
      positions.array.set(basePositions);
      positions.needsUpdate = true;
      noiseAmount = 0;
      return;
    }

    noiseTime += delta * NOISE_SPEED;

    for (let index = 0; index < positions.count; index += 1) {
      const offset = index * 3;
      const x = basePositions[offset];
      const y = basePositions[offset + 1];
      const z = basePositions[offset + 2];
      const length = Math.hypot(x, y, z) || 1;
      const noise =
        simplex.noise3d(
          x * NOISE_FREQUENCY + noiseTime,
          y * NOISE_FREQUENCY - noiseTime * 1.17,
          z * NOISE_FREQUENCY + noiseTime * 0.83,
        ) *
        NOISE_STRENGTH *
        noiseAmount;
      const radiusScale = (length + noise) / length;

      positions.setXYZ(
        index,
        x * radiusScale,
        y * radiusScale,
        z * radiusScale,
      );
    }

    positions.needsUpdate = true;
    sourceGeometry.computeBoundingSphere();
  }

  function updateScale(delta: number) {
    const targetHoldScale = noiseActive ? HOLD_SCALE : 1;
    holdScale +=
      (targetHoldScale - holdScale) *
      Math.min(1, delta * (noiseActive ? 10 : 7));

    const scale = (growth.radius / SPHERE_RADIUS) * holdScale;
    dots.scale.setScalar(scale);
    hitSphere.scale.setScalar(scale);
  }

  function resize() {
    const pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
    dotMaterial.uniforms.uPixelRatio.value = pixelRatio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    positionCamera(camera);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
  }

  function render(now: number) {
    const delta = Math.min((now - previousTime) / 1000, 0.05);
    previousTime = now;
    updateTopology(delta);
    updateScale(delta);
    controls.update(delta);

    if (!reducedMotion.matches) {
      const radiusProgress = THREE.MathUtils.inverseLerp(
        MIN_RADIUS,
        SPHERE_RADIUS,
        growth.radius,
      );
      const rotationSpeed = THREE.MathUtils.lerp(
        MAX_ROTATION_SPEED,
        MIN_ROTATION_SPEED,
        radiusProgress,
      );

      dots.rotation.y += delta * rotationSpeed;
      dots.rotation.x += delta * rotationSpeed * 0.3;
    }

    composer.render();
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      renderer.setAnimationLoop(null);
      return;
    }

    previousTime = performance.now();
    renderer.setAnimationLoop(render);
  }

  resize();
  renderer.setAnimationLoop(render);
  window.addEventListener("resize", resize, { signal: abortController.signal });
  interactionCanvas.addEventListener("pointerdown", handlePointerDown, {
    signal: abortController.signal,
  });
  interactionCanvas.addEventListener("pointermove", updateHover, {
    signal: abortController.signal,
    passive: true,
  });
  interactionCanvas.addEventListener("pointerleave", handlePointerLeave, {
    signal: abortController.signal,
  });
  window.addEventListener("pointerup", handlePointerUp, {
    signal: abortController.signal,
  });
  window.addEventListener("pointercancel", handlePointerLeave, {
    signal: abortController.signal,
  });
  document.addEventListener("visibilitychange", handleVisibilityChange, {
    signal: abortController.signal,
  });

  return () => {
    abortController.abort();
    growthTween?.kill();
    renderer.setAnimationLoop(null);
    controls.dispose();
    composer.dispose();
    sourceGeometry.dispose();
    hitGeometry.dispose();
    hitMaterial.dispose();
    dotMaterial.dispose();
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.dispose();
    pageMain?.style.setProperty("pointer-events", previousMainPointerEvents);
    interactionCanvas.style.pointerEvents = previousCanvasPointerEvents;
    interactionCanvas.style.cursor = previousCanvasCursor;
  };
}

function initialize() {
  teardown?.();
  teardown = setupVertexSphere();
}

initialize();
document.addEventListener("astro:page-load", initialize);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
