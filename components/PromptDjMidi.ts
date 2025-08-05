/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { classMap } from 'lit/directives/class-map.js';
import * as Tone from 'tone';

import { throttle } from '../utils/throttle';

import './PromptController';
import './PlayPauseButton';
import type { PlaybackState, Prompt, Note } from '../types';
import { MidiDispatcher } from '../utils/MidiDispatcher';

const MOODS: Record<string, string[]> = {
  'Synthwave': ['Driving Bassline', 'Gated Reverb Snare', 'Analog Synths', 'Neon Nights', 'Retro Arpeggios', 'Lush Pads', '80s Movie Score', 'FM Bells', 'Chorused Guitar', 'Slow Fade', 'Sunset Drive', 'Cyberpunk City', 'Laser Harp', 'Vintage Drum Machine', 'Dreamy Atmosphere', 'Outrun'],
  'Lofi': ['Jazzy Chords', 'Vinyl Crackle', 'Mellow Piano', 'Boom Bap Drums', 'Tape Hiss', 'Rainy Day', 'Chill Guitar Licks', 'Subtle Bass', 'Wobbly Keys', 'Warm Rhodes', 'Relaxed Groove', 'Cozy Vibe', 'Sampled Vocals', 'Kalimba Melody', 'Soft Saxophone', 'Late Night Study'],
  'Orchestral': ['Soaring Strings', 'Timpani Rolls', 'Pizzicato Plucks', 'Majestic Brass', 'Delicate Flute', 'Ominous Choir', 'Heroic Fanfare', 'Woodwind Trills', 'Crescendo', 'Dramatic Hits', 'Lyrical Cello', 'Harp Glissando', 'Mournful Oboe', 'Triumphant Horns', 'Cinematic Percussion', 'Epic Journey'],
  'Techno': ['Driving 4/4 Kick', 'Hypnotic Synth Lead', 'Dark Warehouse', 'Industrial Percussion', 'Acid Bassline', 'Rumbling Sub Bass', 'Minimal Hi-Hats', 'Eerie Pads', 'Filtered Noise Sweep', 'Syncopated Claps', 'Rave Stabs', 'Repetitive Rhythm', 'Delayed FX', 'Dark Atmosphere', 'Peak Time Energy', 'Berlin Underground'],
  'Ambient': ['Evolving Drones', 'Glassy Textures', 'Field Recordings', 'Generative Melody', 'Deep Sub Bass', 'Shimmering Reverb', 'Celestial Pads', 'Slow Attack Strings', 'Gentle Noise', 'Cosmic Arps', 'Meditative State', 'Sound Bath', 'Breathy Synths', 'Distant Chimes', 'Peaceful Atmosphere', 'Floating'],
  'Default': ['Bossa Nova', 'Chillwave', 'Drum and Bass', 'Post Punk', 'Shoegaze', 'Funk', 'Chiptune', 'Lush Strings', 'Sparkling Arpeggios', 'Staccato Rhythms', 'Punchy Kick', 'Dubstep', 'K Pop', 'Neo Soul', 'Trip Hop', 'Thrash'],
};

const PALETTE = ['#9900ff', '#5200ff', '#ff25f6', '#2af6de', '#ffdd28', '#3dffab', '#d8ff3e', '#d9b2ff'];

/** The main application container. */
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
      --sidebar-width: 280px;
      --top-bar-height: 80px;
      --brand-font: 'Google Sans', sans-serif;
    }

    #sidebar-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease-in-out;
    }
    :host([sidebar-open]) #sidebar-overlay {
      opacity: 1;
      pointer-events: auto;
    }

    #sidebar {
      width: var(--sidebar-width);
      height: 100%;
      background: #1a1a1a;
      border-right: 1px solid #333;
      padding: 20px;
      box-sizing: border-box;
      flex-shrink: 0;
      transition: transform 0.3s ease-in-out;
      z-index: 1001;
      display: flex;
      flex-direction: column;
      gap: 20px;
      position: fixed;
      top: 0;
      left: 0;
      transform: translateX(-100%);
    }
    :host([sidebar-open]) #sidebar {
      transform: translateX(0);
    }
    
    #sidebar h2 {
      font-family: var(--brand-font);
      color: #fff;
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    .mood-buttons {
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
    }
    .mood-buttons button {
      width: 100%;
      padding: 12px;
      font-family: var(--brand-font);
      font-size: 16px;
      font-weight: 500;
      background: #333;
      color: #eee;
      border: 1px solid #444;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }
    .mood-buttons button:hover {
      background: #4a4a4a;
    }
    .mood-buttons button.active {
      background: #fff;
      color: #000;
      font-weight: 700;
    }

    #main-content {
      flex-grow: 1;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      overflow: hidden;
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
      height: var(--top-bar-height);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      box-sizing: border-box;
      flex-shrink: 0;
      z-index: 100;
      gap: 20px;
    }
    .top-bar-section {
      display: flex;
      gap: 15px;
      align-items: center;
    }
    .menu-button {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #333;
      border: 1px solid #555;
      cursor: pointer;
      padding: 0;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      flex-shrink: 0;
      transition: background 0.2s;
    }
    .menu-button:hover {
      background: #444;
    }
    .menu-button svg {
      width: 20px;
      height: 20px;
      stroke: #fff;
    }
    
    #analyze-form {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    #analyze-form input {
      min-width: 200px;
      padding: 10px 15px;
      border-radius: 20px;
      border: 1.5px solid #555;
      background: #222;
      color: #fff;
      font-family: var(--brand-font);
      font-size: 14px;
    }
    #analyze-form button,
    .top-bar-section.right > button {
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
    }
    #analyze-form button.secondary {
      background: #282828;
      color: #eee;
      border: 1.5px solid #555;
    }
    #analyze-form button.secondary:hover {
      background: #333;
    }
    #analyze-form button:disabled,
    .top-bar-section.right button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
     }

    .auto-pilot {
      display: flex;
      align-items: center;
      gap: 15px;
      color: #fff;
    }

    .auto-pilot-toggle {
      font-family: var(--brand-font);
      font-weight: 600;
      cursor: pointer;
      padding: 10px 20px;
      border-radius: 20px;
      white-space: nowrap;
      -webkit-font-smoothing: antialiased;
      user-select: none;
      transition: background-color .2s, color .2s, border-color .2s;
      
      /* Inactive state */
      color: #eee;
      background: #282828;
      border: 1.5px solid #555;
    }
    
    .auto-pilot-toggle.active {
      /* Active state */
      color: #000;
      background: #fff;
      border: 1.5px solid #fff;
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
    }

    #grid {
      width: 100%;
      max-width: 70vmin;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2vmin;
    }

    play-pause-button {
      width: 15vmin;
      margin-top: 3vmin;
    }
    
    .sidebar-controls {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: auto;
    }

    button {
      font: inherit;
      border-radius: 4px;
      padding: 8px 12px;
    }
    
    .midi-button.active {
      background-color: #fff;
      color: #000;
    }
    
    .midi-button {
      font-weight: 600;
      cursor: pointer;
      color: #fff;
      background: #0002;
      -webkit-font-smoothing: antialiased;
      border: 1.5px solid #fff;
    }

    select {
      font: inherit;
      padding: 8px;
      background: #fff;
      color: #000;
      border-radius: 4px;
      border: none;
      outline: none;
      cursor: pointer;
    }

    /* Responsive Design */
    @media (max-width: 850px) {
      #top-bar {
          flex-wrap: wrap;
          height: auto;
          padding: 15px;
          row-gap: 15px;
      }
      .top-bar-section.left {
          width: 100%;
      }
      .top-bar-section.right {
          width: 100%;
          justify-content: space-between;
      }
      #analyze-form {
          width: 100%;
      }
      #analyze-form input {
          flex-grow: 1;
          min-width: 100px;
      }
    }
    
    @media (max-width: 480px) {
      #grid { max-width: 90vmin; }
      play-pause-button { margin-top: 5vmin; width: 20vmin;}
       .top-bar-section.right {
          flex-direction: column;
          align-items: stretch;
      }
      .auto-pilot {
          justify-content: space-between;
      }
    }
  `;

  private midiDispatcher: MidiDispatcher;

  @state() private prompts: Map<string, Prompt> = new Map();
  @state() private _isSidebarOpen = false;
  @state() private _isGenerating = false;
  @state() private _songQuery = '';
  @state() private _activeMood = 'Default';

  @state() private _autoPilotOn = false;
  @state() private _autoPilotInterval = 90; // seconds
  private _autoPilotTimer: number | null = null;


  @state() private _showMidi = false;
  @state() private midiInputIds: string[] = [];
  @state() private _activeMidiInputId: string | null = null;

  @property({ type: String }) public playbackState: PlaybackState = 'stopped';
  @property({ attribute: false }) public musicGenerationFn?: (prompt: string) => Promise<Note[] | null>;
  @property({ attribute: false }) public audioContext?: AudioContext;
  @property({ type: Number }) public audioLevel = 0;

  @state() private filteredPrompts = new Set<string>();

  constructor() {
    super();
    this.midiDispatcher = new MidiDispatcher();
    this._updatePromptsFromList(MOODS['Default'], 3);
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.audioContext && Tone.context.state === 'closed') {
        Tone.setContext(this.audioContext);
    }
  }

  private _buildPromptsFromList(texts: string[], activeCount: number = 0): Map<string, Prompt> {
    const prompts = new Map<string, Prompt>();
    const activeIndices = new Set<number>();
    while (activeIndices.size < activeCount) {
        activeIndices.add(Math.floor(Math.random() * texts.length));
    }

    texts.forEach((text, i) => {
      const promptId = `prompt-${i}`;
      prompts.set(promptId, {
        promptId,
        text,
        weight: activeIndices.has(i) ? 1 : 0,
        cc: i,
        color: PALETTE[i % PALETTE.length],
      });
    });
    return prompts;
  }
  
  private _updatePromptsFromList(texts: string[], activeCount: number = 0) {
    this.prompts = this._buildPromptsFromList(texts, activeCount);
    this.dispatchEvent(new CustomEvent('prompts-changed', { detail: this.prompts }));
  }

  private handlePromptChanged(e: CustomEvent<Prompt>) {
    const newPrompt = e.detail;
    const prompt = this.prompts.get(newPrompt.promptId);
    if (!prompt) return;

    Object.assign(prompt, newPrompt);
    this.prompts = new Map(this.prompts);

    this.dispatchEvent(new CustomEvent('prompts-changed', { detail: this.prompts }));
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
    this._showMidi = !this._showMidi;
    if (!this._showMidi) return;
    try {
      const inputIds = await this.midiDispatcher.getMidiAccess();
      this.midiInputIds = inputIds;
      this._activeMidiInputId = this.midiDispatcher.activeMidiInputId;
    } catch (e: any) {
      this.dispatchEvent(new CustomEvent('error', { detail: e.message }));
    }
  }

  private _handleMidiInputChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this._activeMidiInputId = selectElement.value;
    this.midiDispatcher.activeMidiInputId = selectElement.value;
  }

  private _playPause() {
    this.dispatchEvent(new CustomEvent('play-pause'));
  }
  
  private _toggleSidebar() {
    this._isSidebarOpen = !this._isSidebarOpen;
    this.toggleAttribute('sidebar-open', this._isSidebarOpen);
  }

  private _handleMoodChange(mood: string) {
    this._activeMood = mood;
    this._updatePromptsFromList(MOODS[mood], 3);
    this._songQuery = '';
  }
  
  private async _handleGenerateMusic(e: Event) {
    e.preventDefault();
    const userPrompt = this._songQuery.trim();
    if (!this.musicGenerationFn || !userPrompt) return;
    
    this._isGenerating = true;
    const notes = await this.musicGenerationFn(userPrompt);
    this._isGenerating = false;
    
    if (notes) {
      this._playNotes(notes);
    } else {
      this.dispatchEvent(new CustomEvent('error', { detail: 'Could not generate music from prompt.' }));
    }
  }

  private _playNotes(notes: Note[]) {
    if (Tone.context.state !== 'running') {
      Tone.context.resume();
    }
    const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth' },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1 },
    }).toDestination();

    const now = Tone.now();
    notes.forEach(note => {
        synth.triggerAttackRelease(note.note, note.duration, now + note.time);
    });

    const lastNote = notes.reduce((last, n) => (n.time + n.duration > last.time + last.duration ? n : last), notes[0]);
    const totalDuration = lastNote.time + lastNote.duration;
    setTimeout(() => {
        synth.dispose();
    }, (totalDuration + 2) * 1000);
  }

  private _handleClearSong() {
    this._songQuery = '';
    // No need to change mood, as generation is separate now.
  }

  private _handleRandomize() {
    const promptsArray = [...this.prompts.values()];
    promptsArray.forEach(p => p.weight = 0); // Reset all weights
    
    const numToActivate = Math.floor(Math.random() * 3) + 6; // 3 to 5
    for(let i=0; i<numToActivate; i++) {
      const randomIndex = Math.floor(Math.random() * promptsArray.length);
      promptsArray[randomIndex].weight = Math.random() * 1.2 + 0.3; // Random weight between 0.3 and 1.5
    }

    this.prompts = new Map(this.prompts);
    this.dispatchEvent(new CustomEvent('prompts-changed', { detail: this.prompts }));
  }

  private _handleAutoPilotToggle() {
    this._autoPilotOn = !this._autoPilotOn;
    if (this._autoPilotOn) {
      this._handleRandomize(); // Randomize once when turned on
      this._startAutoPilotTimer();
    } else if (this._autoPilotTimer) {
      clearInterval(this._autoPilotTimer);
      this._autoPilotTimer = null;
    }
  }

  private _startAutoPilotTimer() {
    if (this._autoPilotTimer) clearInterval(this._autoPilotTimer);
    this._autoPilotTimer = window.setInterval(() => {
      this._handleRandomize();
    }, this._autoPilotInterval * 1000);
  }

  private _handleAutoPilotIntervalChange(e: Event) {
    this._autoPilotInterval = parseInt((e.target as HTMLInputElement).value, 10);
    if (this._autoPilotOn) {
      this._startAutoPilotTimer();
    }
  }

  public addFilteredPrompt(prompt: string) {
    this.filteredPrompts = new Set([...this.filteredPrompts, prompt]);
  }
  
  override render() {
    this.toggleAttribute('sidebar-open', this._isSidebarOpen);
    return html`
      <div id="sidebar-overlay" @click=${this._toggleSidebar}></div>
      ${this._renderSidebar()}
      ${this._renderMainContent()}
    `;
  }
  
  private _renderSidebar() {
    return html`
      <div id="sidebar">
        <h2>Moods</h2>
        <div class="mood-buttons">
          ${Object.keys(MOODS).map(mood => html`
            <button class=${classMap({active: this._activeMood === mood})} @click=${() => this._handleMoodChange(mood)}>${mood}</button>
          `)}
        </div>
        <div class="sidebar-controls">
          <button
            @click=${this._toggleShowMidi}
            class=${classMap({'midi-button': true, active: this._showMidi})}
            >MIDI
          </button>
          <select
            @change=${this._handleMidiInputChange}
            .value=${this._activeMidiInputId || ''}
            style=${this._showMidi ? '' : 'display: none'}>
            ${this.midiInputIds.length > 0
              ? this.midiInputIds.map(
                (id) => html`<option value=${id}>${this.midiDispatcher.getDeviceName(id)}</option>`,
              )
              : html`<option value="">No devices found</option>`}
          </select>
        </div>
      </div>
    `;
  }

  private _renderMainContent() {
    const bg = styleMap({ backgroundImage: this.makeBackground() });
    return html`
      <div id="main-content">
        <div id="background" style=${bg}></div>
        ${this._renderTopBar()}
        <div id="content-area">
          <div id="grid">${this._renderGrid()}</div>
          <play-pause-button .playbackState=${this.playbackState} @click=${this._playPause}></play-pause-button>
        </div>
      </div>
    `;
  }
  
  private _renderTopBar() {
    return html`
    <div id="top-bar">
      <div class="top-bar-section left">
        <button class="menu-button" @click=${this._toggleSidebar} aria-label="Toggle Menu">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <form id="analyze-form" @submit=${this._handleGenerateMusic}>
          <input type="text" placeholder="Describe some music to generate..." .value=${this._songQuery} @input=${(e: Event) => this._songQuery = (e.target as HTMLInputElement).value} ?disabled=${this._isGenerating}>
          <button type="submit" ?disabled=${this._isGenerating || !this._songQuery.trim()}>${this._isGenerating ? 'Generating...' : 'Generate'}</button>
          <button type="button" class="secondary" @click=${this._handleClearSong} ?disabled=${this._isGenerating}>Clear</button>
        </form>
      </div>

      <div class="top-bar-section right">
        <button @click=${this._handleRandomize}>Randomize</button>
        <div class="auto-pilot">
          <button
            class=${classMap({ 'auto-pilot-toggle': true, active: this._autoPilotOn })}
            @click=${this._handleAutoPilotToggle}>Auto</button>
          ${this._autoPilotOn ? html`
            <input type="range" min="30" max="300" step="10" .value=${this._autoPilotInterval} @input=${this._handleAutoPilotIntervalChange}>
            <span>${this._autoPilotInterval}s</span>
          ` : ''}
        </div>
      </div>
    </div>`;
  }

  private _renderGrid() {
    return [...this.prompts.values()].map((prompt) => {
      return html`<prompt-controller
        .promptId=${prompt.promptId}
        ?filtered=${this.filteredPrompts.has(prompt.text)}
        .cc=${prompt.cc}
        .text=${prompt.text}
        .weight=${prompt.weight}
        .color=${prompt.color}
        .midiDispatcher=${this.midiDispatcher}
        ?showCC=${this._showMidi}
        .audioLevel=${this.audioLevel}
        @prompt-changed=${this.handlePromptChanged}>
      </prompt-controller>`;
    });
  }
}
