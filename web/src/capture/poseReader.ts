// Reads body poses from a video or the camera with MediaPipe Pose Landmarker, as engine Frames.
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark, type Landmark } from "@mediapipe/tasks-vision";
import type { Frame } from "../engine";

const WASM = `${import.meta.env.BASE_URL}mediapipe`;
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

let landmarker: Promise<PoseLandmarker> | null = null;

export function getLandmarker(): Promise<PoseLandmarker> {
  landmarker ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    const make = (delegate: "GPU" | "CPU") =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    try {
      return await make("GPU");
    } catch {
      return await make("CPU");
    }
  })();
  return landmarker;
}

/** MediaPipe world landmarks (x right, y down, z away from the camera) to engine axes (right-handed, y up). */
function toEngine(l: Landmark): { x: number; y: number; z: number } {
  return { x: l.x, y: -l.y, z: -l.z };
}

function mid(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1) };
}

/** One detection to an engine frame (before the floor is set). Indices follow the MediaPipe pose model. */
export function frameFromWorld(world: Landmark[], t: number): Frame {
  const w = (i: number) => world[i]!;
  const joints = {
    pelvis: toEngine(mid(w(23), w(24))),
    "left-hip": toEngine(w(23)),
    "right-hip": toEngine(w(24)),
    "left-knee": toEngine(w(25)),
    "right-knee": toEngine(w(26)),
    "left-ankle": toEngine(w(27)),
    "right-ankle": toEngine(w(28)),
    "left-shoulder": toEngine(w(11)),
    "right-shoulder": toEngine(w(12)),
    "left-elbow": toEngine(w(13)),
    "right-elbow": toEngine(w(14)),
    "left-wrist": toEngine(w(15)),
    "right-wrist": toEngine(w(16)),
    neck: toEngine(mid(w(11), w(12))),
    head: toEngine(mid(w(7), w(8))),
  } as Frame["joints"];
  return { t, joints };
}

/** Put the lowest ankle of the take 8 cm above the floor, as the motion-capture import does. */
export function setFloor(frames: Frame[]): Frame[] {
  let low = Infinity;
  for (const f of frames) low = Math.min(low, f.joints["left-ankle"].y, f.joints["right-ankle"].y);
  if (!Number.isFinite(low)) return frames;
  const dy = 0.08 - low;
  return frames.map((f) => {
    const joints = {} as Frame["joints"];
    for (const [k, v] of Object.entries(f.joints) as Array<[keyof Frame["joints"], { x: number; y: number; z: number }]>) {
      joints[k] = { x: v.x, y: v.y + dy, z: v.z };
    }
    return { t: f.t, joints };
  });
}

export interface ReadProgress {
  done: number;
  total: number;
  image?: NormalizedLandmark[];
}

/** Step through a video frame by frame at `fps` and read one pose per frame. Frames with no person are skipped. */
export async function readVideo(
  video: HTMLVideoElement,
  fps: number,
  onProgress: (p: ReadProgress) => void,
  signal?: AbortSignal,
): Promise<Frame[]> {
  const lm = await getLandmarker();
  const total = Math.floor(video.duration * fps);
  const frames: Frame[] = [];
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) break;
    const t = i / fps;
    await new Promise<void>((resolve) => {
      const done = () => {
        video.removeEventListener("seeked", done);
        resolve();
      };
      video.addEventListener("seeked", done);
      video.currentTime = t;
    });
    const res = lm.detectForVideo(video, Math.round(t * 1000) + 1);
    const world = res.worldLandmarks[0];
    if (world) frames.push(frameFromWorld(world, t));
    onProgress({ done: i + 1, total, image: res.landmarks[0] });
  }
  return setFloor(frames);
}
