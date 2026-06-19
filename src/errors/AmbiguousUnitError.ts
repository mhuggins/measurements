import type { Unit } from "../lib/Unit";

export class AmbiguousUnitError extends Error {
  constructor(token: string, candidates: Unit[]) {
    const names = candidates.map((unit) => unit.name).join(", ");
    super(
      `Ambiguous unit "${token}": matches ${names}. Pass a preferred measurement system to disambiguate.`,
    );
  }
}
