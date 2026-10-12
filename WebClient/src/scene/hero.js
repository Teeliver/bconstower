import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder.js";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder.js";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder.js";
import { CreatePolyhedron } from "@babylonjs/core/Meshes/Builders/polyhedronBuilder.js";
const MeshBuilder = {
  CreateBox,
  CreateCylinder,
  CreateSphere,
  CreateTorus,
  CreateTube,
  CreatePolyhedron,
};

let heroSequence = 0;

function heroClass(character = {}) {
  character = character || {};
  const label = String(
    character.classKey || character.className || "",
  ).toLowerCase();
  if (/elf|fairy|archer/.test(label)) return "elf";
  if (/wizard|mage|sorcerer|soul|summoner/.test(label)) return "wizard";
  if (/knight|warrior|blade|gladiator/.test(label)) return "knight";
  const id = Number(character.classId ?? character.class ?? 1);
  if (id === 2 || (id >= 32 && id < 48)) return "elf";
  if (id === 0 || (id >= 0 && id < 16 && id !== 1)) return "wizard";
  return "knight";
}

/** A procedural preview model. The hierarchy moves with root; forward is +Z. */
export function createHero(scene, _materials, character = {}) {
  const prefix = `hero-${++heroSequence}`;
  const kind = heroClass(character);
  const root = new TransformNode(prefix, scene);
  const ownMaterials = [];
  const makeMaterial = (name, color, specular = 0.15, emissive = null) => {
    const material = new StandardMaterial(`${prefix}-${name}`, scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor = new Color3(specular, specular, specular);
    material.specularPower = 48;
    if (emissive) material.emissiveColor = Color3.FromHexString(emissive);
    ownMaterials.push(material);
    return material;
  };
  const palette = {
    armor: makeMaterial("emerald-armor", "#35564b", 0.6),
    dark: makeMaterial("shadow-armor", "#172b28", 0.3),
    gold: makeMaterial("antique-gold", "#cfad68", 0.75),
    cloth: makeMaterial(
      "green-cloth",
      kind === "wizard" ? "#273f48" : "#294538",
    ),
    ivory: makeMaterial("ivory", "#e9d6ab", 0.25),
    leather: makeMaterial("leather", "#523f30"),
    skin: makeMaterial("skin", "#cda67e"),
    hair: makeMaterial("hair", kind === "elf" ? "#e3ce94" : "#423527"),
    steel: makeMaterial("silver-steel", "#b7c6bc", 0.8),
    glow: makeMaterial("amber-crystal", "#ebb764", 0.35, "#9b4f10"),
  };
  palette.cloth.backFaceCulling = false;

  const node = (name, parent, x = 0, y = 0, z = 0) => {
    const pivot = new TransformNode(`${prefix}-${name}`, scene);
    pivot.parent = parent;
    pivot.position.set(x, y, z);
    return pivot;
  };
  const place = (mesh, parent, material, x, y, z) => {
    mesh.parent = parent;
    mesh.material = material;
    mesh.position.set(x, y, z);
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    return mesh;
  };
  const box = (name, parent, dimensions, position, material) =>
    place(
      MeshBuilder.CreateBox(
        `${prefix}-${name}`,
        {
          width: dimensions[0],
          height: dimensions[1],
          depth: dimensions[2],
        },
        scene,
      ),
      parent,
      material,
      ...position,
    );
  const cylinder = (
    name,
    parent,
    diameter,
    height,
    position,
    material,
    top = diameter,
  ) =>
    place(
      MeshBuilder.CreateCylinder(
        `${prefix}-${name}`,
        {
          diameterBottom: diameter,
          diameterTop: top,
          height,
          tessellation: 6,
        },
        scene,
      ),
      parent,
      material,
      ...position,
    );
  const sphere = (name, parent, diameter, position, material, segments = 6) =>
    place(
      MeshBuilder.CreateSphere(
        `${prefix}-${name}`,
        { diameter, segments },
        scene,
      ),
      parent,
      material,
      ...position,
    );
  const ring = (name, parent, diameter, thickness, position, material) =>
    place(
      MeshBuilder.CreateTorus(
        `${prefix}-${name}`,
        {
          diameter,
          thickness,
          tessellation: 12,
        },
        scene,
      ),
      parent,
      material,
      ...position,
    );

  const body = node("body", root);
  const waist = cylinder(
    "waist",
    body,
    0.57,
    0.15,
    [0, 1.09, 0],
    palette.leather,
  );
  waist.scaling.z = 0.7;
  const belt = cylinder("belt", body, 0.62, 0.075, [0, 1.13, 0], palette.gold);
  belt.scaling.z = 0.7;
  box("belt-buckle", body, [0.15, 0.13, 0.06], [0, 1.14, 0.245], palette.gold);
  const buckle = sphere(
    "buckle-stone",
    body,
    0.068,
    [0, 1.14, 0.285],
    palette.glow,
  );
  buckle.scaling.z = 0.5;

  const torso = cylinder(
    "breastplate",
    body,
    0.53,
    0.72,
    [0, 1.52, 0],
    kind === "wizard" ? palette.cloth : palette.armor,
    kind === "elf" ? 0.64 : 0.77,
  );
  torso.scaling.z = 0.62;
  const collar = cylinder(
    "collar",
    body,
    0.7,
    0.08,
    [0, 1.84, 0],
    palette.gold,
    0.53,
  );
  collar.scaling.z = 0.62;
  const chestTrim = box(
    "chest-trim",
    body,
    [0.46, 0.045, 0.035],
    [0, 1.64, 0.244],
    palette.gold,
  );
  chestTrim.rotation.z = -0.06;
  const chestGem = sphere(
    "chest-gem",
    body,
    0.13,
    [0, 1.59, 0.275],
    palette.glow,
  );
  chestGem.scaling.set(0.65, 1, 0.35);
  for (const side of [-1, 1]) {
    const strap = box(
      `chest-ridge-${side}`,
      body,
      [0.045, 0.38, 0.04],
      [side * 0.165, 1.48, 0.234],
      palette.gold,
    );
    strap.rotation.z = side * 0.18;
    const skirt = box(
      `hip-armor-${side}`,
      body,
      [0.25, 0.3, 0.18],
      [side * 0.17, 0.96, 0.105],
      kind === "wizard" ? palette.cloth : palette.armor,
    );
    skirt.rotation.z = side * 0.11;
    box(
      `hip-trim-${side}`,
      skirt,
      [0.25, 0.04, 0.19],
      [0, -0.12, 0],
      palette.gold,
    );
  }

  cylinder("neck", body, 0.21, 0.15, [0, 1.96, 0], palette.skin);
  const head = sphere("head", body, 0.4, [0, 2.16, 0.022], palette.skin);
  head.scaling.set(0.82, 1, 0.9);
  const hair = sphere("hair", body, 0.43, [0, 2.24, -0.052], palette.hair);
  hair.scaling.set(0.84, 0.7, 0.87);
  for (const side of [-1, 1]) {
    box(
      `eye-${side}`,
      body,
      [0.047, 0.018, 0.012],
      [side * 0.073, 2.18, 0.189],
      palette.dark,
    );
    box(
      `brow-${side}`,
      body,
      [0.06, 0.023, 0.018],
      [side * 0.073, 2.218, 0.177],
      palette.hair,
    );
  }
  box("nose", body, [0.042, 0.065, 0.038], [0, 2.135, 0.201], palette.skin);

  if (kind === "wizard") {
    const hood = sphere("hood", body, 0.54, [0, 2.24, -0.08], palette.cloth);
    hood.scaling.set(0.94, 1.05, 0.8);
    // The face stays in front of the hood; the trim gives it a clear silhouette.
    const hoodTrim = ring(
      "hood-trim",
      body,
      0.41,
      0.035,
      [0, 2.19, 0.113],
      palette.gold,
    );
    hoodTrim.rotation.x = Math.PI / 2;
    hoodTrim.scaling.y = 1.17;
    const robe = cylinder(
      "robe",
      body,
      0.81,
      0.77,
      [0, 0.71, -0.015],
      palette.cloth,
      0.49,
    );
    robe.scaling.z = 0.75;
    const hem = cylinder(
      "robe-hem",
      body,
      0.84,
      0.07,
      [0, 0.36, -0.015],
      palette.gold,
      0.8,
    );
    hem.scaling.z = 0.75;
    box(
      "robe-panel",
      body,
      [0.11, 0.65, 0.03],
      [0, 0.76, 0.266],
      palette.ivory,
    );
  } else if (kind === "knight") {
    const helmet = sphere(
      "helmet",
      body,
      0.455,
      [0, 2.27, -0.045],
      palette.armor,
    );
    helmet.scaling.set(0.95, 0.7, 0.92);
    const circlet = ring(
      "helmet-band",
      body,
      0.39,
      0.035,
      [0, 2.27, -0.035],
      palette.gold,
    );
    circlet.scaling.z = 0.83;
    box(
      "helm-ridge",
      body,
      [0.065, 0.14, 0.37],
      [0, 2.39, -0.025],
      palette.gold,
    );
    for (const side of [-1, 1]) {
      const cheek = box(
        `helm-cheek-${side}`,
        body,
        [0.07, 0.19, 0.15],
        [side * 0.175, 2.14, 0.015],
        palette.armor,
      );
      cheek.rotation.z = side * 0.12;
    }
  } else {
    const circlet = ring(
      "elf-circlet",
      body,
      0.37,
      0.025,
      [0, 2.265, 0.015],
      palette.gold,
    );
    circlet.scaling.z = 0.88;
    const jewel = sphere(
      "elf-jewel",
      body,
      0.068,
      [0, 2.255, 0.204],
      palette.glow,
    );
    jewel.scaling.z = 0.55;
    for (const side of [-1, 1]) {
      const ear = cylinder(
        `elf-ear-${side}`,
        body,
        0.09,
        0.21,
        [side * 0.18, 2.18, -0.01],
        palette.skin,
        0,
      );
      ear.rotation.z = -side * 0.9;
    }
    const ponytail = cylinder(
      "ponytail",
      body,
      0.15,
      0.43,
      [0, 2.01, -0.2],
      palette.hair,
      0.22,
    );
    ponytail.rotation.x = -0.2;
  }

  const arms = [];
  const legs = [];
  for (const side of [-1, 1]) {
    const arm = node(
      `arm-${side}`,
      body,
      side * (kind === "elf" ? 0.38 : 0.44),
      1.77,
      0,
    );
    arm.rotation.z = -side * 0.1;
    const shoulder = sphere(
      `pauldron-${side}`,
      arm,
      kind === "knight" ? 0.43 : 0.34,
      [side * 0.035, -0.07, 0],
      kind === "wizard" ? palette.cloth : palette.armor,
    );
    shoulder.scaling.y = 0.65;
    const shoulderBand = ring(
      `pauldron-trim-${side}`,
      arm,
      kind === "knight" ? 0.34 : 0.27,
      0.027,
      [side * 0.035, -0.15, 0],
      palette.gold,
    );
    shoulderBand.scaling.z = 0.84;
    cylinder(
      `upper-arm-${side}`,
      arm,
      0.18,
      0.31,
      [0, -0.25, 0],
      palette.dark,
      0.23,
    );
    const elbow = node(`elbow-${side}`, arm, 0, -0.4, 0);
    elbow.rotation.x = -0.18;
    sphere(`elbow-plate-${side}`, elbow, 0.22, [0, 0, 0], palette.gold);
    cylinder(
      `bracer-${side}`,
      elbow,
      0.2,
      0.26,
      [0, -0.14, 0],
      palette.armor,
      0.23,
    );
    cylinder(
      `bracer-trim-${side}`,
      elbow,
      0.21,
      0.045,
      [0, -0.255, 0],
      palette.gold,
    );
    const hand = node(`hand-${side}`, elbow, 0, -0.34, 0);
    sphere(`glove-${side}`, hand, 0.16, [0, 0, 0], palette.leather);
    arms.push({ arm, elbow, hand, side });

    const leg = node(`leg-${side}`, body, side * 0.16, 1.05, 0);
    cylinder(
      `thigh-${side}`,
      leg,
      0.23,
      0.43,
      [0, -0.22, 0],
      palette.dark,
      0.28,
    );
    const knee = node(`knee-${side}`, leg, 0, -0.43, 0);
    const kneePlate = sphere(
      `knee-plate-${side}`,
      knee,
      0.24,
      [0, -0.025, 0.07],
      palette.gold,
    );
    kneePlate.scaling.z = 0.64;
    cylinder(
      `greave-${side}`,
      knee,
      0.21,
      0.36,
      [0, -0.21, 0],
      palette.armor,
      0.26,
    );
    const boot = box(
      `boot-${side}`,
      knee,
      [0.25, 0.22, 0.4],
      [0, -0.49, 0.085],
      palette.leather,
    );
    box(
      `boot-cap-${side}`,
      boot,
      [0.255, 0.12, 0.16],
      [0, -0.025, 0.125],
      palette.gold,
    );
    legs.push({ leg, knee, side });
  }

  const capePivot = node("cape-pivot", body, 0, 1.85, -0.24);
  const cape = new Mesh(`${prefix}-cape`, scene);
  const capeData = new VertexData();
  capeData.positions = [
    -0.3, 0, 0, 0, 0, -0.055, 0.3, 0, 0, -0.44, -0.48, -0.04, 0, -0.48, -0.14,
    0.44, -0.48, -0.04, -0.51, -1.12, -0.11, 0, -1.17, -0.22, 0.51, -1.12,
    -0.11,
  ];
  capeData.indices = [
    0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5, 3, 6, 4, 4, 6, 7, 4, 7, 5, 5, 7, 8,
  ];
  capeData.normals = [];
  VertexData.ComputeNormals(
    capeData.positions,
    capeData.indices,
    capeData.normals,
  );
  capeData.applyToMesh(cape);
  place(cape, capePivot, palette.cloth, 0, 0, 0);
  for (const side of [-1, 1]) {
    const trim = box(
      `cape-trim-${side}`,
      capePivot,
      [0.022, 1.13, 0.012],
      [side * 0.405, -0.55, -0.053],
      palette.gold,
    );
    trim.rotation.z = side * -0.185;
  }

  const weaponHand = arms.find((item) => item.side === -1).hand;
  const otherHand = arms.find((item) => item.side === 1).hand;
  let crystal = null;
  if (kind === "wizard") {
    const staff = node("staff", weaponHand, 0, 0, 0.04);
    staff.rotation.z = -0.1;
    cylinder("staff-shaft", staff, 0.06, 1.7, [0, 0.15, 0], palette.leather);
    for (const y of [-0.54, -0.06, 0.72]) {
      cylinder(`staff-band-${y}`, staff, 0.09, 0.1, [0, y, 0], palette.gold);
    }
    const crown = ring(
      "staff-crown",
      staff,
      0.32,
      0.045,
      [0, 1.02, 0],
      palette.gold,
    );
    crown.rotation.x = Math.PI / 2;
    crystal = place(
      MeshBuilder.CreatePolyhedron(
        `${prefix}-staff-crystal`,
        {
          type: 1,
          size: 0.14,
        },
        scene,
      ),
      staff,
      palette.glow,
      0,
      1.02,
      0,
    );
    crystal.scaling.y = 1.5;
  } else if (kind === "knight") {
    const sword = node("sword", weaponHand, 0, 0, 0.025);
    sword.rotation.x = -0.28;
    cylinder("sword-grip", sword, 0.075, 0.22, [0, 0.06, 0], palette.leather);
    sphere("sword-pommel", sword, 0.1, [0, -0.06, 0], palette.gold);
    box(
      "sword-crossguard",
      sword,
      [0.36, 0.065, 0.09],
      [0, 0.19, 0],
      palette.gold,
    );
    const blade = cylinder(
      "sword-blade",
      sword,
      0.15,
      0.97,
      [0, 0.7, 0],
      palette.steel,
      0.025,
    );
    blade.scaling.z = 0.24;
    box(
      "sword-spine",
      sword,
      [0.025, 0.76, 0.012],
      [0, 0.68, 0.028],
      palette.ivory,
    );
    const shield = node("shield", otherHand, 0.045, 0.12, 0.12);
    shield.rotation.y = 0.16;
    const shieldFace = cylinder(
      "shield-body",
      shield,
      0.57,
      0.09,
      [0, 0, 0],
      palette.armor,
    );
    shieldFace.rotation.x = Math.PI / 2;
    shieldFace.scaling.z = 1.25;
    const shieldRim = ring(
      "shield-rim",
      shield,
      0.55,
      0.035,
      [0, 0, 0.054],
      palette.gold,
    );
    shieldRim.rotation.x = Math.PI / 2;
    shieldRim.scaling.z = 1.25;
    const boss = sphere(
      "shield-boss",
      shield,
      0.16,
      [0, 0, 0.09],
      palette.gold,
    );
    boss.scaling.z = 0.45;
    box(
      "shield-emblem",
      shield,
      [0.045, 0.4, 0.02],
      [0, 0, 0.061],
      palette.ivory,
    );
  } else {
    const bow = node("bow", weaponHand, 0, 0.16, 0.1);
    const bowPath = [];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      bowPath.push(
        new Vector3(0, (t - 0.5) * 1.15, Math.sin(t * Math.PI) * 0.25),
      );
    }
    place(
      MeshBuilder.CreateTube(
        `${prefix}-bow-limb`,
        {
          path: bowPath,
          radius: 0.032,
          tessellation: 6,
        },
        scene,
      ),
      bow,
      palette.gold,
      0,
      0,
      0,
    );
    box("bow-string", bow, [0.008, 1.15, 0.008], [0, 0, 0], palette.ivory);
    cylinder("bow-grip", bow, 0.085, 0.17, [0, 0, 0.25], palette.leather);
    const quiver = cylinder(
      "quiver",
      body,
      0.21,
      0.61,
      [0.24, 1.47, -0.36],
      palette.leather,
    );
    quiver.rotation.z = -0.27;
    for (let i = 0; i < 3; i += 1) {
      const arrow = cylinder(
        `arrow-${i}`,
        quiver,
        0.023,
        0.69,
        [(i - 1) * 0.055, 0.18, 0],
        palette.ivory,
      );
      box(
        `arrow-fletching-${i}`,
        arrow,
        [0.07, 0.1, 0.025],
        [0, 0.27, 0],
        palette.gold,
      );
    }
  }

  let elapsed = 0;
  let motion = 0;
  let disposed = false;
  return {
    root,
    classKey: kind,
    update(delta, moving = false, heading) {
      if (disposed) return;
      const dt = Math.min(Math.max(Number(delta) || 0, 0), 0.1);
      elapsed += dt;
      motion += ((moving ? 1 : 0) - motion) * Math.min(1, dt * 9);
      if (Number.isFinite(heading)) {
        const difference = Math.atan2(
          Math.sin(heading - root.rotation.y),
          Math.cos(heading - root.rotation.y),
        );
        root.rotation.y += difference * Math.min(1, dt * 12);
      }
      const stride = Math.sin(elapsed * 9.5);
      body.position.y =
        Math.abs(Math.sin(elapsed * 9.5)) * 0.055 * motion +
        Math.sin(elapsed * 1.8) * 0.012 * (1 - motion);
      body.rotation.z = Math.cos(elapsed * 9.5) * 0.018 * motion;
      for (const { leg, knee, side } of legs) {
        const phase = stride * side;
        leg.rotation.x = phase * 0.46 * motion;
        knee.rotation.x = Math.max(0, -phase) * 0.5 * motion;
      }
      for (const { arm, elbow, side } of arms) {
        arm.rotation.x = -stride * side * 0.29 * motion;
        arm.rotation.z = -side * (0.1 + Math.sin(elapsed * 1.8) * 0.008);
        elbow.rotation.x = -0.18 - Math.max(0, stride * side) * 0.15 * motion;
      }
      capePivot.rotation.x =
        -0.035 - motion * 0.2 + Math.sin(elapsed * 4) * 0.035;
      capePivot.rotation.z = Math.sin(elapsed * 3) * (0.015 + motion * 0.03);
      if (crystal) {
        crystal.rotation.y += dt * 0.7;
        palette.glow.emissiveColor = Color3.FromHexString("#9b4f10").scale(
          0.9 + Math.sin(elapsed * 2) * 0.15,
        );
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.dispose(false);
      ownMaterials.forEach((material) => material.dispose());
    },
  };
}
