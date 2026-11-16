// An identity pin is not an authorization credential. The server verifies the
// cookie session first, then rejects a request from a stale shared-device tab.
export const STUDENT_SESSION_HEADER = "X-Student-Session";
export const SESSION_CHANGED_MESSAGE =
  "This student session changed in another tab. Start a new session to keep each student's practice separate.";
