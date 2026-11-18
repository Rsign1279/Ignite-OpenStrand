import { profileSchema, type Profile } from "@/lib/validation";
import { studentAccessMessage } from "@/lib/student-access-errors";
import { SESSION_CHANGED_MESSAGE } from "@/lib/student-session";

/** Kept only in this tab's memory, and only until its registration completes. */
export type PendingRegistration = {
  identity: string;
  initialProfile: Readonly<Profile>;
};

type Identity = { id: string; is_anonymous?: boolean };
export type RegistrationAuth = {
  signOut(options: { scope: "local" }): Promise<{ error: unknown }>;
  signInAnonymously(): Promise<{
    data: { user: Identity | null };
    error: unknown;
  }>;
  getSession(): Promise<{
    data: { session: { user: Identity } | null };
    error?: unknown;
  }>;
};

type RegistrationOptions = {
  auth: RegistrationAuth;
  pending: PendingRegistration | null;
  desiredProfile: Readonly<Profile>;
  isCurrent: () => boolean;
  onPending: (pending: PendingRegistration | null) => void;
  readProfile: (identity: string) => Promise<{
    profile: Profile | null;
    sessionIdentity: string | null;
  }>;
  writeProfile: (
    identity: string,
    profile: Profile,
  ) => Promise<{ sessionIdentity: string | null }>;
};

const sameProfile = (left: Readonly<Profile>, right: Readonly<Profile>) =>
  left.name === right.name &&
  left.strand === right.strand &&
  left.ignite_year === right.ignite_year;

/**
 * A failed profile write can reuse its own anonymous identity. An ordinary fresh
 * registration still ends the prior local session instead of adopting it.
 */
export async function registerWithRecovery(options: RegistrationOptions) {
  const { auth, isCurrent, onPending, readProfile, writeProfile } = options;
  // Snapshot before any await: edits or another registration cannot replace it.
  const desired = profileSchema.parse(options.desiredProfile);
  const assertCurrent = () => {
    if (!isCurrent()) throw new Error(SESSION_CHANGED_MESSAGE);
  };
  const changed = (): never => {
    if (isCurrent()) onPending(null);
    throw new Error(SESSION_CHANGED_MESSAGE);
  };
  const publishPending = (pending: PendingRegistration | null) => {
    assertCurrent();
    onPending(
      pending
        ? { ...pending, initialProfile: { ...pending.initialProfile } }
        : null,
    );
  };
  const assertIdentity = async (identity: string) => {
    assertCurrent();
    const { data, error } = await auth.getSession();
    assertCurrent();
    if (error) throw new Error(studentAccessMessage(error));
    if (
      data.session?.user.id !== identity ||
      data.session.user.is_anonymous !== true
    )
      changed();
  };
  const assertPin = (actual: string | null, expected: string) => {
    assertCurrent();
    if (actual !== expected) changed();
  };

  assertCurrent();
  let pending: PendingRegistration;
  if (options.pending) {
    const parsed = profileSchema.safeParse(options.pending.initialProfile);
    if (!options.pending.identity) return changed();
    if (!parsed.success) return changed();
    pending = {
      identity: options.pending.identity,
      initialProfile: parsed.data,
    };
    await assertIdentity(pending.identity);
  } else {
    const { error } = await auth.signOut({ scope: "local" });
    assertCurrent();
    if (error)
      throw new Error(
        "The previous session could not be ended. Retry before starting a new session.",
      );
    const { data, error: authError } = await auth.signInAnonymously();
    assertCurrent();
    if (authError || !data.user)
      throw new Error(studentAccessMessage(authError));
    if (!data.user.id || data.user.is_anonymous !== true) changed();
    pending = { identity: data.user.id, initialProfile: { ...desired } };
    // Even a later storage failure must not consume another signup on retry.
    publishPending(pending);
    await assertIdentity(pending.identity);
  }

  const recoverExisting = async () => {
    assertCurrent();
    const result = await readProfile(pending.identity);
    assertPin(result.sessionIdentity, pending.identity);
    await assertIdentity(pending.identity);
    if (result.profile === null) return null;
    const parsed = profileSchema.safeParse(result.profile);
    if (!parsed.success) return changed();
    if (!sameProfile(parsed.data, pending.initialProfile)) return changed();
    return parsed.data;
  };
  const complete = async (profile: Profile, recovered: boolean) => {
    await assertIdentity(pending.identity);
    publishPending(null);
    return { identity: pending.identity, profile, recovered };
  };

  if (options.pending) {
    const existing = await recoverExisting();
    if (existing) return complete(existing, true);
  }
  // If a retry changes an unsaved form, bind any eventual recovery to that write.
  pending = { identity: pending.identity, initialProfile: { ...desired } };
  publishPending(pending);
  await assertIdentity(pending.identity);
  let response: { sessionIdentity: string | null };
  try {
    response = await writeProfile(pending.identity, { ...desired });
  } catch (error) {
    assertCurrent();
    if (error instanceof Error && error.message === SESSION_CHANGED_MESSAGE)
      changed();
    // The server may have saved the profile before its response was lost.
    let existing: Profile | null = null;
    try {
      existing = await recoverExisting();
    } catch (recoveryError) {
      assertCurrent();
      if (
        recoveryError instanceof Error &&
        recoveryError.message === SESSION_CHANGED_MESSAGE
      )
        throw recoveryError;
      // Preserve the initiating error and pending identity on an ordinary outage.
    }
    if (existing) return complete(existing, true);
    throw error;
  }
  assertPin(response.sessionIdentity, pending.identity);
  return complete(desired, false);
}
