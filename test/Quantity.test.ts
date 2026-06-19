import { describe, expect, it } from "vitest";

import {
  AmbiguousUnitError,
  Dimension,
  InvalidConversionError,
  Quantity,
  UnknownUnitError,
} from "../src";
import { kilometer, meter, mile } from "../src/dimensions/length";
import { gram, longTon, mass, shortTon } from "../src/dimensions/mass";
import { psi } from "../src/dimensions/pressure";
import { hour, minute, second, time } from "../src/dimensions/time";
import {
  imperialFluidOunce,
  imperialGallon,
  imperialGill,
  imperialPint,
  imperialQuart,
  liter,
  milliliter,
  usFluidOunce,
  usGallon,
  usGill,
  usPint,
  usQuart,
  volume,
} from "../src/dimensions/volume";
import { imperial, usCustomary } from "../src/systems";

/** Every volume token shared between US and Imperial: [token, us, imperial]. */
const SHARED_VOLUME_ALIASES = [
  ["gallon", usGallon, imperialGallon],
  ["quart", usQuart, imperialQuart],
  ["pint", usPint, imperialPint],
  ["gill", usGill, imperialGill],
  ["floz", usFluidOunce, imperialFluidOunce],
] as const;

describe("Quantity", () => {
  describe("parse", () => {
    it("parses unambiguous single and compound tokens", () => {
      expect(Quantity.parse("5 hr", time).unit).toBe(hour);
      const compound = Quantity.parse("5hr 20min", time);
      expect(compound.unit).toBe(minute);
      expect(compound.magnitude).toBe(320);
      expect(compound.in(second)).toBe(19200);
    });

    it("throws on an unknown unit token", () => {
      expect(() => Quantity.parse("5 furlongs", time)).toThrow(UnknownUnitError);
    });

    it("throws on a shared alias with no preferred system", () => {
      expect(() => Quantity.parse("1 ton", mass)).toThrow(AmbiguousUnitError);
      for (const [token] of SHARED_VOLUME_ALIASES) {
        expect(() => Quantity.parse(`1 ${token}`, volume)).toThrow(AmbiguousUnitError);
      }
    });

    it("resolves shared mass aliases via the preferred measurement system", () => {
      expect(Quantity.parse("1 ton", mass, { prefer: usCustomary }).unit).toBe(shortTon);
      expect(Quantity.parse("1 ton", mass, { prefer: imperial }).unit).toBe(longTon);
    });

    it.each(
      SHARED_VOLUME_ALIASES,
    )('resolves "%s" to the right unit per preferred system', (token, us, imp) => {
      expect(Quantity.parse(`1 ${token}`, volume, { prefer: usCustomary }).unit).toBe(us);
      expect(Quantity.parse(`1 ${token}`, volume, { prefer: imperial }).unit).toBe(imp);
      expect(new Quantity(1, imp).in(us)).not.toBeCloseTo(1, 3);
    });

    it("still resolves an alias unique to one system without a hint", () => {
      // "tbsp" exists only in US customary, so no preference is needed.
      expect(Quantity.parse("3 tbsp", volume).unit.name).toBe("tablespoon");
    });
  });

  describe("arithmetic", () => {
    it("adds quantities of different units, result in the receiver's unit", () => {
      const sum = new Quantity(1, mile).plus(new Quantity(1, kilometer));
      expect(sum.unit).toBe(mile);
      expect(sum.magnitude).toBeCloseTo(1 + 1 / 1.609344, 10); // ≈ 1.621371 mi
    });

    it("subtracts quantities of different units", () => {
      const diff = new Quantity(1, mile).minus(new Quantity(1, kilometer));
      expect(diff.unit).toBe(mile);
      expect(diff.magnitude).toBeCloseTo(1 - 1 / 1.609344, 10); // ≈ 0.378629 mi
    });

    it("scales by a dimensionless factor", () => {
      expect(new Quantity(2, meter).times(3).magnitude).toBe(6);
      expect(new Quantity(6, meter).dividedBy(3).magnitude).toBe(2);
      expect(new Quantity(5, meter).negate().magnitude).toBe(-5);
    });

    it("takes the absolute value", () => {
      expect(new Quantity(-5, meter).abs().magnitude).toBe(5);
      expect(new Quantity(5, meter).abs().magnitude).toBe(5);
    });

    it("ratioTo gives the dimensionless ratio between two quantities", () => {
      // How many 250 mL servings fit in a 2 L bottle?
      expect(new Quantity(2, liter).ratioTo(new Quantity(250, milliliter))).toBe(8);
      // Same dimension, different units (here the divisor's magnitude is 1).
      expect(new Quantity(1, mile).ratioTo(new Quantity(1, kilometer))).toBe(1.609344);
      // Same unit, divisor magnitude ≠ 1.
      expect(new Quantity(10, meter).ratioTo(new Quantity(2, meter))).toBe(5);
      expect(() => new Quantity(1, meter).ratioTo(new Quantity(1, liter))).toThrow(
        InvalidConversionError,
      );
    });

    it("clamps to a range, returned in this quantity's unit", () => {
      const lower = new Quantity(1, meter);
      const upper = new Quantity(1, kilometer);
      expect(new Quantity(500, meter).clamp(lower, upper).magnitude).toBe(500);
      const belowed = new Quantity(0, meter).clamp(lower, upper);
      expect(belowed.unit).toBe(meter);
      expect(belowed.magnitude).toBe(1);
      const aboved = new Quantity(5, kilometer).clamp(lower, upper);
      expect(aboved.unit).toBe(kilometer);
      expect(aboved.magnitude).toBe(1);
    });

    it("is immutable — operands are not modified", () => {
      const a = new Quantity(1, mile);
      const b = new Quantity(1, kilometer);
      a.plus(b);
      expect(a.magnitude).toBe(1);
      expect(b.magnitude).toBe(1);
    });

    it("throws when combining different dimensions", () => {
      expect(() => new Quantity(1, mile).plus(new Quantity(1, liter))).toThrow(
        InvalidConversionError,
      );
    });

    it("exposes short aliases add/sub/mul/div", () => {
      const a = new Quantity(10, meter);
      const b = new Quantity(5, meter);
      expect(a.add(b).magnitude).toBe(a.plus(b).magnitude);
      expect(a.sub(b).magnitude).toBe(a.minus(b).magnitude);
      expect(a.mul(3).magnitude).toBe(a.times(3).magnitude);
      expect(a.div(2).magnitude).toBe(a.dividedBy(2).magnitude);
    });
  });

  describe("comparison", () => {
    it("compares across units of the same dimension", () => {
      expect(new Quantity(1, kilometer).equals(new Quantity(1000, meter))).toBe(true);
      expect(new Quantity(1, meter).notEquals(new Quantity(2, meter))).toBe(true);
      expect(new Quantity(1, meter).lessThan(new Quantity(1, kilometer))).toBe(true);
      expect(new Quantity(1, kilometer).greaterThan(new Quantity(1, meter))).toBe(true);
      expect(new Quantity(1, kilometer).lessThan(new Quantity(1, meter))).toBe(false);
    });

    it("exposes short aliases eq/ne/lt/gt", () => {
      const a = new Quantity(1, kilometer);
      const b = new Quantity(1000, meter);
      const c = new Quantity(1, meter);
      expect(a.eq(b)).toBe(a.equals(b));
      expect(a.ne(c)).toBe(a.notEquals(c));
      expect(c.lt(a)).toBe(c.lessThan(a));
      expect(a.gt(c)).toBe(a.greaterThan(c));
    });

    it("supports inclusive comparisons lte/gte", () => {
      const a = new Quantity(1, kilometer);
      const equal = new Quantity(1000, meter);
      const smaller = new Quantity(1, meter);
      expect(a.lessThanOrEqual(equal)).toBe(true);
      expect(a.greaterThanOrEqual(equal)).toBe(true);
      expect(smaller.lte(a)).toBe(true);
      expect(smaller.gte(a)).toBe(false);
    });

    it("compareTo returns -1/0/1 and works as a sort comparator", () => {
      const m1 = new Quantity(1, meter);
      const km1 = new Quantity(1, kilometer);
      expect(m1.compareTo(km1)).toBe(-1);
      expect(km1.compareTo(m1)).toBe(1);
      expect(km1.compareTo(new Quantity(1000, meter))).toBe(0);
      const sorted = [km1, m1, new Quantity(500, meter)].sort((a, b) => a.compareTo(b));
      expect(sorted.map((q) => q.in(meter))).toEqual([1, 500, 1000]);
    });

    it("throws when comparing different dimensions", () => {
      expect(() => new Quantity(1, meter).equals(new Quantity(1, liter))).toThrow(
        InvalidConversionError,
      );
    });
  });

  describe("statics", () => {
    it("min/max pick the extreme quantity", () => {
      const a = new Quantity(1, kilometer);
      const b = new Quantity(500, meter);
      const c = new Quantity(2, kilometer);
      expect(Quantity.min(a, b, c)).toBe(b);
      expect(Quantity.max(a, b, c)).toBe(c);
    });

    it("sum totals in the first quantity's unit", () => {
      const total = Quantity.sum(new Quantity(1, kilometer), new Quantity(500, meter));
      expect(total.unit).toBe(kilometer);
      expect(total.magnitude).toBe(1.5);
    });

    it("throws when mixing dimensions", () => {
      expect(() => Quantity.min(new Quantity(1, meter), new Quantity(1, liter))).toThrow(
        InvalidConversionError,
      );
    });
  });

  describe("best", () => {
    it("picks the largest unit whose magnitude is still at least 1", () => {
      const best = new Quantity(5000, meter).best(meter, kilometer, mile);
      expect(best.unit).toBe(mile);
    });

    it("converts the magnitude into the chosen unit", () => {
      const best = new Quantity(1500, meter).best(meter, kilometer);
      expect(best.unit).toBe(kilometer);
      expect(best.magnitude).toBe(1.5);
    });

    it("falls back to the smallest unit when even it rounds below 1", () => {
      const best = new Quantity(500, meter).best(kilometer, mile);
      expect(best.unit).toBe(kilometer);
      expect(best.magnitude).toBe(0.5);
    });

    it("compares by absolute magnitude", () => {
      const best = new Quantity(-5000, meter).best(meter, kilometer, mile);
      expect(best.unit).toBe(mile);
    });

    it("is order-independent (sorts candidates by scale)", () => {
      const best = new Quantity(5000, meter).best(mile, meter, kilometer);
      expect(best.unit).toBe(mile);
    });

    it("requires at least one unit", () => {
      expect(() => new Quantity(1, meter).best()).toThrow("at least one unit");
    });

    it("throws when a candidate belongs to another dimension", () => {
      expect(() => new Quantity(1, meter).best(liter)).toThrow(InvalidConversionError);
    });
  });

  describe("predicates and rounding", () => {
    it("reports the magnitude sign", () => {
      expect(new Quantity(0, meter).isZero()).toBe(true);
      expect(new Quantity(5, meter).isPositive()).toBe(true);
      expect(new Quantity(-5, meter).isNegative()).toBe(true);
      expect(new Quantity(5, meter).isZero()).toBe(false);
      expect(new Quantity(0, meter).isPositive()).toBe(false);
    });

    it("rounds the magnitude to the given decimals, keeping the unit", () => {
      expect(new Quantity(1.6213, mile).round(2).magnitude).toBe(1.62);
      expect(new Quantity(1.6213, mile).round().magnitude).toBe(2);
      expect(new Quantity(2.5, meter).round().magnitude).toBe(3);
      expect(new Quantity(1.2345, meter).round(2).unit).toBe(meter);
    });
  });

  describe("formatting", () => {
    it("toString renders the magnitude and unit name", () => {
      expect(new Quantity(5, kilometer).toString()).toBe("5 kilometer");
      expect(String(new Quantity(2.5, meter))).toBe("2.5 meter");
      expect(`${new Quantity(3, meter)}`).toBe("3 meter");
    });

    it("format() is magnitude-aware by default (singular at ±1, else plural)", () => {
      expect(new Quantity(5, gram).format()).toBe("5 grams");
      expect(new Quantity(1, gram).format()).toBe("1 gram");
      expect(new Quantity(-1, gram).format()).toBe("-1 gram");
      expect(new Quantity(5, kilometer).format()).toBe("5 kilometers");
    });

    it("format() honors an explicit unit style", () => {
      const q = new Quantity(5, gram);
      expect(q.format({ unit: "symbol" })).toBe("5 g");
      expect(q.format({ unit: "name" })).toBe("5 gram");
      expect(q.format({ unit: "plural" })).toBe("5 grams");
    });

    it("format() falls back to name when symbol/plural are unset", () => {
      // psi has no symbol; a user-defined unit here has neither symbol nor plural.
      expect(new Quantity(30, psi).format({ unit: "symbol" })).toBe("30 psi");
      const d = new Dimension("d");
      const widget = d.base("widget");
      expect(new Quantity(5, widget).format()).toBe("5 widget");
      expect(new Quantity(5, widget).format({ unit: "plural" })).toBe("5 widget");
    });

    it("format() renders the magnitude in the runtime's default locale when none is given", () => {
      const localized = (1234.5).toLocaleString();
      expect(new Quantity(1234.5, meter).format()).toBe(`${localized} meters`);
    });

    it("format() localizes the magnitude via a locale", () => {
      // German groups with "." and uses "," as the decimal separator.
      expect(new Quantity(1234.5, meter).format({ locale: "de-DE" })).toBe("1.234,5 meters");
      expect(new Quantity(1234.5, meter).format({ locale: "en-US" })).toBe("1,234.5 meters");
    });

    it("format() honors Intl.NumberFormat precision options", () => {
      expect(
        new Quantity(1.23456, meter).format({
          locale: "en-US",
          numberFormat: { maximumFractionDigits: 2 },
        }),
      ).toBe("1.23 meters");
      // numberFormat without a locale still routes through toLocaleString
      // (rendered in the runtime's default locale).
      const localized = (2).toLocaleString(undefined, { minimumFractionDigits: 2 });
      expect(new Quantity(2, gram).format({ numberFormat: { minimumFractionDigits: 2 } })).toBe(
        `${localized} grams`,
      );
    });

    it("format() combines localized magnitude with an explicit unit style", () => {
      expect(new Quantity(1234.5, kilometer).format({ locale: "de-DE", unit: "symbol" })).toBe(
        "1.234,5 km",
      );
    });

    it("formatParts() returns the magnitude and label as separate strings", () => {
      expect(new Quantity(5, kilometer).formatParts()).toEqual({
        magnitude: "5",
        unit: "kilometers",
      });
      expect(new Quantity(1, gram).formatParts()).toEqual({ magnitude: "1", unit: "gram" });
    });

    it("formatParts() honors the same options as format()", () => {
      expect(
        new Quantity(1234.5, kilometer).formatParts({ locale: "de-DE", unit: "symbol" }),
      ).toEqual({ magnitude: "1.234,5", unit: "km" });
    });

    it("format() and formatParts() stay in sync", () => {
      const q = new Quantity(1234.5, meter);
      const options = { locale: "de-DE", numberFormat: { maximumFractionDigits: 1 } } as const;
      const { magnitude, unit } = q.formatParts(options);
      expect(q.format(options)).toBe(`${magnitude} ${unit}`);
    });
  });
});
