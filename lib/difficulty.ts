/**
 * Task difficulty values.
 *
 * Deliberately not exported from `lib/actions/tasks.ts`: a `"use server"`
 * module may only export async functions, so a plain array declared there does
 * not survive the server/client boundary and arrives as a non-array.
 */
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
