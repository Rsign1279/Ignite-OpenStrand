import { expect, it } from "vitest";
import { reviewAudit } from "../scripts/audit-dependencies";
import exception from "../security/audit-exceptions.json";
const now = Date.parse("2026-11-17T12:00:00Z");
const make = () => ({
  audit: {
    metadata: {},
    vulnerabilities: {
      picomatch: {
        severity: "high",
        nodes: ["node_modules/picomatch"],
        via: [
          {
            source: 1247710,
            url: exception.advisory,
            severity: "high",
            range: "<=4.0.7",
          },
        ],
      },
      linter: {
        severity: "high",
        nodes: ["node_modules/linter"],
        via: ["picomatch"],
      },
    },
  },
  lock: {
    packages: {
      "node_modules/picomatch": { dev: true, version: "4.0.7" },
      "node_modules/linter": { dev: true, version: "1.0.0" },
    },
  },
});
it("allows only the reviewed development-only advisory and its dependency chain", () => {
  const { audit, lock } = make();
  expect(reviewAudit(audit, lock, exception, "4.0.7", now)).toEqual({
    allowed: ["picomatch", "linter"],
    blocked: [],
  });
});
it("blocks the same advisory when any affected package is a production dependency", () => {
  const { audit, lock } = make();
  lock.packages["node_modules/picomatch"].dev = false;
  expect(reviewAudit(audit, lock, exception, "4.0.7", now).blocked).toEqual([
    "picomatch",
    "linter",
  ]);
});
it.each([
  "https://github.com/advisories/GHSA-other",
  "https://github.com/advisories/GHSA-fc5q-39xc-vjpf?other",
])("blocks unrelated advisories (%s)", (url) => {
  const { audit, lock } = make();
  const via = audit.vulnerabilities.picomatch.via[0];
  via.url = url;
  expect(
    reviewAudit(audit, lock, exception, "4.0.7", now).blocked,
  ).toHaveLength(2);
});
it("expires rather than silently accepting a permanent exception", () => {
  const { audit, lock } = make();
  expect(
    reviewAudit(
      audit,
      lock,
      exception,
      "4.0.7",
      Date.parse("2026-12-02T00:00:00Z"),
    ).blocked,
  ).toHaveLength(2);
});
it("requires review when a new picomatch release or unreviewed installed version appears", () => {
  const { audit, lock } = make();
  expect(
    reviewAudit(audit, lock, exception, "4.0.8", now).blocked,
  ).toHaveLength(2);
  lock.packages["node_modules/picomatch"].version = "3.0.1";
  expect(
    reviewAudit(audit, lock, exception, "4.0.7", now).blocked,
  ).toHaveLength(2);
});
it("rejects increased severity, unknown dependency chains, and unusable audit responses", () => {
  const { audit, lock } = make();
  audit.vulnerabilities.picomatch.severity = "critical";
  expect(
    reviewAudit(audit, lock, exception, "4.0.7", now).blocked,
  ).toHaveLength(2);
  audit.vulnerabilities.linter.via = ["missing-package"];
  expect(
    reviewAudit(audit, lock, exception, "4.0.7", now).blocked,
  ).toHaveLength(2);
  expect(
    reviewAudit({ error: "unavailable" }, lock, exception, "4.0.7", now)
      .blocked,
  ).not.toHaveLength(0);
});
it("needs no exception when the full audit is clear", () => {
  const { lock } = make();
  expect(
    reviewAudit(
      { metadata: {}, vulnerabilities: {} },
      lock,
      exception,
      "4.0.8",
      now,
    ),
  ).toEqual({ allowed: [], blocked: [] });
});
