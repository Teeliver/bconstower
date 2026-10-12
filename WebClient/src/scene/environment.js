import { Color3 } from "@babylonjs/core/Maths/math.color";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import "@babylonjs/core/Meshes/instancedMesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
const MeshBuilder = {
  CreateBox,
  CreateCylinder,
  CreateGround,
  CreateSphere,
  CreateTorus,
};

// These meshes and textures are generated locally. No MU client assets are used.
export function createCourtyard(scene, shadows) {
  let seed = 984;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const root = new TransformNode("courtyard", scene);
  const animated = [];
  const material = (name, color, emissive = null) => {
    const result = new StandardMaterial(name, scene);
    result.diffuseColor = Color3.FromHexString(color);
    result.specularColor = new Color3(0.12, 0.15, 0.12);
    if (emissive) result.emissiveColor = Color3.FromHexString(emissive);
    return result;
  };
  const stone = material("warm limestone", "#aaa794");
  const darkStone = material("weathered limestone", "#6b7669");
  const gold = material("brushed antique brass", "#b7a465");
  const darkGold = material("old brass", "#696048");
  const timber = material("dark cedar", "#373a2e");
  const leaves = [
    material("cedar green", "#304d3c"),
    material("cedar light", "#43614a"),
    material("cedar shadow", "#263b32"),
  ];
  const banner = material("emerald banner cloth", "#155044");
  const flame = material("golden fire", "#f1b252", "#e96b1d");
  const flameCore = material("fire core", "#ffecc1", "#ffc353");
  const crystal = material("jade prism", "#82d9b5", "#32695b");
  const rune = material("ancient runes", "#79b49e", "#24473b");
  const water = material("still moat", "#183d3b");
  water.specularColor = new Color3(0.6, 0.75, 0.7);
  water.specularPower = 90;

  const mesh = (result, mat, position, cast = true) => {
    result.material = mat;
    result.parent = root;
    result.position.copyFromFloats(...position);
    result.receiveShadows = true;
    result.isPickable = false;
    if (cast) shadows.addShadowCaster(result);
    return result;
  };
  const box = (
    name,
    width,
    height,
    depth,
    position,
    mat = stone,
    cast = true,
  ) =>
    mesh(
      MeshBuilder.CreateBox(name, { width, height, depth }, scene),
      mat,
      position,
      cast,
    );
  const cylinder = (name, options, position, mat = stone, cast = true) =>
    mesh(MeshBuilder.CreateCylinder(name, options, scene), mat, position, cast);

  function stoneTexture() {
    const texture = new DynamicTexture(
      "hand laid cobblestones",
      1024,
      scene,
      true,
    );
    const context = texture.getContext();
    context.fillStyle = "#283b32";
    context.fillRect(0, 0, 1024, 1024);
    const rows = 16;
    const cell = 1024 / rows;
    for (let y = -1; y < rows + 1; y += 1) {
      for (let x = -1; x < rows + 1; x += 1) {
        const dx = x * cell + ((y % 2) * cell) / 2;
        const dy = y * cell;
        const brightness = Math.floor(58 + random() * 30);
        const inset = 3 + random() * 3;
        context.fillStyle = `rgb(${brightness + 7},${brightness + 12},${brightness})`;
        context.beginPath();
        context.moveTo(dx + inset + 7, dy + inset);
        context.lineTo(dx + cell - inset - 2, dy + inset + 2);
        context.lineTo(dx + cell - inset, dy + cell - inset - 8);
        context.lineTo(dx + cell - inset - 7, dy + cell - inset);
        context.lineTo(dx + inset, dy + cell - inset - 3);
        context.lineTo(dx + inset, dy + inset + 7);
        context.closePath();
        context.fill();
        context.strokeStyle = "rgba(189,185,150,0.15)";
        context.lineWidth = 2;
        context.stroke();
      }
    }
    for (let i = 0; i < 2600; i += 1) {
      context.fillStyle =
        random() > 0.55 ? "rgba(110,140,75,.10)" : "rgba(18,30,24,.12)";
      context.fillRect(
        random() * 1024,
        random() * 1024,
        random() * 5 + 1,
        random() * 7 + 1,
      );
    }
    texture.update();
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    return texture;
  }
  const cobblestone = material("mossy courtyard cobbles", "#aab4a5");
  cobblestone.diffuseTexture = stoneTexture();
  cobblestone.diffuseTexture.uScale = 3.2;
  cobblestone.diffuseTexture.vScale = 3.2;
  const lawn = material("courtyard moss", "#35473a");
  const lawnTexture = new DynamicTexture("forest floor", 512, scene, true);
  const lawnContext = lawnTexture.getContext();
  lawnContext.fillStyle = "#65735a";
  lawnContext.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 13000; i += 1) {
    const value = Math.floor(52 + random() * 35);
    lawnContext.fillStyle = `rgba(${value},${value + 18},${value - 6},0.45)`;
    lawnContext.fillRect(
      random() * 512,
      random() * 512,
      1 + random() * 5,
      1 + random() * 6,
    );
  }
  lawnTexture.update();
  lawnTexture.wrapU = Texture.WRAP_ADDRESSMODE;
  lawnTexture.wrapV = Texture.WRAP_ADDRESSMODE;
  lawnTexture.uScale = 16;
  lawnTexture.vScale = 16;
  lawn.diffuseTexture = lawnTexture;

  const ground = mesh(
    MeshBuilder.CreateGround(
      "walkable moss",
      { width: 100, height: 100 },
      scene,
    ),
    lawn,
    [0, -0.04, 0],
    false,
  );
  ground.isPickable = true;
  ground.metadata = { walkable: true };
  const plaza = mesh(
    MeshBuilder.CreateGround(
      "courtyard square",
      { width: 27, height: 30 },
      scene,
    ),
    cobblestone,
    [0, 0, 1],
    false,
  );
  plaza.isPickable = true;
  plaza.metadata = { walkable: true };
  const center = cylinder(
    "old circular seal",
    { height: 0.06, diameter: 8.6, tessellation: 64 },
    [0, 0.035, 0],
    darkStone,
    false,
  );
  center.isPickable = true;
  center.metadata = { walkable: true };
  const sealMaterial = material("seal worn stone", "#708074");
  sealMaterial.diffuseTexture = cobblestone.diffuseTexture;
  center.material = sealMaterial;
  mesh(
    MeshBuilder.CreateTorus(
      "seal brass outer ring",
      { diameter: 8.3, thickness: 0.045, tessellation: 64 },
      scene,
    ),
    gold,
    [0, 0.08, 0],
    false,
  );
  mesh(
    MeshBuilder.CreateTorus(
      "seal jade inner ring",
      { diameter: 6.7, thickness: 0.025, tessellation: 64 },
      scene,
    ),
    rune,
    [0, 0.08, 0],
    false,
  );
  for (let i = 0; i < 16; i += 1) {
    const angle = (i * Math.PI) / 8;
    const mark = box(
      "ring rune",
      0.16,
      0.018,
      0.38,
      [Math.sin(angle) * 3.72, 0.081, Math.cos(angle) * 3.72],
      gold,
      false,
    );
    mark.rotation.y = angle;
  }

  // Raised borders and a bridge give the courtyard a clear silhouette.
  [-1, 1].forEach((side) => {
    box(
      "courtyard edging",
      0.35,
      0.18,
      34,
      [side * 13.8, 0.01, 1],
      darkStone,
      false,
    );
    box(
      "courtyard outer edging",
      0.45,
      0.18,
      34,
      [side * 15.7, 0.01, 1],
      darkStone,
      false,
    );
    for (let i = -8; i <= 8; i += 1) {
      box(
        "side walkway slab",
        1.4,
        0.12,
        1.6,
        [side * 14.7, 0.02, i * 1.85],
        stone,
        false,
      );
    }
    mesh(
      MeshBuilder.CreateGround("moat", { width: 6, height: 50 }, scene),
      water,
      [side * 21, -0.12, 1],
      false,
    );
    box("moat inner wall", 0.7, 0.8, 43, [side * 18.2, 0, 0], darkStone);
  });
  box("bridge floor", 7.8, 0.5, 9, [0, -0.14, -18.7], darkStone);
  for (let side of [-1, 1]) {
    box("bridge parapet", 0.6, 0.8, 8, [side * 4.1, 0.45, -19], stone);
    for (let i = 0; i < 4; i += 1) {
      box(
        "bridge post",
        0.85,
        1.3,
        0.85,
        [side * 4.1, 0.65, -16.1 - i * 2],
        stone,
      );
      box(
        "bridge post cap",
        1,
        0.16,
        1,
        [side * 4.1, 1.35, -16.1 - i * 2],
        gold,
      );
    }
  }

  function tower(x, z, height, diameter) {
    cylinder(
      "tower foundation",
      { diameter: diameter + 0.8, height: 0.8, tessellation: 8 },
      [x, 0.4, z],
      darkStone,
    );
    cylinder(
      "octagonal watchtower",
      { diameter, height, tessellation: 8 },
      [x, height / 2 + 0.5, z],
      stone,
    );
    for (let i = 0; i < 3; i += 1) {
      cylinder(
        "tower stone belt",
        { diameter: diameter + 0.15, height: 0.16, tessellation: 8 },
        [x, 1.5 + i * (height / 3), z],
        darkStone,
      );
    }
    cylinder(
      "tower cornice",
      { diameter: diameter + 0.6, height: 0.35, tessellation: 8 },
      [x, height + 0.65, z],
      darkStone,
    );
    for (let i = 0; i < 8; i += 1) {
      const angle = (i * Math.PI) / 4;
      const battlement = box(
        "tower battlement",
        0.95,
        1.1,
        0.85,
        [
          x + (Math.sin(angle) * diameter) / 2.25,
          height + 1.15,
          z + (Math.cos(angle) * diameter) / 2.25,
        ],
        stone,
      );
      battlement.rotation.y = angle;
    }
    box(
      "watchtower window shadow",
      0.65,
      1.9,
      0.1,
      [x, height * 0.66, z - diameter / 2 - 0.01],
      timber,
      false,
    );
    box(
      "watchtower window glow",
      0.36,
      1.35,
      0.03,
      [x, height * 0.66, z - diameter / 2 - 0.08],
      flame,
      false,
    );
  }
  tower(-9, 19, 10.8, 4.3);
  tower(9, 19, 10.8, 4.3);
  tower(-18, 24, 15, 4.8);
  tower(18, 24, 13, 4.8);
  box("great gate stone wall", 15, 6.8, 2.3, [0, 3.4, 20], darkStone);
  box("great gate cornice", 15.6, 0.3, 2.65, [0, 6.8, 20], stone);
  for (let i = -6; i <= 6; i += 2) {
    box("great gate crenellation", 1.05, 0.9, 1.1, [i, 7.4, 19.5], stone);
  }
  for (let side of [-1, 1]) {
    box("fortress outer wall", 7.3, 5.4, 1.8, [side * 14, 2.7, 23], darkStone);
    for (let i = 0; i < 4; i += 1)
      box(
        "outer wall crenellation",
        1.1,
        0.8,
        2,
        [side * (11 + i * 2), 5.65, 23],
        stone,
      );
  }
  const doorway = material("gate darkness", "#0f2420", "#071714");
  box("great gate shadow", 4.6, 5.3, 0.08, [0, 2.72, 18.8], doorway, false);
  for (let side of [-1, 1]) {
    box("gate upright", 0.7, 3.4, 0.75, [side * 2.6, 1.8, 18.5], stone);
    box("gate base", 1, 0.4, 1.15, [side * 2.6, 0.28, 18.5], gold);
    box("gate column crown", 0.95, 0.28, 0.95, [side * 2.6, 3.4, 18.5], gold);
  }
  for (let i = 0; i <= 12; i += 1) {
    const angle = (i / 12) * Math.PI;
    const block = box(
      "arched gate keystone",
      0.67,
      0.7,
      0.9,
      [Math.cos(angle) * 2.6, 3.3 + Math.sin(angle) * 2.6, 18.5],
      i === 6 ? gold : stone,
    );
    block.rotation.z = angle - Math.PI / 2;
  }
  for (let i = 0; i < 7; i += 1) {
    box(
      "iron portcullis",
      0.055,
      4.4,
      0.06,
      [-1.6 + i * 0.53, 2.26, 18.66],
      darkGold,
      false,
    );
  }
  for (let y = 1; y < 4; y += 1)
    box("portcullis brace", 3.6, 0.06, 0.06, [0, y, 18.65], darkGold, false);
  for (let i = 0; i < 4; i += 1)
    box(
      "gate step",
      6.4 - i * 0.35,
      0.15,
      1.05,
      [0, 0.08 + i * 0.15, 14.5 + i * 1.0],
      stone,
      false,
    );

  function hangingBanner(x, z, height = 5.5) {
    box("banner bracket", 2.4, 0.09, 0.16, [x, height, z], gold);
    box(
      "emerald standard",
      1.75,
      2.7,
      0.06,
      [x, height - 1.48, z],
      banner,
      false,
    );
    box(
      "banner vertical ornament",
      0.045,
      2.2,
      0.08,
      [x - 0.65, height - 1.48, z - 0.08],
      gold,
      false,
    );
    box(
      "banner vertical ornament",
      0.045,
      2.2,
      0.08,
      [x + 0.65, height - 1.48, z - 0.08],
      gold,
      false,
    );
    const emblem = box(
      "standard gold diamond",
      0.55,
      0.55,
      0.07,
      [x, height - 1.4, z - 0.08],
      gold,
      false,
    );
    emblem.rotation.z = Math.PI / 4;
  }
  hangingBanner(-5.8, 18.7);
  hangingBanner(5.8, 18.7);

  // Ruined colonnades frame the playable space without blocking the hero.
  function column(x, z, height = 4.8) {
    box("column plinth", 1.4, 0.25, 1.4, [x, 0.16, z], darkStone);
    cylinder(
      "column base",
      { diameter: 1.15, height: 0.28, tessellation: 10 },
      [x, 0.42, z],
      stone,
    );
    cylinder(
      "fluted ruin pillar",
      { diameter: 0.7, height, tessellation: 10 },
      [x, height / 2 + 0.55, z],
      stone,
    );
    cylinder(
      "column capital",
      { diameter: 1.1, height: 0.24, tessellation: 8 },
      [x, height + 0.64, z],
      gold,
    );
    box("column crown", 1.2, 0.22, 1.2, [x, height + 0.87, z], stone);
  }
  for (let side of [-1, 1]) {
    [-8, -1, 6, 12].forEach((z, index) =>
      column(side * 12, z, index === 0 ? 2.5 : 4.5),
    );
    box("remaining architrave", 1.4, 0.7, 7.8, [side * 12, 5.6, 9], darkStone);
    box("broken entablature", 1.5, 0.8, 4, [side * 12, 0.4, -11], stone);
    for (let i = 0; i < 8; i += 1) {
      const rubble = box(
        "fallen masonry",
        0.4 + random(),
        0.35 + random() * 0.4,
        0.4 + random(),
        [side * (10.6 + random() * 3.2), 0.22, -10 + random() * 6],
        darkStone,
      );
      rubble.rotation.set(random() * 0.3, random() * Math.PI, random() * 0.2);
    }
  }

  function tree(x, z, scale = 1) {
    cylinder(
      "cedar trunk",
      {
        diameterBottom: 0.6 * scale,
        diameterTop: 0.3 * scale,
        height: 4 * scale,
        tessellation: 6,
      },
      [x, 2 * scale, z],
      timber,
    );
    for (let i = 0; i < 4; i += 1) {
      cylinder(
        "cedar foliage",
        {
          diameterBottom: (4.6 - i * 0.83) * scale,
          diameterTop: 0,
          height: 3.1 * scale,
          tessellation: 7,
        },
        [x, (3 + i * 1.35) * scale, z],
        leaves[i % leaves.length],
      );
    }
  }
  for (let side of [-1, 1]) {
    [-14, -7, 0, 8, 16, 31].forEach((z, index) =>
      tree(side * (16.7 + random() * 3), z, 0.78 + random() * 0.48),
    );
    for (let i = 0; i < 4; i += 1)
      tree(side * (23 + random() * 12), 5 + i * 11, 1.4 + random());
  }

  function brazier(x, z) {
    cylinder(
      "brazier foot",
      { diameter: 0.9, height: 0.25, tessellation: 8 },
      [x, 0.15, z],
      darkStone,
    );
    cylinder(
      "brazier pedestal",
      {
        diameterBottom: 0.52,
        diameterTop: 0.36,
        height: 1.35,
        tessellation: 8,
      },
      [x, 0.86, z],
      darkGold,
    );
    cylinder(
      "fire bowl",
      {
        diameterBottom: 0.45,
        diameterTop: 1.12,
        height: 0.45,
        tessellation: 10,
      },
      [x, 1.66, z],
      gold,
    );
    const outer = cylinder(
      "brazier amber flame",
      { diameterBottom: 0.62, diameterTop: 0, height: 1.06, tessellation: 6 },
      [x, 2.16, z],
      flame,
      false,
    );
    const inner = cylinder(
      "brazier bright flame",
      { diameterBottom: 0.28, diameterTop: 0, height: 0.9, tessellation: 5 },
      [x, 2.23, z - 0.08],
      flameCore,
      false,
    );
    animated.push({ type: "flame", outer, inner, phase: random() * 6 });
  }
  [
    [-6.2, -7],
    [6.2, -7],
    [-5.8, 12],
    [5.8, 12],
    [-4.7, 17],
    [4.7, 17],
  ].forEach(([x, z]) => brazier(x, z));

  function crystalShrine(x, z) {
    cylinder(
      "shrine footing",
      { diameter: 1.4, height: 0.25, tessellation: 8 },
      [x, 0.16, z],
      darkStone,
    );
    cylinder(
      "shrine base gold",
      { diameter: 0.9, height: 0.12, tessellation: 6 },
      [x, 0.35, z],
      gold,
    );
    const shard = cylinder(
      "floating jade crystal",
      { diameterBottom: 0.1, diameterTop: 0.72, height: 0.75, tessellation: 5 },
      [x, 1.24, z],
      crystal,
      false,
    );
    const top = cylinder(
      "jade crystal tip",
      { diameterBottom: 0.72, diameterTop: 0, height: 1.2, tessellation: 5 },
      [x, 2.2, z],
      crystal,
      false,
    );
    const halo = mesh(
      MeshBuilder.CreateTorus(
        "shrine orbit",
        { diameter: 1.4, thickness: 0.024, tessellation: 32 },
        scene,
      ),
      gold,
      [x, 1.28, z],
      false,
    );
    halo.rotation.z = 0.42;
    animated.push({ type: "crystal", shard, top, halo, phase: random() * 6 });
  }
  crystalShrine(-7, 4.5);
  crystalShrine(7, 4.5);

  // A field of small instanced grasses, flowers and rocks adds texture cheaply.
  const grassMat = material("golden meadow blades", "#748866");
  const grassSource = MeshBuilder.CreateCylinder(
    "grass source",
    { height: 0.4, diameterBottom: 0.12, diameterTop: 0, tessellation: 3 },
    scene,
  );
  grassSource.material = grassMat;
  grassSource.isVisible = false;
  grassSource.isPickable = false;
  for (let i = 0; i < 360; i += 1) {
    const grass = grassSource.createInstance("wild grass");
    const side = random() > 0.5 ? 1 : -1;
    grass.position.set(
      side * (13.9 + random() * 3.9),
      0.08,
      -14 + random() * 29,
    );
    grass.scaling.set(0.65 + random(), 0.5 + random(), 0.65 + random());
    grass.isPickable = false;
    grass.parent = root;
  }
  const flowerMat = material("pale meadow blooms", "#d5cda1");
  const flowerSource = MeshBuilder.CreateSphere(
    "bloom source",
    { diameter: 0.09, segments: 4 },
    scene,
  );
  flowerSource.material = flowerMat;
  flowerSource.isVisible = false;
  flowerSource.isPickable = false;
  for (let i = 0; i < 100; i += 1) {
    const flower = flowerSource.createInstance("small wildflower");
    flower.position.set(
      (random() > 0.5 ? 1 : -1) * (14 + random() * 3.7),
      0.26,
      -13 + random() * 27,
    );
    flower.isPickable = false;
    flower.parent = root;
  }
  grassSource.parent = root;
  flowerSource.parent = root;

  // Distant mountains and a pale moon complete the backdrop.
  const mountainMat = material("distant jade mountains", "#293f38");
  for (let i = -5; i <= 5; i += 1) {
    cylinder(
      "distant crag",
      {
        diameterBottom: 14 + random() * 15,
        diameterTop: 0.6,
        height: 18 + random() * 18,
        tessellation: 5,
      },
      [i * 11, 7, 48 + random() * 9],
      mountainMat,
      false,
    );
  }
  const moonMat = material("pearl moon", "#c5d8c3", "#7b9d8b");
  mesh(
    MeshBuilder.CreateSphere("moon", { diameter: 4.1, segments: 24 }, scene),
    moonMat,
    [-24, 29, 47],
    false,
  );

  // Ambient motes are gentle rather than firework-like; they never affect state.
  const moteMat = material("forest fireflies", "#e3d7a9", "#778d54");
  const motes = [];
  for (let i = 0; i < 30; i += 1) {
    const mote = mesh(
      MeshBuilder.CreateSphere(
        "ambient light mote",
        { diameter: 0.025 + random() * 0.025, segments: 3 },
        scene,
      ),
      moteMat,
      [(random() - 0.5) * 24, 0.6 + random() * 5, (random() - 0.5) * 27],
      false,
    );
    motes.push({
      mesh: mote,
      y: mote.position.y,
      x: mote.position.x,
      phase: random() * 8,
    });
  }

  return {
    update(time) {
      for (let item of animated) {
        if (item.type === "flame") {
          item.outer.scaling.y = 1 + Math.sin(time * 7 + item.phase) * 0.1;
          item.outer.rotation.y = time * 0.2 + item.phase;
          item.inner.scaling.y = 1 + Math.sin(time * 11 + item.phase) * 0.11;
        } else {
          item.shard.position.y =
            1.24 + Math.sin(time * 1.5 + item.phase) * 0.12;
          item.top.position.y = 2.2 + Math.sin(time * 1.5 + item.phase) * 0.12;
          item.shard.rotation.y = time * 0.25;
          item.top.rotation.y = time * 0.25;
          item.halo.rotation.y = time * 0.15;
        }
      }
      motes.forEach((mote) => {
        mote.mesh.position.y =
          mote.y + Math.sin(time * 0.8 + mote.phase) * 0.35;
        mote.mesh.position.x = mote.x + Math.sin(time * 0.5 + mote.phase) * 0.4;
      });
    },
    root,
  };
}
