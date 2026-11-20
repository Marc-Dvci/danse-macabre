// From video: read a dance from a video or the camera, write its score, and check it against motion capture.
import { useEffect, useRef, useState } from "react";
import { addCustomClip, loadClip } from "./clips";
import { notateClip, type Frame, type Score } from "./engine";
import { centreClip } from "./pose";
import { getLandmarker, frameFromWorld, readVideo, setFloor } from "./capture/poseReader";
import { alignTakes, armAgreement, type Agreement } from "./compare";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const SAMPLES = [
  {
    id: "modern-arms-high",
    file: "./video/modern-arms-high.webm",
    title: "Modern dance: arms held high",
    note: "CMU reference video of subject 5, trial 12 (cropped to the dancer). The same take is in Watch as motion capture.",
  },
  {
    id: "modern-pirouette",
    file: "./video/modern-pirouette.webm",
    title: "Modern dance: expressive arms, pirouette",
    note: "CMU reference video of subject 5, trial 2 (cropped to the dancer). The same take is in Watch as motion capture.",
  },
];

const BONES: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];

function drawLandmarks(canvas: HTMLCanvasElement, lm: NormalizedLandmark[] | undefined): void {
  const g = canvas.getContext("2d");
  if (!g) return;
  g.clearRect(0, 0, canvas.width, canvas.height);
  if (!lm) return;
  g.strokeStyle = "#ece6d6";
  g.lineWidth = Math.max(2, canvas.width / 160);
  g.lineCap = "round";
  for (const [a, b] of BONES) {
    const p = lm[a];
    const q = lm[b];
    if (!p || !q) continue;
    g.beginPath();
    g.moveTo(p.x * canvas.width, p.y * canvas.height);
    g.lineTo(q.x * canvas.width, q.y * canvas.height);
    g.stroke();
  }
  g.fillStyle = "#c8321e";
  for (const i of [15, 16, 27, 28]) {
    const p = lm[i];
    if (p) g.fillRect(p.x * canvas.width - 3, p.y * canvas.height - 3, 6, 6);
  }
}

type Phase = "idle" | "loading" | "reading" | "camera" | "done";

export function Capture({ onOpen }: { onOpen: (id: string) => void }) {
  const [sample, setSample] = useState(SAMPLES[0]!);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [score, setScore] = useState<Score | null>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const abort = useRef<AbortController | null>(null);
  const cameraFrames = useRef<Frame[]>([]);
  const fileUrl = useRef<string | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function finish(frames: Frame[], id: string, title: string, compareId: string | null) {
    if (frames.length < 10) {
      setError("No dancer was found in enough frames to write a score.");
      setPhase("idle");
      return;
    }
    const s = notateClip(centreClip(frames), title);
    setScore(s);
    const clipId = `video-${id}`;
    setOpenId(clipId);
    addCustomClip(
      { id: clipId, title: `${title} (from video)`, seconds: Math.round(frames[frames.length - 1]!.t * 10) / 10, subject: "video", trial: id, description: `${title}, read from video` },
      frames,
    );
    if (compareId) {
      const mocap = await loadClip(compareId);
      const offset = alignTakes(frames, mocap.frames);
      const shifted = mocap.frames.filter((f) => f.t >= offset).map((f) => ({ ...f, t: f.t - offset }));
      const mocapScore = notateClip(centreClip(shifted), mocap.title);
      setAgreement(armAgreement(s, mocapScore, 0, Math.min(frames[frames.length - 1]!.t, shifted[shifted.length - 1]?.t ?? 0)));
      setAgreement((a) => (a ? { ...a, offsetSeconds: offset } : a));
    }
    setPhase("done");
  }

  async function readSample() {
    const v = video.current;
    if (!v) return;
    setError(null);
    setScore(null);
    setAgreement(null);
    setPhase("loading");
    try {
      await getLandmarker();
      if (v.readyState < 1) await new Promise((r) => v.addEventListener("loadedmetadata", r, { once: true }));
      setPhase("reading");
      abort.current = new AbortController();
      const frames = await readVideo(
        v,
        30,
        (p) => {
          setProgress({ done: p.done, total: p.total });
          if (overlay.current) drawLandmarks(overlay.current, p.image);
        },
        abort.current.signal,
      );
      const isSample = SAMPLES.some((s) => s.file === v.getAttribute("src"));
      await finish(frames, isSample ? sample.id : "file", isSample ? sample.title : "Your video", isSample ? sample.id : null);
    } catch (e) {
      setError(`Pose reading failed: ${(e as Error).message}`);
      setPhase("idle");
    }
  }

  async function startCamera() {
    const v = video.current;
    if (!v) return;
    setError(null);
    setScore(null);
    setAgreement(null);
    try {
      const lm = await getLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      v.srcObject = stream;
      await v.play();
      cameraFrames.current = [];
      setPhase("camera");
      const t0 = performance.now();
      const loop = () => {
        if (!v.srcObject) return;
        const now = performance.now();
        const res = lm.detectForVideo(v, now);
        if (overlay.current) drawLandmarks(overlay.current, res.landmarks[0]);
        const world = res.worldLandmarks[0];
        if (world) cameraFrames.current.push(frameFromWorld(world, (now - t0) / 1000));
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (e) {
      setError(`Camera unavailable: ${(e as Error).message}`);
    }
  }

  async function stopCamera() {
    const v = video.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    await finish(setFloor(cameraFrames.current), "camera", "Camera take", null);
  }

  return (
    <div className="page capture">
      <div className="capture-grid">
        <section aria-label="Video">
          <div className="video-box">
            <video ref={video} src={sample.file} muted playsInline crossOrigin="anonymous" preload="auto" />
            <canvas ref={overlay} width={320} height={480} aria-hidden="true" />
          </div>
          <p className="note">{sample.note}</p>
        </section>
        <section aria-label="Read a dance" className="prose">
          <h2>Read a dance from video</h2>
          <p>
            The pose model finds 33 points on the body in every frame. The notation engine keeps 15 of them and writes the
            score, the same way it does for motion capture.
          </p>
          <div className="choices" role="radiogroup" aria-label="Video">
            {SAMPLES.map((s) => (
              <label key={s.id} className="toggle">
                <input
                  type="radio"
                  name="sample"
                  checked={sample.id === s.id && !fileUrl.current}
                  onChange={() => {
                    fileUrl.current = null;
                    setSample(s);
                    setPhase("idle");
                  }}
                />
                {s.title}
              </label>
            ))}
            <label className="toggle">
              <input
                type="file"
                accept="video/*"
                aria-label="Open a video file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f || !video.current) return;
                  if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
                  fileUrl.current = URL.createObjectURL(f);
                  video.current.src = fileUrl.current;
                  setPhase("idle");
                }}
              />
            </label>
          </div>
          <div className="actions">
            <button className="action" onClick={readSample} disabled={phase === "reading" || phase === "loading" || phase === "camera"}>
              Read the dance
            </button>
            {phase !== "camera" ? (
              <button className="action quiet" onClick={startCamera} disabled={phase === "reading" || phase === "loading"}>
                Use the camera
              </button>
            ) : (
              <button className="action" onClick={stopCamera}>
                Stop and write the score
              </button>
            )}
          </div>
          <div aria-live="polite" className="status">
            {phase === "loading" && <p>Loading the pose model.</p>}
            {phase === "reading" && (
              <p>
                Reading frame {progress.done} of {progress.total}.
              </p>
            )}
            {error && <p className="error">{error}</p>}
            {phase === "done" && score && (
              <>
                <p>
                  Written: <strong>{score.symbols.length} symbols</strong> at {score.tempo} counts per minute.
                </p>
                {agreement && (
                  <p>
                    Against the motion capture of the same take (lined up by {agreement.offsetSeconds.toFixed(1)} s), the
                    arms hold the same direction and level in <strong>{Math.round(agreement.exact * 100)}%</strong> of{" "}
                    {agreement.samples} checks, and the same or a neighbouring one in{" "}
                    <strong>{Math.round(agreement.near * 100)}%</strong>.
                  </p>
                )}
                <button className="action" onClick={() => openId && onOpen(openId)}>
                  Watch the score
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
