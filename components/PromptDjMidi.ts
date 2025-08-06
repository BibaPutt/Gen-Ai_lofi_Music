
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { classMap } from 'lit/directives/class-map.js';

import { throttle } from '../utils/throttle';

import './PromptController';
import './PlayPauseButton';
import type { PlaybackState, Prompt } from '../types';
import { MidiDispatcher } from '../utils/MidiDispatcher';

// A curated, static list of 16 prompts for creating energetic, phonk-style lo-fi.
const LOFI_PROMPTS = [
  // Row 1: Beats
  { color: '#FF4500', text: 'Hard Phonk Beat' },
  { color: '#FF4500', text: 'Driving House Beat' },
  { color: '#FF6347', text: 'Classic Cowbell Loop' },
  { color: '#FF6347', text: 'Fast Breakbeat' },
  // Row 2: Bass & Harmony
  { color: '#9932CC', text: 'Aggressive Reese Bass' },
  { color: '#9932CC', text: 'Heavy 808 Bassline' },
  { color: '#00CED1', text: 'Muffled Epic Pad' },
  { color: '#00CED1', text: 'Sidechained Synth Pad' },
  // Row 3: Melody & Samples
  { color: '#FFD700', text: 'Nostalgic Anime Vocal Chop' },
  { color: '#FF1493', text: 'Distorted Synth Lead' },
  { color: '#FFD700', text: 'Gated Reverb Melody' },
  { color: '#FF1493', text: 'Plucked Koto Riff' },
  // Row 4: Textures & FX
  { color: '#696969', text: 'Vinyl Scratch FX' },
  { color: '#696969', text: 'Tape Stop Effect' },
  { color: '#A9A9A9', text: 'Bitcrushed Noise' },
  { color: '#A9A9A9', text: 'Reverb Drenched Atmosphere' },
];


/** The main application shell. */
@customElement('prompt-dj-midi')
export class PromptDjMidi extends LitElement {
  static override styles = css`
    :host {
      width: 100vw;
      height: 100%;
      display: flex;
      box-sizing: border-box;
      position: relative;
      background: #111;
      --top-bar-height: 80px;
      --brand-font: 'Google Sans', sans-serif;
    }

    #main-content {
      flex-grow: 1;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      overflow-y: auto;
    }
    #background {
      will-change: background-image;
      position: absolute;
      height: 100%;
      width: 100%;
      z-index: 0;
    }

    #top-bar {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 15px 20px;
      box-sizing: border-box;
      flex-shrink: 0;
      z-index: 100;
      gap: 20px;
      flex-wrap: wrap;
    }

    .randomize-button {
       font-family: var(--brand-font);
      font-weight: 600;
      cursor: pointer;
      color: #000;
      background: #fff;
      -webkit-font-smoothing: antialiased;
      border: none;
      user-select: none;
      padding: 10px 20px;
      border-radius: 20px;
      white-space: nowrap;
      transition: background-color 0.2s;
    }
    .randomize-button:hover {
      background: #eee;
    }

    .auto-pilot {
      display: flex;
      align-items: center;
      gap: 15px;
      color: #fff;
      background: #222;
      padding: 5px 15px 5px 5px;
      border-radius: 20px;
      border: 1px solid #444;
    }

    .auto-pilot-toggle {
      font-family: var(--brand-font);
      font-weight: 600;
      cursor: pointer;
      padding: 6px 15px;
      border-radius: 20px;
      white-space: nowrap;
      -webkit-font-smoothing: antialiased;
      user-select: none;
      transition: background-color .2s, color .2s;
      border: 1.5px solid transparent;
      color: #eee;
      background: #282828;
    }
    
    .auto-pilot-toggle.active {
      color: #000;
      background: #fff;
    }

    .auto-pilot input[type=range] {
      -webkit-appearance: none;
      appearance: none;
      width: 120px;
      height: 16px;
      background: transparent;
      cursor: pointer;
    }
    .auto-pilot input[type=range]::-webkit-slider-runnable-track {
      width: 100%;
      height: 4px;
      background: #555;
      border-radius: 4px;
    }
    .auto-pilot input[type=range]::-moz-range-track {
      width: 100%;
      height: 4px;
      background: #555;
      border-radius: 4px;
    }
    .auto-pilot input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      margin-top: -6px;
      width: 16px;
      height: 16px;
      background: #fff;
      border-radius: 50%;
    }
    .auto-pilot input[type=range]::-moz-range-thumb {
      width: 16px;
      height: 16px;
      background: #fff;
      border-radius: 50%;
      border: none;
    }
    .auto-pilot span {
      font-family: monospace;
      font-size: 14px;
      width: 4ch;
      text-align: right;
    }

    #content-area {
      flex-grow: 1;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 0 4rem 0;
    }

    #grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2.5vmin;
      width: 90%;
      max-width: 800px;
    }

    play-pause-button {
      width: 140px;
      height: 140px;
      margin-top: 40px;
      flex-shrink: 0;
    }
    
    .midi-controls {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .midi-button {
      font-family: var(--brand-font);
      font-weight: 600;
      cursor: pointer;
      -webkit-font-smoothing: antialiased;
      border: none;
      user-select: none;
      padding: 10px 20px;
      border-radius: 20px;
      white-space: nowrap;
      color: #000;
      background: #fff;
      transition: background-color 0.2s;
    }
    .midi-button.active {
      background-color: #aaa;
    }

    select {
      font: inherit;
      padding: 8px 12px;
      background: #333;
      color: #fff;
      border-radius: 8px;
      border: 1px solid #444;
      outline: none;
      cursor: pointer;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      #grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 5vmin;
        width: 90vw;
      }
      play-pause-button {
          width: 120px;
          height: 120px;
          margin-top: 30px;
      }
    }
    
    @media (max-width: 600px) {
      #top-bar {
        flex-direction: column;
        align-items: stretch;
      }
      .auto-pilot {
        justify-content: space-between;
      }
      .auto-pilot input[type=range] {
        flex-grow: 1;
      }
      .midi-controls {
        flex-direction: column;
        align-items: stretch;
      }
      select {
        text-align: center;
      }
    }
  `;

  public prompts: Map<string, Prompt>;
  private midiDispatcher: MidiDispatcher;

  @property({ type: Boolean }) private showMidi = false;
  @property({ type: String }) public playbackState: PlaybackState = 'stopped';
  @state() public audioLevel = 0;
  @state() private midiInputIds: string[] = [];
  @state() private activeMidiInputId: string | null = null;
  @state() private _autoPilotOn = false;
  @state() private _autoPilotInterval = 60; // seconds

  @property({ type: Object })
  private filteredPrompts = new Set<string>();

  private _autoPilotTimerId: number | null = null;

  constructor() {
    super();
    this.prompts = this._buildInitialPrompts();
    this.midiDispatcher = new MidiDispatcher();
  }

  private _buildInitialPrompts() {
    const prompts = new Map<string, Prompt>();
    for (let i = 0; i < 16; i++) {
        const promptId = `prompt-${i}`;
        const promptData = LOFI_PROMPTS[i];
        const { text, color } = promptData;
        
        // Set an energetic beat, bass, and sample to be active initially.
        const initialActive = i === 0 || i === 5 || i === 9;

        prompts.set(promptId, {
            promptId,
            text,
            weight: initialActive ? 1 : 0,
            cc: i,
            color,
        });
    }
    return prompts;
  }
  
  private _randomizePrompts() {
    const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    
    const prompts = [...this.prompts.values()];

    // Categories are based on their static positions in the 16-slot grid
    const beats = prompts.slice(0, 4);
    const bass = prompts.slice(4, 6);
    const harmony = prompts.slice(6, 8);
    const melody = prompts.slice(8, 12);
    const textures = prompts.slice(12, 16);
    
    const newWeights = new Map<string, number>();

    // Set all to 0 initially
    for (const p of prompts) {
      newWeights.set(p.promptId, 0);
    }

    // --- Create a coherent Lo-fi track ---
    // Pick one beat
    newWeights.set(pickRandom(beats).promptId, 1 + Math.random() * 0.2);
    // Pick one bass
    newWeights.set(pickRandom(bass).promptId, 1 + Math.random() * 0.2);
    // 50% chance of a harmony element
    if (Math.random() > 0.5) {
      newWeights.set(pickRandom(harmony).promptId, 1 + Math.random() * 0.2);
    }
    // 70% chance of a melody/sample
    if (Math.random() > 0.3) {
      newWeights.set(pickRandom(melody).promptId, 0.8 + Math.random() * 0.4);
    }
    // Pick one or two textures/fx
    const texture1 = pickRandom(textures);
    newWeights.set(texture1.promptId, 0.7 + Math.random() * 0.4);
    if (Math.random() > 0.6) {
      const texture2 = pickRandom(textures.filter(t => t.promptId !== texture1.promptId));
      if(texture2) newWeights.set(texture2.promptId, 0.7 + Math.random() * 0.4);
    }
    
    // Apply new weights to the main prompts map
    this.prompts.forEach(p => {
      p.weight = newWeights.get(p.promptId) ?? 0;
    });

    this._dispatchPromptsChanged();
  }

  private _runAutoPilot() {
    if (!this._autoPilotOn) return;
    this._randomizePrompts();
    this._autoPilotTimerId = window.setTimeout(() => this._runAutoPilot(), this._autoPilotInterval * 1000);
  }

  private _toggleAutoPilot() {
      this._autoPilotOn = !this._autoPilotOn;
      if (this._autoPilotOn) {
          this._runAutoPilot();
      } else {
          if (this._autoPilotTimerId) clearTimeout(this._autoPilotTimerId);
          this._autoPilotTimerId = null;
      }
  }

  private _handleIntervalChange(e: Event) {
      const input = e.target as HTMLInputElement;
      this._autoPilotInterval = Number(input.value);
      if (this._autoPilotOn) {
          if (this._autoPilotTimerId) clearTimeout(this._autoPilotTimerId);
          this._autoPilotTimerId = window.setTimeout(() => this._runAutoPilot(), this._autoPilotInterval * 1000);
      }
  }

  private _dispatchPromptsChanged() {
    this.requestUpdate();
    this.dispatchEvent(
      new CustomEvent('prompts-changed', { detail: this.prompts }),
    );
  }

  private handlePromptChanged(e: CustomEvent<Prompt>) {
    const { promptId, text, weight, cc } = e.detail;
    const prompt = this.prompts.get(promptId);

    if (!prompt) return;

    prompt.text = text;
    prompt.weight = weight;
    prompt.cc = cc;
    
    this.prompts.set(promptId, prompt);
    this._dispatchPromptsChanged();
  }

  private readonly makeBackground = throttle(() => {
    const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
    const MAX_WEIGHT = 0.5;
    const MAX_ALPHA = 0.6;
    const bg: string[] = [];
    [...this.prompts.values()].forEach((p, i) => {
      const alphaPct = clamp01(p.weight / MAX_WEIGHT) * MAX_ALPHA;
      const alpha = Math.round(alphaPct * 0xff).toString(16).padStart(2, '0');
      const stop = p.weight / 2;
      const x = (i % 4) / 3;
      const y = Math.floor(i / 4) / 3;
      const s = `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${p.color}${alpha} 0px, ${p.color}00 ${stop * 100}%)`;
      bg.push(s);
    });
    return bg.join(', ');
  }, 30);

  private async _toggleShowMidi() {
    this.showMidi = !this.showMidi;
    if (!this.showMidi) return;
    try {
      const inputIds = await this.midiDispatcher.getMidiAccess();
      this.midiInputIds = inputIds;
      this.activeMidiInputId = this.midiDispatcher.activeMidiInputId;
    } catch (e: any) {
      this.showMidi = false;
      this.dispatchEvent(new CustomEvent('error', { detail: e.message }));
    }
  }

  private handleMidiInputChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const newMidiId = selectElement.value;
    this.activeMidiInputId = newMidiId;
    this.midiDispatcher.activeMidiInputId = newMidiId;
  }

  private playPause() {
    this.dispatchEvent(new CustomEvent('play-pause'));
  }
  
  public addFilteredPrompt(prompt: string) {
    this.filteredPrompts = new Set([...this.filteredPrompts, prompt]);
  }

  override render() {
    const bg = styleMap({ backgroundImage: this.makeBackground() });
    
    return html`
      <main id="main-content">
        <div id="background" style=${bg}></div>
        <div id="top-bar">
          <div class="auto-pilot">
            <button 
              class=${classMap({'auto-pilot-toggle': true, active: this._autoPilotOn })}
              @click=${this._toggleAutoPilot}>Auto-Pilot</button>
            <input type="range" min="30" max="120" .value=${this._autoPilotInterval} @input=${this._handleIntervalChange} />
            <span>${this._autoPilotInterval}s</span>
          </div>
          <button class="randomize-button" @click=${this._randomizePrompts}>Randomize</button>
          <div class="midi-controls">
            <button
              @click=${this._toggleShowMidi}
              class=${classMap({'midi-button': true, active: this.showMidi})}
            >MIDI</button>
            <select
              @change=${this.handleMidiInputChange}
              .value=${this.activeMidiInputId || ''}
              style=${!this.showMidi ? 'display: none' : ''}>
              ${this.midiInputIds.length > 0
                ? this.midiInputIds.map(id => html`<option value=${id}>${this.midiDispatcher.getDeviceName(id)}</option>`)
                : html`<option value="">No devices found</option>`
              }
            </select>
          </div>
        </div>
        <div id="content-area">
          <div id="grid">${this.renderPrompts()}</div>
          <play-pause-button .playbackState=${this.playbackState} @click=${this.playPause}></play-pause-button>
        </div>
      </main>
    `;
  }

  private renderPrompts() {
    return [...this.prompts.values()].map((prompt) => {
      return html`<prompt-controller
        promptId=${prompt.promptId}
        ?filtered=${this.filteredPrompts.has(prompt.text)}
        cc=${prompt.cc}
        text=${prompt.text}
        weight=${prompt.weight}
        color=${prompt.color}
        .midiDispatcher=${this.midiDispatcher}
        .showCC=${this.showMidi}
        audioLevel=${this.audioLevel}
        @prompt-changed=${this.handlePromptChanged}>
      </prompt-controller>`;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-dj-midi': PromptDjMidi
  }
}
