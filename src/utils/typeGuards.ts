/** Type guard: is `value` one of the allowed string literals? Replaces `includes(x as F)` casts. */
export function isOneOf<F extends string>(allowed: readonly F[], value: unknown): value is F {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}
