/**
 * Procedural Web Audio API Soundscapes
 * Lightweight, zero-dependency synthetic audio haptics for the 3D Neural Universe.
 * Generates organic, ethereal chimes and resonance frequencies in real-time.
 */

let audioCtx: AudioContext | null = null;
let isMuted = false;

// Initialize or resume AudioContext on user interaction
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  
  if (localStorage.getItem('vb_audio_muted') === 'true') {
    isMuted = true;
  }

  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

export function isAudioEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('vb_audio_muted') !== 'true';
}

export function toggleAudio(): boolean {
  if (typeof window === 'undefined') return false;
  const currentlyMuted = localStorage.getItem('vb_audio_muted') === 'true';
  const newMuted = !currentlyMuted;
  localStorage.setItem('vb_audio_muted', String(newMuted));
  isMuted = newMuted;
  if (!newMuted) {
    playNodeTone('person'); // Play a soft chime on unmute
  }
  return !newMuted;
}

// Frequency tuning per cognitive category (Solfeggio and Harmonic ratios)
const CATEGORY_FREQUENCIES: Record<string, number> = {
  person:     528, // Love / Connection (528 Hz)
  place:      432, // Earth / Nature (432 Hz)
  restaurant: 480, // Warm culinary
  dish:       540, // Taste
  movie:      639, // Expressive / Story (639 Hz)
  show:       600, // Media
  book:       741, // Intuition / Clarity (741 Hz)
  event:      852, // Awakening Topaz (852 Hz)
  period:     396, // Grounding Era (396 Hz)
  school:     440, // Focus (Concert A)
  org:        350, // Industry / Stability
  item:       500, // Tactile
  other:      400, // Neutral
  tension:    293.66, // D4 Minor tension harmonic
};

/**
 * Plays an organic crystal resonant chime when interacting with a node
 */
export function playNodeTone(category = 'other', isTension = false) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const baseFreq = isTension ? CATEGORY_FREQUENCIES.tension : (CATEGORY_FREQUENCIES[category] || 432);
    const now = ctx.currentTime;

    // Primary fundamental tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, now);

    // Subtle overtone (octave + fifth) for crystal glass timbre
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseFreq * 1.5, now);

    // Envelope
    const duration = isTension ? 0.7 : 0.45;
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.exponentialRampToValueAtTime(0.02, now + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.8);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(ctx.destination);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.05);
    osc2.stop(now + duration + 0.05);
  } catch {}
}

/**
 * Plays a soft resonant pitch sweep during 4D temporal scrubbing
 */
export function playScrubTone(progress: number) { // 0.0 to 1.0
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const freq = 200 + progress * 400; // 200Hz to 600Hz
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  } catch {}
}

/**
 * Plays a double harmonic chord when an action or memory saves
 */
export function playSuccessChime() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    [528, 660, 792].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.001, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.06, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.65);
    });
  } catch {}
}
