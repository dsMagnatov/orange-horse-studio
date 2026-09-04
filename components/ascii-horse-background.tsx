'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import * as THREE from 'three';

type AsciiHorseConfig = {
  cellSize: number;
  simulationResolution: number;
  mouseRadius: number;
  force: number;
  forceClamp: number;
  pressure: number;
  dissipation: number;
  viscosity: number;
  curlStrength: number;
  distortionStrength: number;
  brightnessStrength: number;
  videoZoom: number;
  vignetteStrength: number;
  vignetteInner: number;
  vignetteOuter: number;
  transitionColor: string;
  finalTransitionColor: string;
  transitionBand: number;
  characters: string;
};

const ASCII_HORSE_CONFIG: Readonly<AsciiHorseConfig> = Object.freeze({
  cellSize: 16,
  simulationResolution: 128,
  mouseRadius: 0.2,
  force: 20,
  forceClamp: 50,
  pressure: 0.999,
  dissipation: 0.0011,
  viscosity: 0.0011,
  curlStrength: 0.243,
  distortionStrength: 0.02,
  brightnessStrength: 0.5,
  videoZoom: 1.15,
  vignetteStrength: 0.72,
  vignetteInner: 0.55,
  vignetteOuter: 1.35,
  transitionColor: '#f03017',
  finalTransitionColor: '#ffffff',
  transitionBand: 0.22,
  characters: 'HORSE+-*#=',
});

const FULLSCREEN_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const VIDEO_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uVideo;
  varying vec2 vUv;

  void main() {
    gl_FragColor = texture2D(uVideo, vUv);
  }
`;

const CLEAR_FLUID_FRAGMENT_SHADER = /* glsl */ `
  void main() {
    gl_FragColor = vec4(0.5, 0.5, 0.0, 1.0);
  }
`;

const FLUID_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uVelocity;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform vec2 uPointerPrevious;
  uniform vec2 uPointerVelocity;
  uniform float uPointerActive;
  uniform float uDelta;
  uniform float uTime;
  uniform float uMouseRadius;
  uniform float uForce;
  uniform float uForceClamp;
  uniform float uPressure;
  uniform float uDissipation;
  uniform float uViscosity;
  uniform float uCurlStrength;
  varying vec2 vUv;

  vec2 decodeVelocity(vec2 encodedVelocity) {
    return encodedVelocity * 2.0 - 1.0;
  }

  vec2 encodeVelocity(vec2 velocity) {
    return velocity * 0.5 + 0.5;
  }

  float segmentDistance(vec2 point, vec2 start, vec2 end) {
    vec2 segment = end - start;
    float denominator = max(dot(segment, segment), 0.000001);
    float position = clamp(dot(point - start, segment) / denominator, 0.0, 1.0);
    return length(point - (start + segment * position));
  }

  void main() {
    vec2 texel = 1.0 / uResolution;
    vec4 currentSample = texture2D(uVelocity, vUv);
    vec2 currentVelocity = decodeVelocity(currentSample.xy);
    vec2 backtracedUv = clamp(vUv - currentVelocity * uDelta * 0.46, 0.0, 1.0);
    vec4 advectedSample = texture2D(uVelocity, backtracedUv);
    vec2 velocity = decodeVelocity(advectedSample.xy);
    float trail = advectedSample.b;

    vec2 velocityLeft = decodeVelocity(texture2D(uVelocity, clamp(vUv - vec2(texel.x, 0.0), 0.0, 1.0)).xy);
    vec2 velocityRight = decodeVelocity(texture2D(uVelocity, clamp(vUv + vec2(texel.x, 0.0), 0.0, 1.0)).xy);
    vec2 velocityBottom = decodeVelocity(texture2D(uVelocity, clamp(vUv - vec2(0.0, texel.y), 0.0, 1.0)).xy);
    vec2 velocityTop = decodeVelocity(texture2D(uVelocity, clamp(vUv + vec2(0.0, texel.y), 0.0, 1.0)).xy);
    vec2 blurredVelocity = (velocityLeft + velocityRight + velocityBottom + velocityTop) * 0.25;
    float viscosityMix = clamp(uViscosity * uDelta * 620.0, 0.0, 0.22);
    velocity = mix(velocity, blurredVelocity, viscosityMix);

    float vorticity = (velocityRight.y - velocityLeft.y - velocityTop.x + velocityBottom.x) * 0.5;
    vec2 rotationalForce = vec2(velocity.y, -velocity.x) * vorticity;
    velocity += rotationalForce * uCurlStrength * uDelta * 2.4;

    float speed = length(uPointerVelocity);
    float normalizedForce = clamp(speed * uForce, 0.0, uForceClamp) / max(uForceClamp, 0.0001);
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    float radius = uMouseRadius * mix(0.17, 0.38, smoothstep(0.0, 1.0, normalizedForce));
    float distanceToTrail = segmentDistance(vUv * aspect, uPointerPrevious * aspect, uPointer * aspect);
    float influence = exp(-distanceToTrail * distanceToTrail / max(radius * radius, 0.00001)) * uPointerActive;

    if (uPointerActive > 0.5 && speed > 0.0001) {
      vec2 direction = normalize(uPointerVelocity);
      vec2 normal = vec2(-direction.y, direction.x);
      float impulseStrength = min(speed * uForce, uForceClamp) * 0.0025;
      float curlWave = sin(dot(vUv - uPointer, normal) * 72.0 + uTime * 4.0);
      velocity += direction * impulseStrength * influence;
      velocity += normal * curlWave * influence * normalizedForce * uCurlStrength * 0.048;
      trail = max(trail, influence * (0.32 + normalizedForce * 0.68));
    }

    float pressureDecay = pow(uPressure, uDelta * 60.0);
    float trailDecay = exp(-uDissipation * uDelta * 720.0);
    velocity *= pressureDecay * trailDecay;
    trail *= trailDecay;

    gl_FragColor = vec4(encodeVelocity(clamp(velocity, -1.0, 1.0)), clamp(trail, 0.0, 1.0), 1.0);
  }
`;

const ASCII_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uVideo;
  uniform sampler2D uFluid;
  uniform sampler2D uAtlas;
  uniform vec2 uResolution;
  uniform vec2 uSourceSize;
  uniform float uCellSize;
  uniform float uCharacterCount;
  uniform float uDistortionStrength;
  uniform float uBrightnessStrength;
  uniform float uVideoZoom;
  uniform float uVignetteStrength;
  uniform float uVignetteInner;
  uniform float uVignetteOuter;
  uniform vec3 uTransitionColor;
  uniform vec3 uFinalTransitionColor;
  uniform float uTransitionBand;
  uniform float uScrollProgress;
  uniform float uFinalScrollProgress;
  uniform float uTime;
  varying vec2 vUv;

  vec2 decodeVelocity(vec2 encodedVelocity) {
    return encodedVelocity * 2.0 - 1.0;
  }

  vec2 coverUv(vec2 screenUv) {
    float viewportAspect = uResolution.x / uResolution.y;
    float sourceAspect = uSourceSize.x / uSourceSize.y;
    vec2 scale = vec2(1.0);

    if (viewportAspect > sourceAspect) {
      scale.y = sourceAspect / viewportAspect;
    } else {
      scale.x = viewportAspect / sourceAspect;
    }

    return ((screenUv - 0.5) * scale) / uVideoZoom + 0.5;
  }

  float noise(vec2 position) {
    return fract(sin(dot(position, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec4 fluid = texture2D(uFluid, vUv);
    vec2 flow = decodeVelocity(fluid.xy);
    float fluidIntensity = smoothstep(0.008, 0.68, fluid.b);
    vec2 warpedUv = clamp(
      vUv - flow * uDistortionStrength * (0.7 + fluidIntensity * 1.45),
      0.0,
      1.0
    );

    vec2 gridSize = max(floor(uResolution / uCellSize), vec2(1.0));
    vec2 gridPosition = warpedUv * gridSize;
    vec2 cell = floor(gridPosition);
    vec2 characterUv = fract(gridPosition);
    vec2 cellCenterUv = (cell + 0.5) / gridSize;
    vec2 videoUv = clamp(
      coverUv(cellCenterUv) - flow * uDistortionStrength * fluidIntensity * 1.25,
      0.001,
      0.999
    );

    vec3 sourceColor = texture2D(uVideo, videoUv).rgb;
    float brightness = dot(sourceColor, vec3(0.2126, 0.7152, 0.0722));
    float characterShade = clamp(1.0 - brightness * 1.08, 0.0, 0.9999);
    float characterIndex = floor(characterShade * uCharacterCount);
    vec2 atlasUv = vec2(
      (characterIndex + characterUv.x) / uCharacterCount,
      characterUv.y
    );
    float glyph = texture2D(uAtlas, atlasUv).r;
    glyph = smoothstep(0.22, 0.78, glyph);

    vec3 fieldColor = sourceColor * 0.32 + vec3(0.014);
    vec3 glyphColor = sourceColor * (1.12 + fluidIntensity * uBrightnessStrength * 1.35);
    glyphColor += fluidIntensity * uBrightnessStrength * vec3(0.075, 0.15, 0.16);
    vec3 color = mix(fieldColor, glyphColor, glyph);
    color += fluidIntensity * uBrightnessStrength * (sourceColor * 0.46 + vec3(0.038, 0.075, 0.08));

    float grain = noise(gl_FragCoord.xy + floor(uTime * 24.0)) - 0.5;
    color += grain * 0.047;
    color *= 0.98 + 0.035 * sin(gl_FragCoord.y * 3.14159 / max(uCellSize, 1.0));

    vec2 vignettePosition = (vUv * 2.0 - 1.0) * vec2(0.92, 1.08);
    float vignette = smoothstep(
      uVignetteInner,
      uVignetteOuter,
      length(vignettePosition)
    );
    color *= 1.0 - vignette * uVignetteStrength;

    vec2 transitionGrid = max(ceil(uResolution / uCellSize), vec2(1.0));
    vec2 transitionCell = floor(gl_FragCoord.xy / uCellSize);
    float rowProgress = (transitionCell.y + 0.5) / transitionGrid.y;
    float pixelRandom = noise(transitionCell + vec2(19.17, 73.41));
    float clusterRandom = noise(floor(transitionCell * 0.5) + vec2(117.3, 31.9));
    float randomOffset = (mix(pixelRandom, clusterRandom, 0.32) - 0.5) * uTransitionBand;
    float waveOffset = sin(transitionCell.x * 0.37 + pixelRandom * 6.28318) * 0.025;
    float revealAt = clamp(rowProgress + randomOffset + waveOffset, 0.01, 0.99);
    float easedScroll = uScrollProgress * uScrollProgress * (3.0 - 2.0 * uScrollProgress);
    float reveal = step(revealAt, easedScroll);
    color = mix(color, uTransitionColor, reveal);

    float easedFinalScroll = uFinalScrollProgress * uFinalScrollProgress *
      (3.0 - 2.0 * uFinalScrollProgress);
    float finalReveal = step(revealAt, easedFinalScroll);
    color = mix(color, uFinalTransitionColor, finalReveal);

    gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
  }
`;

function createCharacterAtlas(characters: string) {
  const tileSize = 96;
  const canvas = document.createElement('canvas');
  canvas.width = tileSize * characters.length;
  canvas.height = tileSize;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create the ASCII character atlas.');
  }

  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.font = `700 ${Math.round(tileSize * 0.78)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  Array.from(characters).forEach((character, index) => {
    context.fillText(character, index * tileSize + tileSize / 2, tileSize * 0.52);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createRenderTarget(
  width: number,
  height: number,
  type: THREE.TextureDataType = THREE.UnsignedByteType,
) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.generateMipmaps = false;
  return target;
}

function getSimulationSize() {
  const device = navigator as Navigator & { deviceMemory?: number };
  const weakDevice =
    Math.min(window.innerWidth, window.innerHeight) < 600 ||
    (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) ||
    (device.deviceMemory !== undefined && device.deviceMemory <= 4);

  return weakDevice
    ? Math.max(64, Math.round(ASCII_HORSE_CONFIG.simulationResolution / 2))
    : ASCII_HORSE_CONFIG.simulationResolution;
}

export function AsciiHorseBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);

    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;

    if (!container || !video) return;

    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;

    if (reducedMotion) {
      container.dataset.webgl = 'reduced';
      video.pause();
      return;
    }

    const playPromise = video.play();
    if (playPromise) playPromise.catch(() => undefined);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
        premultipliedAlpha: false,
      });
    } catch {
      container.dataset.webgl = 'unavailable';
      return;
    }

    const canvas = renderer.domElement;
    canvas.className = 'ascii-webgl-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.dataset.effect = 'ascii-fluid-video';
    canvas.style.opacity = '0';
    container.appendChild(canvas);
    container.dataset.webgl = 'active';

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    const quad = new THREE.Mesh(geometry);
    quad.frustumCulled = false;
    scene.add(quad);

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.generateMipmaps = false;
    videoTexture.colorSpace = THREE.SRGBColorSpace;

    const atlasTexture = createCharacterAtlas(ASCII_HORSE_CONFIG.characters);
    const simulationSize = getSimulationSize();
    const fluidTextureType = renderer.capabilities.isWebGL2
      ? THREE.HalfFloatType
      : THREE.UnsignedByteType;
    let fluidReadTarget = createRenderTarget(simulationSize, simulationSize, fluidTextureType);
    let fluidWriteTarget = createRenderTarget(simulationSize, simulationSize, fluidTextureType);
    canvas.dataset.simulationResolution = String(simulationSize);

    const maxVideoWidth = simulationSize < ASCII_HORSE_CONFIG.simulationResolution ? 960 : 1280;
    const sourceWidth = video.videoWidth || 16;
    const sourceHeight = video.videoHeight || 9;
    const videoScale = Math.min(1, maxVideoWidth / sourceWidth);
    let videoTarget = createRenderTarget(
      Math.max(16, Math.round(sourceWidth * videoScale)),
      Math.max(9, Math.round(sourceHeight * videoScale)),
    );
    const videoUniforms = {
      uVideo: { value: videoTexture },
    };
    const videoMaterial = new THREE.ShaderMaterial({
      uniforms: videoUniforms,
      vertexShader: FULLSCREEN_VERTEX_SHADER,
      fragmentShader: VIDEO_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    const clearFluidMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX_SHADER,
      fragmentShader: CLEAR_FLUID_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    const fluidUniforms = {
      uVelocity: { value: fluidReadTarget.texture },
      uResolution: { value: new THREE.Vector2(simulationSize, simulationSize) },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uPointerPrevious: { value: new THREE.Vector2(0.5, 0.5) },
      uPointerVelocity: { value: new THREE.Vector2() },
      uPointerActive: { value: 0 },
      uDelta: { value: 1 / 60 },
      uTime: { value: 0 },
      uMouseRadius: { value: ASCII_HORSE_CONFIG.mouseRadius },
      uForce: { value: ASCII_HORSE_CONFIG.force },
      uForceClamp: { value: ASCII_HORSE_CONFIG.forceClamp },
      uPressure: { value: ASCII_HORSE_CONFIG.pressure },
      uDissipation: { value: ASCII_HORSE_CONFIG.dissipation },
      uViscosity: { value: ASCII_HORSE_CONFIG.viscosity },
      uCurlStrength: { value: ASCII_HORSE_CONFIG.curlStrength },
    };
    const fluidMaterial = new THREE.ShaderMaterial({
      uniforms: fluidUniforms,
      vertexShader: FULLSCREEN_VERTEX_SHADER,
      fragmentShader: FLUID_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    const transitionColor = new THREE.Color(
      ASCII_HORSE_CONFIG.transitionColor,
    ).convertLinearToSRGB();
    const finalTransitionColor = new THREE.Color(
      ASCII_HORSE_CONFIG.finalTransitionColor,
    ).convertLinearToSRGB();
    const asciiUniforms = {
      uVideo: { value: videoTarget.texture },
      uFluid: { value: fluidReadTarget.texture },
      uAtlas: { value: atlasTexture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uSourceSize: { value: new THREE.Vector2(sourceWidth, sourceHeight) },
      uCellSize: { value: ASCII_HORSE_CONFIG.cellSize },
      uCharacterCount: { value: ASCII_HORSE_CONFIG.characters.length },
      uDistortionStrength: { value: ASCII_HORSE_CONFIG.distortionStrength },
      uBrightnessStrength: { value: ASCII_HORSE_CONFIG.brightnessStrength },
      uVideoZoom: { value: ASCII_HORSE_CONFIG.videoZoom },
      uVignetteStrength: { value: ASCII_HORSE_CONFIG.vignetteStrength },
      uVignetteInner: { value: ASCII_HORSE_CONFIG.vignetteInner },
      uVignetteOuter: { value: ASCII_HORSE_CONFIG.vignetteOuter },
      uTransitionColor: { value: transitionColor },
      uFinalTransitionColor: { value: finalTransitionColor },
      uTransitionBand: { value: ASCII_HORSE_CONFIG.transitionBand },
      uScrollProgress: { value: 0 },
      uFinalScrollProgress: { value: 0 },
      uTime: { value: 0 },
    };
    const asciiMaterial = new THREE.ShaderMaterial({
      uniforms: asciiUniforms,
      vertexShader: FULLSCREEN_VERTEX_SHADER,
      fragmentShader: ASCII_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      toneMapped: false,
    });

    quad.material = clearFluidMaterial;
    renderer.setRenderTarget(fluidReadTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(fluidWriteTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    const pointerCurrent = new THREE.Vector2(0.5, 0.5);
    const pointerRendered = new THREE.Vector2(0.5, 0.5);
    const pointerVelocity = new THREE.Vector2();
    const measuredVelocity = new THREE.Vector2();
    const drawingBufferSize = new THREE.Vector2();
    let pointerDirty = false;
    let lastPointerTime = performance.now();
    let lastFrameTime = performance.now();
    let animationFrame = 0;
    let resizeFrame = 0;
    let pointerSamples = 0;
    let revealed = false;
    let disposed = false;
    let contextLost = false;

    const resizeVideoTarget = () => {
      const width = video.videoWidth || 16;
      const height = video.videoHeight || 9;
      const scale = Math.min(1, maxVideoWidth / width);
      const targetWidth = Math.max(16, Math.round(width * scale));
      const targetHeight = Math.max(9, Math.round(height * scale));

      if (targetWidth !== videoTarget.width || targetHeight !== videoTarget.height) {
        const previousTarget = videoTarget;
        videoTarget = createRenderTarget(targetWidth, targetHeight);
        asciiUniforms.uVideo.value = videoTarget.texture;
        previousTarget.dispose();
      }

      asciiUniforms.uSourceSize.value.set(width, height);
    };

    const resize = () => {
      if (disposed) return;
      const bounds = container.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      renderer.getDrawingBufferSize(drawingBufferSize);
      asciiUniforms.uResolution.value.copy(drawingBufferSize);
      asciiUniforms.uCellSize.value = ASCII_HORSE_CONFIG.cellSize * pixelRatio;
    };

    const scheduleResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    };

    const updateScrollProgress = () => {
      const firstScreenHeight = Math.max(
        document.querySelector<HTMLElement>('.site-screen--horse')?.offsetHeight ??
          window.innerHeight,
        1,
      );
      asciiUniforms.uScrollProgress.value = THREE.MathUtils.clamp(
        window.scrollY / firstScreenHeight,
        0,
        1,
      );

      const finalScreen = document.querySelector<HTMLElement>('.site-screen--white');
      if (!finalScreen) {
        asciiUniforms.uFinalScrollProgress.value = 0;
        return;
      }

      const finalScreenTop = finalScreen.getBoundingClientRect().top + window.scrollY;
      const finalTransitionStart = finalScreenTop - window.innerHeight;
      asciiUniforms.uFinalScrollProgress.value = THREE.MathUtils.clamp(
        (window.scrollY - finalTransitionStart) / Math.max(window.innerHeight, 1),
        0,
        1,
      );
    };

    const setPointer = (clientX: number, clientY: number, timeStamp: number) => {
      const bounds = container.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;

      const nextX = THREE.MathUtils.clamp((clientX - bounds.left) / bounds.width, 0, 1);
      const nextY = THREE.MathUtils.clamp(1 - (clientY - bounds.top) / bounds.height, 0, 1);
      const elapsed = Math.max((timeStamp - lastPointerTime) / 1000, 1 / 240);
      measuredVelocity.set(
        (nextX - pointerCurrent.x) / elapsed,
        (nextY - pointerCurrent.y) / elapsed,
      );
      pointerVelocity.lerp(measuredVelocity, 0.62);
      pointerCurrent.set(nextX, nextY);
      pointerDirty = true;
      lastPointerTime = timeStamp;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      setPointer(event.clientX, event.clientY, event.timeStamp || performance.now());
      pointerSamples += 1;
      canvas.dataset.pointerSamples = String(pointerSamples);
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) setPointer(touch.clientX, touch.clientY, event.timeStamp || performance.now());
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      canvas.style.opacity = '0';
    };

    const onContextRestored = () => {
      contextLost = false;
      revealed = false;
      canvas.style.opacity = '0';
    };

    const animate = (now: number) => {
      if (disposed) return;
      animationFrame = requestAnimationFrame(animate);

      if (document.hidden || contextLost) {
        lastFrameTime = now;
        return;
      }

      const delta = Math.min(Math.max((now - lastFrameTime) / 1000, 1 / 240), 1 / 20);
      lastFrameTime = now;
      const time = now / 1000;

      fluidUniforms.uVelocity.value = fluidReadTarget.texture;
      fluidUniforms.uPointer.value.copy(pointerCurrent);
      fluidUniforms.uPointerPrevious.value.copy(pointerRendered);
      fluidUniforms.uPointerVelocity.value.copy(pointerVelocity);
      fluidUniforms.uPointerActive.value = pointerDirty ? 1 : 0;
      fluidUniforms.uDelta.value = delta;
      fluidUniforms.uTime.value = time;

      quad.material = fluidMaterial;
      renderer.setRenderTarget(fluidWriteTarget);
      renderer.render(scene, camera);
      [fluidReadTarget, fluidWriteTarget] = [fluidWriteTarget, fluidReadTarget];
      asciiUniforms.uFluid.value = fluidReadTarget.texture;

      if (pointerDirty) {
        pointerRendered.copy(pointerCurrent);
        pointerDirty = false;
      }
      pointerVelocity.multiplyScalar(Math.pow(0.22, delta));

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        quad.material = videoMaterial;
        renderer.setRenderTarget(videoTarget);
        renderer.render(scene, camera);

        asciiUniforms.uTime.value = time;
        quad.material = asciiMaterial;
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);

        if (!revealed) {
          revealed = true;
          canvas.style.opacity = '1';
          canvas.dataset.ready = 'true';
        }
      }
    };

    resize();
    resizeVideoTarget();
    updateScrollProgress();
    window.addEventListener('resize', scheduleResize, { passive: true });
    window.addEventListener('resize', updateScrollProgress, { passive: true });
    window.addEventListener('orientationchange', scheduleResize, { passive: true });
    window.addEventListener('orientationchange', updateScrollProgress, { passive: true });
    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    video.addEventListener('loadedmetadata', resizeVideoTarget);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    animationFrame = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize', scheduleResize);
      window.removeEventListener('resize', updateScrollProgress);
      window.removeEventListener('orientationchange', scheduleResize);
      window.removeEventListener('orientationchange', updateScrollProgress);
      window.removeEventListener('scroll', updateScrollProgress);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
      video.removeEventListener('loadedmetadata', resizeVideoTarget);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      video.pause();

      scene.remove(quad);
      geometry.dispose();
      videoTexture.dispose();
      atlasTexture.dispose();
      videoMaterial.dispose();
      clearFluidMaterial.dispose();
      fluidMaterial.dispose();
      asciiMaterial.dispose();
      fluidReadTarget.dispose();
      fluidWriteTarget.dispose();
      videoTarget.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      delete container.dataset.webgl;
    };
  }, [reducedMotion]);

  return (
    <div
      ref={containerRef}
      className="ascii-horse-background"
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      data-webgl="initializing"
      aria-hidden="true"
    >
      <Image
        className="ascii-horse-poster"
        src="/horse-poster.png"
        alt=""
        width={1680}
        height={1005}
        sizes="100vw"
        priority
        draggable={false}
      />
      <video
        ref={videoRef}
        className="ascii-horse-video"
        src="/horse-loop.mp4"
        poster="/horse-poster.png"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        tabIndex={-1}
      />
    </div>
  );
}
