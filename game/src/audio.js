// Procedural WebAudio only: engine, siren, pulse music and short impact effects.
export function createAudio() {
  let context = null;
  let armed = false;
  let enabled = true;
  let engine = null;
  let engineGain = null;
  let siren = null;
  let sirenGain = null;
  let musicClock = 0;
  let noteIndex = 0;
  const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];

  function ensure() {
    if (!armed || !enabled) return null;
    if (!context) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      context = new AC();
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function tone(freq, duration, type = 'sine', level = 0.05) {
    const ac = ensure();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    gain.gain.setValueAtTime(level, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, ac.currentTime + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration + 0.02);
  }

  function noise(duration, level = 0.04) {
    const ac = ensure();
    if (!ac) return;
    const frames = Math.floor(ac.sampleRate * duration);
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = ac.createBufferSource();
    const gain = ac.createGain();
    gain.gain.value = level;
    source.buffer = buffer;
    source.connect(gain).connect(ac.destination);
    source.start();
  }

  function sfx(name) {
    switch (name) {
      case 'shoot': tone(190, 0.09, 'square', 0.045); noise(0.06, 0.035); break;
      case 'melee': tone(120, 0.12, 'triangle', 0.05); break;
      case 'hit': tone(420, 0.07, 'sawtooth', 0.025); break;
      case 'impact': noise(0.08, 0.05); break;
      case 'explosion': noise(0.55, 0.12); tone(70, 0.5, 'sawtooth', 0.07); break;
      case 'enter': tone(330, 0.1, 'sine', 0.05); tone(440, 0.12, 'sine', 0.04); break;
      case 'exit': tone(300, 0.1, 'sine', 0.04); break;
      case 'pickup': tone(660, 0.1, 'sine', 0.05); tone(880, 0.14, 'sine', 0.04); break;
      case 'mission': tone(523, 0.18, 'triangle', 0.06); tone(784, 0.26, 'triangle', 0.05); break;
      case 'wanted': tone(392, 0.14, 'square', 0.04); tone(294, 0.18, 'square', 0.04); break;
      case 'reward': tone(587, 0.14, 'sine', 0.05); tone(880, 0.22, 'sine', 0.05); break;
      case 'crash': noise(0.2, 0.08); break;
      case 'ram': tone(90, 0.16, 'square', 0.04); break;
      case 'dry': tone(150, 0.04, 'square', 0.02); break;
      case 'click': tone(520, 0.05, 'sine', 0.03); break;
      case 'win': tone(523, 0.3, 'triangle', 0.06); tone(659, 0.4, 'triangle', 0.05); tone(784, 0.5, 'sine', 0.05); break;
      default: break;
    }
  }

  function ensureEngine() {
    const ac = ensure();
    if (!ac || engine) return;
    engine = ac.createOscillator();
    engineGain = ac.createGain();
    engine.type = 'sawtooth';
    engineGain.gain.value = 0;
    engine.connect(engineGain).connect(ac.destination);
    engine.start();
    siren = ac.createOscillator();
    sirenGain = ac.createGain();
    siren.type = 'square';
    sirenGain.gain.value = 0;
    siren.connect(sirenGain).connect(ac.destination);
    siren.start();
  }

  function update(dt, world) {
    if (!enabled || !armed) return;
    ensureEngine();
    if (!engine || !context) return;
    const speed = Math.abs(world?.player?.speed || 0);
    const driving = world?.player?.onFoot === false;
    engine.frequency.setTargetAtTime(58 + speed * 5.2, context.currentTime, 0.08);
    engineGain.gain.setTargetAtTime(driving ? 0.018 + Math.min(0.03, speed * 0.0007) : 0, context.currentTime, 0.15);
    const wanted = world?.wanted || 0;
    siren.frequency.setTargetAtTime(wanted > 2 ? 760 : 620, context.currentTime, 0.06);
    sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.014 : 0, context.currentTime, 0.2);
    musicClock -= dt;
    if (musicClock <= 0) {
      musicClock = 0.42;
      const note = SCALE[noteIndex % SCALE.length];
      noteIndex++;
      tone(note, 0.32, 'triangle', 0.011);
      if (noteIndex % 4 === 0) tone(note / 2, 0.5, 'sine', 0.012);
    }
  }

  function setEnabled(on) {
    enabled = Boolean(on);
    if (!enabled && context && context.state === 'running') context.suspend().catch(() => {});
    if (enabled && context && context.state === 'suspended') context.resume().catch(() => {});
  }

  return {
    resume() { armed = true; ensure(); },
    sfx, update, setEnabled,
    get enabled() { return enabled; },
  };
}
