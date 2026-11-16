import { announceSessionChange } from "@/lib/session-events";
export async function signInStaff(email: string, password: string) {
  let response: Response;
  try {
    response = await fetch("/api/staff/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "We couldn’t connect to staff sign-in. Your password is still entered. Check your connection and try again.",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Staff sign-in is temporarily unavailable. Your password is still entered; please try again.",
    );
  }
  if (!response.ok) {
    const error =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Staff sign-in could not be completed. Please try again.";
    throw new Error(error);
  }
  if (
    typeof data !== "object" ||
    data === null ||
    !("success" in data) ||
    data.success !== true
  )
    throw new Error(
      "Your staff session could not be confirmed. Please try again.",
    );
  announceSessionChange();
}

export async function signOutStaff() {
  try {
    const response = await fetch("/api/staff/logout", {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    const data: unknown = await response.json();
    if (
      !response.ok ||
      typeof data !== "object" ||
      data === null ||
      !("success" in data) ||
      data.success !== true
    )
      throw new Error("Unconfirmed logout");
    announceSessionChange();
  } catch {
    throw new Error(
      "Unable to confirm sign-out. Please retry before leaving this device.",
    );
  }
}
