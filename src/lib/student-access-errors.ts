/** Translate auth failures without exposing provider messages or credentials. */
export function studentAccessMessage(error: unknown) {
  const failure =
    typeof error === "object" && error !== null
      ? (error as { name?: unknown; code?: unknown; status?: unknown })
      : undefined;

  if (
    failure?.code === "anonymous_provider_disabled" ||
    failure?.code === "signup_disabled" ||
    failure?.status === 401 ||
    failure?.status === 403
  )
    return "Student sign-in is not ready on this site yet. Your details are still here.";

  if (failure?.status === 429 || failure?.code === "over_request_rate_limit")
    return "Student sign-in is busy. Your details are still here. Please wait before retrying.";

  if (failure?.code === "captcha_failed")
    return "Student sign-in could not complete its verification. Your details are still here. Try again.";

  if (
    failure?.name === "AuthRetryableFetchError" ||
    failure?.name === "TypeError" ||
    failure?.status === 0
  )
    return "We couldn't reach student sign-in. Your details are still here. Try again. If this continues at school, ask your advisor or school IT to check sign-in access.";

  return "We couldn't start your student session. Your details are still here. Try again.";
}
