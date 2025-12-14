/**
 * Result type for error handling without exceptions
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;
export interface Ok<T> {
    readonly ok: true;
    readonly value: T;
}
export interface Err<E = Error> {
    readonly ok: false;
    readonly error: E;
}
export declare function ok<T>(value: T): Ok<T>;
export declare function err<E = Error>(error: E): Err<E>;
export declare function isOk<T, E>(result: Result<T, E>): result is Ok<T>;
export declare function isErr<T, E>(result: Result<T, E>): result is Err<E>;
/**
 * Unwraps a Result, throwing if it's an error
 */
export declare function unwrap<T, E>(result: Result<T, E>): T;
/**
 * Maps a Result's value if Ok
 */
export declare function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>;
/**
 * Chains Results together
 */
export declare function andThen<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E>;
//# sourceMappingURL=result.d.ts.map