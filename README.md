# measurable

Convert between units of measurement, with batteries-included common units and
first-class support for defining your own.

- **No drift** — each unit defines a single transform to its dimension's base
  unit; reverse conversions are derived, never stored, so they can't fall out of
  sync.
- **Free chaining** — any unit converts to any other in the same dimension
  (e.g. `mile → inch`) without you defining every pair.
- **Affine units** — temperature scales (°C/°F/K) and anything else needing an
  offset, not just a scale factor.
- **Two orthogonal ideas** — a **dimension** decides what _can_ convert; a
  **measurement system** (metric/imperial/US) is a tag that never gates
  conversion but powers filtering, formatting, and parse disambiguation.

## Installation

```sh
npm install measurable
```

## Entry points

The package is split into three import paths so the core stays lean:

| Import                     | What you get                                                              |
| -------------------------- | ------------------------------------------------------------------------- |
| `measurable`             | The building blocks: `Quantity`, `Dimension`, `MeasurementSystem`, `Unit`, errors |
| `measurable/dimensions`  | Predefined dimensions and their units (`length`, `meter`, `volume`, …)    |
| `measurable/systems`     | Predefined measurement systems (`metric`, `imperial`, `usCustomary`)      |

## Quick start

```ts
import { Quantity } from "measurable";
import { meter, mile, celsius, fahrenheit } from "measurable/dimensions";

// Convert: `.to()` returns a Quantity, `.in()` returns a raw number.
new Quantity(5, mile).to(meter).magnitude; // 8046.72
new Quantity(5, mile).in(meter);           // 8046.72

// Affine scales work the same way.
new Quantity(100, celsius).in(fahrenheit); // 212
```

## Concepts

- **`Dimension`** — a kind of measurable quantity (length, volume, mass, …). It
  owns a canonical **base unit** and is where all conversion happens. A unit
  belongs to exactly one dimension.
- **`Unit`** — a name plus a transform (`toBase` / `fromBase`) into its
  dimension's base unit. Created through a dimension's builder methods.
- **`Quantity`** — a magnitude paired with a unit (e.g. `5 kilometer`).
- **`MeasurementSystem`** — a cross-dimension tag (metric/imperial/…). A unit can
  belong to many; membership is optional and never affects whether a conversion
  is allowed.

## Built-in dimensions

Import any dimension or unit from `measurable/dimensions`:

| Dimension     | Base       | Units (a selection)                                                                 |
| ------------- | ---------- | ----------------------------------------------------------------------------------- |
| `length`      | `meter`    | `kilometer`, `centimeter`, `millimeter`, `inch`, `foot`, `yard`, `mile`             |
| `volume`      | `liter`    | `milliliter`, `us*`/`imperial*` `Gallon`/`Quart`/`Pint`/`Gill`/`FluidOunce`, `cup`, `tablespoon`, `teaspoon` |
| `mass`        | `gram`     | `kilogram`, `milligram`, `tonne`, `pound`, `ounce`, `stone`, `shortTon`, `longTon`  |
| `time`        | `second`   | `millisecond`, `minute`, `hour`, `day`, `week`                                      |
| `temperature` | `kelvin`   | `celsius`, `fahrenheit`                                                              |
| `angle`       | `radian`   | `degree`, `gradian`, `turn`                                                          |
| `force`       | `newton`   | `kilonewton`, `dyne`, `poundForce`, `kilogramForce`                                  |

The metric units carry the **full SI prefix ladder** (yotta → yocto), generated for
you: `length`, `mass`, `volume`, and `force` get every prefix (so `kilogram`
itself is just the kilo-prefixed gram), while `time` and `angle` get the
fractional prefixes only (e.g.
`millisecond`, `microradian`). So `decimeter`, `hectometer`, `megagram`,
`kiloliter`, `nanosecond`, etc. are all available and parse from their symbols
(`dm`, `hm`, `Mg`, `kL`, `ns`, and `µm`/`um` for micro). You can apply the same
ladder to your own dimensions with `definePrefixed` (see below).

## Built-in measurement systems

Import `metric`, `imperial`, or `usCustomary` from `measurable/systems`.

```ts
import { foot } from "measurable/dimensions";
import { imperial, usCustomary, metric } from "measurable/systems";

imperial.has(foot);      // true  — a unit can belong to several systems
usCustomary.has(foot);   // true
metric.has(foot);        // false
```

### Listing units in a system

```ts
import { length } from "measurable/dimensions";
import { metric } from "measurable/systems";

metric.in(length).map((u) => u.name); // ["meter", "kilometer", "centimeter", "millimeter"]
```

### Best-fit formatting

`express` re-expresses a quantity in a system's most readable unit (the largest
unit whose magnitude is still ≥ 1):

```ts
import { Quantity } from "measurable";
import { meter } from "measurable/dimensions";
import { metric, imperial } from "measurable/systems";

metric.express(new Quantity(5000, meter));    // Quantity(5, kilometer)
imperial.express(new Quantity(5000, meter));  // Quantity(3.107…, mile)
```

A `Quantity` also has a `toString()` that renders `"<magnitude> <unit name>"`
(e.g. `new Quantity(5, kilometer).toString()` → `"5 kilometer"`), and `round(decimals)`
to trim the magnitude for display (`new Quantity(1.6213, mile).round(2)` → `1.62 mile`).

## Parsing strings

`Quantity.parse(input, dimension, options?)` reads a string into a `Quantity`.
Compound inputs are summed and returned in the finest unit present:

```ts
import { Quantity } from "measurable";
import { length, time } from "measurable/dimensions";

Quantity.parse("1km", length);         // Quantity(1, kilometer)
Quantity.parse("5 hr", time);          // Quantity(5, hour)
Quantity.parse("5hr 20min", time);     // Quantity(320, minute)
```

### Ambiguous aliases

Some names mean different things in different systems — a US gallon (3.785 L) is
not an imperial gallon (4.546 L), and `ton` could be short or long. These are
distinct units that share an alias, so an unqualified parse throws; pass a
`prefer`red system to disambiguate:

```ts
import { Quantity, AmbiguousUnitError } from "measurable";
import { volume, mass } from "measurable/dimensions";
import { usCustomary, imperial } from "measurable/systems";

Quantity.parse("1 gallon", volume);                                    // throws AmbiguousUnitError
Quantity.parse("1 gallon", volume, { prefer: usCustomary }).unit.name; // "usGallon"
Quantity.parse("1 ton", mass, { prefer: imperial }).unit.name;         // "longTon"
```

Conversion itself is governed only by the dimension, so cross-system conversions
always work regardless of tags:

```ts
import { shortTon, tonne } from "measurable/dimensions";

new Quantity(1, shortTon).in(tonne); // 0.90718474
```

## Arithmetic

Quantities can be combined. `plus`/`minus` take another `Quantity` (converted into
the receiver's unit first, so the operands may use different units of the same
dimension); `times`/`dividedBy` apply a dimensionless scalar, and `negate`/`abs`
transform the magnitude. All return a **new** `Quantity` in the receiver's unit and
leave the operands untouched.

```ts
import { Quantity } from "measurable";
import { kilometer, mile } from "measurable/dimensions";

new Quantity(1, mile).plus(new Quantity(1, kilometer));  // Quantity(1.6213…, mile)
new Quantity(1, mile).minus(new Quantity(1, kilometer)); // Quantity(0.3786…, mile)
new Quantity(2, mile).times(3);                          // Quantity(6, mile)
new Quantity(6, mile).dividedBy(2);                      // Quantity(3, mile)
```

Short aliases are available: **`add`** (`plus`), **`sub`** (`minus`), **`mul`**
(`times`), **`div`** (`dividedBy`).

Combining different dimensions throws `InvalidConversionError`. Note that adding
**affine** units (e.g. temperatures) is mathematically defined but physically
questionable, since it adds absolute points rather than a difference.

## Comparison

`equals`/`notEquals`/`lessThan`/`greaterThan`/`lessThanOrEqual`/`greaterThanOrEqual`
compare two quantities (the other is converted into the receiver's unit first),
returning a boolean. Comparing different dimensions throws `InvalidConversionError`.

```ts
import { Quantity } from "measurable";
import { kilometer, meter } from "measurable/dimensions";

new Quantity(1, kilometer).equals(new Quantity(1000, meter));    // true
new Quantity(1, meter).lessThan(new Quantity(1, kilometer));     // true
new Quantity(1, kilometer).greaterThan(new Quantity(1, meter));  // true
```

Short aliases: **`eq`** (`equals`), **`ne`** (`notEquals`), **`lt`** (`lessThan`),
**`gt`** (`greaterThan`), **`lte`** (`lessThanOrEqual`), **`gte`**
(`greaterThanOrEqual`). Equality is exact, so values differing only by
floating-point rounding from a conversion may compare unequal.

`compareTo(other)` returns `-1`, `0`, or `1`, suitable as an `Array#sort`
comparator: `quantities.sort((a, b) => a.compareTo(b))`.

## Combining quantities

`Quantity.min`/`max`/`sum` aggregate several quantities at once; `clamp` is an
instance method that bounds one quantity to a range. Each converts operands as
needed, so mixing dimensions throws `InvalidConversionError`.

```ts
import { Quantity } from "measurable";
import { kilometer, meter } from "measurable/dimensions";

const a = new Quantity(1, kilometer);
const b = new Quantity(500, meter);

Quantity.min(a, b); // Quantity(500, meter) — the smaller
Quantity.max(a, b); // Quantity(1, kilometer) — the larger
Quantity.sum(a, b); // Quantity(1.5, kilometer) — total, in a's unit
b.clamp(a, new Quantity(2, kilometer)); // b bounded to [a, 2 km], in b's unit
```

## Defining your own units

Create a `Dimension` and add units through its builder methods. `scale` is how
many base units make up one of the unit being defined.

```ts
import { Dimension, Quantity } from "measurable";

const data = new Dimension("data");
const byte = data.base("byte", ["B", "bytes"]); // the base unit (identity)
const kilobyte = data.unit("kilobyte", 1024, ["KB"]);
const megabyte = data.unit("megabyte", 1024 ** 2, ["MB"]);

new Quantity(2, megabyte).in(kilobyte); // 2048
```

### Affine units (offset, not just scale)

```ts
const temperature = new Dimension("temperature");
const kelvin = temperature.base("kelvin", ["K"]);
// value_in_base = value * scale + offset
const celsius = temperature.affine("celsius", { scale: 1, offset: 273.15 }, ["C"]);
```

### Fully custom transforms

For anything non-linear, provide an explicit inverse pair:

```ts
const dim = new Dimension("custom");
dim.base("base");
dim.custom("squared", {
  toBase: (x) => x * x,
  fromBase: (x) => Math.sqrt(x),
});
```

### Generating SI prefixes

`definePrefixed` adds the metric prefix ladder to a reference unit and returns the
created units keyed by name (skipping any name that already exists). Pass
`SI_SUBMULTIPLE_PREFIXES` to generate fractions only.

```ts
import { Dimension, Quantity, definePrefixed } from "measurable";

const data = new Dimension("data");
const bit = data.base("bit", ["b"]);
const prefixed = definePrefixed(data, { name: "bit", symbol: "b", scale: 1 });

new Quantity(1, prefixed.kilobit).in(bit); // 1000  (SI kilo = 1e3)
```

### Tagging units into a measurement system

```ts
import { MeasurementSystem } from "measurable";

const si = new MeasurementSystem("si").add(byte, kilobyte, megabyte);
si.has(kilobyte); // true
```

## API reference

### `Dimension`

- `new Dimension(name)`
- `.base(name, aliases?)` — define the canonical base unit
- `.unit(name, scale, aliases?)` — linear unit (`scale` base units per unit)
- `.affine(name, { scale, offset }, aliases?)` — linear with additive offset
- `.custom(name, { toBase, fromBase }, aliases?)` — arbitrary inverse pair
- `.convert(value, from, to)` — convert a raw number between two of its units
- `.get(token)` — units matching a name/alias (`Unit[] | undefined`)
- `.has(unit)`, `.units`, `.baseUnit`

### `Unit`

A passive handle, normally created via a dimension's builder methods rather than
`new Unit` directly. Read-only properties:

- `.name` — the unit's canonical name
- `.dimension` — the `Dimension` it belongs to
- `.toBase(value)` → `number` — convert a value in this unit to base units
- `.fromBase(value)` → `number` — convert a value in base units to this unit

### `Quantity`

- `new Quantity(magnitude, unit)`
- `.to(target)` → `Quantity`
- `.in(target)` → `number`
- `.toString()` → `string` — e.g. `"5 kilometer"`
- `.plus(other)` / `.minus(other)` → `Quantity` — add/subtract another quantity (aliases: `add` / `sub`)
- `.times(factor)` / `.dividedBy(divisor)` → `Quantity` — scale by a number (aliases: `mul` / `div`)
- `.negate()` / `.abs()` → `Quantity`
- `.clamp(lower, upper)` → `Quantity` — bound to a range, in this unit
- `.round(decimals?)` → `Quantity` — round the magnitude (default 0 decimals)
- `.equals(other)` / `.notEquals(other)` → `boolean` (aliases: `eq` / `ne`)
- `.lessThan(other)` / `.greaterThan(other)` → `boolean` (aliases: `lt` / `gt`)
- `.lessThanOrEqual(other)` / `.greaterThanOrEqual(other)` → `boolean` (aliases: `lte` / `gte`)
- `.compareTo(other)` → `-1 | 0 | 1` — sort comparator
- `.isZero()` / `.isPositive()` / `.isNegative()` → `boolean`
- `Quantity.min(...quantities)` / `Quantity.max(...quantities)` / `Quantity.sum(...quantities)` → `Quantity`
- `Quantity.parse(input, dimension, { prefer? })` → `Quantity`

### `MeasurementSystem`

- `new MeasurementSystem(name)`
- `.add(...units)`, `.has(unit)`
- `.in(dimension)` → `Unit[]`
- `.express(quantity)` → `Quantity`

### Errors

- `InvalidConversionError` — units are from different dimensions
- `UnknownUnitError` — a parsed token matches no unit
- `AmbiguousUnitError` — a parsed token matches several units and no `prefer` was given

## License

ISC
