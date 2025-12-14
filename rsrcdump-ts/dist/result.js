/**
 * Result type for error handling without exceptions
 */
export function ok(value) {
    return { ok: true, value };
}
export function err(error) {
    return { ok: false, error };
}
export function isOk(result) {
    return result.ok;
}
export function isErr(result) {
    return !result.ok;
}
/**
 * Unwraps a Result, throwing if it's an error
 */
export function unwrap(result) {
    if (result.ok) {
        return result.value;
    }
    throw result.error;
}
/**
 * Maps a Result's value if Ok
 */
export function map(result, fn) {
    if (result.ok) {
        return ok(fn(result.value));
    }
    return result;
}
/**
 * Chains Results together
 */
export function andThen(result, fn) {
    if (result.ok) {
        return fn(result.value);
    }
    return result;
}
//# sourceMappingURL=result.js.map