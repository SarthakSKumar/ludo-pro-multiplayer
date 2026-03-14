// Sound effects utility using Web Audio API
class SoundManager {
  constructor() {
    this.enabled = true;
    this._ctx = null;
  }

  _getContext() {
    if (!this._ctx || this._ctx.state === "closed") {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (this._ctx.state === "suspended") {
      this._ctx.resume().catch(() => {});
    }
    return this._ctx;
  }

  playDiceRoll() {
    if (!this.enabled) return;
    const audioContext = this._getContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 200;
    gainNode.gain.value = 0.1;

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  }

  playTokenMove() {
    if (!this.enabled) return;
    const audioContext = this._getContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 440;
    gainNode.gain.value = 0.05;

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.05);
  }

  // Subtle click for each individual step during movement animation
  playTokenStep() {
    if (!this.enabled) return;
    const audioContext = this._getContext();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.type = "sine";
    osc.frequency.value = 520;
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.06,
    );
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.07);
  }

  // Sparkle sound when token lands on a star (safe) cell
  playStarLand() {
    if (!this.enabled) return;
    const audioContext = this._getContext();
    const notes = [880, 1047, 1319];
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = audioContext.currentTime + i * 0.07;
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  }

  playCapture() {
    if (!this.enabled) return;
    const audioContext = this._getContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 100;
    gainNode.gain.value = 0.1;

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  }

  playTokenHome() {
    if (!this.enabled) return;
    const audioContext = this._getContext();
    // Ascending celebratory jingle
    const notes = [660, 880, 1100];
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      const t = audioContext.currentTime + i * 0.12;
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  playWin() {
    if (!this.enabled) return;
    const audioContext = this._getContext();

    // Play a sequence of notes
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = freq;
      gainNode.gain.value = 0.1;

      const startTime = audioContext.currentTime + i * 0.15;
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.15);
    });
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

export const soundManager = new SoundManager();
