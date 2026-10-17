# Amazonia — a dragonfly's rainforest

A procedural Amazon rainforest built in [three.js](https://threejs.org), designed to be explored from the perspective of an
8 cm flame-skimmer dragonfly. Everything (textures, trees, plants, animals and sound) is generated in the browser at load
time; there are no external assets.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/
```

Quality presets: `?q=low`, `?q=medium`, `?q=high` (default). The world is dense (hundreds of thousands of leaf cards,
millions of triangles); use `?q=medium` or `?q=low` on laptops/integrated GPUs.

## Controls

| | |
|---|---|
| Mouse | look (click to capture the pointer) |
| W A S D | fly |
| Space / E | rise · Q / C sink |
| Shift | dart (dragonfly burst speed) |
| Mouse wheel | cruise speed |
| F | perch on the nearest leaf, twig, vine or bark (any move key takes off) |
| V | chase camera / first person |
| T | cinematic tour (autopilot) |
| M | mute · H help |

## What's in the forest

**Vertical structure.** Trees are placed layer by layer (emergent → canopy → sub-canopy → understory) using
light-competition rasters: each new tree goes where its layer is most open, so every layer closes into a ceiling that
shades the one below.

**Tree growth.** Crowns are grown with a *space-colonisation* algorithm (`src/flora/growth.js`): attraction points fill a
species-specific crown envelope (umbrella crowns for emergent kapoks and giants, domes for canopy trees, narrow columns
for saplings). Branches grow toward the points, and limb thickness follows the pipe model, so big trees end up with massive
limbs feeding thousands of twigs. Foliage clusters sit on every twig tip.

- Old-growth giants (55–68 m) with huge wedge-shaped plank buttresses, flared bases and arching surface roots
- Kapok and Brazil-nut emergents, canopy and sub-canopy trees, cecropia pioneers along the river, flowering ipê
- Strangler figs, including hollow ones where the host has rotted away and only the root lattice remains
- Açaí palm clumps with berry clusters, stilt-rooted walking palms, tree ferns with fiddleheads

**Vines (`src/flora/vines.js`).** A *feasting liana* algorithm climbs a host trunk, follows the limbs out along the
colonised skeleton, then smothers the crown with its own foliage, bridges to neighbouring crowns and drops leafy curtains
from the edges. Every route is recorded as a traversal trail (`vines.trails`), and arboreal ant columns march along
them from the forest floor up into the canopy. There are also catenary lianas between crowns, woody lianas dropping to the
ground, monkey-ladder vines, aerial roots, climbing aroids, shingle plants and ground creepers.

**Epiphytes.** Tank bromeliads (some with poison-dart frogs), bird's-nest ferns, orchids, moss cushions, beard moss,
bracket fungi and arboreal termite nests with their covered runways.

**Forest floor.** Camera-following leaf litter and fern sprigs. Ferns, heliconias, monstera, philodendron, calathea,
peace lilies, ivory palms, spiral ginger and hot-lips. Mushrooms, parasols, cup and coral fungi, fallen sticks and dead
palm fronds. Fallen nurse logs (some hollow, some with upturned root plates), standing dead snags with woodpecker holes,
mossy stumps, and a leafcutter ant nest with its cleared trail.

**River.** A blackwater river with planar reflections, giant *Victoria* water lilies, water hyacinth, reeds, caimans and
capybaras.

**Fauna.** Blue morphos and other butterflies, dragonflies and helicopter damselflies, midge swarms, leafcutter and arboreal
ants, golden orb-weavers on their webs, macaws (flying pairs and perched), toucans, hummingbirds working the flowers, a
harpy eagle, sloths, an emerald tree boa and frogs.

**Atmosphere.** Height fog with sun in-scattering, canopy-coverage ambient occlusion, leaf translucency, god rays through
canopy gaps, sunlit dust motes, river mist, eye adaptation, bloom and grading, plus a procedural soundscape (insect
chorus, screaming piha, tinamous, macaws, frogs and the dragonfly's wing hum).

## Code map

```
src/core      rng, noise, shader patches (fog/AO/wind/translucency), textures, geometry builders, colliders
src/world     terrain + river, sky, water, distant canopy, god rays / motes / mist
src/flora     trees + growth (space colonisation), palms, plants, epiphytes, vines, ground & dead wood
src/fauna     insects, birds, frogs / sloths / boa / capybaras / caimans
src/player    dragonfly model, flight controller, chase camera, tour
src/post      bloom + grade; src/audio soundscape; src/ui HUD
```

Debug URL parameters: `?cam=x,y,z,yaw,pitch` to start at a pose, `?tour=0` to start without the autopilot, `?fpv=1`.
