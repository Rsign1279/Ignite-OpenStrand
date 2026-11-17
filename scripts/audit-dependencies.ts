import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

type Advisory = {
  source: number;
  url: string;
  severity: string;
  range: string;
};
type Vulnerability = {
  severity: string;
  nodes: string[];
  via: (string | Advisory)[];
};
type Audit = {
  error?: unknown;
  metadata?: unknown;
  vulnerabilities?: Record<string, Vulnerability>;
};
type Lock = { packages: Record<string, { dev?: boolean; version?: string }> };
type Exception = {
  advisory: string;
  source: number;
  severity: string;
  range: string;
  package: string;
  latestReviewedVersion: string;
  reviewedInstalledVersions: string[];
  expiresAt: string;
};

/** A single reviewed, development-only advisory; all other serious findings block. */
export function reviewAudit(
  audit: Audit,
  lock: Lock,
  exception: Exception,
  latestVersion: string,
  now: number,
) {
  const blocked: string[] = [],
    allowed: string[] = [];
  if (
    !audit ||
    audit.error ||
    !audit.metadata ||
    !audit.vulnerabilities ||
    !lock?.packages
  ) {
    return { blocked: ["Unable to verify the dependency audit."], allowed };
  }
  const vulnerabilities = audit.vulnerabilities;
  const deadline = Date.parse(exception.expiresAt);
  const exceptionActive =
    Number.isFinite(deadline) &&
    now <= deadline &&
    latestVersion === exception.latestReviewedVersion;
  const reviewedChain = (name: string, path = new Set<string>()): boolean => {
    const v = vulnerabilities[name];
    if (
      !exceptionActive ||
      path.has(name) ||
      !v ||
      v.severity !== exception.severity ||
      !Array.isArray(v.nodes) ||
      !v.nodes.length ||
      !Array.isArray(v.via) ||
      !v.via.length
    )
      return false;
    if (!v.nodes.every((node) => lock.packages[node]?.dev === true))
      return false;
    if (
      name === exception.package &&
      !v.nodes.every((node) =>
        exception.reviewedInstalledVersions.includes(
          lock.packages[node]?.version ?? "",
        ),
      )
    )
      return false;
    const next = new Set(path).add(name);
    return v.via.every((via) =>
      typeof via === "string"
        ? reviewedChain(via, next)
        : via.source === exception.source &&
          via.url === exception.advisory &&
          via.severity === exception.severity &&
          via.range.replace(/\s/g, "") === exception.range,
    );
  };
  for (const [name, v] of Object.entries(vulnerabilities)) {
    if (v.severity === "info" || v.severity === "low") continue;
    (reviewedChain(name) ? allowed : blocked).push(name);
  }
  return { blocked, allowed };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  // Production vulnerabilities never receive an exception.
  execFileSync("npm", ["audit", "--omit=dev", "--audit-level=moderate"], {
    stdio: "inherit",
  });
  let raw: string;
  try {
    raw = execFileSync("npm", ["audit", "--json"], {
      encoding: "utf8",
      maxBuffer: 10_000_000,
    });
  } catch (error) {
    const failure = error as { status?: number; stdout?: string };
    if (failure.status !== 1 || typeof failure.stdout !== "string") throw error;
    raw = failure.stdout;
  }
  const audit = JSON.parse(raw) as Audit;
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as Lock;
  const exception = JSON.parse(
    readFileSync("security/audit-exceptions.json", "utf8"),
  ) as Exception;
  const latest = JSON.parse(
    execFileSync("npm", ["view", exception.package, "version", "--json"], {
      encoding: "utf8",
    }),
  ) as string;
  const result = reviewAudit(audit, lock, exception, latest, Date.now());
  if (result.blocked.length)
    throw new Error(
      `Dependency audit blocked: ${result.blocked.join(", ")}. Review the audit and security/DEPENDENCY-REVIEW.md.`,
    );
  if (result.allowed.length) {
    console.log(
      `Temporary development-only exception: ${exception.advisory}; ${result.allowed.length} affected tooling packages; expires ${exception.expiresAt}. Production dependencies passed. This advisory is not fixed.`,
    );
  } else console.log("Dependency audit passed without exceptions.");
}
