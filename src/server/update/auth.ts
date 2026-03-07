export function isAuthorizedManualTrigger(
  request: Request,
  token: string | undefined
): boolean {
  if (!token) {
    return false;
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return false;
  }

  const expected = `Bearer ${token}`;
  return authorization === expected;
}
