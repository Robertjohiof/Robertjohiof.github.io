# Robert Johannessen · Portfolio

**Live: https://robertjohiof.github.io**

My portfolio: full-stack web development, interactive visualisation and graphic design from my bachelor in Information Systems at Østfold University College.

## Built with
- Plain HTML, CSS and JavaScript, no framework and no build step
- An interactive dot field on a `<canvas>` that reacts to the mouse, a custom cursor with a glowing trail, and hover effects that only animate opacity to stay fast
- Project pages that open in place with shareable links (`#/p/project-name`), live demos in an `<iframe>`, a lightbox, a sketch-to-logo comparison slider, and an audio player with a live waveform (Web Audio API)
- Responsive down to small phones, dark and light themes, keyboard accessible, and respects reduced motion

## Structure
| Path | Contents |
|---|---|
| `index.html` | The page |
| `js/data.js` | All the content: projects, timeline and skills |
| `js/main.js` | Interactions and rendering |
| `css/style.css` | Design system and layout |
| `bachelor.html` | Case study of my bachelor thesis, with an interactive demo on a fictional network |
| `assets/` | Screenshots, design work, photos and audio |

## Run locally
Any static file server works, for example:

```bash
python -m http.server 8000
```

© Robert Johannessen. The design work, illustrations and troll voices are my own and may not be reused without permission.
