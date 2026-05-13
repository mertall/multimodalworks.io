"""Export real first-token latency aggregates from a local Langfuse install.

Reads traces from the local Langfuse API, buckets them by task category, and
writes assets/data/latency_benchmark.json so the website chart renders against
your actual deployment instead of public benchmark fallbacks.

Usage
-----
1. Set environment variables for your local Langfuse:

       export LANGFUSE_HOST="http://langfuse.localhost:8443"
       export LANGFUSE_PUBLIC_KEY="pk-..."
       export LANGFUSE_SECRET_KEY="sk-..."

   (These are the same values your local-ai-station LiteLLM configuration
   uses when forwarding traces to Langfuse.)

2. Tag your traces with one of the task categories the chart understands:
       chat · RAG 8d · code · agent

   For LiteLLM, the simplest path is to set `metadata = {"task": "chat"}`
   on each request from the agent layer.

3. Run:

       python scripts/run_langfuse_export.py --since 7d

   The script aggregates p50 TTFT across the window and rewrites
   assets/data/latency_benchmark.json with provenance pointing at your
   Langfuse host.

The website's `localLatency` D3 IIFE fetches that JSON on page load — the
chart will reflect your own numbers as soon as the file is updated.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import statistics
import sys
from pathlib import Path

try:
    from langfuse import Langfuse
except ImportError:  # pragma: no cover - dependency hint only
    sys.stderr.write(
        "langfuse-python is required. Install with `pip install langfuse`.\n"
    )
    sys.exit(2)


REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = REPO_ROOT / "assets" / "data" / "latency_benchmark.json"

# The chart expects these task buckets; we group traces by their metadata tag.
TASK_BUCKETS = ["chat", "RAG 8d", "code", "agent"]


def parse_window(spec: str) -> dt.timedelta:
    """Accept things like 24h, 7d, 30d."""
    if spec.endswith("h"):
        return dt.timedelta(hours=int(spec[:-1]))
    if spec.endswith("d"):
        return dt.timedelta(days=int(spec[:-1]))
    raise ValueError(f"Unknown window spec: {spec!r}")


def first_token_ms(observation) -> float | None:
    """Pull the TTFT from a Langfuse observation if present.

    Langfuse stores token-level timings on `time_to_first_token` for streaming
    generations. If absent, fall back to total latency (less accurate but
    still bounded).
    """
    ttft = getattr(observation, "time_to_first_token", None)
    if ttft is not None:
        return float(ttft) * 1000.0
    latency = getattr(observation, "latency", None)
    if latency is not None:
        return float(latency) * 1000.0
    return None


def aggregate(
    client: Langfuse,
    window: dt.timedelta,
    cloud_provider_tag: str,
) -> dict[str, dict[str, float]]:
    """Return {task: {cloud: p50_ms, local: p50_ms}} aggregates."""
    since = dt.datetime.utcnow() - window

    samples: dict[str, dict[str, list[float]]] = {
        t: {"cloud": [], "local": []} for t in TASK_BUCKETS
    }

    # The Langfuse API returns paginated traces; iterate until exhausted.
    page = 1
    while True:
        resp = client.api.trace.list(
            from_timestamp=since.isoformat(),
            page=page,
            limit=100,
        )
        if not resp.data:
            break
        for trace in resp.data:
            task = (trace.metadata or {}).get("task")
            if task not in samples:
                continue
            backend = (trace.metadata or {}).get("backend", "local")
            bucket = "cloud" if backend == cloud_provider_tag else "local"
            for obs in trace.observations or []:
                t = first_token_ms(obs)
                if t is not None:
                    samples[task][bucket].append(t)
        if len(resp.data) < 100:
            break
        page += 1

    out: dict[str, dict[str, float]] = {}
    for task, sides in samples.items():
        out[task] = {
            side: round(statistics.median(vals), 0) if vals else None
            for side, vals in sides.items()
        }
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--since",
        default="7d",
        help="Time window to aggregate over (e.g. 24h, 7d, 30d).",
    )
    parser.add_argument(
        "--cloud-tag",
        default="openai",
        help="trace.metadata.backend value that identifies cloud-routed calls.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print aggregates without writing JSON.",
    )
    args = parser.parse_args()

    host = os.environ.get("LANGFUSE_HOST")
    pk = os.environ.get("LANGFUSE_PUBLIC_KEY")
    sk = os.environ.get("LANGFUSE_SECRET_KEY")
    if not (host and pk and sk):
        sys.stderr.write(
            "LANGFUSE_HOST, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY must be set.\n"
        )
        return 2

    client = Langfuse(host=host, public_key=pk, secret_key=sk)
    window = parse_window(args.since)
    agg = aggregate(client, window, args.cloud_tag)

    datasets = []
    for task in TASK_BUCKETS:
        cloud_v = agg[task]["cloud"]
        local_v = agg[task]["local"]
        datasets.append(
            {
                "task": task,
                "description": f"Aggregated from Langfuse traces · last {args.since}",
                "cloud": {
                    "value_ms": cloud_v,
                    "source": f"Langfuse · {host} · {args.since} window",
                }
                if cloud_v is not None
                else None,
                "local": {
                    "value_ms": local_v,
                    "source": f"Langfuse · {host} · {args.since} window",
                }
                if local_v is not None
                else None,
            }
        )

    payload = {
        "schema_version": "1",
        "generated_at": dt.datetime.utcnow().strftime("%Y-%m-%d"),
        "methodology": (
            f"First-token latency (TTFT) in milliseconds, median over the last "
            f"{args.since}. Traces collected from {host} on the Local AI Station "
            f"deployment."
        ),
        "source_label": f"your Langfuse · last {args.since}",
        "sources": [
            {
                "name": "Langfuse local instance",
                "url": host,
                "captured": dt.datetime.utcnow().strftime("%Y-%m-%d"),
            }
        ],
        "datasets": datasets,
    }

    if args.dry_run:
        json.dump(payload, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0

    OUT_PATH.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"wrote {OUT_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
