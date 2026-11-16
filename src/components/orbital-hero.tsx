"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Mic,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";

// Keep this media condition aligned with orbital.css. CSS and WebGL must use
// the same asset so the visible fallback and renderer share one download.
const compactTextureMedia =
  "(max-width: 1050px), (pointer: coarse), (prefers-reduced-data: reduce)";

const vertexShader = `
  attribute vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

// An orthographic ray/sphere intersection gives each fragment a genuine 3D
// normal. Rotating that normal before spherical UV mapping rotates the globe,
// rather than sliding a flat image or rotating the whole canvas.
const fragmentShader = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform sampler2D u_surface;
  uniform float u_rotation;
  uniform vec2 u_pointer;
  uniform float u_time;
  uniform float u_texel;
  const float PI = 3.14159265359;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 sphericalUv(vec3 n) {
    return vec2(fract(atan(n.z, n.x) / (2.0 * PI) + 0.5), acos(clamp(n.y, -1.0, 1.0)) / PI);
  }
  vec3 rotateY(vec3 v, float angle) {
    float c = cos(angle), s = sin(angle);
    return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
  }
  void main() {
    float shortest = min(u_resolution.x, u_resolution.y);
    vec2 p = (gl_FragCoord.xy - u_resolution * 0.5) / shortest;
    vec3 base = vec3(0.041, 0.065, 0.105);
    float field = exp(-length(p - vec2(0.25, 0.1)) * 1.4);
    vec3 color = base + vec3(0.032, 0.035, 0.064) * field;

    // Stable star positions, rendered in the same pass as the Moon.
    vec2 starGrid = gl_FragCoord.xy / (shortest / 42.0);
    vec2 cell = floor(starGrid);
    vec2 local = fract(starGrid);
    vec2 starPos = vec2(hash(cell), hash(cell + 31.9));
    float distance = length(local - starPos);
    float star = (1.0 - smoothstep(0.012, 0.047, distance)) * step(0.67, hash(cell + 9.2));
    float sparkle = 0.5 + 0.18 * sin(u_time * 0.35 + hash(cell + 1.7) * 25.0);
    color += vec3(0.70, 0.72, 0.72) * star * sparkle;

    vec2 center = vec2(0.0, 0.035) + u_pointer * 0.012;
    float radius = u_resolution.x < u_resolution.y ? 0.46 : 0.39;
    vec2 point = (p - center) / radius;
    float rr = dot(point, point);
    float halo = exp(-abs(length(point) - 1.0) * 27.0);
    color += vec3(0.10, 0.14, 0.24) * halo * 0.22;
    if (rr <= 1.0) {
      vec3 normal = normalize(vec3(point, sqrt(1.0 - rr)));
      vec3 rotated = rotateY(normal, u_rotation);
      vec2 uv = sphericalUv(rotated);
      vec3 albedo = texture2D(u_surface, uv).rgb;
      float texel = u_texel;
      float bumpX = dot(texture2D(u_surface, uv + vec2(texel, 0.0)).rgb - texture2D(u_surface, uv - vec2(texel, 0.0)).rgb, vec3(0.333));
      float bumpY = dot(texture2D(u_surface, uv + vec2(0.0, texel)).rgb - texture2D(u_surface, uv - vec2(0.0, texel)).rgb, vec3(0.333));
      vec3 bumped = normalize(normal + vec3(bumpX, -bumpY, 0.0) * 0.75);
      vec3 light = normalize(vec3(0.92, 0.42, 0.38));
      float diffuse = max(dot(bumped, light), 0.0);
      float ambient = 0.075;
      vec3 illuminated = pow(albedo, vec3(0.82)) * (ambient + diffuse * 1.37);
      illuminated *= vec3(0.78, 0.84, 1.02);
      float rim = pow(1.0 - normal.z, 4.0) * max(dot(normal, light), 0.0);
      illuminated += vec3(0.12, 0.15, 0.23) * rim;
      float edge = 1.0 - smoothstep(0.985, 1.0, rr);
      color = mix(color, illuminated, edge);
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type RendererStatus = "loading" | "ready" | "fallback";

function MoonCanvas({
  paused,
  onStatusChange,
}: {
  paused: boolean;
  onStatusChange: (status: RendererStatus) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const controller = useRef<{ setPaused: (value: boolean) => void } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [contextVersion, setContextVersion] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = (() => {
      try {
        return canvas.getContext("webgl", {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          powerPreference: "low-power",
        });
      } catch {
        return null;
      }
    })();
    if (!gl) {
      onStatusChange("fallback");
      return;
    }
    onStatusChange("loading");

    const shaders: WebGLShader[] = [];
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      shaders.push(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexShader);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentShader);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      shaders.forEach((shader) => gl.deleteShader(shader));
      if (program) gl.deleteProgram(program);
      onStatusChange("fallback");
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      shaders.forEach((shader) => gl.deleteShader(shader));
      gl.deleteProgram(program);
      onStatusChange("fallback");
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!buffer || !texture) {
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
      shaders.forEach((shader) => gl.deleteShader(shader));
      gl.deleteProgram(program);
      onStatusChange("fallback");
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, "u_resolution");
    const rotation = gl.getUniformLocation(program, "u_rotation");
    const pointer = gl.getUniformLocation(program, "u_pointer");
    const time = gl.getUniformLocation(program, "u_time");
    const texel = gl.getUniformLocation(program, "u_texel");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program, "u_surface"), 0);

    let alive = true;
    let loaded = false;
    let resourcesInvalidated = false;
    let inView = true;
    let isPaused = pausedRef.current;
    let frame = 0;
    let lastFrame = 0;
    let motionTime = 0;
    let scrollRotation = 0;
    let smoothedRotation = 0;
    let pointerX = 0;
    let pointerY = 0;
    let smoothX = 0;
    let smoothY = 0;
    const surface = new Image();
    surface.decoding = "async";

    const draw = () => {
      if (!loaded || !alive || gl.isContextLost()) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(rotation, 1.1 + smoothedRotation + motionTime * 0.018);
      gl.uniform2f(pointer, smoothX, smoothY);
      gl.uniform1f(time, motionTime);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    const tick = (now: number) => {
      frame = 0;
      if (
        !alive ||
        !loaded ||
        isPaused ||
        !inView ||
        document.hidden ||
        gl.isContextLost()
      )
        return;
      const elapsed = lastFrame ? Math.min((now - lastFrame) / 1000, 0.08) : 0;
      if (lastFrame && now - lastFrame < 30) {
        frame = requestAnimationFrame(tick);
        return;
      }
      lastFrame = now;
      motionTime += elapsed;
      smoothedRotation += (scrollRotation - smoothedRotation) * 0.09;
      smoothX += (pointerX - smoothX) * 0.06;
      smoothY += (pointerY - smoothY) * 0.06;
      draw();
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (
        !frame &&
        alive &&
        loaded &&
        !gl.isContextLost() &&
        !isPaused &&
        inView &&
        !document.hidden
      ) {
        lastFrame = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const updateSurface = () => {
      if (!alive || gl.isContextLost()) return;
      // Read the fallback's CSS choice instead of making an independent device
      // guess, which could fetch both image sizes on a cold mobile visit.
      const textureWidth = getComputedStyle(canvas).getPropertyValue(
        "--orbital-texture-width",
      );
      const nextSource =
        Number.parseInt(textureWidth, 10) === 1024
          ? "/planet/lroc-color-1k.jpg"
          : "/planet/lroc-color-2k.jpg";
      if (surface.getAttribute("src") !== nextSource) surface.src = nextSource;
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const memory = (navigator as Navigator & { deviceMemory?: number })
        .deviceMemory;
      const lowPower =
        navigator.hardwareConcurrency <= 4 ||
        (memory !== undefined && memory <= 4);
      const mobile = window.matchMedia("(pointer: coarse)").matches;
      // Bound fill rate and framebuffer memory, including on large high-DPI screens.
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        lowPower ? 1 : mobile ? 1.25 : 1.5,
        Math.sqrt(1_800_000 / Math.max(1, rect.width * rect.height)),
      );
      const width = Math.max(1, Math.round(rect.width * pixelRatio));
      const height = Math.max(1, Math.round(rect.height * pixelRatio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      updateSurface();
      draw();
    };
    const scroll = () => {
      if (isPaused || !inView || document.hidden || gl.isContextLost()) return;
      const section = canvas.closest("section");
      const top = section?.getBoundingClientRect().top ?? 0;
      scrollRotation =
        Math.max(-1, Math.min(4, -top / window.innerHeight)) * 1.8;
      start();
    };
    const move = (event: PointerEvent) => {
      if (
        isPaused ||
        !inView ||
        document.hidden ||
        event.pointerType !== "mouse"
      )
        return;
      const rect = canvas.getBoundingClientRect();
      pointerX = Math.max(
        -0.5,
        Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5),
      );
      pointerY = Math.max(
        -0.5,
        Math.min(0.5, 0.5 - (event.clientY - rect.top) / rect.height),
      );
    };
    const visibility = () => {
      if (document.hidden) stop();
      else start();
    };
    const lost = (event: Event) => {
      event.preventDefault();
      stop();
      loaded = false;
      resourcesInvalidated = true;
      setReady(false);
      onStatusChange("fallback");
    };
    // Restored contexts invalidate every previous GPU resource. Rebuild them
    // through the effect, retaining the user's pause preference.
    const restored = () => {
      if (alive) setContextVersion((version) => version + 1);
    };
    controller.current = {
      setPaused(value) {
        isPaused = value;
        if (value) stop();
        else {
          scroll();
          start();
        }
      },
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) {
          scroll();
          start();
        } else stop();
      },
      { rootMargin: "80px" },
    );
    observer.observe(canvas);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    surface.onload = () => {
      if (!alive || gl.isContextLost()) return;
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGB,
          gl.RGB,
          gl.UNSIGNED_BYTE,
          surface,
        );
        if (gl.getError() !== gl.NO_ERROR) {
          if (!loaded) onStatusChange("fallback");
          return;
        }
        gl.uniform1f(texel, 1 / surface.naturalWidth);
        loaded = true;
        resize();
        scroll();
        setReady(true);
        onStatusChange("ready");
        start();
      } catch {
        // The CSS moon remains visible if texture upload is unavailable.
        if (!loaded) onStatusChange("fallback");
      }
    };
    surface.onerror = () => {
      // Keep an already rendered texture if a resized variant fails to load.
      if (alive && !loaded) onStatusChange("fallback");
    };
    const textureMedia = window.matchMedia(compactTextureMedia);
    textureMedia.addEventListener("change", updateSurface);
    updateSurface();
    return () => {
      alive = false;
      stop();
      surface.onload = null;
      surface.onerror = null;
      controller.current = null;
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      textureMedia.removeEventListener("change", updateSurface);
      // Context loss already frees these objects; deleting old handles after
      // restoration produces INVALID_OPERATION in the newly restored context.
      if (!resourcesInvalidated) {
        gl.deleteTexture(texture);
        gl.deleteBuffer(buffer);
        shaders.forEach((shader) => gl.deleteShader(shader));
        gl.deleteProgram(program);
      }
      // Release the drawing buffer promptly when navigating away.
      canvas.width = 1;
      canvas.height = 1;
    };
  }, [contextVersion, onStatusChange]);

  useEffect(() => {
    pausedRef.current = paused;
    controller.current?.setPaused(paused);
  }, [paused]);

  return (
    <div
      className={`orbital-world ${ready ? "orbital-world-ready" : ""}`}
      aria-hidden="true"
    >
      <div className="orbital-static-stars" />
      <div className="orbital-moon-fallback" />
      <canvas ref={canvasRef} className="orbital-canvas" />
    </div>
  );
}

export function OrbitalHero() {
  const [paused, setPaused] = useState(false);
  const [rendererStatus, setRendererStatus] =
    useState<RendererStatus>("loading");
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => true,
  );
  const motionPaused = paused || reducedMotion;
  const scenePaused = motionPaused || rendererStatus !== "ready";
  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/planet/lroc-color-1k.jpg"
        media={compactTextureMedia}
        fetchPriority="high"
      />
      <section
        className="orbital-hero"
        aria-labelledby="orbital-title"
        data-motion={scenePaused ? "paused" : "playing"}
      >
        <MoonCanvas paused={motionPaused} onStatusChange={setRendererStatus} />
        <div className="orbital-overline">
          <span>
            <i /> IGNITE OPENSTRAND
          </span>
          <span>A NEW WORLD OF POSSIBILITY</span>
        </div>
        <div className="orbital-coordinates" aria-hidden="true">
          <span>01 / EXPLORE</span>
          <span>02 / PRACTICE</span>
          <span>03 / BECOME</span>
        </div>
        <div className="orbital-heading">
          <span className="orbital-kicker">Your next chapter starts here.</span>
          <h1 id="orbital-title">
            A world of potential.
            <br />
            <em>A story only you can tell.</em>
          </h1>
        </div>
        <div className="orbital-bottom">
          <div className="orbital-promise">
            <span className="orbital-wave" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <p>
              Step into the room. Find your voice.
              <br />
              Build the confidence to be yourself.
            </p>
          </div>
          <div className="orbital-start">
            <Link href="/interview" className="orbital-start-button">
              Start Student Interview <ArrowUpRight size={21} />
            </Link>
            <span>
              <Mic size={13} /> Speak or type. Your experience counts.
            </span>
          </div>
        </div>
        <div className="orbital-foot">
          <a href="#how-it-works" className="orbital-scroll">
            <ArrowDown size={15} />
            <span>
              {scenePaused
                ? "Explore the experience"
                : "Scroll to explore. Watch your world turn."}
            </span>
          </a>
          <button
            type="button"
            className="orbital-motion"
            onClick={() => setPaused(!paused)}
            disabled={reducedMotion || rendererStatus !== "ready"}
            aria-pressed={scenePaused}
          >
            {scenePaused ? <Play size={13} /> : <Pause size={13} />}
            <span>
              {reducedMotion
                ? "Reduced motion on"
                : rendererStatus === "loading"
                  ? "Loading scene"
                  : rendererStatus === "fallback"
                    ? "Still scene"
                    : paused
                      ? "Resume motion"
                      : "Pause motion"}
            </span>
          </button>
        </div>
        <span className="orbital-seal" aria-hidden="true">
          <Sparkles size={16} />
          <span>
            REAL EXPERIENCES.
            <br />
            EXTRAORDINARY POSSIBILITIES.
          </span>
        </span>
      </section>
    </>
  );
}
