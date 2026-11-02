// One reusable noise source per tool; gestures only adjust their envelopes.
export class FoodSound {
  private context?: AudioContext;
  private sauce?: GainNode;
  private sugar?: GainNode;
  private sources: AudioBufferSourceNode[] = [];
  private epochs = { sauce: 0, sugar: 0 };
  enabled = true;

  private async ready() {
    if (!this.enabled) return false;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        const ctx = this.context;
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const values = buffer.getChannelData(0);
        let soft = 0;
        for (let i = 0; i < values.length; i++) {
          soft = soft * .78 + (Math.random() * 2 - 1) * .22;
          const pulse = .25 + .75 * Math.sin(i / ctx.sampleRate * 47) ** 8;
          values[i] = soft * pulse;
        }
        for (const tool of ['sauce', 'sugar'] as const) {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.playbackRate.value = tool === 'sugar' ? .75 : 1;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = tool === 'sugar' ? 1500 : 2300;
          const gain = ctx.createGain();
          gain.gain.value = 0;
          source.connect(filter).connect(gain).connect(ctx.destination);
          source.start();
          this.sources.push(source);
          this[tool] = gain;
        }
      }
      if (this.context.state === 'suspended') await this.context.resume();
      return this.enabled && this.context.state === 'running';
    } catch { return false; }
  }

  async gesture(tool: 'sauce' | 'sugar') {
    const epoch = this.epochs[tool];
    if (!await this.ready()) return;
    const ctx = this.context, gain = this[tool];
    if (!ctx || !gain || !this.enabled || epoch !== this.epochs[tool]) return;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(tool === 'sauce' ? .11 : .045, now + .025);
    gain.gain.setTargetAtTime(0, now + (tool === 'sauce' ? .065 : .22), tool === 'sauce' ? .025 : .05);
  }

  stop(tool?: 'sauce' | 'sugar', immediate = false) {
    const ctx = this.context;
    for (const name of tool ? [tool] : ['sauce', 'sugar'] as const) {
      this.epochs[name]++;
      if (!ctx) continue;
      const gain = this[name];
      if (!gain) continue;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      if (immediate) gain.gain.setValueAtTime(0, ctx.currentTime);
      else gain.gain.setTargetAtTime(0, ctx.currentTime, .025);
    }
  }

  mute(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stop(undefined, true);
  }

  dispose() {
    this.stop(undefined, true);
    this.sources.forEach(source => source.stop());
    void this.context?.close().catch(() => {});
  }
}