import { AmbiguousUnitError } from "../errors/AmbiguousUnitError";
import { UnknownUnitError } from "../errors/UnknownUnitError";
import type { Dimension } from "./Dimension";
import type { MeasurementSystem } from "./MeasurementSystem";
import { scaleOf } from "./scale";
import type { Unit } from "./Unit";

/** Options for {@link Quantity.parse}. */
export interface ParseOptions {
  /** Preferred measurement system, used only to break ties on shared aliases. */
  prefer?: MeasurementSystem;
}

/** A magnitude paired with a unit (e.g. `5` `kilometer`). */
export class Quantity {
  constructor(
    public magnitude: number,
    public unit: Unit,
  ) {}

  /** Return an equivalent quantity expressed in `target`. */
  to(target: Unit): Quantity {
    return new Quantity(this.in(target), target);
  }

  /** Return this quantity's raw magnitude expressed in `target`. */
  in(target: Unit): number {
    return this.unit.dimension.convert(this.magnitude, this.unit, target);
  }

  /** Render as `"<magnitude> <unit name>"`, e.g. `"5 kilometer"`. */
  toString(): string {
    return `${this.magnitude} ${this.unit.name}`;
  }

  /**
   * Add another quantity, returned in *this* quantity's unit. The other operand
   * is converted into this unit first, so the two may use different units of the
   * same dimension (e.g. `mile.plus(km)`). Throws {@link InvalidConversionError}
   * if the operands belong to different dimensions.
   *
   * Note: for affine units (e.g. temperature) addition is mathematically defined
   * but physically questionable, since it adds absolute points rather than a
   * difference.
   */
  plus(other: Quantity): Quantity {
    return new Quantity(this.magnitude + other.in(this.unit), this.unit);
  }

  /** Subtract another quantity, returned in this quantity's unit. */
  minus(other: Quantity): Quantity {
    return new Quantity(this.magnitude - other.in(this.unit), this.unit);
  }

  /** Scale this quantity by a dimensionless factor. */
  times(factor: number): Quantity {
    return new Quantity(this.magnitude * factor, this.unit);
  }

  /** Divide this quantity by a dimensionless divisor. */
  dividedBy(divisor: number): Quantity {
    return new Quantity(this.magnitude / divisor, this.unit);
  }

  /** Return this quantity with its magnitude negated. */
  negate(): Quantity {
    return new Quantity(-this.magnitude, this.unit);
  }

  /** Return this quantity with a non-negative magnitude. */
  abs(): Quantity {
    return new Quantity(Math.abs(this.magnitude), this.unit);
  }

  /** Clamp this quantity to the range [`lower`, `upper`], returned in this unit. */
  clamp(lower: Quantity, upper: Quantity): Quantity {
    if (this.lessThan(lower)) {
      return lower.to(this.unit);
    }
    if (this.greaterThan(upper)) {
      return upper.to(this.unit);
    }
    return this;
  }

  /** Alias for {@link plus}. */
  add(other: Quantity): Quantity {
    return this.plus(other);
  }

  /** Alias for {@link minus}. */
  sub(other: Quantity): Quantity {
    return this.minus(other);
  }

  /** Alias for {@link times}. */
  mul(factor: number): Quantity {
    return this.times(factor);
  }

  /** Alias for {@link dividedBy}. */
  div(divisor: number): Quantity {
    return this.dividedBy(divisor);
  }

  /**
   * Whether this quantity equals `other`, compared in this quantity's unit.
   * Throws {@link InvalidConversionError} if the operands belong to different
   * dimensions. Comparison is exact, so values that differ only by
   * floating-point rounding from a conversion may compare unequal.
   */
  equals(other: Quantity): boolean {
    return this.magnitude === other.in(this.unit);
  }

  /** Whether this quantity does not equal `other`. */
  notEquals(other: Quantity): boolean {
    return !this.equals(other);
  }

  /** Whether this quantity is less than `other`. */
  lessThan(other: Quantity): boolean {
    return this.magnitude < other.in(this.unit);
  }

  /** Whether this quantity is greater than `other`. */
  greaterThan(other: Quantity): boolean {
    return this.magnitude > other.in(this.unit);
  }

  /** Whether this quantity is less than or equal to `other`. */
  lessThanOrEqual(other: Quantity): boolean {
    return this.magnitude <= other.in(this.unit);
  }

  /** Whether this quantity is greater than or equal to `other`. */
  greaterThanOrEqual(other: Quantity): boolean {
    return this.magnitude >= other.in(this.unit);
  }

  /** Alias for {@link equals}. */
  eq(other: Quantity): boolean {
    return this.equals(other);
  }

  /** Alias for {@link notEquals}. */
  ne(other: Quantity): boolean {
    return this.notEquals(other);
  }

  /** Alias for {@link lessThan}. */
  lt(other: Quantity): boolean {
    return this.lessThan(other);
  }

  /** Alias for {@link greaterThan}. */
  gt(other: Quantity): boolean {
    return this.greaterThan(other);
  }

  /** Alias for {@link lessThanOrEqual}. */
  lte(other: Quantity): boolean {
    return this.lessThanOrEqual(other);
  }

  /** Alias for {@link greaterThanOrEqual}. */
  gte(other: Quantity): boolean {
    return this.greaterThanOrEqual(other);
  }

  /**
   * Compare with `other` (in this quantity's unit): `-1` if this is smaller, `1`
   * if larger, `0` if equal. Suitable as an `Array#sort` comparator.
   */
  compareTo(other: Quantity): number {
    const value = other.in(this.unit);
    if (this.magnitude < value) {
      return -1;
    }
    if (this.magnitude > value) {
      return 1;
    }
    return 0;
  }

  /**
   * Parse a string into a `Quantity` using a dimension's known units and aliases.
   *
   *  - `"1km"`        -> `Quantity(1, kilometer)`
   *  - `"5 hr"`       -> `Quantity(5, hour)`
   *  - `"5hr 20min"`  -> `Quantity(320, minute)`
   *
   * Compound inputs are summed in base units and returned in the *finest*
   * (smallest-scale) unit present, so `"5hr 20min"` collapses to `320 minute`.
   *
   * When a token is a shared alias (e.g. `"ton"` → short ton & long ton), pass
   * `options.prefer` to pick the candidate belonging to that measurement system.
   */
  static parse(str: string, dimension: Dimension, options: ParseOptions = {}): Quantity {
    const pattern = /(-?\d+(?:\.\d+)?)\s*([^\d\s]+)/g;

    let total = 0; // accumulated in base units
    let finest: Unit | undefined;
    let count = 0;

    for (let match = pattern.exec(str); match !== null; match = pattern.exec(str)) {
      const value = Number.parseFloat(match[1]);
      const unit = resolve(match[2], dimension, options.prefer);
      total += unit.toBase(value);
      if (!finest || scaleOf(unit) < scaleOf(finest)) {
        finest = unit;
      }
      count += 1;
    }

    if (count === 0 || !finest) {
      throw new Error(`Could not parse a quantity from "${str}"`);
    }

    return new Quantity(finest.fromBase(total), finest);
  }

  /** The smallest of the given quantities (by value); requires at least one. */
  static min(first: Quantity, ...rest: Quantity[]): Quantity {
    return rest.reduce((smallest, q) => (q.lessThan(smallest) ? q : smallest), first);
  }

  /** The largest of the given quantities (by value); requires at least one. */
  static max(first: Quantity, ...rest: Quantity[]): Quantity {
    return rest.reduce((largest, q) => (q.greaterThan(largest) ? q : largest), first);
  }

  /** The sum of the given quantities, in the first one's unit; requires at least one. */
  static sum(first: Quantity, ...rest: Quantity[]): Quantity {
    return rest.reduce((total, q) => total.plus(q), first);
  }
}

/** Resolve a token to a single unit, disambiguating shared aliases by system. */
function resolve(token: string, dimension: Dimension, prefer?: MeasurementSystem): Unit {
  const candidates = dimension.get(token);
  if (!candidates || candidates.length === 0) {
    throw new UnknownUnitError(token, dimension);
  }
  if (candidates.length === 1) {
    return candidates[0];
  }
  if (prefer) {
    const matches = candidates.filter((unit) => prefer.has(unit));
    if (matches.length === 1) {
      return matches[0];
    }
  }
  throw new AmbiguousUnitError(token, candidates);
}
