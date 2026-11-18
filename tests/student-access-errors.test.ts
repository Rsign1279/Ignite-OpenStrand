import { expect, it } from "vitest";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { studentAccessMessage } from "@/lib/student-access-errors";

it("distinguishes an unreachable auth service from disabled student signup", () => {
  expect(
    studentAccessMessage(new AuthRetryableFetchError("Failed to fetch", 0)),
  ).toContain("couldn't reach student sign-in");
  expect(
    studentAccessMessage(
      new AuthApiError(
        "Anonymous sign-ins are disabled",
        422,
        "anonymous_provider_disabled",
      ),
    ),
  ).toContain("not ready on this site");
});

it("offers appropriate recovery for signup throttling and verification", () => {
  expect(
    studentAccessMessage(
      new AuthApiError("Rate limit", 429, "over_request_rate_limit"),
    ),
  ).toContain("wait before retrying");
  expect(
    studentAccessMessage(new AuthApiError("Captcha", 400, "captcha_failed")),
  ).toContain("could not complete its verification");
});

it.each([
  new AuthRetryableFetchError("Failed to fetch", 0),
  new AuthRetryableFetchError("Service temporarily unavailable", 503),
  new TypeError("Load failed"),
  { status: 0 },
])("gives safe school support steps for unreachable sign-in: %j", (error) => {
  const message = studentAccessMessage(error);

  expect(message).toContain("Your details are still here. Try again.");
  expect(message).toContain(
    "If this continues at school, ask your advisor or school IT to check sign-in access.",
  );
  expect(message).not.toMatch(/VPN|proxy|disable|bypass|different network/i);
});

it("does not treat a blocked connection as a confirmed school filter diagnosis", () => {
  const message = studentAccessMessage(
    new AuthRetryableFetchError("PRIVATE_FILTER_PAGE_AND_TOKEN", 0),
  );

  expect(message).not.toContain("PRIVATE_FILTER_PAGE_AND_TOKEN");
  expect(message).not.toMatch(
    /school (?:filter|network) (?:is|has)|blocked by/i,
  );
});

it("keeps known access, rate-limit, and verification errors distinct from network support", () => {
  for (const error of [
    { name: "TypeError", code: "anonymous_provider_disabled" },
    { name: "AuthRetryableFetchError", status: 403 },
    { name: "AuthRetryableFetchError", status: 429 },
    { name: "TypeError", code: "captcha_failed" },
  ]) {
    expect(studentAccessMessage(error)).not.toContain("school IT");
  }
});

it("never reflects provider messages, private fields, or unexpected payloads", () => {
  const secret = "PRIVATE_PROVIDER_DETAIL";
  for (const value of [
    null,
    secret,
    new Error(secret),
    { code: secret, status: 500, message: secret, token: secret },
    { status: 401, message: secret },
  ]) {
    expect(studentAccessMessage(value)).not.toContain(secret);
    expect(studentAccessMessage(value)).toContain(
      "Your details are still here",
    );
  }
});
