/**
 * Simulated SMS / voice / e-mail gateway. In production the server generates,
 * hashes and checks the code; the app never sees it. In the demo the code is
 * shown on the code screen so the flow can be tested without a phone network.
 */
export function demoOtpCode(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}
