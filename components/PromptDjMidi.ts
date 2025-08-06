/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { classMap } from 'lit/directives/class-map.js';
import { GoogleGenAI, Type } from '@google/genai';

import { throttle } from '../utils/throttle';

import './PromptController';
import './PlayPauseButton';
import type { PlaybackState, Prompt } from '../types';

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

const CATEGORY_MAPPING: Record<string, { color: string, slots: number[] }> = {
    beat: { color: '#FF4500', slots: [0, 1, 2, 3] },
    bass: { color: '#9932CC', slots: [4, 5] },
    harmony: { color: '#00CED1', slots: [6, 7] },
    melody: { color: '#FFD700', slots: [8, 9, 10, 11] },
    texture: { color: '#696969', slots: [12, 13, 14, 15] },
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
      justify-content: space-between;
      padding: 15px 20px;
      box-sizing: border-box;
      flex-shrink: 0;
      z-index: 100;
      gap: 10px;
    }
    
    #analyze-form {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    #analyze-form input {
      width: 250px;
      padding: 10px 15px;
      border-radius: 20px;
      border: 1.5px solid #555;
      background: #222;
      color: #fff;
      font-family: var(--brand-font);
      font-size: 14px;
      transition: all .2s;
    }
    #analyze-form input:focus {
      outline: none;
      border-color: #8ab4f8;
      background: #333;
    }
    
    .top-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      cursor: pointer;
      padding: 0;
      border-radius: 50%;
      flex-shrink: 0;
      transition: background 0.2s, opacity .2s, transform .2s;
      border: none;
      background: #282828;
    }
    .top-button:hover:not(:disabled) {
      background: #383838;
      transform: scale(1.1);
    }
    .top-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .analyze-button {
      background: none;
      padding: 2px;
    }
    .analyze-button svg {
      width: 100%;
      height: 100%;
    }
    .analyze-button .analyzing {
      animation: spin 1s linear infinite;
      transform-origin: center;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .clear-button svg {
      width: 18px;
      height: 18px;
      stroke: #aaa;
      stroke-width: 2.5;
    }

    #content-area {
      flex-grow: 1;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-around;
      padding: 2rem 1rem;
      box-sizing: border-box;
    }
    
    #bottom-controls {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      max-width: 500px;
    }

    play-pause-button {
      width: 140px;
      height: 140px;
      flex-shrink: 0;
    }

    .auto-shuffle {
      position: relative;
    }
    
    .auto-shuffle-toggle {
      font-family: var(--brand-font);
      font-weight: 600;
      cursor: pointer;
      padding: 10px 20px;
      border-radius: 25px;
      white-space: nowrap;
      user-select: none;
      transition: background-color .2s, color .2s, border-color .2s, transform .2s;
      border: 2px solid #282828;
      color: #eee;
      background: #282828;
      font-size: 14px;
    }

    .auto-shuffle-toggle:hover {
        transform: scale(1.1);
    }

    .auto-shuffle-toggle.active {
      border-color: #fff;
    }
    
    .auto-shuffle-panel {
      position: absolute;
      right: calc(100% + 10px);
      top: 50%;
      transform: translateY(-50%);
      background: #222;
      border: 1px solid #444;
      border-radius: 25px;
      padding: 5px;
      display: flex;
      gap: 5px;
      z-index: 200;
    }
    .auto-shuffle-panel button {
      font-family: var(--brand-font);
      font-weight: 600;
      cursor: pointer;
      padding: 6px 15px;
      border-radius: 20px;
      white-space: nowrap;
      user-select: none;
      transition: background-color .2s, color .2s;
      border: none;
      color: #eee;
      background: #333;
    }
    .auto-shuffle-panel button.active {
      color: #000;
      background: #fff;
    }

    #grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2.5vmin;
      width: 90%;
      max-width: 800px;
    }
    
    /* Responsive Design */
    @media (max-width: 768px) {
      #top-bar {
        flex-wrap: wrap;
        justify-content: center;
        gap: 15px;
      }
      #analyze-form {
        order: 2;
        width: 100%;
        justify-content: center;
      }
       #analyze-form input {
        width: 100%;
        max-width: 400px;
      }
      .auto-shuffle {
        order: 1;
      }
      #grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 5vmin;
        width: 90vw;
      }
    }
    @media (max-width: 600px) {
      play-pause-button {
          width: 120px;
          height: 120px;
      }
      .auto-shuffle-toggle {
        padding: 8px 16px;
        font-size: 13px;
      }
    }
    @media (max-width: 480px) {
        #content-area {
            padding: 1.5rem 0.5rem;
        }
        #grid {
            gap: 3vmin;
        }
    }
  `;

  @state() public prompts: Map<string, Prompt>;
  @property({ type: Object }) public generativeAi!: GoogleGenAI;
  @property({ type: String }) public playbackState: PlaybackState = 'stopped';
  
  @state() public audioLevel = 0;
  @state() private isAnalyzing = false;
  @state() private songQuery = '';
  @state() private _autoShuffleOn = false;
  @state() private _autoShufflePanelOpen = false;
  @state() private _autoShuffleInterval: number | 'random' = 'random';
  
  @property({ type: Object })
  private filteredPrompts = new Set<string>();

  private _autoShuffleTimerId: number | null = null;

  constructor() {
    super();
    this.prompts = this._buildInitialPrompts();
  }

  private _buildInitialPrompts() {
    const prompts = new Map<string, Prompt>();
    for (let i = 0; i < 16; i++) {
        const promptId = `prompt-${i}`;
        const promptData = LOFI_PROMPTS[i];
        const { text, color } = promptData;
        
        const initialActive = i === 0 || i === 5 || i === 9;

        prompts.set(promptId, {
            promptId,
            text,
            weight: initialActive ? 1 : 0,
            color,
        });
    }
    return prompts;
  }
  
  private _randomizePrompts() {
    const originalPrompts = [...this.prompts.values()];
    const newWeights = new Map<string, number>();

    const beats = originalPrompts.slice(0, 4);
    const bass = originalPrompts.slice(4, 6);
    const harmony = originalPrompts.slice(6, 8);
    const melodies = originalPrompts.slice(8, 12);
    const textures = originalPrompts.slice(12, 16);

    // Helper to pick a 'count' of unique prompts from a category and assign random weights.
    const pickAndAssign = (prompts: Prompt[], count: number, min: number, max: number) => {
        // Filter out prompts that have already been assigned a weight, then shuffle the rest
        const available = prompts.filter(p => !newWeights.has(p.promptId));
        const shuffled = [...available]; // create a copy to shuffle
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        // Assign weights to the requested number of prompts
        for (let i = 0; i < count && i < shuffled.length; i++) {
            const p = shuffled[i];
            newWeights.set(p.promptId, min + Math.random() * (max - min));
        }
    };
    
    const complexityRoll = Math.random();

    // All musical compositions start with a beat.
    // The main beat should have a strong presence.
    pickAndAssign(beats, 1, 1.0, 1.8);

    // Profile: Simple and sparse (2-4 prompts)
    if (complexityRoll < 0.3) {
        // High chance of a foundational bassline.
        if (Math.random() > 0.2) pickAndAssign(bass, 1, 0.9, 1.5);
        // Low chance of a melody.
        if (Math.random() > 0.7) pickAndAssign(melodies, 1, 0.7, 1.2);
        // Medium chance of a light texture.
        if (Math.random() > 0.5) pickAndAssign(textures, 1, 0.2, 0.7);
    } 
    // Profile: Standard, well-rounded song (4-7 prompts)
    else if (complexityRoll < 0.85) {
        // Guaranteed bassline to ground the track.
        pickAndAssign(bass, 1, 0.9, 1.5);
        
        // Add harmonic and melodic layers.
        pickAndAssign(harmony, 1, 0.6, 1.3);
        if (Math.random() > 0.4) pickAndAssign(melodies, 1, 0.8, 1.4); // Main melody
        if (Math.random() > 0.7) pickAndAssign(melodies, 1, 0.5, 0.9); // Secondary/counter-melody

        // Add 1 or 2 textural elements for atmosphere.
        const numTextures = 1 + Math.floor(Math.random() * 2);
        pickAndAssign(textures, numTextures, 0.3, 0.9);
    } 
    // Profile: Complex and layered (7-10 prompts)
    else {
        // Layer a secondary beat/percussion loop.
        pickAndAssign(beats, 1, 0.5, 0.9);
        // Guaranteed strong bassline.
        pickAndAssign(bass, 1, 1.0, 1.6);
        
        // Create a rich harmonic and melodic section.
        const numHarmony = 1 + Math.floor(Math.random() * 2); // 1 or 2
        pickAndAssign(harmony, numHarmony, 0.5, 1.2);
        const numMelodies = 1 + Math.floor(Math.random() * 2); // 1 or 2
        pickAndAssign(melodies, numMelodies, 0.6, 1.5);

        // Fill out the soundscape with plenty of texture.
        const numTextures = 2 + Math.floor(Math.random() * 2); // 2 or 3
        pickAndAssign(textures, numTextures, 0.2, 1.0);
    }

    // Apply the new weights to the prompts map.
    const newPrompts = new Map<string, Prompt>();
    this.prompts.forEach((oldPrompt, promptId) => {
      newPrompts.set(promptId, {
        ...oldPrompt,
        weight: newWeights.get(promptId) ?? 0,
      });
    });
    
    this.prompts = newPrompts;
    this._dispatchPromptsChanged();
  }

  private _runAutoShuffle() {
    if (!this._autoShuffleOn) return;
    this._randomizePrompts();

    let intervalMs: number;
    if (this._autoShuffleInterval === 'random') {
      // Random time between 30 and 120 seconds
      intervalMs = (30 + Math.random() * 90) * 1000;
    } else {
      intervalMs = this._autoShuffleInterval * 1000;
    }

    this._autoShuffleTimerId = window.setTimeout(() => this._runAutoShuffle(), intervalMs);
  }

  private _toggleAutoShufflePanel() {
      // Toggle panel visibility
      this._autoShufflePanelOpen = !this._autoShufflePanelOpen;

      // If we are closing the panel, and auto shuffle is not active, keep it closed.
      // If auto shuffle IS active, closing the panel also turns it off.
      if (!this._autoShufflePanelOpen && this._autoShuffleOn) {
          this._autoShuffleOn = false;
      }
      
      if (!this._autoShuffleOn) {
        if (this._autoShuffleTimerId) clearTimeout(this._autoShuffleTimerId);
        this._autoShuffleTimerId = null;
      }
      this.requestUpdate();
  }

  private _setAutoShuffleInterval(interval: number | 'random') {
    this._autoShuffleInterval = interval;
    // Activate auto shuffle when an interval is chosen
    this._autoShuffleOn = true;

    if (this._autoShuffleTimerId) clearTimeout(this._autoShuffleTimerId);
    this._runAutoShuffle();
    
    this.requestUpdate();
  }

  private _dispatchPromptsChanged() {
    // requestUpdate is automatically called when a @state property changes.
    this.dispatchEvent(
      new CustomEvent('prompts-changed', { detail: this.prompts }),
    );
  }

  private handlePromptChanged(e: CustomEvent<Prompt>) {
    const { promptId, text, weight } = e.detail;
    const prompt = this.prompts.get(promptId);

    if (!prompt) return;

    prompt.text = text;
    prompt.weight = weight;
    
    this.prompts.set(promptId, prompt);
    this._dispatchPromptsChanged();
    this.requestUpdate(); // Manually request update since we're mutating an object in the map
  }

  private async _handleAnalyzeSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!this.songQuery || this.isAnalyzing) return;
    await this._analyzeSong();
  }

  private _clearQuery() {
    this.songQuery = '';
    // Also clear the input element itself
    const input = this.shadowRoot?.querySelector('#analyze-form input') as HTMLInputElement;
    if (input) input.value = '';
  }

  private async _analyzeSong() {
    this.isAnalyzing = true;
    try {
      const systemInstruction = `You are a sonic analyst and expert music producer, specializing in deconstructing popular songs into their core instrumental components for a generative AI. Your goal is to capture the unique vibe and background instrumentation of a given song, so the AI can recreate a similar feel. You must be specific and attentive to genre nuances, especially for styles like Punjabi pop, Afrobeats, and Lo-fi.

For the song provided, generate a JSON array of EXACTLY 16 musical prompts.

Follow these rules precisely:
1.  **Core Mission**: Your prompts should meticulously describe the background music and instrumental elements. Capture the song's unique sonic identity, not just a generic genre template.
2.  **Be Specific & Evocative**: Use descriptive adjectives. Instead of "Guitar", say "Reverb-drenched clean guitar". Instead of "Beat", say "Driving trap beat with fast hi-hats".
3.  **Strict Structure**: You MUST return exactly 16 prompts distributed into these five categories with the specified counts:
    - 4 'beat' prompts: Describe the specific rhythmic patterns, drum machine sounds, or percussion style (e.g., 'Lofi Boom-Bap Drums', 'Syncopated Afrobeats Percussion', 'Minimalist Trap Hi-Hats').
    - 2 'bass' prompts: Describe the bass texture and melody (e.g., 'Deep Sub Bass Rumble', 'Funky Slap Bass Riff').
    - 2 'harmony' prompts: Describe the chordal and pad-like instruments (e.g., 'Washed-out Wurlitzer Chords', 'Mournful String Pad').
    - 4 'melody' prompts: Focus on instrumental hooks, counter-melodies, or significant non-vocal melodic phrases (e.g., 'Sad Flute Melody', 'Catchy Plucked Synth Riff', 'Sampled Vocal Chop').
    - 4 'texture' prompts: Describe the atmospheric and FX layers that create the song's mood (e.g., 'Gentle Rain Soundscape', 'Vinyl Crackle and Hiss', 'Echoing Ad-Lib FX').
4.  **No Silence or Generic Prompts**: Every prompt must be a creative, musical idea derived from the song. Do not use "silence" or overly simple prompts like "Drums".
5.  **Analyze Intelligently**: Listen carefully to the song provided. If only a title or vibe is given, infer the sonic characteristics based on the genre and artist's typical style. For example, for "pal pal by talwiinder", you should identify lo-fi, trap, and melancholic elements. For "wacuka", you should listen for Afrobeats rhythms.`;
      
      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: "A short, descriptive prompt for a musical element (e.g., 'Heavy 808 Bassline', 'Plucked Koto Riff'). Must be 2-4 words."
            },
            category: {
              type: Type.STRING,
              description: "The category of the musical element. Must be one of: 'beat', 'bass', 'harmony', 'melody', 'texture'."
            }
          },
          required: ["text", "category"]
        }
      };

      const response = await this.generativeAi.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze the song: "${this.songQuery}"`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      const jsonText = response.text.trim();
      const generatedPrompts = JSON.parse(jsonText) as { text: string, category: string }[];
      this._updatePromptsFromAnalysis(generatedPrompts);

    } catch (err) {
      console.error(err);
      this.dispatchEvent(new CustomEvent('error', { detail: 'Could not analyze song. The model may be unavailable or the song too obscure. Please try again.' }));
    } finally {
      this.isAnalyzing = false;
    }
  }

  private _updatePromptsFromAnalysis(aiPrompts: {text: string, category: string}[]) {
    const categorizedPrompts: Record<string, { text: string }[]> = {
      beat: [], bass: [], harmony: [], melody: [], texture: [],
    };

    const defaultPrompts = new Map(LOFI_PROMPTS.map((p, i) => [`prompt-${i}`, p]));

    for (const p of aiPrompts) {
      const category = p.category.toLowerCase();
      if (categorizedPrompts[category]) {
        categorizedPrompts[category].push({ text: p.text });
      }
    }
    
    const newPrompts = new Map<string, Prompt>();
    for (let i = 0; i < 16; i++) {
      const promptId = `prompt-${i}`;
      
      const categoryName = Object.keys(CATEGORY_MAPPING).find(key => CATEGORY_MAPPING[key].slots.includes(i))!;
      const categoryInfo = CATEGORY_MAPPING[categoryName];
      
      const newText = categorizedPrompts[categoryName]?.shift()?.text || defaultPrompts.get(promptId)!.text;

      newPrompts.set(promptId, {
        promptId,
        text: newText,
        weight: 0,
        color: categoryInfo.color,
      });
    }

    this.prompts = newPrompts;
    this.filteredPrompts.clear();
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

  private playPause() {
    this.dispatchEvent(new CustomEvent('play-pause'));
  }
  
  public addFilteredPrompt(prompt: string) {
    this.filteredPrompts = new Set([...this.filteredPrompts, prompt]);
  }

  override render() {
    const bg = styleMap({ backgroundImage: this.makeBackground() });
    
    return html`
      ${this.renderSvgDefs()}
      <main id="main-content">
        <div id="background" style=${bg}></div>
        <div id="top-bar">
          <form id="analyze-form" @submit=${this._handleAnalyzeSubmit}>
            <input 
              type="text" 
              placeholder="Describe a vibe or genre..."
              .value=${this.songQuery}
              @input=${(e: Event) => this.songQuery = (e.target as HTMLInputElement).value}
              ?disabled=${this.isAnalyzing}
            />
            <button class="top-button analyze-button" type="submit" ?disabled=${this.isAnalyzing || !this.songQuery} aria-label="Analyze song">
                ${this.renderSparkIcon()}
            </button>
            <button class="top-button clear-button" type="button" @click=${this._clearQuery} ?hidden=${!this.songQuery} aria-label="Clear search">
              ${this.renderClearIcon()}
            </button>
          </form>
          <div class="auto-shuffle">
              <button 
                  class="auto-shuffle-toggle ${classMap({active: this._autoShuffleOn})}"
                  @click=${this._toggleAutoShufflePanel}
                  aria-label="Toggle Auto Shuffle"
                  >Auto Shuffler</button>
              ${this._autoShufflePanelOpen ? html`
                  <div class="auto-shuffle-panel">
                      ${(['random', 30, 60, 90, 120] as const).map(val => html`
                        <button 
                          class=${classMap({ active: this._autoShuffleInterval === val && this._autoShuffleOn })}
                          @click=${() => this._setAutoShuffleInterval(val)}>
                          ${val === 'random' ? 'Random' : `${val}s`}
                        </button>
                      `)}
                  </div>
              ` : ''}
          </div>
        </div>

        <div id="content-area">
          <div id="grid">${this.renderPrompts()}</div>
          <div id="bottom-controls">
            <play-pause-button .playbackState=${this.playbackState} @click=${this.playPause}></play-pause-button>
          </div>
        </div>
      </main>
    `;
  }

  private renderPrompts() {
    return [...this.prompts.values()].map((prompt) => {
      return html`<prompt-controller
        promptId=${prompt.promptId}
        ?filtered=${this.filteredPrompts.has(prompt.text)}
        text=${prompt.text}
        weight=${prompt.weight}
        color=${prompt.color}
        audioLevel=${this.audioLevel}
        @prompt-changed=${this.handlePromptChanged}>
      </prompt-controller>`;
    });
  }

  private renderSvgDefs() {
    return svg`
      <svg width="0" height="0" style="position:absolute">
        <defs>
          <linearGradient id="analyze-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stop-color="#FF5733"/>
              <stop offset="0.25" stop-color="#FFC300"/>
              <stop offset="0.5" stop-color="#DAF7A6"/>
              <stop offset="0.75" stop-color="#33FF57"/>
              <stop offset="1" stop-color="#3357FF"/>
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  private renderSparkIcon() {
    if (this.isAnalyzing) {
      return svg`
        <svg viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="20" fill="url(#analyze-gradient)"/>
          <g class="analyzing">
            <path transform="translate(8,8)" d="M21 12a9 9 0 1 1-6.219-8.56" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          </g>
        </svg>
      `;
    }
    return svg`
      <svg viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="20" fill="url(#analyze-gradient)"/>
        <path d="M20 5 L23.5 16.5 L35 20 L23.5 23.5 L20 35 L16.5 23.5 L5 20 L16.5 16.5 Z" fill="white"/>
      </svg>
    `;
  }

  private renderClearIcon() {
    return svg`
      <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-dj-midi': PromptDjMidi;
  }
}