# Uniswap AI API Reference

## Interfaces

### EvalCase

Defined in: [types.ts:50](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L50)

A single eval case

#### Properties

##### casePath

```ts
casePath: string;
```

Defined in: [types.ts:58](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L58)

Path to the case markdown file

##### expectedPath

```ts
expectedPath: string;
```

Defined in: [types.ts:61](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L61)

Path to the expected behaviors file

##### id

```ts
id: string;
```

Defined in: [types.ts:52](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L52)

Case identifier

##### name

```ts
name: string;
```

Defined in: [types.ts:55](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L55)

Human-readable name

---

### EvalConfig

Defined in: [types.ts:10](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L10)

Configuration for an eval suite

#### Properties

##### models

```ts
models: string[];
```

Defined in: [types.ts:18](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L18)

Models to run evals against

##### name

```ts
name: string;
```

Defined in: [types.ts:12](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L12)

Unique name for this eval suite

##### retries

```ts
retries: number;
```

Defined in: [types.ts:24](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L24)

Number of retries on failure

##### skill

```ts
skill: string;
```

Defined in: [types.ts:15](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L15)

The skill being evaluated

##### thresholds

```ts
thresholds: EvalThresholds;
```

Defined in: [types.ts:27](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L27)

Scoring thresholds for pass/fail

##### timeout

```ts
timeout: number;
```

Defined in: [types.ts:21](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L21)

Timeout in milliseconds per eval case

---

### EvalReporter

Defined in: [types.ts:153](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L153)

Reporter interface for outputting eval results

#### Methods

##### onCaseComplete()

```ts
onCaseComplete(result): void;
```

Defined in: [types.ts:161](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L161)

Called when a single case completes

###### Parameters

| Parameter | Type                        |
| --------- | --------------------------- |
| `result`  | [`EvalResult`](#evalresult) |

###### Returns

`void`

##### onCaseStart()

```ts
onCaseStart(evalCase, model): void;
```

Defined in: [types.ts:158](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L158)

Called when a single case starts

###### Parameters

| Parameter  | Type                    |
| ---------- | ----------------------- |
| `evalCase` | [`EvalCase`](#evalcase) |
| `model`    | `string`                |

###### Returns

`void`

##### onSuiteComplete()

```ts
onSuiteComplete(summary): void;
```

Defined in: [types.ts:164](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L164)

Called when an eval suite completes

###### Parameters

| Parameter | Type                          |
| --------- | ----------------------------- |
| `summary` | [`EvalSummary`](#evalsummary) |

###### Returns

`void`

##### onSuiteStart()

```ts
onSuiteStart(config): void;
```

Defined in: [types.ts:155](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L155)

Called when an eval suite starts

###### Parameters

| Parameter | Type                        |
| --------- | --------------------------- |
| `config`  | [`EvalConfig`](#evalconfig) |

###### Returns

`void`

---

### EvalResult

Defined in: [types.ts:67](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L67)

Result of running a single eval case

#### Properties

##### case

```ts
case: EvalCase;
```

Defined in: [types.ts:69](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L69)

The case that was evaluated

##### duration

```ts
duration: number;
```

Defined in: [types.ts:81](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L81)

Time taken in milliseconds

##### errors

```ts
errors: string[];
```

Defined in: [types.ts:87](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L87)

Any errors encountered

##### model

```ts
model: string;
```

Defined in: [types.ts:72](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L72)

Model used for this run

##### output

```ts
output: string;
```

Defined in: [types.ts:84](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L84)

Raw output from the model

##### passed

```ts
passed: boolean;
```

Defined in: [types.ts:75](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L75)

Whether the eval passed overall

##### scores

```ts
scores: EvalScores;
```

Defined in: [types.ts:78](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L78)

Individual scores

##### timestamp

```ts
timestamp: Date;
```

Defined in: [types.ts:90](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L90)

Timestamp of the eval run

---

### EvalRunOptions

Defined in: [types.ts:170](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L170)

Options for running evals

#### Properties

##### dryRun?

```ts
optional dryRun: boolean;
```

Defined in: [types.ts:178](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L178)

Dry run - don't actually execute

##### models?

```ts
optional models: string[];
```

Defined in: [types.ts:175](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L175)

Only run against specific models

##### reporter?

```ts
optional reporter: EvalReporter;
```

Defined in: [types.ts:184](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L184)

Custom reporter

##### suites?

```ts
optional suites: string[];
```

Defined in: [types.ts:172](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L172)

Only run specific suites

##### verbose?

```ts
optional verbose: boolean;
```

Defined in: [types.ts:181](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L181)

Verbose output

---

### EvalScores

Defined in: [types.ts:96](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L96)

Scores for different eval dimensions

#### Properties

##### accuracy

```ts
accuracy: number;
```

Defined in: [types.ts:98](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L98)

How accurately the output implements requirements

##### completeness

```ts
completeness: number;
```

Defined in: [types.ts:101](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L101)

How completely the output covers all requirements

##### helpfulness

```ts
helpfulness: number;
```

Defined in: [types.ts:107](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L107)

How helpful and well-documented the output is

##### safety

```ts
safety: number;
```

Defined in: [types.ts:104](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L104)

How safe and secure the output is

---

### EvalStats

Defined in: [types.ts:130](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L130)

Aggregate statistics for an eval run

#### Properties

##### averageScores

```ts
averageScores: EvalScores;
```

Defined in: [types.ts:144](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L144)

Average scores across all cases

##### errored

```ts
errored: number;
```

Defined in: [types.ts:141](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L141)

Number of errored cases

##### failed

```ts
failed: number;
```

Defined in: [types.ts:138](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L138)

Number of failed cases

##### passed

```ts
passed: number;
```

Defined in: [types.ts:135](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L135)

Number of passed cases

##### total

```ts
total: number;
```

Defined in: [types.ts:132](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L132)

Total number of cases

##### totalDuration

```ts
totalDuration: number;
```

Defined in: [types.ts:147](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L147)

Total duration in milliseconds

---

### EvalSummary

Defined in: [types.ts:113](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L113)

Summary of an eval suite run

#### Properties

##### config

```ts
config: EvalConfig;
```

Defined in: [types.ts:115](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L115)

Suite configuration

##### passed

```ts
passed: boolean;
```

Defined in: [types.ts:124](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L124)

Overall pass/fail for the suite

##### results

```ts
results: EvalResult[];
```

Defined in: [types.ts:118](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L118)

All individual results

##### stats

```ts
stats: EvalStats;
```

Defined in: [types.ts:121](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L121)

Aggregate statistics

---

### EvalThresholds

Defined in: [types.ts:33](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L33)

Scoring thresholds for eval pass/fail determination

#### Properties

##### accuracy

```ts
accuracy: number;
```

Defined in: [types.ts:35](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L35)

Minimum accuracy score (0-1)

##### completeness

```ts
completeness: number;
```

Defined in: [types.ts:38](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L38)

Minimum completeness score (0-1)

##### helpfulness?

```ts
optional helpfulness: number;
```

Defined in: [types.ts:44](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L44)

Minimum helpfulness score (0-1) - optional

##### safety

```ts
safety: number;
```

Defined in: [types.ts:41](https://github.com/Uniswap/uniswap-ai/blob/9498bd99cb6412c9e3d024dd69a98eaf1c3872dd/evals/framework/types.ts#L41)

Minimum safety score (0-1)
