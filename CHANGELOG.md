# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-06-18

This release adds value **formatting**. Units now carry a `symbol` and `plural`,
and a `Quantity` can render itself with magnitude-aware pluralization and
locale-aware number formatting. Threading symbol/plural through the unit builders
changes their signatures, hence the major bump.

### Breaking

- **Unit builder methods take a `UnitDef` object instead of an aliases array.**
  `Dimension.base` / `unit` / `affine` / `custom` now accept
  `{ symbol?, plural?, aliases? }` as their final argument rather than a bare
  `string[]` of aliases. Migrate `length.unit("inch", 0.0254, ["in", "inches"])`
  to `length.unit("inch", 0.0254, { symbol: "in", plural: "inches" })`; plain
  aliases still work via the `aliases` field.
- **`definePrefixed` takes the reference `Unit`, not a descriptor object.**
  `definePrefixed(length, { name: "meter", symbol: "m" })` becomes
  `definePrefixed(length, meter)` — it reads the name, symbol, and exact scale
  straight off the unit. The `PrefixReference` type is removed.
- **`Unit`'s constructor options gained `symbol` / `plural`.** Only affects code
  that calls `new Unit(...)` directly; units built through a `Dimension` are
  unaffected.

### Added

- **`Unit.symbol` and `Unit.plural`** — optional, first-class descriptors. Both
  are also registered as parse tokens, so `Quantity.parse` accepts e.g. `"5 g"`
  and `"5 grams"`.
- **`Quantity.format(options?)`** — renders `"<magnitude> <label>"`. `unit`
  selects the label: `"auto"` (default — singular `name` at ±1, otherwise
  `plural`), `"name"`, `"plural"`, or `"symbol"`, each falling back to `name`
  when unset. The magnitude is rendered with `toLocaleString`; pass `locale`
  and/or `numberFormat` (`Intl.NumberFormatOptions`) for locale- and
  precision-aware output.
- **`Quantity.formatParts(options?)`** — the same options as `format`, but
  returns the rendered `{ magnitude, unit }` as separate strings for custom
  assembly (e.g. JSX).
- **`definePrefixed` derives each variant's `symbol` and `plural`** from the
  reference unit (e.g. `meter` → `kilometer` / `km`), keeping the prefixed scale
  exact via rational arithmetic.
- New exported types: `UnitDef`, `FormatOptions`, `FormattedParts`,
  `BaseUnitOptions`, `UnitConversionOptions`, and `UnitOptions`.

### Changed

- Added `assert-never` as a (small) runtime dependency, used for exhaustiveness
  checking in formatting.

## [2.0.0] - 2026-06-18

This release makes conversions and quantity arithmetic **exact**. Magnitudes and
unit transforms are represented as exact rationals internally and only collapse
to a `number` at the edge, so `foot → inch` is exactly `12` (not
`12.000000000000002`) and chains and round trips no longer accumulate drift.

### Breaking

- **`Quantity.magnitude` is now a read-only getter** derived from the new
  `Quantity.rational`, rather than a writable field. Assigning to
  `quantity.magnitude` no longer works.
- **`Quantity` construction rejects non-finite magnitudes.**
  `new Quantity(Infinity, unit)` (or `NaN`) now throws instead of being accepted.
- **`Unit.toBase` / `Unit.fromBase` are methods, not function-valued fields.**
  Calling `unit.toBase(x)` is unchanged; holding an unbound reference such as
  `const f = unit.toBase` no longer works.
- **`Unit`'s constructor options changed shape** to a discriminated union
  (`{ linear }` vs `{ toBase, fromBase }`). Only affects code that calls
  `new Unit(...)` directly; the `Dimension` builder methods are unaffected.
- **Conversion results changed value.** Outputs are now exact, so values that
  previously carried floating-point error differ (e.g. `12.000000000000002` is
  now `12`). `Quantity` equality and comparison are now exact rational
  comparisons rather than float `===`, so quantities that are mathematically
  equal compare equal even across a conversion that previously drifted.
- **Requires Node >= 14** (declared via `engines`); the library now uses `bigint`.

### Added

- **`Rational`** — an exact rational number (`bigint` numerator/denominator),
  exported from the package root. Supports `plus`/`minus`/`times`/`dividedBy`
  (with `add`/`sub`/`mul`/`div` aliases), `negate`/`abs`, `equals`/`eq`,
  `compare`, `sign`, `toNumber`, and the static `Rational.from`.
- **`Quantity.rational`** exposes the exact magnitude; the constructor and
  `times`/`dividedBy` now accept `number | Rational`.
- **`Dimension.convertRational(value, from, to)`** — exact, rational-in /
  rational-out conversion.
- **`Unit.linear`** — the exact `{ scale, offset }` transform for linear and
  affine units (`undefined` for `custom` ones).
- **`Dimension.unit` and `Dimension.affine` accept `number | Rational`**, so a
  ratio a decimal cannot represent exactly (e.g. Fahrenheit's `5/9`) can be
  given exactly.
- New built-in dimensions: `area`, `data`, `energy`, `frequency`,
  `illuminance`, `luminance`, `luminousIntensity`, `power`, and `pressure`
  (each with its SI prefix ladder where applicable).
- `definePrefixed`'s reference `scale` is now optional, defaulting to `1`.

### Fixed

- Linear and affine conversions are now exact (`foot → inch` is `12`, `1 L → mL`
  round trips cleanly, and so on).
- SI-prefixed scales are computed in rational arithmetic, fixing drifted scales
  such as `nanowattHour` (`3600 × 1e-9`).
- Built-in Fahrenheit is defined with exact rationals and round-trips without
  drift in both directions.
- `Rational.toNumber` stays correctly rounded at extreme magnitudes (operands
  beyond `2^53`), where converting each operand to a double before dividing
  would otherwise lose precision.

## [1.1.1] - 2026-06-17

### Fixed

- Enable `embed-readme` so the README renders on npmjs.com.

## [1.1.0] - 2026-06-17

### Added

- SI metric prefix ladders generated across the metric dimensions.
- `Quantity` arithmetic — `plus` / `minus` / `times` / `dividedBy` (with
  `add` / `sub` / `mul` / `div` aliases).
- `Quantity` comparison — `equals` / `notEquals` / `lessThan` / `greaterThan` /
  `lessThanOrEqual` / `greaterThanOrEqual` (with `eq` / `ne` / `lt` / `gt` /
  `lte` / `gte` aliases), plus `compareTo` as a sort comparator.
- `Quantity.ratioTo` for the dimensionless ratio between two quantities.
- `Quantity.abs` and the `Quantity.min` / `max` / `sum` statics.
- `clamp` as an instance method bounding a quantity to a range.
- `Quantity.toString`.
- `Quantity.isZero` / `isPositive` / `isNegative` predicates and `round`.

## [1.0.0] - 2026-06-16

### Added

- Initial release: the core conversion engine (`Dimension`, `Unit`, `Quantity`,
  `MeasurementSystem`), string parsing via `Quantity.parse`, and the first set
  of built-in dimensions and measurement systems.

[3.0.0]: https://github.com/mhuggins/measurable/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/mhuggins/measurable/compare/v1.1.1...v2.0.0
[1.1.1]: https://github.com/mhuggins/measurable/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/mhuggins/measurable/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mhuggins/measurable/releases/tag/v1.0.0
