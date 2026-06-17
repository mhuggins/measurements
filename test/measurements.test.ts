import { describe, expect, it } from "vitest";

import {
  AmbiguousUnitError,
  Dimension,
  InvalidConversionError,
  Quantity,
  UnknownUnitError,
} from "../src";
import {
  decameter,
  decimeter,
  foot,
  hectometer,
  inch,
  kilometer,
  length,
  meter,
  micrometer,
  mile,
} from "../src/dimensions/length";
import {
  gram,
  kilogram,
  longTon,
  mass,
  megagram,
  milligram,
  shortTon,
  tonne,
} from "../src/dimensions/mass";
import { celsius, fahrenheit, kelvin } from "../src/dimensions/temperature";
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

/** Every volume token shared between US and Imperial: [token, us, imperial]. */
const SHARED_VOLUME_ALIASES = [
  ["gallon", usGallon, imperialGallon],
  ["quart", usQuart, imperialQuart],
  ["pint", usPint, imperialPint],
  ["gill", usGill, imperialGill],
  ["floz", usFluidOunce, imperialFluidOunce],
] as const;

import { imperial, metric, usCustomary } from "../src/systems";

describe("conversion is dimension-only", () => {
  it("converts across measurement systems within a dimension (tons ↔ tonnes)", () => {
    // The headline guarantee: a measurement-system tag never gates conversion.
    expect(new Quantity(1, shortTon).in(tonne)).toBeCloseTo(0.90718474, 8);
    expect(new Quantity(1, tonne).in(shortTon)).toBeCloseTo(1.10231131, 6);
    expect(new Quantity(1, longTon).in(tonne)).toBeCloseTo(1.0160469088, 8);
  });

  it("converts using the base-routed model (no backwards-factor bug)", () => {
    expect(new Quantity(1, liter).in(milliliter)).toBe(1000);
    expect(new Quantity(1000, milliliter).in(liter)).toBe(1);
  });

  it("round-trips without drift", () => {
    for (const [a, b] of [
      [meter, foot],
      [meter, mile],
      [liter, usGallon],
    ] as const) {
      const there = a.dimension.convert(7, a, b);
      const back = a.dimension.convert(there, b, a);
      expect(back).toBeCloseTo(7, 10);
    }
  });

  it("chains through the base with no direct edge between units", () => {
    expect(new Quantity(1, mile).in(inch)).toBeCloseTo(63360, 6);
  });

  it("throws when units belong to different dimensions", () => {
    expect(() => length.convert(1, meter, liter)).toThrow(InvalidConversionError);
  });
});

describe("affine temperature", () => {
  it("converts across offset scales", () => {
    expect(new Quantity(100, celsius).in(fahrenheit)).toBeCloseTo(212, 10);
    expect(new Quantity(32, fahrenheit).in(celsius)).toBeCloseTo(0, 10);
    expect(new Quantity(0, celsius).in(kelvin)).toBeCloseTo(273.15, 10);
  });
});

describe("MeasurementSystem", () => {
  it("lets a unit belong to several systems (foot is imperial AND US customary)", () => {
    expect(imperial.has(foot)).toBe(true);
    expect(usCustomary.has(foot)).toBe(true);
    expect(metric.has(foot)).toBe(false);
  });

  it("lists units of a given dimension within the system", () => {
    const metricLengths = metric.in(length);
    expect(metricLengths).toContain(meter);
    expect(metricLengths).not.toContain(foot);
    expect(metricLengths.every((u) => u.dimension === length)).toBe(true);
  });

  it("does not exist in conversion: membership is optional", () => {
    // kilogram has no system tag conflict; tonne (metric) ↔ kilogram still works.
    expect(new Quantity(2, tonne).in(kilogram)).toBe(2000);
  });
});

describe("express (best-fit formatting)", () => {
  it("picks the largest unit with magnitude >= 1 for the chosen system", () => {
    const distance = new Quantity(5000, meter);
    expect(imperial.express(distance).unit).toBe(mile);
    const metricBest = metric.express(distance);
    expect(metricBest.unit.name).toBe("kilometer");
    expect(metricBest.magnitude).toBeCloseTo(5, 10);
  });
});

describe("Quantity.parse", () => {
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

describe("custom dimensions", () => {
  it("lets a user define their own dimension and units", () => {
    const data = new Dimension("data");
    const byte = data.base("byte", ["B", "bytes"]);
    const kilobyte = data.unit("kilobyte", 1024, ["KB"]);
    expect(new Quantity(2, kilobyte).in(byte)).toBe(2048);
  });
});

describe("Quantity arithmetic", () => {
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

describe("Quantity comparison", () => {
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

  it("throws when comparing different dimensions", () => {
    expect(() => new Quantity(1, meter).equals(new Quantity(1, liter))).toThrow(
      InvalidConversionError,
    );
  });
});

describe("metric prefixes", () => {
  it("fills in the SI ladder for length", () => {
    expect(new Quantity(1, kilometer).in(meter)).toBe(1000);
    expect(new Quantity(1, hectometer).in(meter)).toBeCloseTo(100, 9);
    expect(new Quantity(1, decameter).in(meter)).toBeCloseTo(10, 9);
    expect(new Quantity(1, decimeter).in(meter)).toBeCloseTo(0.1, 12);
    expect(new Quantity(1, micrometer).in(meter)).toBeCloseTo(1e-6, 18);
  });

  it("prefixes the gram (not the kilogram base) for mass", () => {
    expect(new Quantity(1, megagram).in(kilogram)).toBeCloseTo(1000, 6);
    expect(new Quantity(1000, milligram).in(gram)).toBeCloseTo(1, 9);
  });

  it("parses prefixed symbols, including the micro sign", () => {
    expect(Quantity.parse("3 km", length).unit.name).toBe("kilometer");
    expect(Quantity.parse("250 mL", volume).unit.name).toBe("milliliter");
    expect(Quantity.parse("5 µm", length).unit.name).toBe("micrometer");
  });

  it("tags the prefixed metric units into the metric system", () => {
    expect(metric.has(decameter)).toBe(true);
    expect(metric.has(megagram)).toBe(true);
  });
});
