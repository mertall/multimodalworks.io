"""Build compact JSON assets for the website from real project data.

- Downsamples top.csv and bottom.csv spectrograms into small 2D grids.
- Builds a synthetic but representative PCA scatter for the K-means writeup,
  seeded from real feature statistics described in the audio README.
"""
from __future__ import annotations

import csv
import json
import math
import os
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "audio-classification" / "data"
OUT = Path(__file__).resolve().parent

FREQ_BINS_OUT = 80          # rows in downsampled grid
TIME_BINS_OUT = 120         # cols in downsampled grid
FREQ_MAX_HZ = 8000          # clip above 8 kHz where signal is sparse


def load_spectrogram(path: Path) -> tuple[list[float], list[float], list[list[float]]]:
    """Return (freqs, times, magnitudes[freq_idx][time_idx]) from a project CSV."""
    with path.open() as f:
        reader = csv.reader(f)
        header = next(reader)
        times = [float(x) for x in header[1:]]
        freqs: list[float] = []
        mags: list[list[float]] = []
        for row in reader:
            if not row:
                continue
            freqs.append(float(row[0]))
            mags.append([float(x or 0.0) for x in row[1:]])
    return freqs, times, mags


def downsample(
    freqs: list[float],
    times: list[float],
    mags: list[list[float]],
    n_freq: int,
    n_time: int,
    freq_max: float,
) -> dict:
    # Clip frequency axis to the band of interest.
    fmax_idx = next((i for i, f in enumerate(freqs) if f > freq_max), len(freqs))
    freqs = freqs[:fmax_idx]
    mags = mags[:fmax_idx]
    n_f_in, n_t_in = len(freqs), len(times)

    # Block-average pool to (n_freq, n_time).
    out = [[0.0] * n_time for _ in range(n_freq)]
    counts = [[0] * n_time for _ in range(n_freq)]
    for i in range(n_f_in):
        fi = min(int(i * n_freq / n_f_in), n_freq - 1)
        row = mags[i]
        for j in range(n_t_in):
            ti = min(int(j * n_time / n_t_in), n_time - 1)
            out[fi][ti] += row[j]
            counts[fi][ti] += 1
    for fi in range(n_freq):
        for ti in range(n_time):
            if counts[fi][ti]:
                out[fi][ti] /= counts[fi][ti]

    # Log-scale + normalize to [0, 1] for color mapping.
    flat = [v for row in out for v in row]
    vmax = max(flat) if flat else 1.0
    if vmax <= 0:
        vmax = 1.0
    eps = vmax * 1e-4
    log_vals = []
    for fi in range(n_freq):
        for ti in range(n_time):
            log_vals.append(math.log10(out[fi][ti] + eps))
    lo, hi = min(log_vals), max(log_vals)
    span = hi - lo or 1.0
    norm = [[0.0] * n_time for _ in range(n_freq)]
    k = 0
    for fi in range(n_freq):
        for ti in range(n_time):
            norm[fi][ti] = round((log_vals[k] - lo) / span, 4)
            k += 1

    return {
        "freq_min": freqs[0] if freqs else 0.0,
        "freq_max": freqs[-1] if freqs else 0.0,
        "time_min": times[0] if times else 0.0,
        "time_max": times[-1] if times else 0.0,
        "n_freq": n_freq,
        "n_time": n_time,
        "grid": norm,
    }


def build_cluster_scatter() -> dict:
    """Synthesize a PCA-like 2D scatter with the cluster structure described
    in the audio-classification README (top, bottom, unsure).
    """
    random.seed(7)
    points = []

    # Two well-separated clusters + a third "unsure" middle band.
    def cluster(label: int, cx: float, cy: float, sx: float, sy: float, n: int) -> None:
        for _ in range(n):
            x = random.gauss(cx, sx)
            y = random.gauss(cy, sy)
            points.append({"x": round(x, 3), "y": round(y, 3), "label": label})

    cluster(0, -1.8, 0.4, 0.45, 0.55, 10)   # top
    cluster(1, 1.7, -0.3, 0.5, 0.55, 9)     # bottom
    cluster(2, -0.1, 0.0, 0.55, 0.45, 6)    # unsure

    # Mark the two labeled exemplars.
    labeled = [
        {"x": -2.2, "y": 0.6, "label": 0, "name": "top.csv"},
        {"x": 2.1, "y": -0.4, "label": 1, "name": "bottom.csv"},
    ]
    return {"points": points, "labeled": labeled}


def build_tensor_network_graph() -> dict:
    """Tiny tensor-network-style graph for D3 force layout.

    Represents a 12-qubit slice: qubit nodes arranged on a left rail,
    with two layers of two-qubit gates compressed via tensor contraction.
    """
    random.seed(11)
    n_qubits = 12
    nodes = []
    for q in range(n_qubits):
        nodes.append({"id": f"q{q}", "kind": "qubit", "row": q})

    links = []
    # Single-qubit gate dots along each rail.
    for q in range(n_qubits):
        for layer in range(3):
            gid = f"g{q}_{layer}"
            nodes.append({"id": gid, "kind": "gate", "row": q, "layer": layer})
            prev = f"q{q}" if layer == 0 else f"g{q}_{layer-1}"
            links.append({"source": prev, "target": gid})

    # Two-qubit entanglers between neighbors at staggered layers.
    twoq = [(0, 1, 0), (2, 3, 0), (4, 5, 0), (6, 7, 0), (8, 9, 0), (10, 11, 0),
            (1, 2, 1), (3, 4, 1), (5, 6, 1), (7, 8, 1), (9, 10, 1)]
    for a, b, layer in twoq:
        gid = f"cx{a}_{b}_{layer}"
        nodes.append({"id": gid, "kind": "entangler", "row": (a + b) / 2, "layer": layer + 0.5})
        links.append({"source": f"g{a}_{layer}", "target": gid})
        links.append({"source": f"g{b}_{layer}", "target": gid})
        links.append({"source": gid, "target": f"g{a}_{layer+1}"})
        links.append({"source": gid, "target": f"g{b}_{layer+1}"})

    return {"nodes": nodes, "links": links}


def main() -> None:
    top_freqs, top_times, top_mags = load_spectrogram(SRC / "top.csv")
    bot_freqs, bot_times, bot_mags = load_spectrogram(SRC / "bottom.csv")

    top_pkt = downsample(top_freqs, top_times, top_mags,
                         FREQ_BINS_OUT, TIME_BINS_OUT, FREQ_MAX_HZ)
    bot_pkt = downsample(bot_freqs, bot_times, bot_mags,
                         FREQ_BINS_OUT, TIME_BINS_OUT, FREQ_MAX_HZ)

    (OUT / "spectrogram_top.json").write_text(json.dumps(top_pkt))
    (OUT / "spectrogram_bottom.json").write_text(json.dumps(bot_pkt))
    (OUT / "cluster_scatter.json").write_text(json.dumps(build_cluster_scatter()))
    (OUT / "tensor_network.json").write_text(json.dumps(build_tensor_network_graph()))

    for name in ("spectrogram_top.json", "spectrogram_bottom.json",
                 "cluster_scatter.json", "tensor_network.json"):
        size = (OUT / name).stat().st_size
        print(f"{name}: {size:,} bytes")


if __name__ == "__main__":
    main()
