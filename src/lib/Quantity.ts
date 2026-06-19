import { assertNever } from "assert-never";
import { AmbiguousUnitError } from "../errors/AmbiguousUnitError";
import { UnknownUnitError } from "../errors/UnknownUnitError";
import { scaleOf } from "../utils/scaleOf";
import type { Dimension } from "./Dimension";
import type { MeasurementSystem } from "./MeasurementSystem";
import { Rational } from "./Rational";
import type { Unit } from "./Unit";

/** Options for {@link Quantity.parse}. */
export interface ParseOptions {
  /** Preferred measurement system, used only to break ties on shared aliases. */
  prefer?: MeasurementSystem;
}

/** Options for {@link Quantity.format}. */
export interface FormatOptions {
  /**
   * Which label to render after the magnitude:
   *  - `"auto"` (default) — singular `name` when the magnitude is exactly ±1,
   *    otherwise the `plural`.
   *  - `"name"` — always the singular name.
   *  - `"plural"` — always the plural.
   *  - `"symbol"` — the unit's symbol.
   *
   * `plural`/`symbol` fall back to the unit's `name` when that field is unset.
   * Labels are English/canonical; localize the *magnitude* via {@link locale} /
   * {@link numberFormat}.
   */
  unit?: "auto" | "name" | "plural" | "symbol";

  /**
   * BCP 47 locale(s) used to render the magnitude (e.g. `"de-DE"`, `["fr", "en"]`).
   * Passed straight to `Number.prototype.toLocaleString`. When omitted, the
   * runtime's default locale is used.
   */
  locale?: string | string[];

  /**
   * `Intl.NumberFormat` options for the magnitude — precision
   * (`minimumFractionDigits` / `maximumFractionDigits`), `style: "currency"`,
   * grouping, and so on. Passed straight to `Number.prototype.toLocaleString`.
   */
  numberFormat?: Intl.NumberFormatOptions;
}

/**
 * The rendered pieces of a formatted quantity, as returned by
 * {@link Quantity.formatParts}. Each is already a finished string; the caller
 * decides how to assemble them (a plain join, JSX, a template, …).
 */
export interface FormattedParts {
  /** The locale-formatted magnitude, e.g. `"1.234,5"`. */
  magnitude: string;
  /** The chosen unit label, e.g. `"kilometers"`, `"km"`. */
  unit: string;
}

/** A magnitude paired with a unit (e.g. `5` `kilometer`). */
export class Quantity {
  /**
   * The magnitude as an exact {@link Rational} — the source of truth this
   * quantity is built on. Conversions and arithmetic operate on it directly, so
   * a chain like `q.to(a).to(b)` stays exact instead of accumulating the binary
   * rounding of repeated float round trips. (Exact for linear / affine units; a
   * conversion through a non-linear `custom` unit recaptures a float as a
   * rational, so it is best-effort there.)
   */
  readonly rational: Rational;

  constructor(
    magnitude: number | Rational,
    public readonly unit: Unit,
  ) {
    this.rational = Rational.from(magnitude);
  }

  /** The magnitude as a `number`, derived from {@link rational}. */
  get magnitude(): number {
    return this.rational.toNumber();
  }

  /** Return an equivalent quantity expressed in `target`. */
  to(target: Unit): Quantity {
    return new Quantity(this.inRational(target), target);
  }

  /** Return this quantity's raw magnitude expressed in `target`. */
  in(target: Unit): number {
    return this.inRational(target).toNumber();
  }

  /** This quantity's exact magnitude expressed in `target`. */
  private inRational(target: Unit): Rational {
    return this.unit.dimension.convertRational(this.rational, this.unit, target);
  }

  /**
   * Re-express this quantity in the best-fit unit among `units`: the largest
   * unit whose absolute magnitude is still at least 1 (falling back to the
   * smallest unit when even that rounds below 1). Requires at least one unit,
   * and each must belong to this quantity's dimension (else
   * {@link InvalidConversionError}).
   */
  best(...units: Unit[]): Quantity {
    const candidates = [...units].sort((a, b) => scaleOf(a) - scaleOf(b));
    if (candidates.length === 0) {
      throw new Error("Quantity.best requires at least one unit");
    }

    let chosen = candidates[0];
    for (const unit of candidates) {
      if (Math.abs(this.in(unit)) >= 1) {
        chosen = unit;
      } else {
        break;
      }
    }
    return this.to(chosen);
  }

  /** Render as `"<magnitude> <unit name>"`, e.g. `"5 kilometer"`. */
  toString(): string {
    return `${this.magnitude} ${this.unit.name}`;
  }

  /**
   * Render as `"<magnitude> <label>"`, choosing the label per `options.unit`
   * (default `"auto"`: magnitude-aware singular/plural). Unlike {@link toString},
   * this can use the unit's symbol or plural — e.g. `"5 grams"`, `"5 g"`,
   * `"1 gram"`. Pass `locale` / `numberFormat` to localize the magnitude via
   * `toLocaleString` — e.g. `format({ locale: "de-DE" })` → `"1.234,5 meters"`,
   * or `format({ numberFormat: { maximumFractionDigits: 2 } })` for precision.
   *
   * For non-string output (e.g. JSX), use {@link formatParts} and assemble the
   * pieces yourself.
   */
  format(options: FormatOptions = {}): string {
    const { magnitude, unit } = this.formatParts(options);
    return `${magnitude} ${unit}`;
  }

  /**
   * Like {@link format}, but returns the rendered magnitude and label as
   * separate strings instead of joining them, so the caller controls the
   * assembly. Useful when a single string won't do — e.g. styling the magnitude
   * in a React component:
   *
   * ```tsx
   * const { magnitude, unit } = q.formatParts({ locale: "de-DE" });
   * return <><b>{magnitude}</b> {unit}</>;
   * ```
   */
  formatParts(options: FormatOptions = {}): FormattedParts {
    return { magnitude: this.formatMagnitude(options), unit: this.formatLabel(options) };
  }

  /**
   * Render the magnitude via `toLocaleString`. With no `locale`/`numberFormat`
   * it uses the runtime's default locale; supply either for locale- and
   * precision-aware formatting.
   */
  private formatMagnitude({ locale, numberFormat }: FormatOptions): string {
    return this.magnitude.toLocaleString(locale, numberFormat);
  }

  private formatLabel({ unit = "auto" }: FormatOptions): string {
    const { name, symbol, plural } = this.unit;
    switch (unit) {
      case "symbol":
        return symbol ?? name;
      case "name":
        return name;
      case "plural":
        return plural ?? name;
      case "auto":
        return Math.abs(this.magnitude) === 1 ? name : (plural ?? name);
      default:
        return assertNever(unit);
    }
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
    return new Quantity(this.rational.plus(other.inRational(this.unit)), this.unit);
  }

  /** Subtract another quantity, returned in this quantity's unit. */
  minus(other: Quantity): Quantity {
    return new Quantity(this.rational.minus(other.inRational(this.unit)), this.unit);
  }

  /** Scale this quantity by a dimensionless factor. */
  times(factor: number | Rational): Quantity {
    return new Quantity(this.rational.times(Rational.from(factor)), this.unit);
  }

  /** Divide this quantity by a dimensionless divisor. */
  dividedBy(divisor: number | Rational): Quantity {
    return new Quantity(this.rational.dividedBy(Rational.from(divisor)), this.unit);
  }

  /**
   * Divide this quantity by `other` of the same dimension, yielding the
   * dimensionless ratio between them — i.e. how many of `other` fit in this.
   * Unlike {@link in}, this accounts for `other`'s magnitude, not just its unit.
   * Throws {@link InvalidConversionError} across dimensions.
   */
  ratioTo(other: Quantity): number {
    return this.rational.dividedBy(other.inRational(this.unit)).toNumber();
  }

  /** Return this quantity with its magnitude negated. */
  negate(): Quantity {
    return new Quantity(this.rational.negate(), this.unit);
  }

  /** Return this quantity with a non-negative magnitude. */
  abs(): Quantity {
    return new Quantity(this.rational.abs(), this.unit);
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

  /** Return this quantity with its magnitude rounded to `decimals` places (default 0). */
  round(decimals = 0): Quantity {
    const factor = 10 ** decimals;
    return new Quantity(Math.round(this.magnitude * factor) / factor, this.unit);
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
  mul(factor: number | Rational): Quantity {
    return this.times(factor);
  }

  /** Alias for {@link dividedBy}. */
  div(divisor: number | Rational): Quantity {
    return this.dividedBy(divisor);
  }

  /**
   * Whether this quantity equals `other`, compared in this quantity's unit.
   * Throws {@link InvalidConversionError} if the operands belong to different
   * dimensions. Comparison is exact rational equality, so quantities that are
   * mathematically equal compare equal even if reaching them involved a
   * conversion that would have drifted in floating point.
   */
  equals(other: Quantity): boolean {
    return this.rational.equals(other.inRational(this.unit));
  }

  /** Whether this quantity does not equal `other`. */
  notEquals(other: Quantity): boolean {
    return !this.equals(other);
  }

  /** Whether this quantity is less than `other`. */
  lessThan(other: Quantity): boolean {
    return this.rational.compare(other.inRational(this.unit)) < 0;
  }

  /** Whether this quantity is greater than `other`. */
  greaterThan(other: Quantity): boolean {
    return this.rational.compare(other.inRational(this.unit)) > 0;
  }

  /** Whether this quantity is less than or equal to `other`. */
  lessThanOrEqual(other: Quantity): boolean {
    return this.rational.compare(other.inRational(this.unit)) <= 0;
  }

  /** Whether this quantity is greater than or equal to `other`. */
  greaterThanOrEqual(other: Quantity): boolean {
    return this.rational.compare(other.inRational(this.unit)) >= 0;
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
    return this.rational.compare(other.inRational(this.unit));
  }

  /** Whether this quantity's magnitude is exactly zero. */
  isZero(): boolean {
    return this.rational.sign() === 0;
  }

  /** Whether this quantity's magnitude is greater than zero. */
  isPositive(): boolean {
    return this.rational.sign() > 0;
  }

  /** Whether this quantity's magnitude is less than zero. */
  isNegative(): boolean {
    return this.rational.sign() < 0;
  }

  /**
   * Parse a string into a `Quantity` using a dimension's known units and aliases.
   *
   *  - `"1km"`        -> `Quantity(1, kilometer)`
   *  - `"5 hr"`       -> `Quantity(5, hour)`
   *  - `"5hr 20min"`  -> `Quantity(320, minute)`
   *
   * Compound inputs are summed (exactly) and returned in the *finest*
   * (smallest-scale) unit present, so `"5hr 20min"` collapses to `320 minute`.
   *
   * When a token is a shared alias (e.g. `"ton"` → short ton & long ton), pass
   * `options.prefer` to pick the candidate belonging to that measurement system.
   */
  static parse(str: string, dimension: Dimension, options: ParseOptions = {}): Quantity {
    const pattern = /(-?\d+(?:\.\d+)?)\s*([^\d\s]+)/g;

    let total: Quantity | undefined;
    let finest: Unit | undefined;

    for (let match = pattern.exec(str); match !== null; match = pattern.exec(str)) {
      const value = Number.parseFloat(match[1]);
      const unit = resolve(match[2], dimension, options.prefer);
      const quantity = new Quantity(value, unit);
      total = total ? total.plus(quantity) : quantity;
      if (!finest || scaleOf(unit) < scaleOf(finest)) {
        finest = unit;
      }
    }

    if (!total || !finest) {
      throw new Error(`Could not parse a quantity from "${str}"`);
    }

    return total.to(finest);
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
