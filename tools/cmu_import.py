"""Convert CMU Graphics Lab motion capture (ASF skeleton + AMC motion) into Danse Macabre clip JSON.

    python tools/cmu_import.py --asf 143.asf --amc 143_35.amc --id macarena --title "Macarena" \
        --description "Macarena Dance" --out data/clips/macarena.json [--fps 30]

Output: right-handed metres, y up. Joints follow `packages/core` JointName. Source: mocap.cs.cmu.edu
(free for all uses, no resale; created with funding from NSF EIA-0196217).
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np

# ASF lengths are in inches scaled by 1/0.45 (":units length 0.45").
LENGTH_TO_M = (1.0 / 0.45) * 0.0254

JOINTS = {
    "pelvis": ("root", "start"),
    "left-hip": ("lhipjoint", "end"),
    "right-hip": ("rhipjoint", "end"),
    "left-knee": ("lfemur", "end"),
    "right-knee": ("rfemur", "end"),
    "left-ankle": ("ltibia", "end"),
    "right-ankle": ("rtibia", "end"),
    "left-shoulder": ("lclavicle", "end"),
    "right-shoulder": ("rclavicle", "end"),
    "left-elbow": ("lhumerus", "end"),
    "right-elbow": ("rhumerus", "end"),
    "left-wrist": ("lradius", "end"),
    "right-wrist": ("rradius", "end"),
    "neck": ("lowerneck", "end"),
    "head": ("head", "end"),
}


def rot(axis: str, deg: float) -> np.ndarray:
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    if axis == "x":
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == "y":
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def euler(order: str, values: dict[str, float]) -> np.ndarray:
    """Rotation for angles applied in `order` (e.g. "XYZ": x first), as a matrix acting on column vectors."""
    m = np.eye(3)
    for ax in order.lower():
        m = rot(ax, values.get(ax, 0.0)) @ m
    return m


def parse_asf(path: Path) -> dict:
    lines = [ln.strip() for ln in path.read_text(encoding="latin-1").splitlines()]
    bones: dict[str, dict] = {}
    root = {"order": [], "axis": "XYZ", "position": [0, 0, 0], "orientation": [0, 0, 0]}
    hierarchy: dict[str, list[str]] = {}
    section = None
    cur: dict | None = None
    for ln in lines:
        if ln.startswith(":"):
            section = ln.split()[0]
            continue
        if section == ":root":
            parts = ln.split()
            if parts and parts[0] == "order":
                root["order"] = [p.lower() for p in parts[1:]]
            elif parts and parts[0] == "axis":
                root["axis"] = parts[1]
            elif parts and parts[0] in ("position", "orientation"):
                root[parts[0]] = [float(p) for p in parts[1:4]]
        elif section == ":bonedata":
            parts = ln.split()
            if not parts:
                continue
            if parts[0] == "begin":
                cur = {"dof": []}
            elif parts[0] == "end" and cur is not None:
                bones[cur["name"]] = cur
                cur = None
            elif cur is not None:
                if parts[0] == "name":
                    cur["name"] = parts[1]
                elif parts[0] == "direction":
                    cur["direction"] = np.array([float(p) for p in parts[1:4]])
                elif parts[0] == "length":
                    cur["length"] = float(parts[1]) * LENGTH_TO_M
                elif parts[0] == "axis":
                    cur["axis"] = [float(p) for p in parts[1:4]]
                    cur["axis_order"] = parts[4]
                elif parts[0] == "dof":
                    cur["dof"] = [p.lower() for p in parts[1:]]
        elif section == ":hierarchy":
            parts = ln.split()
            if parts and parts[0] not in ("begin", "end"):
                hierarchy[parts[0]] = parts[1:]
    for b in bones.values():
        ax = dict(zip("xyz", b["axis"]))
        b["C"] = euler(b["axis_order"], ax)
        b["Cinv"] = b["C"].T
    return {"bones": bones, "root": root, "hierarchy": hierarchy}


def parse_amc(path: Path) -> list[dict[str, list[float]]]:
    frames: list[dict[str, list[float]]] = []
    cur: dict[str, list[float]] | None = None
    for ln in path.read_text(encoding="latin-1").splitlines():
        ln = ln.strip()
        if not ln or ln.startswith("#") or ln.startswith(":"):
            continue
        parts = ln.split()
        if len(parts) == 1 and parts[0].isdigit():
            cur = {}
            frames.append(cur)
        elif cur is not None:
            cur[parts[0]] = [float(p) for p in parts[1:]]
    return frames


def pose(skel: dict, motion: dict[str, list[float]]) -> dict[str, np.ndarray]:
    bones, root, hier = skel["bones"], skel["root"], skel["hierarchy"]
    rvals = motion["root"]
    named = dict(zip(root["order"], rvals))
    tx, ty, tz = (named.get(k, 0.0) for k in ("tx", "ty", "tz"))
    root_pos = np.array([tx, ty, tz]) * LENGTH_TO_M
    root_rot = euler(root["axis"], {k[1]: v for k, v in named.items() if k.startswith("r")})
    ends: dict[str, np.ndarray] = {"root": root_pos}
    mats: dict[str, np.ndarray] = {"root": root_rot}

    def visit(parent: str) -> None:
        for child in hier.get(parent, []):
            b = bones[child]
            vals = dict(zip([d[1] for d in b["dof"]], motion.get(child, [])))
            m = euler("XYZ", vals)
            mats[child] = mats[parent] @ b["C"] @ m @ b["Cinv"]
            ends[child] = ends[parent] + b["length"] * (mats[child] @ b["direction"])
            visit(child)

    visit("root")
    return ends


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--asf", required=True)
    ap.add_argument("--amc", required=True)
    ap.add_argument("--id", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--description", required=True)
    ap.add_argument("--subject", required=True)
    ap.add_argument("--trial", required=True)
    ap.add_argument("--source-fps", type=float, default=120.0)
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--start", type=float, default=0.0, help="seconds to skip")
    ap.add_argument("--seconds", type=float, default=0.0, help="clip length, 0 = all")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    skel = parse_asf(Path(args.asf))
    motion = parse_amc(Path(args.amc))
    step = args.source_fps / args.fps
    first = int(round(args.start * args.source_fps))
    last = len(motion) if args.seconds <= 0 else min(len(motion), first + int(round(args.seconds * args.source_fps)))
    names = list(JOINTS)
    out_frames = []
    i = float(first)
    while int(round(i)) < last:
        ends = pose(skel, motion[int(round(i))])
        row = []
        for name in names:
            bone, where = JOINTS[name]
            p = ends[bone] if where == "end" else ends["root"]
            row.append([round(float(v), 4) for v in p])
        out_frames.append(row)
        i += step
    # Put the floor at y = 0: lowest ankle over the clip, minus a typical ankle height of 8 cm.
    arr = np.array(out_frames)
    ankle_idx = [names.index("left-ankle"), names.index("right-ankle")]
    floor = float(arr[:, ankle_idx, 1].min()) - 0.08
    arr[:, :, 1] -= floor
    clip = {
        "id": args.id,
        "title": args.title,
        "source": {
            "database": "CMU Graphics Lab Motion Capture Database",
            "url": "http://mocap.cs.cmu.edu/",
            "subject": args.subject,
            "trial": args.trial,
            "description": args.description,
            "licence": "Free for all uses; may not be resold. Created with funding from NSF EIA-0196217.",
        },
        "fps": args.fps,
        "joints": names,
        "frames": [[[round(float(v), 4) for v in j] for j in f] for f in arr],
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(clip, separators=(",", ":")), encoding="utf-8")
    print(f"{args.id}: {len(out_frames)} frames at {args.fps} fps, {len(out_frames) / args.fps:.1f} s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
