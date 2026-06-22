export const META_TOKEN_EXPIRED_MESSAGE = "Meta token expired";

export function isMetaTokenReauthRequired(input: {
  status: string;
  refreshFailureCount: number;
}): boolean {
  return input.status === "error" && input.refreshFailureCount >= 2;
}

export function resolveMetaIntegrationErrorMessage(input: {
  status: string;
  refreshFailureCount: number;
  lastError: string | null;
}): { needsReauth: boolean; errorMessage: string | null } {
  if (isMetaTokenReauthRequired(input)) {
    return { needsReauth: true, errorMessage: META_TOKEN_EXPIRED_MESSAGE };
  }

  return { needsReauth: false, errorMessage: input.lastError };
}
