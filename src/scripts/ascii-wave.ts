import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const vertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const simulationFragmentShader = `
uniform sampler2D uPreviousFrame;
uniform vec2 uPointer;
uniform vec2 uResolution;
uniform float uImpulse;
uniform float uImpulseRadius;
uniform float uFrame;
varying vec2 vUv;

const float DELTA = 1.35;

void main() {
    if (uFrame < 0.5) {
        gl_FragColor = vec4(0.0);
        return;
    }

    vec2 texel = 1.0 / uResolution;
    vec4 data = texture2D(uPreviousFrame, vUv);
    float pressure = data.x;
    float velocity = data.y;

    float right = texture2D(uPreviousFrame, vUv + vec2(texel.x, 0.0)).x;
    float left = texture2D(uPreviousFrame, vUv - vec2(texel.x, 0.0)).x;
    float up = texture2D(uPreviousFrame, vUv + vec2(0.0, texel.y)).x;
    float down = texture2D(uPreviousFrame, vUv - vec2(0.0, texel.y)).x;

    if (vUv.x <= texel.x) left = right;
    if (vUv.x >= 1.0 - texel.x) right = left;
    if (vUv.y <= texel.y) down = up;
    if (vUv.y >= 1.0 - texel.y) up = down;

    velocity += DELTA * (-2.0 * pressure + right + left) * 0.25;
    velocity += DELTA * (-2.0 * pressure + up + down) * 0.25;
    pressure += DELTA * velocity;
    velocity -= 0.005 * DELTA * pressure;
    velocity *= 1.0 - 0.005 * DELTA;
    pressure *= 0.996;

    float pointerDistance = distance(vUv, uPointer);
    float pointerRadius = uImpulseRadius / min(uResolution.x, uResolution.y);
    pressure += uImpulse * 1.8 * (1.0 - smoothstep(0.0, pointerRadius, pointerDistance));

    gl_FragColor = vec4(
        pressure,
        velocity,
        (right - left) * 0.5,
        (up - down) * 0.5
    );
}
`;

const renderFragmentShader = `
uniform sampler2D uWave;
uniform sampler2D uAscii;
uniform sampler2D uArrow;
uniform vec3 uBackground;
uniform vec2 uPointer;
uniform vec2 uViewport;
uniform vec2 uGrid;
uniform float uCursorRadius;
uniform float uArrowHover;
uniform float uReducedMotion;
varying vec2 vUv;

void main() {
    vec2 cellUv = (floor(vUv * uGrid) + 0.5) / uGrid;
    vec4 waveData = texture2D(uWave, cellUv);
    float ripple = smoothstep(0.001, 0.36, abs(waveData.x));
    ripple = pow(ripple, 0.66);
    float halo = 1.0 - smoothstep(0.0, 0.20, distance(cellUv, uPointer));
    float reveal = mix(ripple, halo, uReducedMotion);
    float glyph = texture2D(uAscii, vUv).a;
    float arrow = texture2D(uArrow, vUv).a;
    vec2 pointerOffset = (vUv - uPointer) * uViewport;
    float cursorPoint = 1.0 - smoothstep(
        uCursorRadius - 1.5,
        uCursorRadius + 1.5,
        length(pointerOffset)
    );
    vec3 color = mix(uBackground, vec3(1.15), max(glyph, arrow) * reveal);
    vec3 cursorColor = mix(
        vec3(2.8, 0.015, 0.01),
        vec3(0.02, 2.8, 0.12),
        uArrowHover
    );
    color = mix(color, cursorColor, cursorPoint);

    gl_FragColor = vec4(color, 1.0);
}
`;

const ASCII_CHARACTERS = " .:-=+*#%@/\\|<>[]{}";
let teardown: (() => void) | undefined;

interface GridTextures {
  arrowTexture: THREE.CanvasTexture;
  asciiTexture: THREE.CanvasTexture;
  columns: number;
  rows: number;
}

function createGridTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  return texture;
}

function createGridTextures(width: number, height: number): GridTextures {
  const asciiCanvas = document.createElement("canvas");
  const arrowCanvas = document.createElement("canvas");
  const context = asciiCanvas.getContext("2d");
  const arrowContext = arrowCanvas.getContext("2d");

  if (!context || !arrowContext) {
    throw new Error("Could not create the ASCII grid textures.");
  }

  asciiCanvas.width = width;
  asciiCanvas.height = height;
  arrowCanvas.width = width;
  arrowCanvas.height = height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";

  const cellSize = Math.max(
    14,
    Math.round(18 * Math.min(window.devicePixelRatio, 1.5)),
  );
  const font = `${Math.round(cellSize * 0.72)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  context.font = font;
  arrowContext.fillStyle = "#ffffff";
  arrowContext.font = font;
  arrowContext.textAlign = "center";
  arrowContext.textBaseline = "middle";

  const columns = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const hash =
        (column * 17 + row * 31 + column * row * 7) % ASCII_CHARACTERS.length;
      const character = ASCII_CHARACTERS[hash];
      context.fillText(
        character,
        column * cellSize + cellSize * 0.5,
        row * cellSize + cellSize * 0.5,
      );
    }
  }

  const arrowPattern = [
    "       █   ",
    "       ██  ",
    "       ███ ",
    "████████████",
    "█████████████",
    "████████████",
    "       ███ ",
    "       ██  ",
    "       █   ",
  ];
  const arrowColumns = Math.max(...arrowPattern.map((line) => line.length));
  const arrowRows = arrowPattern.length;
  const arrowStartColumn = Math.max(1, columns - arrowColumns - 2);
  const arrowStartRow = Math.max(1, rows - arrowRows - 2);

  arrowPattern.forEach((line, row) => {
    Array.from(line).forEach((character, column) => {
      if (character !== "█") return;

      arrowContext.fillText(
        character,
        (arrowStartColumn + column) * cellSize + cellSize * 0.5,
        (arrowStartRow + row) * cellSize + cellSize * 0.5,
      );
    });
  });

  return {
    asciiTexture: createGridTexture(asciiCanvas),
    arrowTexture: createGridTexture(arrowCanvas),
    columns,
    rows,
  };
}

function setupAsciiWave() {
  const root = document.querySelector<HTMLElement>("[data-ascii-wave]");
  const canvas = document.querySelector<HTMLCanvasElement>("#webgl-canvas");
  const nextButton = document.querySelector<HTMLButtonElement>(
    "[data-ascii-next]",
  );

  if (!root || !canvas || !nextButton) return;

  const abortController = new AbortController();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  document.documentElement.classList.add("has-webgl-cursor");
  const background = getComputedStyle(document.documentElement)
    .getPropertyValue("--bg")
    .trim();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: false,
    powerPreference: "high-performance",
  });
  const scene = new THREE.Scene();
  const simulationScene = new THREE.Scene();
  const camera = new THREE.Camera();
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.01,
    0.3,
    0.32,
  );
  const outputPass = new OutputPass();
  const geometry = new THREE.PlaneGeometry(2, 2);
  const pointer = new THREE.Vector2(-10, -10);
  const previousPointer = new THREE.Vector2();
  const pointerVelocity = new THREE.Vector2();
  const nextPointerVelocity = new THREE.Vector2();
  const drawingBufferSize = new THREE.Vector2();
  let frame = 0;
  let pointerImpulse = 0;
  let previousPointerTime = 0;
  let cursorRadius = 3;
  let cursorRadiusTarget = 3;
  let arrowHover = 0;
  let arrowHoverTarget = 0;
  let asciiTexture: THREE.CanvasTexture;
  let arrowTexture: THREE.CanvasTexture;
  let targetA: THREE.WebGLRenderTarget;
  let targetB: THREE.WebGLRenderTarget;
  let impulseRadius = 18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  const targetOptions: THREE.RenderTargetOptions = {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  };

  const simulationMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uPreviousFrame: { value: null },
      uPointer: { value: pointer },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uImpulse: { value: 0 },
      uImpulseRadius: { value: impulseRadius },
      uFrame: { value: 0 },
    },
    vertexShader,
    fragmentShader: simulationFragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const renderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uWave: { value: null },
      uAscii: { value: null },
      uArrow: { value: null },
      uBackground: { value: new THREE.Color(background) },
      uPointer: { value: pointer },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uGrid: { value: new THREE.Vector2(1, 1) },
      uCursorRadius: { value: cursorRadius },
      uArrowHover: { value: arrowHover },
      uReducedMotion: { value: Number(reducedMotion.matches) },
    },
    vertexShader,
    fragmentShader: renderFragmentShader,
    depthTest: false,
    depthWrite: false,
  });

  simulationScene.add(new THREE.Mesh(geometry, simulationMaterial));
  scene.add(new THREE.Mesh(geometry, renderMaterial));

  function resize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    composer.setSize(window.innerWidth, window.innerHeight);
    renderer.getDrawingBufferSize(drawingBufferSize);

    const width = Math.max(1, Math.round(drawingBufferSize.x));
    const height = Math.max(1, Math.round(drawingBufferSize.y));
    const simulationWidth = Math.max(1, Math.round(width * 0.3));
    const simulationHeight = Math.max(1, Math.round(height * 0.3));

    targetA?.dispose();
    targetB?.dispose();
    asciiTexture?.dispose();
    arrowTexture?.dispose();

    targetA = new THREE.WebGLRenderTarget(
      simulationWidth,
      simulationHeight,
      targetOptions,
    );
    targetB = new THREE.WebGLRenderTarget(
      simulationWidth,
      simulationHeight,
      targetOptions,
    );
    const gridTextures = createGridTextures(width, height);
    asciiTexture = gridTextures.asciiTexture;
    arrowTexture = gridTextures.arrowTexture;
    simulationMaterial.uniforms.uResolution.value.set(
      simulationWidth,
      simulationHeight,
    );
    renderMaterial.uniforms.uAscii.value = asciiTexture;
    renderMaterial.uniforms.uArrow.value = arrowTexture;
    renderMaterial.uniforms.uGrid.value.set(
      gridTextures.columns,
      gridTextures.rows,
    );
    renderMaterial.uniforms.uViewport.value.set(
      window.innerWidth,
      window.innerHeight,
    );
    frame = 0;
  }

  function handlePointerMove(event: PointerEvent) {
    const now = performance.now();
    const elapsed =
      Math.min(Math.max(now - previousPointerTime, 8), 100) / 1000;

    if (previousPointerTime > 0) {
      nextPointerVelocity.set(
        (event.clientX - previousPointer.x) / elapsed,
        (event.clientY - previousPointer.y) / elapsed,
      );

      const acceleration =
        Math.hypot(
          nextPointerVelocity.x - pointerVelocity.x,
          nextPointerVelocity.y - pointerVelocity.y,
        ) / elapsed;

      cursorRadiusTarget = 3 + Math.min(acceleration / 12000, 7);
      pointerVelocity.copy(nextPointerVelocity);
    }

    previousPointer.set(event.clientX, event.clientY);
    previousPointerTime = now;
    pointer.set(
      event.clientX / window.innerWidth,
      1 - event.clientY / window.innerHeight,
    );
    pointerImpulse = 0.3;
    impulseRadius = 5;
  }

  function handlePointerDown(event: PointerEvent) {
    pointer.set(
      event.clientX / window.innerWidth,
      1 - event.clientY / window.innerHeight,
    );
    pointerImpulse = 6.5;
    impulseRadius = 3;
  }

  function handleNextPointerDown(event: PointerEvent) {
    event.stopPropagation();
  }

  function handleNextClick() {
    console.log("next");
  }

  function handleNextPointerEnter() {
    arrowHoverTarget = 1;
  }

  function handleNextPointerLeave() {
    arrowHoverTarget = 0;
  }

  function handlePointerLeave() {
    pointer.set(-10, -10);
    previousPointerTime = 0;
    pointerVelocity.set(0, 0);
    cursorRadiusTarget = 3;
  }

  function handleMotionPreference() {
    renderMaterial.uniforms.uReducedMotion.value = Number(
      reducedMotion.matches,
    );
    frame = 0;
  }

  function render() {
    cursorRadiusTarget += (3 - cursorRadiusTarget) * 0.08;
    cursorRadius += (cursorRadiusTarget - cursorRadius) * 0.2;
    arrowHover += (arrowHoverTarget - arrowHover) * 0.22;
    renderMaterial.uniforms.uCursorRadius.value = cursorRadius;
    renderMaterial.uniforms.uArrowHover.value = arrowHover;

    if (!reducedMotion.matches) {
      simulationMaterial.uniforms.uFrame.value = frame;
      simulationMaterial.uniforms.uImpulse.value = pointerImpulse;
      simulationMaterial.uniforms.uImpulseRadius.value = impulseRadius;
      simulationMaterial.uniforms.uPreviousFrame.value = targetA.texture;
      renderer.setRenderTarget(targetB);
      renderer.render(simulationScene, camera);

      const previousTarget = targetA;
      targetA = targetB;
      targetB = previousTarget;
      pointerImpulse = 0;
      frame += 1;
    }

    renderMaterial.uniforms.uWave.value = targetA.texture;
    renderer.setRenderTarget(null);
    composer.render();
  }

  function handleVisibilityChange() {
    renderer.setAnimationLoop(document.hidden ? null : render);
  }

  resize();
  renderer.setAnimationLoop(render);
  window.addEventListener("resize", resize, { signal: abortController.signal });
  window.addEventListener("pointermove", handlePointerMove, {
    signal: abortController.signal,
    passive: true,
  });
  window.addEventListener("pointerdown", handlePointerDown, {
    signal: abortController.signal,
    passive: true,
  });
  nextButton.addEventListener("pointerdown", handleNextPointerDown, {
    signal: abortController.signal,
  });
  nextButton.addEventListener("click", handleNextClick, {
    signal: abortController.signal,
  });
  nextButton.addEventListener("pointerenter", handleNextPointerEnter, {
    signal: abortController.signal,
  });
  nextButton.addEventListener("pointerleave", handleNextPointerLeave, {
    signal: abortController.signal,
  });
  document.documentElement.addEventListener(
    "pointerleave",
    handlePointerLeave,
    {
      signal: abortController.signal,
    },
  );
  document.addEventListener("visibilitychange", handleVisibilityChange, {
    signal: abortController.signal,
  });
  reducedMotion.addEventListener("change", handleMotionPreference, {
    signal: abortController.signal,
  });

  return () => {
    abortController.abort();
    document.documentElement.classList.remove("has-webgl-cursor");
    renderer.setAnimationLoop(null);
    targetA.dispose();
    targetB.dispose();
    asciiTexture.dispose();
    arrowTexture.dispose();
    geometry.dispose();
    simulationMaterial.dispose();
    renderMaterial.dispose();
    composer.dispose();
    bloomPass.dispose();
    outputPass.dispose();
    renderer.dispose();
  };
}

function initialize() {
  teardown?.();
  teardown = setupAsciiWave();
}

initialize();
document.addEventListener("astro:page-load", initialize);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
