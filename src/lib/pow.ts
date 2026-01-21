/**
 * Proof of Work for Briefing API
 *
 * Implements a hashcash-style proof of work to prevent API abuse.
 * Even though the algorithm is public (open source), the computational
 * cost is real - attackers must spend CPU time for each session.
 *
 * Flow:
 * 1. Client requests a challenge from server
 * 2. Client finds a nonce such that SHA256(challenge + nonce) has N leading zero bits
 * 3. Server verifies the solution and issues a session token
 * 4. Subsequent requests use the session token (valid for 1 hour)
 */

import { POW_DIFFICULTY } from "./constants";

/**
 * Generate a random challenge string
 * Called server-side when a new session is needed
 */
export function generateChallenge(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const random = Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `rp-${Date.now()}-${random}`;
}

/**
 * Solve a proof of work challenge (client-side)
 *
 * Finds a nonce such that SHA256(challenge + nonce) has `difficulty` leading zero bits.
 * This is computationally expensive - typically 100-500ms for difficulty 16-18.
 */
export async function solveChallenge(
  challenge: string,
  difficulty: number = POW_DIFFICULTY
): Promise<{ nonce: number; hash: string }> {
  let nonce = 0;
  const target = Math.pow(2, 256 - difficulty);

  while (true) {
    const hash = await computeHash(`${challenge}:${nonce}`);
    const hashValue = BigInt(`0x${hash}`);

    if (hashValue < BigInt(Math.floor(target))) {
      return { nonce, hash };
    }

    nonce++;

    // Yield to event loop every 1000 iterations to keep UI responsive
    if (nonce % 1000 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

/**
 * Verify a proof of work solution (server-side)
 *
 * Checks:
 * 1. Challenge format is valid and not expired
 * 2. Hash of challenge + nonce has required leading zeros
 */
export async function verifySolution(
  challenge: string,
  nonce: number,
  difficulty: number = POW_DIFFICULTY
): Promise<{ valid: boolean; error?: string }> {
  // Validate challenge format: rp-{timestamp}-{random}
  const parts = challenge.split("-");
  if (parts.length !== 3 || parts[0] !== "rp") {
    return { valid: false, error: "Invalid challenge format" };
  }

  const timestamp = parseInt(parts[1], 10);
  if (isNaN(timestamp)) {
    return { valid: false, error: "Invalid challenge timestamp" };
  }

  // Challenge expires after 5 minutes
  const age = Date.now() - timestamp;
  if (age > 5 * 60 * 1000) {
    return { valid: false, error: "Challenge expired" };
  }

  if (age < 0) {
    return { valid: false, error: "Challenge timestamp in future" };
  }

  // Verify the hash
  const hash = await computeHash(`${challenge}:${nonce}`);
  const hashValue = BigInt(`0x${hash}`);
  const target = BigInt(Math.floor(Math.pow(2, 256 - difficulty)));

  if (hashValue >= target) {
    return { valid: false, error: "Hash does not meet difficulty requirement" };
  }

  return { valid: true };
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute SHA-256 hash using Web Crypto API
 */
async function computeHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
