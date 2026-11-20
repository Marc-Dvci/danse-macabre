// The stage: a dark chapel floor with an engraved direction ring, one warm key light, and the skeleton.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Skeleton, type Pose } from "./skeleton";

export type View = "front" | "behind" | "side" | "above";

const DIRECTION_LABELS = [
  "forward",
  "right forward",
  "right",
  "right back",
  "back",
  "left back",
  "left",
  "left forward",
];

/** Engraved floor ring: concentric circles and the eight Laban directions, drawn on a canvas. */
function ringTexture(): THREE.CanvasTexture {
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const mid = size / 2;
  g.clearRect(0, 0, size, size);
  g.strokeStyle = "rgba(236,230,214,0.55)";
  g.fillStyle = "rgba(236,230,214,0.75)";
  for (const [r, w] of [
    [470, 3],
    [455, 1],
    [300, 1.5],
    [140, 1],
  ] as const) {
    g.lineWidth = w;
    g.beginPath();
    g.arc(mid, mid, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.font = "italic 30px 'IM Fell English', Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let k = 0; k < 8; k++) {
    // k = 0 is forward (toward -y on the canvas, which maps to +z on the floor).
    const a = (k * Math.PI) / 4;
    const dx = Math.sin(a);
    const dy = Math.cos(a);
    g.lineWidth = k % 2 === 0 ? 3 : 1.5;
    g.beginPath();
    g.moveTo(mid + dx * 300, mid + dy * 300);
    g.lineTo(mid + dx * 455, mid + dy * 455);
    g.stroke();
    g.save();
    g.translate(mid + dx * 380, mid + dy * 380);
    g.rotate(-a + Math.PI);
    g.fillText(DIRECTION_LABELS[k]!, 0, -22);
    g.restore();
  }
  // Forward arrow mark, in the accent colour.
  g.fillStyle = "#c8321e";
  g.beginPath();
  g.moveTo(mid, mid + 470 + 0);
  g.lineTo(mid - 16, mid + 440);
  g.lineTo(mid + 16, mid + 440);
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
  readonly skeleton = new Skeleton("bone");
  readonly ghost = new Skeleton("ghost");
  private readonly controls: OrbitControls;
  private readonly ring: THREE.Mesh;
  private readonly target = new THREE.Vector3(0, 0.95, 0);
  private facing = 0;
  private disposed = false;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor("#0d0b0a");
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute("aria-hidden", "true");

    this.scene.fog = new THREE.Fog("#0d0b0a", 6, 13);
    const key = new THREE.SpotLight("#ffd9a8", 38, 12, Math.PI / 5, 0.6, 1.4);
    key.position.set(1.6, 4.2, 2.6);
    key.target.position.copy(this.target);
    this.scene.add(key, key.target);
    const rim = new THREE.DirectionalLight("#9fb4d9", 0.7);
    rim.position.set(-3, 2.5, -3);
    this.scene.add(rim, new THREE.AmbientLight("#5a5048", 0.9));

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(6, 64),
      new THREE.MeshStandardMaterial({ color: "#16130f", roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    this.ring = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.002;
    this.scene.add(this.ring);

    this.addFrieze();
    this.scene.add(this.skeleton.group, this.ghost.group);
    this.ghost.group.visible = false;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.copy(this.target);
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 9;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.setView("front");

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    const loop = () => {
      if (this.disposed) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }

  /** Holbein's Dance of Death woodcuts as panels on a circular wall around the stage, like the painted Totentanz walls. */
  private addFrieze(): void {
    const names = ["the-trumpeters-of-death", "the-doctor", "the-duchess", "the-old-man", "the-ploughman", "the-preacher"];
    const loader = new THREE.TextureLoader();
    const radius = 4.6;
    names.forEach((name, i) => {
      const tex = loader.load(`${import.meta.env.BASE_URL}art/${name}.webp`);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.42, depthWrite: false });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 2.5), mat);
      const a = (i / names.length) * Math.PI * 2 + Math.PI;
      panel.position.set(Math.sin(a) * radius, 1.55, Math.cos(a) * radius);
      panel.lookAt(0, 1.55, 0);
      this.scene.add(panel);
    });
  }

  setView(view: View): void {
    const d = 4.4;
    const f = this.facing;
    const at = (yaw: number, h: number) =>
      new THREE.Vector3(this.target.x + Math.sin(yaw) * d, h, this.target.z + Math.cos(yaw) * d);
    const pos =
      view === "front" ? at(f, 1.5) : view === "behind" ? at(f + Math.PI, 1.6) : view === "side" ? at(f + Math.PI / 2, 1.4) : at(f, 5.2);
    this.camera.position.copy(pos);
    this.controls.target.copy(this.target);
  }

  /** Move the skeleton; the ring follows the dancer and turns to its front. */
  show(pose: Pose): void {
    this.skeleton.update(pose);
    const right = new THREE.Vector3().subVectors(pose["right-hip"], pose["left-hip"]);
    right.y = 0;
    if (right.lengthSq() > 1e-6) {
      right.normalize();
      const forward = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right);
      const yaw = Math.atan2(forward.x, forward.z);
      this.facing = yaw;
      this.ring.rotation.z = yaw;
    }
    this.ring.position.x = pose.pelvis.x;
    this.ring.position.z = pose.pelvis.z;
    const t = new THREE.Vector3(pose.pelvis.x, 0.95, pose.pelvis.z);
    this.controls.target.lerp(t, 0.08);
  }

  /** The recording, drawn as a pale ghost behind the skeleton that performs the score. */
  showGhost(pose: Pose | null): void {
    this.ghost.group.visible = pose !== null;
    if (pose) this.ghost.update(pose);
  }

  /** Hide or show the bone skeleton (when only the recording is shown). */
  showBones(on: boolean): void {
    this.skeleton.group.visible = on;
  }

  resize(): void {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.disposed = true;
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
