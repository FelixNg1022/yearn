# yearn

Interactive hero page — "get your daily fortune"

## Layer stack (bottom to top)

| z | Component        | Role                                      |
|---|------------------|-------------------------------------------|
| 0 | `GradientField`  | Full-bleed radial/linear gradient bg      |
| 1 | `ArchLayer`      | Central arch shape with gradient fill     |
| 2 | `CloudLayer`     | Cream-colored cloud SVGs flanking arch    |
| 3 | `Wordmark`       | Large "yearn" display type                |
| 4 | `Florals`        | Poppy/flower SVG illustrations            |
| 5 | `CTA`            | Call-to-action button/text                |

## SVG inventory

| Component       | Source file                        |
|-----------------|------------------------------------|
| `BackWindow`    | `src/assets/svg/back-window.svg`   |
| `TopCloud`      | `src/assets/svg/topcloud.svg`      |
| `BottomCloud`   | `src/assets/svg/bottomcloud.svg`   |
| `BackFlower`    | `src/assets/svg/back-flower.svg`   |
| `MiddleFlower`  | `src/assets/svg/middle-flower.svg` |
| `FrontFlower`   | `src/assets/svg/front-flower.svg`  |

## Assets

Drop raw SVG files into `src/assets/svg/`.

## Development

```bash
npm install
npm run dev    # http://localhost:5173
```
