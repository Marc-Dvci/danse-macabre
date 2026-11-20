// A skeleton built from 15 joint positions, drawn as bone-white toon bones with an ink outline.
import * as THREE from "three";

export const JOINTS = [
  "pelvis",
  "left-hip",
  "right-hip",
  "left-knee",
  "right-knee",
  "left-ankle",
  "right-ankle",
  "left-shoulder",
  "right-shoulder",
  "left-elbow",
  "right-elbow",
  "left-wrist",
  "right-wrist",
  "neck",
  "head",
] as const;
export type Joint = (typeof JOINTS)[number];
export type Pose = Record<Joint, THREE.Vector3>;

const BONE = new THREE.Color("#ece6d6");
const INK = new THREE.Color("#0d0b0a");

function toonGradient(): THREE.Texture {
  const data = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

/** A unit bone along +Y from 0 to 1: knobby ends and a narrow shaft. */
function boneGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const profile: Array<[number, number]> = [
    [0.0, 0.0],
    [0.55, 0.01],
    [0.95, 0.04],
    [0.85, 0.09],
    [0.45, 0.16],
    [0.36, 0.3],
    [0.33, 0.5],
    [0.36, 0.7],
    [0.45, 0.84],
    [0.85, 0.91],
    [0.95, 0.96],
    [0.55, 0.99],
    [0.0, 1.0],
  ];
  for (const [r, y] of profile) pts.push(new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 14);
  g.computeVertexNormals();
  return g;
}

interface BoneMesh {
  mesh: THREE.Mesh;
  outline: THREE.Mesh;
  radius: number;
}

export class Skeleton {
  readonly group = new THREE.Group();
  private readonly mat: THREE.MeshToonMaterial;
  private readonly inkMat: THREE.MeshBasicMaterial;
  private readonly boneGeo = boneGeometry();
  private readonly bones = new Map<string, BoneMesh>();
  private readonly knobs = new Map<string, THREE.Mesh>();
  private readonly skull: THREE.Group;
  private readonly ribs: THREE.Mesh[] = [];
  private readonly pelvisBowl: THREE.Mesh;
  private readonly highlight = new Set<string>();

  constructor(readonly style: "bone" | "ghost" = "bone") {
    const ghost = style === "ghost";
    this.mat = new THREE.MeshToonMaterial({
      color: ghost ? new THREE.Color("#9fb4d9") : BONE,
      gradientMap: toonGradient(),
      transparent: ghost,
      opacity: ghost ? 0.28 : 1,
      depthWrite: !ghost,
    });
    this.inkMat = new THREE.MeshBasicMaterial({
      color: INK,
      side: THREE.BackSide,
      transparent: ghost,
      opacity: ghost ? 0 : 1,
      depthWrite: !ghost,
    });

    const limb = (name: string, radius: number) => this.addBone(name, radius);
    limb("left-upper-arm", 0.026);
    limb("right-upper-arm", 0.026);
    limb("left-radius", 0.014);
    limb("left-ulna", 0.012);
    limb("right-radius", 0.014);
    limb("right-ulna", 0.012);
    limb("left-femur", 0.034);
    limb("right-femur", 0.034);
    limb("left-tibia", 0.026);
    limb("left-fibula", 0.013);
    limb("right-tibia", 0.026);
    limb("right-fibula", 0.013);
    limb("left-clavicle", 0.014);
    limb("right-clavicle", 0.014);
    limb("left-foot", 0.022);
    limb("right-foot", 0.022);
    limb("spine-low", 0.03);
    limb("spine-high", 0.026);
    limb("neck-bone", 0.02);
    for (const side of ["left", "right"]) {
      for (let f = 0; f < 4; f++) limb(`${side}-finger-${f}`, 0.006);
    }

    for (const j of JOINTS) {
      if (j === "head" || j === "neck") continue;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(j === "pelvis" ? 0.035 : 0.03, 12, 10), this.mat);
      this.knobs.set(j, knob);
      this.group.add(knob);
    }

    // Ribcage: six open rings that follow the torso.
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 28, Math.PI * 1.7), this.mat);
      this.ribs.push(ring);
      this.group.add(ring);
    }
    this.pelvisBowl = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 8, 24, Math.PI * 1.25), this.mat);
    this.group.add(this.pelvisBowl);

    this.skull = this.buildSkull();
    this.group.add(this.skull);
  }

  private addBone(name: string, radius: number): void {
    const mesh = new THREE.Mesh(this.boneGeo, this.mat);
    const outline = new THREE.Mesh(this.boneGeo, this.inkMat);
    this.group.add(outline, mesh);
    this.bones.set(name, { mesh, outline, radius });
  }

  private buildSkull(): THREE.Group {
    const g = new THREE.Group();
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), this.mat);
    cranium.scale.set(0.95, 1.05, 1.08);
    const ink = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), this.inkMat);
    ink.scale.set(1.0, 1.1, 1.13);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.08), this.mat);
    jaw.position.set(0, -0.085, 0.035);
    const socketMat = new THREE.MeshBasicMaterial({ color: INK });
    for (const x of [-0.035, 0.035]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), socketMat);
      eye.position.set(x, 0.0, 0.088);
      g.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 3), socketMat);
    nose.position.set(0, -0.04, 0.1);
    nose.rotation.x = Math.PI;
    g.add(ink, cranium, jaw, nose);
    return g;
  }

  /** Columns or limbs to tint (e.g. the limb whose symbol is active in the score). */
  setHighlight(limbs: Iterable<string>): void {
    this.highlight.clear();
    for (const l of limbs) this.highlight.add(l);
  }

  private place(name: string, a: THREE.Vector3, b: THREE.Vector3, offset?: THREE.Vector3): void {
    const bone = this.bones.get(name);
    if (!bone) return;
    const from = offset ? a.clone().add(offset) : a;
    const to = offset ? b.clone().add(offset) : b;
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = Math.max(dir.length(), 1e-4);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    for (const [m, grow] of [
      [bone.mesh, 1],
      [bone.outline, 1.35],
    ] as const) {
      m.position.copy(from);
      m.quaternion.copy(q);
      m.scale.set(bone.radius * grow, len, bone.radius * grow);
    }
  }

  update(p: Pose, accent?: THREE.Color): void {
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3()
      .subVectors(p["right-hip"], p["left-hip"])
      .add(new THREE.Vector3().subVectors(p["right-shoulder"], p["left-shoulder"]));
    right.y = 0;
    if (right.lengthSq() < 1e-6) right.set(-1, 0, 0);
    right.normalize();
    const forward = new THREE.Vector3().crossVectors(up, right).normalize();

    for (const side of ["left", "right"] as const) {
      const sh = p[`${side}-shoulder`];
      const el = p[`${side}-elbow`];
      const wr = p[`${side}-wrist`];
      const hip = p[`${side}-hip`];
      const kn = p[`${side}-knee`];
      const an = p[`${side}-ankle`];
      this.place(`${side}-upper-arm`, sh, el);
      const forearmSide = new THREE.Vector3().subVectors(wr, el).cross(forward).normalize().multiplyScalar(0.012);
      this.place(`${side}-radius`, el, wr, forearmSide);
      this.place(`${side}-ulna`, el, wr, forearmSide.clone().negate());
      this.place(`${side}-femur`, hip, kn);
      const shinSide = right.clone().multiplyScalar(side === "left" ? -0.014 : 0.014);
      this.place(`${side}-tibia`, kn, an);
      this.place(`${side}-fibula`, kn, an, shinSide);
      this.place(`${side}-clavicle`, p.neck, sh);
      const toe = an.clone().addScaledVector(forward, 0.16).addScaledVector(up, -0.06);
      this.place(`${side}-foot`, an, toe);
      const hand = new THREE.Vector3().subVectors(wr, el).normalize();
      for (let f = 0; f < 4; f++) {
        const spread = new THREE.Vector3()
          .copy(right)
          .multiplyScalar((f - 1.5) * 0.012 * (side === "left" ? -1 : 1));
        const tip = wr.clone().addScaledVector(hand, 0.085 + (f === 1 || f === 2 ? 0.015 : 0)).add(spread);
        this.place(`${side}-finger-${f}`, wr, tip);
      }
    }

    const mid = p.pelvis.clone().lerp(p.neck, 0.45);
    this.place("spine-low", p.pelvis, mid);
    this.place("spine-high", mid, p.neck);
    this.place("neck-bone", p.neck, p.head.clone().lerp(p.neck, 0.45));

    for (const [j, knob] of this.knobs) knob.position.copy(p[j as Joint]);

    // Ribs: rings around the spine between 55% and 95% of the way up, opening toward the back.
    const spineDir = new THREE.Vector3().subVectors(p.neck, p.pelvis);
    const shoulderW = p["left-shoulder"].distanceTo(p["right-shoulder"]);
    const basis = new THREE.Matrix4().makeBasis(right, spineDir.clone().normalize(), forward);
    this.ribs.forEach((ring, i) => {
      const t = 0.55 + i * 0.075;
      const c = p.pelvis.clone().addScaledVector(spineDir, t).addScaledVector(forward, 0.03);
      const w = shoulderW * (0.36 + 0.05 * Math.sin((i / 5) * Math.PI));
      ring.position.copy(c);
      ring.setRotationFromMatrix(basis);
      ring.rotateX(Math.PI / 2);
      ring.rotateZ(Math.PI * 0.65);
      ring.scale.set(w, w * 0.75, 0.25);
    });
    const hipW = p["left-hip"].distanceTo(p["right-hip"]);
    this.pelvisBowl.position.copy(p.pelvis.clone().addScaledVector(up, -0.02));
    this.pelvisBowl.setRotationFromMatrix(basis);
    this.pelvisBowl.rotateX(Math.PI / 2);
    this.pelvisBowl.rotateZ(Math.PI * 0.375);
    this.pelvisBowl.scale.set(hipW * 0.85, hipW * 0.6, hipW * 0.85);

    // Skull faces the body's front, tilted along the neck.
    const headPos = p.head.clone().lerp(p.neck, 0.15);
    this.skull.position.copy(headPos);
    const neckUp = new THREE.Vector3().subVectors(p.head, p.neck).normalize();
    const skullBasis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3().crossVectors(neckUp, forward).normalize().negate(),
      neckUp,
      forward,
    );
    this.skull.setRotationFromMatrix(skullBasis);

    const lit = accent ?? new THREE.Color("#c8321e");
    for (const [name, bone] of this.bones) {
      const on = [...this.highlight].some((h) => name.startsWith(h));
      (bone.mesh.material as THREE.MeshToonMaterial) = on ? this.accentMat(lit) : this.mat;
    }
  }

  private accentCache?: THREE.MeshToonMaterial;
  private accentMat(c: THREE.Color): THREE.MeshToonMaterial {
    if (!this.accentCache) this.accentCache = new THREE.MeshToonMaterial({ color: c, gradientMap: toonGradient() });
    return this.accentCache;
  }
}

/** Read one frame of a clip (joint order given by `names`) into a Pose. */
export function poseFrom(names: readonly string[], frame: ReadonlyArray<readonly number[]>): Pose {
  const out = {} as Pose;
  for (const j of JOINTS) {
    const i = names.indexOf(j);
    const v = frame[i] ?? [0, 0, 0];
    out[j] = new THREE.Vector3(v[0], v[1], v[2]);
  }
  return out;
}

/** Linear blend of two poses, used to play clips between frames. */
export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Pose;
  for (const j of JOINTS) out[j] = a[j].clone().lerp(b[j], t);
  return out;
}
