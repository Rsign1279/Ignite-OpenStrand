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
  ).toContain("wait a minute");
  expect(
    studentAccessMessage(new AuthApiError("Captcha", 400, "captcha_failed")),
  ).toContain("could not complete its verification");
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
