"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/client-api";
import {
  capacityStatusSchema,
  type CapacityLane,
  type CapacityStatus,
} from "@/lib/ai/capacity-status";
import "./pilot-capacity.css";

const number = (value: number | undefined) =>
  value === undefined ? "Not observed" : value.toLocaleString("en-US");
function Lane({ lane }: { lane: CapacityLane }) {
  const latest = lane.latest;
  return (
    <article className="pilot-capacity-lane">
      <h3>{lane.lane === "text" ? "Answer reviews" : "Voice transcription"}</h3>
      <dl>
        <div>
          <dt>Processing now</dt>
          <dd>
            {lane.active} / {lane.maxConcurrent}
          </dd>
        </div>
        <div>
          <dt>App requests this minute</dt>
          <dd>
            {lane.requestsInMinute} / {lane.requestsPerMinute}
          </dd>
        </div>
        <div>
          <dt>Provider cooldown</dt>
          <dd>
            {lane.cooldownSeconds
              ? `${Math.ceil(lane.cooldownSeconds)} sec`
              : "None observed"}
          </dd>
        </div>
        <div>
          <dt>Provider requests remaining / day</dt>
          <dd>
            {number(latest?.requestsPerDayRemaining)}
            {latest?.requestsPerDayLimit !== undefined &&
              ` / ${number(latest.requestsPerDayLimit)}`}
          </dd>
        </div>
        <div>
          <dt>Provider tokens remaining / minute</dt>
          <dd>
            {number(latest?.tokensPerMinuteRemaining)}
            {latest?.tokensPerMinuteLimit !== undefined &&
              ` / ${number(latest.tokensPerMinuteLimit)}`}
          </dd>
        </div>
        {latest && (
          <div>
            <dt>Latest provider response</dt>
            <dd>
              {(latest.latencyMs / 1000).toFixed(1)} sec · HTTP {latest.status}
            </dd>
          </div>
        )}
      </dl>
      <p className="pilot-capacity-observed">
        {latest ? (
          <>
            Observed{" "}
            <time dateTime={latest.observedAt}>
              {new Date(latest.observedAt).toLocaleString("en-US", {
                timeZone: "America/Chicago",
              })}{" "}
              CT
            </time>
            .
          </>
        ) : (
          "No provider response observed yet."
        )}
      </p>
    </article>
  );
}

export function PilotCapacity() {
  const [snapshot, setSnapshot] = useState<CapacityStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const current = useRef<AbortController | null>(null);
  const read = useCallback((controller: AbortController) => {
    void api<unknown>("/api/staff/capacity", undefined, controller.signal)
      .then((data) => {
        const parsed = capacityStatusSchema.parse(data);
        if (!controller.signal.aborted) {
          setSnapshot(parsed);
          setError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          current.current = null;
          setBusy(false);
        }
      });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    current.current = controller;
    read(controller);
    return () => {
      current.current?.abort();
      current.current = null;
    };
  }, [read]);
  function refresh() {
    if (current.current) return;
    const controller = new AbortController();
    current.current = controller;
    setBusy(true);
    setError(false);
    read(controller);
  }
  return (
    <section
      className="pilot-capacity"
      aria-labelledby="pilot-capacity-title"
      aria-busy={busy}
    >
      <div className="pilot-capacity-heading">
        <div>
          <span className="eyebrow">SERVICE CAPACITY</span>
          <h2 id="pilot-capacity-title">Know the current limits.</h2>
        </div>
        <button className="button secondary" onClick={refresh} disabled={busy}>
          <RefreshCw size={16} aria-hidden="true" />
          {busy ? "Checking…" : "Refresh capacity"}
        </button>
      </div>
      <p className="pilot-capacity-note">
        App safeguards control traffic. Provider counters come from the latest
        real response; they are not a guarantee of school-wide capacity.
      </p>
      <p role="status" className="pilot-capacity-status">
        {error ? (
          "Capacity could not be refreshed. Any figures below are from the last check."
        ) : busy ? (
          "Checking capacity…"
        ) : snapshot?.available ? (
          <>
            Checked{" "}
            <time dateTime={snapshot.checkedAt}>
              {new Date(snapshot.checkedAt).toLocaleString("en-US", {
                timeZone: "America/Chicago",
              })}{" "}
              CT
            </time>
            . Refresh to update.
          </>
        ) : (
          "Capacity monitoring is unavailable. Provider limits remain unverified."
        )}
      </p>
      {snapshot?.available && (
        <div className="pilot-capacity-grid">
          {snapshot.lanes.map((lane) => (
            <Lane key={lane.lane} lane={lane} />
          ))}
        </div>
      )}
      <p className="pilot-capacity-note">
        Daily token and audio-hour limits, and school signup limits, need
        separate verification. Refreshing this panel does not call the AI
        provider.
      </p>
    </section>
  );
}
