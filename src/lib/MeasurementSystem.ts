import type { Dimension } from "./Dimension";
import { Quantity } from "./Quantity";
import type { Unit } from "./Unit";

/**
 * A measurement system (metric, imperial, US customary, …) is a cross-dimension
 * collection of units that share a real-world standard.
 *
 * It is purely additive metadata: it never participates in conversion (that is
 * the job of {@link Dimension}). A unit may belong to several measurement
 * systems — e.g. `foot` is both imperial and US customary — and membership is
 * optional, so untagged units still convert normally; they simply won't appear
 * under any standard. Membership lives here, the single source of truth, rather
 * than on the {@link Unit}.
 */
export class MeasurementSystem {
  readonly units = new Set<Unit>();

  constructor(public readonly name: string) {}

  add(...units: Unit[]): this {
    for (const unit of units) {
      this.units.add(unit);
    }
    return this;
  }

  has(unit: Unit): boolean {
    return this.units.has(unit);
  }

  /** Units of a given dimension that belong to this measurement system. */
  in(dimension: Dimension): Unit[] {
    return [...this.units].filter((unit) => unit.dimension === dimension);
  }

  /**
   * Re-express a quantity in this system's best-fit unit for its dimension:
   * the largest unit whose absolute magnitude is still at least 1 (falling back
   * to the smallest unit when even that rounds below 1).
   */
  express(quantity: Quantity): Quantity {
    const candidates = this.in(quantity.unit.dimension);
    if (candidates.length === 0) {
      throw new Error(
        `Measurement system "${this.name}" has no "${quantity.unit.dimension.name}" units to express in`,
      );
    }

    return quantity.best(...candidates);
  }
}
