// Minimal HUD: forest layer + altitude, loading progress, start overlay.
const LAYERS = [
  { max: 0.8, name: 'Forest Floor', note: 'leaf litter, fungi, leafcutter ants' },
  { max: 5, name: 'Shrub Layer', note: 'ferns, heliconias, palms & aroids' },
  { max: 17, name: 'Understory', note: 'saplings, lianas, tree ferns' },
  { max: 34, name: 'Canopy', note: 'bromeliads, orchids, toucans' },
  { max: 52, name: 'Emergent Layer', note: 'kapok crowns, harpy eagles' },
  { max: 1e9, name: 'Above the Canopy', note: 'macaws & open sky' },
];
export class HUD {
  constructor() {
    this.el = document.getElementById('hud');
    this.layer = document.getElementById('layerName');
    this.alt = document.getElementById('layerAlt');
    this.note = document.getElementById('layerNote');
    this.fps = document.getElementById('fps');
    this.current = null;
    this.frames = 0; this.acc = 0;
  }
  setScore(n) {
    const el = document.getElementById('score');
    el.textContent = `Ants eaten: ${n}`;
    el.classList.remove('hidden'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }
  progress(frac, msg) {
    document.getElementById('loadbar').style.width = (frac * 100).toFixed(0) + '%';
    if (msg) document.getElementById('loadmsg').textContent = msg;
  }
  ready() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('start').classList.remove('hidden');
    this.el.classList.remove('hidden');
  }
  update(dt, height) {
    const L = LAYERS.find((l) => height < l.max);
    if (L !== this.current) {
      this.current = L;
      this.layer.textContent = L.name;
      this.note.textContent = L.note;
      this.layer.parentElement.classList.remove('flash'); void this.layer.offsetWidth; this.layer.parentElement.classList.add('flash');
    }
    this.alt.textContent = height.toFixed(1) + ' m';
    this.frames++; this.acc += dt;
    if (this.acc > 0.5) { this.fps.textContent = Math.round(this.frames / this.acc) + ' fps'; this.frames = 0; this.acc = 0; }
  }
}
