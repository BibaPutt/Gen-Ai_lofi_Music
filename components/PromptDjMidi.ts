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

const ALL_PROMPTS = [
  { color: '#9900ff', text: 'Bossa Nova' },
  { color: '#5200ff', text: 'Chillwave' },
  { color: '#ff25f6', text: 'Drum and Bass' },
  { color: '#2af6de', text: 'Post Punk' },
  { color: '#ffdd28', text: 'Shoegaze' },
  { color: '#2af6de', text: 'Funk' },
  { color: '#9900ff', text: 'Chiptune' },
  { color: '#3dffab', text: 'Lush Strings' },
  { color: '#d8ff3e', text: 'Sparkling Arpeggios' },
  { color: '#d9b2ff', text: 'Staccato Rhythms' },
  { color: '#3dffab', text: 'Punchy Kick' },
  { color: '#ffdd28', text: 'Dubstep' },
  { color: '#ff25f6', text: 'K Pop' },
  { color: '#d8ff3e', text: 'Neo Soul' },
  { color: '#5200ff', text: 'Trip Hop' },
  { color: '#d9b2ff', text: 'Thrash' },
  { color: '#ff6347', text: '80s Synth Pop' },
  { color: '#4682b4', text: 'Ambient Textures' },
  { color: '#32cd32', text: 'Reggae' },
  { color: '#dc143c', text: 'Heavy Metal' },
  { color: '#c71585', text: 'Orchestral' },
  { color: '#ffd700', text: 'Jazz Piano' },
];

const PROMPTS_BY_NAME = new Map(ALL_PROMPTS.map(p => [p.text, p]));

const GENRES: Record<string, string[]> = {
  'Lofi': ['Chillwave', 'Trip Hop', 'Jazz Piano', 'Neo Soul', 'Bossa Nova'],
  'HipHop': ['Trip Hop', 'Funk', 'Neo Soul', 'Punchy Kick', 'Reggae'],
  'Ambient': ['Ambient Textures', 'Lush Strings', 'Chillwave', 'Orchestral'],
  'Electronic': ['Chillwave', 'Drum and Bass', 'Dubstep', 'Chiptune', 'Trip Hop', 'Sparkling Arpeggios', '80s Synth Pop', 'Ambient Textures'],
  'Rock/Alternative': ['Post Punk', 'Shoegaze', 'Thrash', 'Funk', 'Heavy Metal'],
  'Pop/World': ['K Pop', 'Bossa Nova', 'Neo Soul', 'Reggae'],
  'Elements': ['Lush Strings', 'Staccato Rhythms', 'Punchy Kick', 'Jazz Piano', 'Orchestral'],
};

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
      --sidebar-width: 250px;
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
      text-align: left;
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
      background: transparent;
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
      background: #333;
    }
    .menu-button svg {
      width: 20px;
      height: 20px;
      stroke: #fff;
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
      transition: background-color .2s, color .2s, border-color .2s;
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
      padding-bottom: var(--top-bar-height);
    }

    #grid {
      width: 100%;
      max-width: 70vmin;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2.5vmin;
    }

    play-pause-button {
      width: 14vmin;
      margin-top: 4vmin;
    }
    
    .sidebar-controls {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: auto;
    }

    .midi-button {
      font-weight: 500;
      cursor: pointer;
      color: #fff;
      background: #333;
      border: 1px solid #444;
      border-radius: 8px;
      -webkit-font-smoothing: antialiased;
      padding: 10px 12px;
      width: 100%;
    }
    .midi-button.active {
      background-color: #fff;
      color: #000;
    }

    select {
      font: inherit;
      padding: 8px;
      background: #333;
      color: #fff;
      border-radius: 8px;
      border: 1px solid #444;
      outline: none;
      cursor: pointer;
      width: 100%;
    }

    /* Responsive Design */
    @media (max-width: 950px) {
      .auto-pilot {
        gap: 8px;
      }
      .auto-pilot input[type=range] {
        width: 80px;
      }
    }
    @media (max-width: 768px) {
      :host {
        --top-bar-height: auto;
      }
      #top-bar {
        flex-direction: column;
        align-items: flex-start;
        padding: 15px;
        gap: 15px;
      }
      .top-bar-section.right {
        width: 100%;
        justify-content: space-between;
      }
      #grid { max-width: 85vmin; }
      play-pause-button { margin-top: 5vmin; width: 18vmin;}
    }
    
    @media (max-width: 480px) {
      .top-bar-section.right {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .auto-pilot {
        justify-content: space-between;
      }
      .auto-pilot input[type=range] {
        flex-grow: 1;
      }
    }
  `;

  public prompts: Map<string, Prompt>;
  private midiDispatcher: MidiDispatcher;

  @property({ type: Boolean, reflect: true, attribute: 'sidebar-open' }) private sidebarOpen = false;
  @property({ type: Boolean }) private showMidi = false;
  @property({ type: String }) public playbackState: PlaybackState = 'stopped';
  @state() public audioLevel = 0;
  @state() private midiInputIds: string[] = [];
  @state() private activeMidiInputId: string | null = null;
  @state() private _activeGenre = 'Initial';
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
    // Pick 3 random prompts to start at weight = 1
    const startOn = [...ALL_PROMPTS]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const prompts = new Map<string, Prompt>();
    const promptPool = [...ALL_PROMPTS].sort(() => Math.random() - 0.5);

    for (let i = 0; i < 16; i++) {
      const promptId = `prompt-${i}`;
      const promptData = promptPool[i];
      const { text, color } = promptData;
      prompts.set(promptId, {
        promptId,
        text,
        weight: startOn.includes(promptData) ? 1 : 0,
        cc: i,
        color,
      });
    }
    return prompts;
  }

  private _getPromptsForGenre(genre: string) {
    const genrePrompts = GENRES[genre]
      .map(name => PROMPTS_BY_NAME.get(name)!)
      .filter(Boolean);
    
    const otherPrompts = ALL_PROMPTS
      .filter(p => !GENRES[genre].includes(p.text))
      .sort(() => 0.5 - Math.random());
    
    return [...genrePrompts, ...otherPrompts].slice(0, 16);
  }
  
  private _setPrompts(newPromptData: {text: string, color: string}[], options: { preserveWeights?: boolean, activeCount?: number } = {}) {
    const { preserveWeights = false, activeCount = 3 } = options;
    const newPrompts = new Map<string, Prompt>();
    const currentPrompts = preserveWeights ? [...this.prompts.values()] : undefined;
    
    // Select random prompts to be active only when not preserving weights
    const startOn = preserveWeights ? [] : [...newPromptData].sort(() => Math.random() - 0.5).slice(0, activeCount);

    for (let i = 0; i < 16; i++) {
      // Use existing promptId and cc if we're preserving state
      const oldPrompt = currentPrompts?.[i];
      const promptId = oldPrompt?.promptId ?? `prompt-${i}`;
      const cc = oldPrompt?.cc ?? i;

      const promptData = newPromptData[i % newPromptData.length];

      newPrompts.set(promptId, {
        promptId,
        text: promptData.text,
        color: promptData.color,
        // Preserve weight if requested, otherwise reset based on `startOn`
        weight: oldPrompt ? oldPrompt.weight : (startOn.includes(promptData) ? 1 : 0),
        cc,
      });
    }
    this.prompts = newPrompts;
    this._dispatchPromptsChanged();
  }
  
  private _randomizePrompts() {
    const randomPrompts = [...ALL_PROMPTS].sort(() => Math.random() - 0.5).slice(0, 16);
    this._setPrompts(randomPrompts, { activeCount: 3 });
    this._activeGenre = '';
  }

  private _handleGenreSelect(e: MouseEvent) {
    const button = e.currentTarget as HTMLButtonElement;
    const genre = button.dataset.genre!;
    this._activeGenre = genre;
    const newPromptData = this._getPromptsForGenre(genre);
    this._setPrompts(newPromptData, { preserveWeights: true });
  }

  private _runAutoPilot() {
    if (!this._autoPilotOn) return; // Stop if turned off
    this._randomizePrompts();
    this._autoPilotTimerId = window.setTimeout(() => this._runAutoPilot(), this._autoPilotInterval * 1000);
  }

  private _toggleAutoPilot() {
      this._autoPilotOn = !this._autoPilotOn;
      if (this._autoPilotOn) {
          // When turning on, randomize immediately and start the timer loop.
          this._runAutoPilot();
      } else {
          // When turning off, just clear the timer.
          if (this._autoPilotTimerId) clearTimeout(this._autoPilotTimerId);
          this._autoPilotTimerId = null;
      }
  }

  private _handleIntervalChange(e: Event) {
      const input = e.target as HTMLInputElement;
      this._autoPilotInterval = Number(input.value);
      if (this._autoPilotOn) {
          // If it's on, clear the old timer and set a new one.
          // This "restarts" the wait for the next randomization without running one now.
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

  private renderMenuIcon() {
    return svg`<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>`;
  }

  override render() {
    const bg = styleMap({ backgroundImage: this.makeBackground() });
    
    return html`
      <div id="sidebar-overlay" @click=${() => this.sidebarOpen = false}></div>
      <aside id="sidebar">
        <h2>Genres</h2>
        <div class="mood-buttons">
          ${Object.keys(GENRES).map(genre => html`
            <button 
              class=${classMap({ active: this._activeGenre === genre })}
              data-genre=${genre}
              @click=${this._handleGenreSelect}>
              ${genre}
            </button>
          `)}
        </div>

        <div class="sidebar-controls">
          <button
            @click=${this._toggleShowMidi}
            class=${classMap({'midi-button': true, active: this.showMidi})}
            >MIDI Controls</button>
          <select
            @change=${this.handleMidiInputChange}
            .value=${this.activeMidiInputId || ''}
            style=${this.showMidi ? '' : 'display: none'}>
            ${this.midiInputIds.length > 0
              ? this.midiInputIds.map(id => html`<option value=${id}>${this.midiDispatcher.getDeviceName(id)}</option>`)
              : html`<option value="">No devices found</option>`
            }
          </select>
        </div>
      </aside>

      <main id="main-content">
        <div id="background" style=${bg}></div>
        <div id="top-bar">
          <div class="top-bar-section left">
            <button class="menu-button" @click=${() => this.sidebarOpen = !this.sidebarOpen} aria-label="Toggle Menu">
              ${this.renderMenuIcon()}
            </button>
          </div>
          <div class="top-bar-section right">
             <div class="auto-pilot">
              <button 
                class=${classMap({'auto-pilot-toggle': true, active: this._autoPilotOn })}
                @click=${this._toggleAutoPilot}>Auto-Pilot</button>
              <input type="range" min="30" max="120" .value=${this._autoPilotInterval} @input=${this._handleIntervalChange} />
              <span>${this._autoPilotInterval}s</span>
            </div>
            <button class="randomize-button" @click=${this._randomizePrompts}>Randomize</button>
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