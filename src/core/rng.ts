/**
 * Deterministic randomness primitives for Prompt Spark. See T-005.
 *
 * Everything here is pure and platform-stable: no Date, no Math.random,
 * no locale-dependent APIs. Implements the frozen signatures declared in
 * ./types (Mulberry32, Djb2, PromptIdFn).
 */

/**
 * mulberry32 — standard 32-bit seeded PRNG.
 * Returns a function yielding floats in [0, 1). Identical seeds yield
 * identical sequences on every platform (all math is 32-bit integer via
 * Math.imul plus one exact power-of-two division).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * djb2 — classic string hash (h = h * 33 + c), returned as an
 * unsigned 32-bit integer.
 */
export function djb2(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return h >>> 0
}

/**
 * promptId — stable id for a (seed, template) pair: the unsigned djb2
 * hash of `${seed}:${templateId}` rendered as UPPERCASE hex.
 */
export function promptId(seed: number, templateId: string): string {
  return djb2(`${seed}:${templateId}`).toString(16).toUpperCase()
}

/**
 * serialFromId — short display serial: the first 4 chars of a promptId,
 * right-padded with '0' in the (rare) case the hex is shorter than 4.
 */
export function serialFromId(id: string): string {
  return id.slice(0, 4).padEnd(4, '0')
}
