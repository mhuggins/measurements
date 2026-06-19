# measurable

Convert between units of measurement, with batteries-included common units and
first-class support for defining your own.

- **Exact, no drift** — magnitudes are held as exact rational numbers and
  conversions run in rational arithmetic, collapsing to a float only when you
  read `.magnitude`. So `foot → inch` is exactly `12` (not `12.000000000000002`),
  and chains and round trips like `liter → gallon → liter` come back to exactly
  what you started with.
- **No redundant factors** — each unit defines a single transform to its
  dimension's base unit; reverse conversions are derived, never stored, so they
  can't fall out of sync.
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
| `measurable`             | The building blocks: `Quantity`, `Dimension`, `MeasurementSystem`, `Unit`, `Rational`, errors |
| `measurable/dimensions`  | Predefined dimensions and their units (`length`, `meter`, `volume`, …)    |
| `measurable/systems`     | Predefined measurement systems (`metric`, `imperial`, `usCustomary`)      |

## Quick start

```ts
import { Quantity } from "measurable";
import { meter, mile, foot, inch, celsius, fahrenheit } from "measurable/dimensions";

// Convert: `.to()` returns a Quantity, `.in()` returns a raw number.
new Quantity(5, mile).to(meter).magnitude; // 8046.72
new Quantity(5, mile).in(meter);           // 8046.72

// Affine scales work the same way.
new Quantity(100, celsius).in(fahrenheit); // 212

// Conversions are exact: magnitudes are rationals under the hood.
new Quantity(1, foot).in(inch);                          // 12 (not 12.000000000000002)
new Quantity(1, foot).to(inch).to(foot).magnitude;       // 1 (exact round trip)
```

## Concepts

- **`Dimension`** — a kind of measurable quantity (length, volume, mass, …). It
  owns a canonical **base unit** and is where all conversion happens. A unit
  belongs to exactly one dimension.
- **`Unit`** — a name plus a transform into its dimension's base unit: an exact
  rational `scale`/`offset` for linear and affine units, or an arbitrary
  function pair for `custom` ones. Created through a dimension's builder methods.
- **`Quantity`** — a magnitude paired with a unit (e.g. `5 kilometer`). The
  magnitude is held as an exact **`Rational`**; `.magnitude` reads it as a
  `number`.
- **`Rational`** — an exact rational number (`n / d` over `bigint`s) used for the
  lossless arithmetic above. You rarely construct one directly, but can pass one
  anywhere a magnitude or scale is expected.
- **`MeasurementSystem`** — a cross-dimension tag (metric/imperial/…). A unit can
  belong to many; membership is optional and never affects whether a conversion
  is allowed.

## Exact arithmetic

A linear conversion is inherently rational — a foot is exactly `3048/10000` m and
an inch exactly `254/10000` m, so a foot is exactly `12` inches. Storing those
ratios as binary floats and routing values through the base unit loses that
(`1 foot → inch` would give `12.000000000000002`).

Instead, each `Quantity` keeps its magnitude as an exact `Rational`, and
conversions/arithmetic run in rational arithmetic, collapsing to a `number` only
when you read `.magnitude` (or call `.in()`). Because nothing is collapsed
mid-chain, conversions compose without accumulating drift:

```ts
import { Quantity } from "measurable";
import { liter, usGallon } from "measurable/dimensions";

// A round trip through an awkward ratio still lands exactly on 7.
new Quantity(7, liter).to(usGallon).to(liter).magnitude; // 7

// .rational exposes the underlying exact value (always in lowest terms).
new Quantity(7, liter).to(usGallon).rational; // Rational 125000000/67596639
```

This is exact for linear and affine units. A conversion that passes through a
non-linear `custom` unit (e.g. a logarithmic scale) necessarily uses floating
point and recaptures the result as a rational, so it is best-effort there.

## Built-in dimensions

Import any dimension or unit from `measurable/dimensions`:

| Dimension            | Base                     | Units (a selection)                                                                                          |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `length`             | `meter`                  | `kilometer`, `centimeter`, `millimeter`, `inch`, `foot`, `yard`, `mile`                                       |
| `area`               | `squareMeter`            | `squareKilometer`, `hectare`, `are`, `squareInch`, `squareFoot`, `squareYard`, `acre`, `squareMile`          |
| `volume`             | `liter`                  | `milliliter`, `us*`/`imperial*` `Gallon`/`Quart`/`Pint`/`Gill`/`FluidOunce`, `cup`, `tablespoon`, `teaspoon`  |
| `mass`               | `gram`                   | `kilogram`, `milligram`, `tonne`, `pound`, `ounce`, `stone`, `shortTon`, `longTon`                            |
| `time`               | `second`                 | `millisecond`, `minute`, `hour`, `day`, `week`                                                                |
| `temperature`        | `kelvin`                 | `celsius`, `fahrenheit`                                                                                       |
| `angle`              | `radian`                 | `degree`, `gradian`, `turn`                                                                                   |
| `force`              | `newton`                 | `kilonewton`, `dyne`, `poundForce`, `kilogramForce`                                                           |
| `energy`             | `joule`                  | `kilojoule`, `wattHour`, `kilowattHour`, `calorie`, `kilocalorie`, `britishThermalUnit`                       |
| `power`              | `watt`                   | `kilowatt`, `megawatt`, `horsepower`, `metricHorsepower`                                                      |
| `pressure`           | `pascal`                 | `kilopascal`, `bar`, `millibar`, `atmosphere`, `torr`, `psi`, `inchOfMercury`, `inchOfWater`                  |
| `frequency`          | `hertz`                  | `kilohertz`, `megahertz`, `gigahertz`, `terahertz`                                                            |
| `data`               | `bit`                    | `byte`, `nibble`, `kilobyte`…`petabyte` (SI), `kibibyte`…`pebibyte` (IEC)                                     |
| `illuminance`        | `lux`                    | `kilolux`, `millilux`, `footCandle`, `phot`                                                                   |
| `luminance`          | `candelaPerSquareMeter`  | `nit`, `stilb`                                                                                                |
| `luminousIntensity`  | `candela`                | `kilocandela`, `millicandela`, `candlepower`, `hefnerkerze`                                                   |

The metric units carry the **full SI prefix ladder** (yotta → yocto), generated for
you: the SI-based dimensions (`length`, `mass`, `volume`, `force`, `energy`, `power`,
`pressure`, `frequency`, `illuminance`, `luminousIntensity`) get every prefix (so
`kilogram` itself is just the kilo-prefixed gram), while `time` and `angle` get the
fractional prefixes only (e.g. `millisecond`, `microradian`). Every generated rung
parses from its symbol (`dm`, `hm`, `Mg`, `kL`, `ns`, `GHz`, `kPa`, and `µm`/`um` for
micro) and converts like any other unit. `data` additionally carries the **IEC binary**
multiples (`kibibyte`, `mebibyte`, … = 1024-based) alongside the SI decimal ones
(`kilobyte`, … = 1000-based). You can apply the same ladder to your own dimensions with
`definePrefixed` (see below).

### Prefixed unit exports

Each prefixed dimension exports a **record** holding the _complete_ generated ladder
keyed by name (the return value of `definePrefixed`), plus a **curated subset of those
same units as individual named exports** for convenience. Reach any rung that isn't
exported individually through the record — e.g. `metricLength.gigameter`,
`metricMass.exagram` — or by parsing its symbol.

| Dimension           | Record export(s)                 | Individually exported units                                                                                       |
| ------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `length`            | `metricLength`                   | `kilometer`, `hectometer`, `decameter`, `decimeter`, `centimeter`, `millimeter`, `micrometer`, `nanometer`        |
| `mass`              | `metricMass`                     | `kilogram`, `megagram`, `hectogram`, `decagram`, `decigram`, `centigram`, `milligram`, `microgram`, `nanogram`    |
| `volume`            | `metricVolume`                   | `kiloliter`, `hectoliter`, `decaliter`, `deciliter`, `centiliter`, `milliliter`                                    |
| `time`              | `metricTime`                     | `millisecond`, `microsecond`, `nanosecond`, `picosecond`                                                          |
| `angle`             | `metricAngle`                    | `milliradian`, `microradian`                                                                                       |
| `force`             | `metricForce`                    | `meganewton`, `kilonewton`, `millinewton`, `micronewton`                                                           |
| `energy`            | `metricEnergy`, `metricWattHour` | `kilojoule`, `megajoule`, `gigajoule`, `millijoule`; `kilowattHour`, `megawattHour`, `gigawattHour`               |
| `power`             | `metricPower`                    | `kilowatt`, `megawatt`, `gigawatt`, `terawatt`, `milliwatt`                                                        |
| `pressure`          | `metricPressure`                 | `kilopascal`, `hectopascal`, `megapascal`, `gigapascal`                                                            |
| `frequency`         | `metricFrequency`                | `kilohertz`, `megahertz`, `gigahertz`, `terahertz`, `petahertz`, `millihertz`                                      |
| `illuminance`       | `metricIlluminance`              | `kilolux`, `millilux`, `microlux`                                                                                  |
| `luminousIntensity` | `metricLuminousIntensity`        | `kilocandela`, `millicandela`, `microcandela`                                                                      |
| `data`              | `dataMultiples`                  | `kilobit`/`kilobyte` … `petabit`/`petabyte` (SI), `kibibit`/`kibibyte` … `pebibit`/`pebibyte` (IEC)               |

```ts
import { metricLength, kilometer } from "measurable/dimensions";

kilometer === metricLength.kilometer; // true — the named export is the same unit
metricLength.gigameter;               // a rung not exported by name, reached via the record
```

## Built-in measurement systems

Import `metric`, `imperial`, or `usCustomary` from `measurable/systems`.

```ts
import { foot } from "measurable/dimensions";
import { imperial, usCustomary, metric } from "measurable/systems";

imperial.has(foot);      // true  — a unit can belong to several systems
usCustomary.has(foot);   // true
metric.has(foot);        // false
```

Membership spans every dimension: SI units (`squareMeter`, `pascal`, `watt`, `joule`,
`hertz`, `lux`, `candela`, and their prefix ladders) are tagged into `metric`, while the
customary ones (`squareFoot`, `acre`, `psi`, `horsepower`, `britishThermalUnit`,
`footCandle`, `candlepower`) belong to both `imperial` and `usCustomary`. Units tied to
no real-world standard (e.g. `atmosphere`, `torr`, and the `data` multiples) stay
untagged — they still convert, they just won't appear under any system.

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

Under the hood, `express` just hands the system's units for that dimension to
`Quantity.best`, the same best-fit primitive you can call directly with whatever
units you like — handy when you want a custom shortlist rather than a whole
system. `best` picks the largest unit whose absolute magnitude is still ≥ 1
(falling back to the smallest when even that rounds below 1), so candidate order
doesn't matter:

```ts
import { Quantity } from "measurable";
import { meter, kilometer, mile } from "measurable/dimensions";

new Quantity(5000, meter).best(meter, kilometer, mile);  // Quantity(3.107…, mile)
new Quantity(1500, meter).best(meter, kilometer);        // Quantity(1.5, kilometer)
new Quantity(500, meter).best(kilometer, mile);          // Quantity(0.5, kilometer) — smallest fallback
```

It requires at least one unit, and each must belong to the quantity's dimension
(otherwise `InvalidConversionError`).

## Formatting output

Each unit carries a canonical `symbol` (`"g"`, `"km"`, `"°C"`) and `plural`
(`"grams"`, `"kilometers"`) alongside its `name`, so a `Quantity` can be rendered the
way you want:

```ts
import { Quantity } from "measurable";
import { gram } from "measurable/dimensions";

new Quantity(5, gram).toString();                 // "5 gram"   (always the bare name)
new Quantity(5, gram).format();                   // "5 grams"  (magnitude-aware)
new Quantity(1, gram).format();                   // "1 gram"   (singular at ±1)
new Quantity(5, gram).format({ unit: "symbol" }); // "5 g"
new Quantity(5, gram).format({ unit: "name" });   // "5 gram"
new Quantity(5, gram).format({ unit: "plural" }); // "5 grams"

// Localize the magnitude with locale / numberFormat (passed to toLocaleString):
new Quantity(1234.5, meter).format({ locale: "de-DE" });                             // "1.234,5 meters"
new Quantity(1.23456, meter).format({ numberFormat: { maximumFractionDigits: 2 } }); // "1.23 meters"
new Quantity(1234.5, kilometer).format({ locale: "de-DE", unit: "symbol" });         // "1.234,5 km"
```

`toString()` is intentionally stable (`"<magnitude> <name>"`). `format(options?)` is the
flexible one: `unit` defaults to `"auto"` (singular `name` at ±1, otherwise `plural`) and
accepts `"name"`, `"plural"`, or `"symbol"`. When a unit has no `symbol`/`plural`, those
modes fall back to its `name`.

The magnitude is rendered with `Number.prototype.toLocaleString`. Pass `locale` (a BCP 47
locale or array) and/or `numberFormat` (`Intl.NumberFormatOptions` — precision via
`maximumFractionDigits`, grouping, `style`, …) to control it; with neither set, the
runtime's default locale is used. Use `round(decimals)` to trim the magnitude first
(`new Quantity(1.6213, mile).round(2)` → `1.62 mile`).

When a single string won't do — e.g. styling the magnitude in a React component — use
`formatParts(options?)`, which takes the same options but returns the rendered
`{ magnitude, unit }` as separate strings for you to assemble:

```tsx
const { magnitude, unit } = new Quantity(1234.5, kilometer).formatParts({ locale: "de-DE" });
// { magnitude: "1.234,5", unit: "kilometers" }
return <><b>{magnitude}</b> {unit}</>;
```

### Internationalization

`format()` localizes the **magnitude** (via `locale`/`numberFormat`), but the **label** it
appends — `symbol`/`plural` — is **English/canonical** convenience data, not a localization
system: a single plural string can't model languages with several plural forms, and the
names themselves are English. For a fully localized label, delegate to `Intl.NumberFormat`,
whose `style: "unit"` localizes **and** pluralizes a curated set of units for you:

```ts
const q = new Quantity(5, kilometer);
new Intl.NumberFormat("de", { style: "unit", unit: "kilometer" }).format(q.magnitude);
// "5 Kilometer"
new Intl.NumberFormat("fr", { style: "unit", unit: "kilometer", unitDisplay: "short" })
  .format(q.magnitude); // "5 km"
```

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
dimension); `times`/`dividedBy` apply a dimensionless scalar (a `number` or a
`Rational`), and `negate`/`abs` transform the magnitude. All return a **new**
`Quantity` in the receiver's unit and leave the operands untouched. Like
conversions, the arithmetic is exact — `q.times(3).dividedBy(3)` returns `q`.

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

## Ratios

`ratioTo` divides two quantities of the **same dimension** and returns a plain
(dimensionless) number — _how many of one fit in the other_:

```ts
import { Quantity } from "measurable";
import { liter, milliliter } from "measurable/dimensions";

// How many 250 mL servings are in a 2 L bottle?
new Quantity(2, liter).ratioTo(new Quantity(250, milliliter)); // 8
```

This is different from `.in(unit)`: `.in(milliliter)` only uses the *unit* on the
right (giving `2000`), whereas `ratioTo` also uses the other quantity's
**magnitude** (the `250`), so it answers "how many of *that quantity* fit in this
one." It's the inverse of scalar `times` — `b.times(a.ratioTo(b))` reconstructs
`a`. Comparing different dimensions throws `InvalidConversionError`.

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
(`greaterThanOrEqual`). Comparison is exact rational comparison, so quantities
that are mathematically equal compare equal even when reaching them involved a
conversion that would have drifted in floating point — e.g.
`new Quantity(7, liter).to(usGallon).to(liter).equals(new Quantity(7, liter))` is
`true`.

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
many base units make up one of the unit being defined. The optional final argument
is a definition object — `{ symbol?, plural?, aliases? }` — whose `symbol` and
`plural` feed `format()` and, like `aliases`, are also registered for parsing.

```ts
import { Dimension, Quantity } from "measurable";

const data = new Dimension("data");
const byte = data.base("byte", { symbol: "B", plural: "bytes" }); // base unit (identity)
const kilobyte = data.unit("kilobyte", 1024, { symbol: "KB", plural: "kilobytes" });
const megabyte = data.unit("megabyte", 1024 ** 2, { symbol: "MB", plural: "megabytes" });

new Quantity(2, megabyte).in(kilobyte);      // 2048
new Quantity(2, megabyte).format();          // "2 megabytes"
new Quantity(2, megabyte).format({ unit: "symbol" }); // "2 MB"
```

A numeric `scale` is read as the exact decimal you wrote (`0.0254` → `254/10000`),
which is exact for any terminating decimal. For a ratio a decimal **can't**
represent exactly — e.g. `5/9` — pass a `Rational` so it stays exact:

```ts
import { Dimension, Rational } from "measurable";

const ratio = new Dimension("ratio");
ratio.base("whole");
const third = ratio.unit("third", new Rational(1, 3)); // exact, not 0.3333…
```

### Affine units (offset, not just scale)

```ts
import { Dimension, Rational } from "measurable";

const temperature = new Dimension("temperature");
const kelvin = temperature.base("kelvin", { symbol: "K" });
// value_in_base = value * scale + offset
const celsius = temperature.affine("celsius", { scale: 1, offset: 273.15 }, {
  symbol: "°C",
  aliases: ["C"],
});
// Fahrenheit's 5/9 isn't a terminating decimal — give it (and the derived
// offset) as exact Rationals so conversions round-trip without drift.
const scale = new Rational(5, 9);
const fahrenheit = temperature.affine(
  "fahrenheit",
  { scale, offset: Rational.from(273.15).minus(new Rational(32).times(scale)) },
  { symbol: "°F", aliases: ["F"] },
);
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

`definePrefixed` adds the metric prefix ladder to a reference **unit** and returns the
created units keyed by name (skipping any name that already exists). It reads the
reference's `name`, `symbol`, and scale straight off the unit (via `scaleOf`), so each
generated unit gets a derived symbol (`b` → `kb`) and plural too — even when the
reference isn't the base unit. Pass `SI_SUBMULTIPLE_PREFIXES` to generate fractions only.

```ts
import { Dimension, Quantity, definePrefixed } from "measurable";

const data = new Dimension("data");
const bit = data.base("bit", { symbol: "b", plural: "bits" });
const prefixed = definePrefixed(data, bit);

new Quantity(1, prefixed.kilobit).in(bit);   // 1000  (SI kilo = 1e3)
prefixed.kilobit.symbol;                     // "kb"
new Quantity(5, prefixed.kilobit).format({ unit: "symbol" }); // "5 kb"
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
- `.base(name, def?)` — define the canonical base unit
- `.unit(name, scale, def?)` — linear unit (`scale` base units per unit; `number | Rational`)
- `.affine(name, { scale, offset }, def?)` — linear with additive offset (each `number | Rational`)
- `.custom(name, { toBase, fromBase }, def?)` — arbitrary inverse pair, for non-linear units
- `.convert(value, from, to)` — convert a raw `number` between two of its units
- `.convertRational(value, from, to)` → `Rational` — exact conversion between two of its units
- `.get(token)` — units matching a name/alias (`Unit[] | undefined`)
- `.has(unit)`, `.units`, `.baseUnit`

`def` is an optional `UnitDef`: `{ symbol?, plural?, aliases? }`. All three are
registered as parse tokens; `symbol`/`plural` are additionally stored on the `Unit`.

### `Unit`

A passive handle, normally created via a dimension's builder methods rather than
`new Unit` directly. Read-only properties:

- `.name` — the unit's canonical name
- `.symbol?` — canonical symbol (e.g. `"g"`, `"km"`), if declared
- `.plural?` — plural name (e.g. `"grams"`), if declared
- `.dimension` — the `Dimension` it belongs to
- `.linear` → `{ scale: Rational; offset: Rational } | undefined` — the exact transform for linear/affine units (`undefined` for `custom` ones)
- `.toBase(value)` → `number` — convert a value in this unit to base units
- `.fromBase(value)` → `number` — convert a value in base units to this unit

### `Quantity`

- `new Quantity(magnitude, unit)` — `magnitude` is a `number | Rational`; throws on a non-finite `number`
- `.magnitude` → `number` — getter, derived from `.rational`
- `.rational` → `Rational` — the exact magnitude (source of truth)
- `.to(target)` → `Quantity`
- `.in(target)` → `number`
- `.toString()` → `string` — stable `"<magnitude> <name>"`, e.g. `"5 kilometer"`
- `.format({ unit?, locale?, numberFormat? })` → `string` — `unit`: `"auto"` (default, magnitude-aware) / `"name"` / `"plural"` / `"symbol"`; `locale` + `numberFormat` localize the magnitude via `toLocaleString`
- `.formatParts(options?)` → `{ magnitude, unit }` — same options as `.format`, but returns the rendered pieces separately for custom assembly (e.g. JSX)
- `.plus(other)` / `.minus(other)` → `Quantity` — add/subtract another quantity (aliases: `add` / `sub`)
- `.times(factor)` / `.dividedBy(divisor)` → `Quantity` — scale by a `number | Rational` (aliases: `mul` / `div`)
- `.ratioTo(other)` → `number` — dimensionless ratio (how many of `other` fit in this)
- `.negate()` / `.abs()` → `Quantity`
- `.clamp(lower, upper)` → `Quantity` — bound to a range, in this unit
- `.round(decimals?)` → `Quantity` — round the magnitude (default 0 decimals)
- `.best(...units)` → `Quantity` — re-express in the largest given unit whose absolute magnitude is still ≥ 1 (smallest as fallback); needs ≥ 1 unit, all of this dimension
- `.equals(other)` / `.notEquals(other)` → `boolean` (aliases: `eq` / `ne`)
- `.lessThan(other)` / `.greaterThan(other)` → `boolean` (aliases: `lt` / `gt`)
- `.lessThanOrEqual(other)` / `.greaterThanOrEqual(other)` → `boolean` (aliases: `lte` / `gte`)
- `.compareTo(other)` → `-1 | 0 | 1` — sort comparator
- `.isZero()` / `.isPositive()` / `.isNegative()` → `boolean`
- `Quantity.min(...quantities)` / `Quantity.max(...quantities)` / `Quantity.sum(...quantities)` → `Quantity`
- `Quantity.parse(input, dimension, { prefer? })` → `Quantity`

### `Rational`

An exact rational number (`n / d`), stored as `bigint`s in lowest terms with a
positive denominator. Immutable; every operation returns a new `Rational`. Used
internally for lossless conversions and arithmetic, but you can construct one to
pass anywhere a magnitude or scale is accepted.

- `new Rational(numerator, denominator?)` — from integers (`bigint | number`; denominator defaults to `1`). Throws on a non-integer `number` or a zero denominator.
- `Rational.from(value)` — coerce a `number | Rational` (a `number` is read as its exact terminating decimal, e.g. `0.0254` → `254/10000`)
- `.n` / `.d` → `bigint` — numerator and denominator
- `.plus(other)` / `.minus(other)` / `.times(other)` / `.dividedBy(other)` → `Rational` (aliases: `add` / `sub` / `mul` / `div`)
- `.negate()` / `.abs()` → `Rational`
- `.equals(other)` → `boolean` (alias: `eq`)
- `.compare(other)` → `-1 | 0 | 1`
- `.sign()` → `-1 | 0 | 1`
- `.toNumber()` → `number` — collapse to the nearest `number`

### `MeasurementSystem`

- `new MeasurementSystem(name)`
- `.add(...units)`, `.has(unit)`
- `.in(dimension)` → `Unit[]`
- `.express(quantity)` → `Quantity`

### Errors

- `InvalidConversionError` — units are from different dimensions
- `UnknownUnitError` — a parsed token matches no unit
- `AmbiguousUnitError` — a parsed token matches several units and no `prefer` was given

## Changelog

See [CHANGELOG.md](https://github.com/mhuggins/measurable/blob/main/CHANGELOG.md)
for release notes. Note that v2.0.0 is a breaking release — see its entry for the
migration details.

## License

ISC
