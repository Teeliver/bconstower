import { useEffect, useRef } from "react";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import "@babylonjs/core/Cameras/Inputs/arcRotateCameraMouseWheelInput";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/core/Culling/ray";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { createCourtyard } from "./scene/environment";
import { createHero } from "./scene/hero";

const WALK_LIMIT = 13;
const WALK_SPEED = 4.4;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function WorldScene({
  character,
  world,
  onPosition,
  onReady,
  onError,
  interactive = true,
}) {
  const canvasRef = useRef(null);
  const runtimeRef = useRef(null);
  const propsRef = useRef({
    character,
    world,
    onPosition,
    onReady,
    onError,
    interactive,
  });
  propsRef.current = {
    character,
    world,
    onPosition,
    onReady,
    onError,
    interactive,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let engine;
    let scene;
    let disposed = false;
    let resizeObserver;
    const keys = new Set();
    const cleanupListeners = [];
    const listen = (target, type, listener, options) => {
      target.addEventListener(type, listener, options);
      cleanupListeners.push(() =>
        target.removeEventListener(type, listener, options),
      );
    };
    const fail = (error) => {
      if (!disposed)
        propsRef.current.onError?.(
          error instanceof Error ? error.message : String(error),
        );
    };

    try {
      if (!Engine.isSupported())
        throw new Error(
          "Trình duyệt chưa hỗ trợ WebGL. Hãy bật tăng tốc đồ họa và tải lại trang.",
        );
      engine = new Engine(
        canvas,
        true,
        {
          stencil: true,
          preserveDrawingBuffer: false,
          powerPreference: "high-performance",
        },
        true,
      );
      engine.setHardwareScalingLevel(
        1 / Math.min(window.devicePixelRatio || 1, 1.5),
      );
      scene = new Scene(engine);
      scene.clearColor = new Color4(0.07, 0.14, 0.12, 1);
      scene.ambientColor = new Color3(0.24, 0.31, 0.24);
      scene.fogMode = Scene.FOGMODE_EXP2;
      scene.fogColor = new Color3(0.13, 0.23, 0.2);
      scene.fogDensity = 0.013;
      scene.imageProcessingConfiguration.toneMappingEnabled = true;
      scene.imageProcessingConfiguration.exposure = 1.08;
      scene.imageProcessingConfiguration.contrast = 1.12;

      const camera = new ArcRotateCamera(
        "courtyard camera",
        -Math.PI / 2.25,
        0.92,
        34,
        new Vector3(0, 1.3, 4.3),
        scene,
      );
      camera.minZ = 0.1;
      camera.maxZ = 200;
      camera.lowerRadiusLimit = 17;
      camera.upperRadiusLimit = 46;
      camera.wheelDeltaPercentage = 0.008;
      camera.inputs.clear();
      camera.inputs.addMouseWheel();
      camera.attachControl(canvas, true);
      camera.panningSensibility = 0;
      const ambient = new HemisphericLight(
        "moonlit ambient",
        new Vector3(-0.2, 1, -0.3),
        scene,
      );
      ambient.intensity = 0.77;
      ambient.diffuse = new Color3(0.74, 0.88, 0.81);
      ambient.groundColor = new Color3(0.16, 0.24, 0.17);
      const sunlight = new DirectionalLight(
        "late gold sun",
        new Vector3(-0.55, -1, 0.45),
        scene,
      );
      sunlight.position = new Vector3(20, 34, -25);
      sunlight.intensity = 1.65;
      sunlight.diffuse = new Color3(1, 0.88, 0.64);
      const shadows = new ShadowGenerator(1024, sunlight);
      shadows.usePercentageCloserFiltering = true;
      shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      shadows.normalBias = 0.03;
      shadows.bias = 0.0003;
      shadows.setDarkness(0.35);

      const environment = createCourtyard(scene, shadows);
      const glow = new GlowLayer("magical lights", scene, {
        blurKernelSize: 32,
      });
      glow.intensity = 0.5;
      const pipeline = new DefaultRenderingPipeline(
        "soft lantern glow",
        true,
        scene,
        [camera],
      );
      pipeline.fxaaEnabled = true;
      pipeline.bloomEnabled = true;
      pipeline.bloomThreshold = 0.85;
      pipeline.bloomWeight = 0.16;
      pipeline.bloomKernel = 32;

      const markerMaterial = new StandardMaterial(
        "walk destination gold",
        scene,
      );
      markerMaterial.diffuseColor = Color3.FromHexString("#d5c181");
      markerMaterial.emissiveColor = Color3.FromHexString("#51462b");
      markerMaterial.alpha = 0.65;
      const destinationMarker = CreateTorus(
        "local walk destination",
        { diameter: 0.65, thickness: 0.025, tessellation: 24 },
        scene,
      );
      destinationMarker.material = markerMaterial;
      destinationMarker.isPickable = false;
      destinationMarker.position.y = 0.12;
      destinationMarker.setEnabled(false);
      const selectionMaterial = new StandardMaterial(
        "player selection jade",
        scene,
      );
      selectionMaterial.diffuseColor = Color3.FromHexString("#b5c797");
      selectionMaterial.emissiveColor = Color3.FromHexString("#2e4934");
      selectionMaterial.alpha = 0.72;
      const selection = CreateTorus(
        "hero selection circle",
        { diameter: 1.38, thickness: 0.018, tessellation: 48 },
        scene,
      );
      selection.material = selectionMaterial;
      selection.position.y = 0.12;
      selection.isPickable = false;

      const runtime = {
        hero: null,
        scene,
        shadows,
        position: new Vector3(0, 0.1, 0),
        target: null,
        heading: Math.PI,
        replaceHero(nextCharacter) {
          const nextHero = createHero(scene, {}, nextCharacter);
          if (this.hero) {
            this.hero.root
              .getChildMeshes()
              .forEach((part) => shadows.removeShadowCaster(part));
            this.hero.dispose();
          }
          this.hero = nextHero;
          this.hero.root.position.copyFrom(this.position);
          this.hero.root
            .getChildMeshes()
            .forEach((part) => shadows.addShadowCaster(part));
        },
        resetPosition() {
          keys.clear();
          this.target = null;
          this.position.set(0, 0.1, 0);
          if (this.hero) this.hero.root.position.copyFrom(this.position);
          destinationMarker.setEnabled(false);
          propsRef.current.onPosition?.({ x: 0, y: 0 });
        },
      };
      runtime.replaceHero(propsRef.current.character);
      runtimeRef.current = runtime;

      const hasSceneFocus = () => document.activeElement === canvas;
      const movementKeys = new Set([
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ]);
      listen(window, "keydown", (event) => {
        if (
          !propsRef.current.interactive ||
          !hasSceneFocus() ||
          document.hidden
        )
          return;
        const key = event.key.toLowerCase();
        if (
          !movementKeys.has(key) ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        keys.add(key);
        runtime.target = null;
        destinationMarker.setEnabled(false);
      });
      listen(window, "keyup", (event) => keys.delete(event.key.toLowerCase()));
      listen(window, "blur", () => keys.clear());
      listen(canvas, "blur", () => keys.clear());
      listen(document, "visibilitychange", () => {
        keys.clear();
        if (document.hidden) runtime.target = null;
      });
      listen(canvas, "pointerdown", (event) => {
        if (
          event.button !== 0 ||
          !propsRef.current.interactive ||
          document.hidden
        )
          return;
        canvas.focus({ preventScroll: true });
        const pick = scene.pick(
          scene.pointerX,
          scene.pointerY,
          (mesh) => mesh.metadata?.walkable === true,
        );
        if (!pick?.hit || !pick.pickedPoint) return;
        runtime.target = new Vector3(
          clamp(pick.pickedPoint.x, -WALK_LIMIT, WALK_LIMIT),
          0.1,
          clamp(pick.pickedPoint.z, -WALK_LIMIT, WALK_LIMIT),
        );
        destinationMarker.position.x = runtime.target.x;
        destinationMarker.position.z = runtime.target.z;
        destinationMarker.setEnabled(true);
      });
      listen(canvas, "webglcontextlost", () => {
        keys.clear();
        fail(
          new Error(
            "Kết nối WebGL bị gián đoạn. Tải lại trang để mở lại bản đồ.",
          ),
        );
      });

      const resize = () => {
        if (!disposed) engine.resize();
      };
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
      }
      listen(window, "resize", resize);

      let time = 0;
      let reportTime = 0;
      let ready = false;
      let failed = false;
      engine.runRenderLoop(() => {
        if (disposed || failed || document.hidden) return;
        try {
          const delta = Math.min(engine.getDeltaTime() / 1000, 0.05);
          time += delta;
          reportTime += delta;
          let moving = false;
          const velocity = new Vector3(0, 0, 0);
          if (propsRef.current.interactive && hasSceneFocus()) {
            const horizontal =
              Number(keys.has("d") || keys.has("arrowright")) -
              Number(keys.has("a") || keys.has("arrowleft"));
            const vertical =
              Number(keys.has("w") || keys.has("arrowup")) -
              Number(keys.has("s") || keys.has("arrowdown"));
            // Input follows the fixed camera's screen axes.
            const right = new Vector3(
              -Math.sin(camera.alpha),
              0,
              Math.cos(camera.alpha),
            );
            const forward = new Vector3(
              -Math.cos(camera.alpha),
              0,
              -Math.sin(camera.alpha),
            );
            velocity.copyFrom(
              right.scale(horizontal).add(forward.scale(vertical)),
            );
          }
          if (
            propsRef.current.interactive &&
            runtime.target &&
            hasSceneFocus() &&
            velocity.lengthSquared() === 0
          ) {
            velocity.copyFrom(runtime.target.subtract(runtime.position));
            velocity.y = 0;
            if (velocity.length() <= WALK_SPEED * delta) {
              runtime.position.copyFrom(runtime.target);
              runtime.target = null;
              velocity.set(0, 0, 0);
              destinationMarker.setEnabled(false);
            }
          }
          if (velocity.lengthSquared() > 0.00001) {
            velocity.normalize();
            const previousX = runtime.position.x;
            const previousZ = runtime.position.z;
            runtime.position.x = clamp(
              runtime.position.x + velocity.x * WALK_SPEED * delta,
              -WALK_LIMIT,
              WALK_LIMIT,
            );
            runtime.position.z = clamp(
              runtime.position.z + velocity.z * WALK_SPEED * delta,
              -WALK_LIMIT,
              WALK_LIMIT,
            );
            moving =
              previousX !== runtime.position.x ||
              previousZ !== runtime.position.z;
            runtime.heading = Math.atan2(velocity.x, velocity.z);
          }
          runtime.hero.root.position.copyFrom(runtime.position);
          runtime.hero.update(delta, moving, runtime.heading);
          selection.position.x = runtime.position.x;
          selection.position.z = runtime.position.z;
          destinationMarker.scaling.setAll(1 + Math.sin(time * 5) * 0.09);
          environment.update(time);
          if (reportTime > 0.2 && (moving || runtime.target)) {
            reportTime = 0;
            propsRef.current.onPosition?.({
              x: Math.round(runtime.position.x * 10) / 10,
              y: Math.round(runtime.position.z * 10) / 10,
            });
          }
          scene.render();
          if (!ready && scene.isReady()) {
            ready = true;
            propsRef.current.onReady?.({
              controls: [
                "Click để di chuyển",
                "WASD / phím mũi tên",
                "Cuộn để thu phóng",
              ],
              localMovement: true,
            });
          }
        } catch (error) {
          failed = true;
          fail(error);
        }
      });
    } catch (error) {
      fail(error);
    }

    return () => {
      disposed = true;
      keys.clear();
      cleanupListeners.forEach((cleanup) => cleanup());
      resizeObserver?.disconnect();
      runtimeRef.current = null;
      engine?.stopRenderLoop();
      scene?.dispose();
      engine?.dispose();
    };
  }, []);

  useEffect(() => {
    try {
      runtimeRef.current?.replaceHero(character);
    } catch (error) {
      propsRef.current.onError?.(
        error instanceof Error ? error.message : String(error),
      );
    }
  }, [character?.name, character?.classKey, character?.classId]);

  useEffect(() => {
    runtimeRef.current?.resetPosition();
  }, [world?.x, world?.y, world?.map, Boolean(world)]);

  return (
    <canvas
      ref={canvasRef}
      className="world-canvas"
      tabIndex={0}
      aria-label="Bản đồ thành cổ 3D. Click vào nền để di chuyển; WASD hoặc phím mũi tên; cuộn để thu phóng. Di chuyển chỉ hiển thị tại trình duyệt."
    />
  );
}
