import { test } from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { createHero } from "./hero.js";

// Exercise real Babylon mesh builders. Missing focused imports previously
// made Elf/Wizard construction fail even though the Knight lobby rendered.
test("all MU classes construct, animate, replace and dispose real Babylon meshes", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const baseline = {
    meshes: scene.meshes.length,
    materials: scene.materials.length,
    nodes: scene.transformNodes.length,
  };
  try {
    for (const [classKey, classId] of [
      ["knight", 16],
      ["elf", 34],
      ["wizard", 0],
      ["gladiator", 48],
      ["lord", 64],
      ["summoner", 80],
      ["fighter", 96],
    ]) {
      const hero = createHero(scene, {}, { name: classKey, classKey, classId });
      assert.ok(
        hero.root.getChildMeshes().length > 30,
        `${classKey} has actual mesh geometry`,
      );
      assert.ok(
        hero.root.getChildMeshes().every((mesh) => mesh.getTotalVertices() > 0),
      );
      hero.update(0.016, true, Math.PI / 2);
      hero.update(0.016, false, 0);
      assert.ok(Number.isFinite(hero.root.rotation.y));
      hero.dispose();
      hero.dispose();
      assert.equal(
        scene.meshes.length,
        baseline.meshes,
        `${classKey}: no remaining meshes`,
      );
      assert.equal(
        scene.materials.length,
        baseline.materials,
        `${classKey}: no remaining materials`,
      );
      assert.equal(
        scene.transformNodes.length,
        baseline.nodes,
        `${classKey}: no remaining nodes`,
      );
    }
  } finally {
    scene.dispose();
    engine.dispose();
  }
});
