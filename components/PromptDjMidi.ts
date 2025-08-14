/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { classMap } from 'lit/directives/class-map.js';
import { GoogleGenAI, Type } from '@google/genai';

import { debounce } from '../utils/throttle';

import './PromptController';
import './PlayPauseButton';
import type { PlaybackState, Prompt } from '../types';

// A curated, static list of 16 prompts for creating classic, chill lo-fi.
const LOFI_PROMPTS = [
  // Row 1: Beats - Blue
  { color: '#5D9CEC', text: 'Classic Lofi Beat' },
  { color: '#5D9CEC', text: 'Jazzy Boom Bap' },
  { color: '#5D9CEC', text: 'Relaxed Hip Hop drums' },
  { color: '#5D9CEC', text: 'Light trap beat' },
  // Row 2: Bass & Harmony
  { color: '#F7DC6F', text: 'Warm Sub Bass' }, // Bass - Yellow
  { color: '#F7DC6F', text: 'Upright Bass Riff' }, // Bass - Yellow
  { color: '#BB8FCE', text: 'Mellow Rhodes Chords' }, // Harmony - Purple
  { color: '#BB8FCE', text: 'Dreamy Synth Pad' }, // Harmony - Purple
  // Row 3: Melody - Orange
  { color: '#E59866', text: 'Reverb Vocal Chop' },
  { color: '#E59866', text: 'Jazzy Piano Melody' },
  { color: '#E59866', text: 'Clean Electric Guitar' },
  { color: '#E59866', text: 'Sad Saxophone hook' },
  // Row 4: Textures & FX - Grey
  { color: '#BFC9CA', text: 'Soft Vinyl Crackle' },
  { color: '#BFC9CA', text: 'Gentle Rain' },
  { color: '#BFC9CA', text: 'Cassette Tape Hiss' },
  { color: '#BFC9CA', text: 'Page Turning Foley' },
];

const CATEGORY_MAPPING: Record<string, { color: string, slots: number[] }> = {
    beat: { color: '#5D9CEC', slots: [0, 1, 2, 3] },
    bass: { color: '#F7DC6F', slots: [4, 5] },
    harmony: { color: '#BB8FCE', slots: [6, 7] },
    melody: { color: '#E59866', slots: [8, 9, 10, 11] },
    texture: { color: '#BFC9CA', slots: [12, 13, 14, 15] },
};

const CHILL_BG_COLOR = '#111111';
const CHILL_HALO_COLORS = ['#4A90E2', '#50E3C2', '#B8E986', '#7DD3FC'];

interface BackgroundHalo {
  id: string;
  x: number;
  y: number;
  angle: number;
  angularVelocity: number;
  orbitRadius: number;
  centerX: number;
  centerY: number;
  centerVx: number;
  centerVy: number;
  baseSize: number;
  color: string;
  borderRadius: string;
}

/** The main application shell. */
@customElement('prompt-dj-midi')
export class PromptDjMidi extends LitElement {
  static override styles = css`
    :host {
      width: 100%;
      min-height: 100vh;
      display: flex;
      box-sizing: border-box;
      position: relative;
      background-color: var(--bg-color, #111);
      transition: background-color 1s ease-out;
      --brand-font: 'Google Sans', sans-serif;
    }
    #main-content {
      flex-grow: 1;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }
    #halo-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      z-index: 0;
      pointer-events: none;
    }
    .background-halo {
      position: absolute;
      filter: blur(120px);
      will-change: transform, border-radius;
      transition:
        transform 200ms linear,
        border-radius 4s ease-in-out,
        background-color 2s ease-out,
        width 2s ease-out,
        height 2s ease-out;
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
    
    #top-left-controls {
        display: flex;
        align-items: center;
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
      transition: background 0.2s, opacity .2s, transform .2s, border-color .2s;
      border: 2px solid #282828;
      background: #282828;
      color: #fff;
    }
    .top-button:hover:not(:disabled) {
      background: #383838;
      transform: scale(1.1);
    }
    .top-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .top-button.active {
      background: #fff;
      color: #000;
    }
    .top-button.active:hover:not(:disabled) {
      background: #eee;
    }
    .top-button svg {
      width: 20px;
      height: 20px;
    }
    .top-button .spinning {
      animation: spin 1s linear infinite;
    }

    .analyze-button {
      background: none;
      padding: 2px;
      border: none;
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
    .reset-button svg {
      width: 20px;
      height: 20px;
      stroke: #aaa;
      stroke-width: 2;
    }
    .reset-button:hover svg {
      stroke: #fff;
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
      z-index: 1;
    }
    
    #bottom-controls {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      max-width: 500px;
      margin-top: 2rem;
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
      left: calc(100% + 10px);
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
      #top-left-controls {
        order: 1;
        width: 100%;
        justify-content: center;
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

  @state() private backgroundHalos: BackgroundHalo[] = [];
  
  private _autoShuffleTimerId: number | null = null;
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private lastMorphTime = 0;

  constructor() {
    super();
    this.prompts = this._buildInitialPrompts();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.lastFrameTime = performance.now();
    this._setupBackgroundHalos();
    this._animateHalos();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private _buildInitialPrompts() {
    const prompts = new Map<string, Prompt>();
    const defaultActiveIndices = [0, 4, 6, 12];
    for (let i = 0; i < 16; i++) {
        const promptId = `prompt-${i}`;
        const promptData = LOFI_PROMPTS[i];
        const { text, color } = promptData;
        
        prompts.set(promptId, {
            promptId,
            text,
            weight: defaultActiveIndices.includes(i) ? 1 : 0,
            color,
        });
    }
    return prompts;
  }
  
  private _randomizePrompts() {
    const archetypes = [
        { name: 'Minimal', beat: 1, bass: 1, harmony: 0, melody: 1, texture: 1, weightRange: [0.9, 1.2] },
        { name: 'Jazzy', beat: 1, bass: 1, harmony: 1, melody: 2, texture: 1, weightRange: [0.8, 1.4] },
        { name: 'Lush', beat: 1, bass: 1, harmony: 2, melody: 1, texture: 2, weightRange: [0.7, 1.3] },
        { name: 'Ambient', beat: 1, bass: 0, harmony: 2, melody: 1, texture: 3, weightRange: [0.6, 1.1] },
        { name: 'Complex', beat: 1, bass: 1, harmony: 1, melody: 2, texture: 2, weightRange: [0.8, 1.5] },
    ];
    const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

    const originalPrompts = [...this.prompts.values()];
    const getPromptsByCategory = (category: string) => 
        CATEGORY_MAPPING[category].slots.map(i => originalPrompts[i]);

    const categories = {
        beat: getPromptsByCategory('beat'),
        bass: getPromptsByCategory('bass'),
        harmony: getPromptsByCategory('harmony'),
        melody: getPromptsByCategory('melody'),
        texture: getPromptsByCategory('texture'),
    };
    
    const newWeights = new Map<string, number>();

    const pickAndAssign = (categoryKey: keyof typeof categories, count: number) => {
        const prompts = categories[categoryKey];
        const shuffled = [...prompts].sort(() => 0.5 - Math.random());
        for (let i = 0; i < count && i < shuffled.length; i++) {
            const p = shuffled[i];
            const [min, max] = archetype.weightRange;
            newWeights.set(p.promptId, min + Math.random() * (max - min));
        }
    };
    
    pickAndAssign('beat', archetype.beat);
    pickAndAssign('bass', archetype.bass);
    pickAndAssign('harmony', archetype.harmony);
    pickAndAssign('melody', archetype.melody);
    pickAndAssign('texture', archetype.texture);

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
      intervalMs = (30 + Math.random() * 90) * 1000;
    } else {
      intervalMs = this._autoShuffleInterval * 1000;
    }

    this._autoShuffleTimerId = window.setTimeout(() => this._runAutoShuffle(), intervalMs);
  }

  private _toggleAutoShufflePanel() {
      this._autoShufflePanelOpen = !this._autoShufflePanelOpen;

      if (!this._autoShufflePanelOpen && this._autoShuffleOn) {
          this._autoShuffleOn = false;
      }
      
      if (!this._autoShuffleOn) {
        if (this._autoShuffleTimerId) clearTimeout(this. _autoShuffleTimerId);
        this._autoShuffleTimerId = null;
      }
      this.requestUpdate();
  }

  private _setAutoShuffleInterval(interval: number | 'random') {
    this._autoShuffleInterval = interval;
    this._autoShuffleOn = true;

    if (this._autoShuffleTimerId) clearTimeout(this._autoShuffleTimerId);
    this._runAutoShuffle();
    
    this.requestUpdate();
  }

  private _dispatchPromptsChanged() {
    this._setupBackgroundHalos();
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
    this.requestUpdate();
  }

  private async _handleAnalyzeSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!this.songQuery || this.isAnalyzing) return;
    await this._analyzeSong();
  }

  private _resetToDefaults() {
    this.songQuery = '';
    const input = this.shadowRoot?.querySelector('#analyze-form input') as HTMLInputElement;
    if (input) input.value = '';

    this.prompts = this._buildInitialPrompts();
    this.filteredPrompts.clear();

    if (this._autoShuffleOn) {
        this._autoShuffleOn = false;
        if (this._autoShuffleTimerId) clearTimeout(this._autoShuffleTimerId);
        this._autoShuffleTimerId = null;
    }
    this._autoShufflePanelOpen = false;
    
    this._dispatchPromptsChanged();
    this.requestUpdate();
  }

  private _getSeed(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash;
  }

  private async _analyzeSong() {
    this.isAnalyzing = true;
    try {
      const systemInstruction = `You are a world-class audio engineer. Your task is to analyze a user's song request and generate 16 prompts for a generative music AI to perfectly recreate the original song. Be hyper-specific and technical. Capture the unique soul of the song. Your goal is replication, not creative interpretation.
      **PROTOCOL:**
      1.  **IDENTIFY**: BPM, key, genre, mood.
      2.  **MAP INSTRUMENTS**: Create a hyper-specific, descriptive prompt for every sound.
          - *Good*: 'Punchy 92 BPM boom-bap drum loop with a vinyl crackle layer'
          - *Bad*: 'Drums'
      3.  **STRUCTURED OUTPUT**: Provide exactly 16 prompts categorized as: 4 'beat', 2 'bass', 2 'harmony', 4 'melody', 4 'texture'. Fill all slots. If the original has vocals, one melody prompt MUST recreate a key line.`;
      
      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: "A short, descriptive prompt for a musical element (e.g., 'Heavy 808 Bassline', 'Plucked Koto Riff'). Must be 2-5 words."
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
        contents: `Analyze the song or vibe: "${this.songQuery}"`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: schema,
          seed: this._getSeed(this.songQuery),
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
    const activeIdsToSet: string[] = [];

    for (const categoryName of Object.keys(CATEGORY_MAPPING)) {
        const categoryInfo = CATEGORY_MAPPING[categoryName];
        let isFirstInCategory = true;
        for(const slotIndex of categoryInfo.slots) {
            const promptId = `prompt-${slotIndex}`;
            const newText = categorizedPrompts[categoryName]?.shift()?.text || defaultPrompts.get(promptId)!.text;
            
            const color = categoryInfo.color;

            newPrompts.set(promptId, {
                promptId,
                text: newText,
                weight: 0,
                color,
            });

            if (isFirstInCategory && ['beat', 'bass', 'harmony', 'melody'].includes(categoryName)) {
                activeIdsToSet.push(promptId);
                isFirstInCategory = false;
            }
        }
    }

    activeIdsToSet.forEach(id => {
      const prompt = newPrompts.get(id);
      if (prompt) prompt.weight = 1.0;
    });

    this.prompts = newPrompts;
    this.filteredPrompts.clear();
    this._dispatchPromptsChanged();
  }
  
  private _generateBlobShape(): string {
    const p = () => `${25 + Math.random() * 50}%`;
    return `${p()} ${p()} ${p()} ${p()} / ${p()} ${p()} ${p()} ${p()}`;
  }

  private _setupBackgroundHalos() {
    const activePrompts = [...this.prompts.values()].filter(p => p.weight > 0);
    const moodColors = CHILL_HALO_COLORS;

    const activeIds = new Set(activePrompts.map(p => p.promptId));
    this.backgroundHalos = this.backgroundHalos.filter(h => activeIds.has(h.id));

    activePrompts.forEach((p, i) => {
      const existing = this.backgroundHalos.find(h => h.id === p.promptId);
      const size = 400 + p.weight * 400;
      let color = p.color;
      if (moodColors.length > 0) {
        color = moodColors[i % moodColors.length];
      }

      if (existing) {
        existing.baseSize = size;
        existing.color = color;
      } else {
        this.backgroundHalos.push({
          id: p.promptId,
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          angle: Math.random() * 2 * Math.PI,
          angularVelocity: (Math.random() - 0.5) * 0.4,
          orbitRadius: 100 + Math.random() * 100,
          centerX: Math.random() * window.innerWidth,
          centerY: Math.random() * window.innerHeight,
          centerVx: (Math.random() - 0.5) * 20,
          centerVy: (Math.random() - 0.5) * 20,
          baseSize: size,
          color: color,
          borderRadius: this._generateBlobShape(),
        });
      }
    });
  }

  private _animateHalos = () => {
    const now = performance.now();
    const delta = (now - this.lastFrameTime) / 1000; // seconds
    
    if (now - this.lastMorphTime > 4000) {
      this.backgroundHalos.forEach(halo => {
        halo.borderRadius = this._generateBlobShape();
      });
      this.lastMorphTime = now;
    }
    
    const speedMultiplier = this.playbackState === 'playing' ? 1.0 : 0.2;

    const container = this.shadowRoot?.querySelector('#halo-container');
    if (container) {
      const { width, height } = container.getBoundingClientRect();
      if (width > 0 && height > 0) {
        this.backgroundHalos.forEach(halo => {
          halo.centerX += halo.centerVx * delta * speedMultiplier;
          halo.centerY += halo.centerVy * delta * speedMultiplier;

          const wrapMargin = halo.orbitRadius + halo.baseSize / 2;
          if (halo.centerVx > 0 && halo.centerX - wrapMargin > width) {
            halo.centerX = -wrapMargin;
          } else if (halo.centerVx < 0 && halo.centerX + wrapMargin < 0) {
            halo.centerX = width + wrapMargin;
          }
          if (halo.centerVy > 0 && halo.centerY - wrapMargin > height) {
            halo.centerY = -wrapMargin;
          } else if (halo.centerVy < 0 && halo.centerY + wrapMargin < 0) {
            halo.centerY = height + wrapMargin;
          }
          
          halo.angle += halo.angularVelocity * delta;
          
          halo.x = halo.centerX + Math.cos(halo.angle) * halo.orbitRadius;
          halo.y = halo.centerY + Math.sin(halo.angle) * halo.orbitRadius;
        });
      }
    }

    this.lastFrameTime = now;
    this.requestUpdate();
    this.animationFrameId = requestAnimationFrame(this._animateHalos);
  }

  private playPause() {
    this.dispatchEvent(new CustomEvent('play-pause'));
  }
  
  public addFilteredPrompt(prompt: string) {
    this.filteredPrompts = new Set([...this.filteredPrompts, prompt]);
  }

  override render() {
    const hostStyles = styleMap({ '--bg-color': CHILL_BG_COLOR });
    
    return html`
      ${this.renderSvgDefs()}
      <div id="halo-container">
        ${this.backgroundHalos.map(halo => {
          const haloStyle = styleMap({
            width: `${halo.baseSize}px`,
            height: `${halo.baseSize}px`,
            backgroundColor: halo.color,
            transform: `translate(${halo.x - halo.baseSize/2}px, ${halo.y - halo.baseSize/2}px)`,
            borderRadius: halo.borderRadius,
          });
          return html`<div class="background-halo" style=${haloStyle}></div>`;
        })}
      </div>

      <main id="main-content" style=${hostStyles}>
        <div id="top-bar">
          <div id="top-left-controls">
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

          <form id="analyze-form" @submit=${this._handleAnalyzeSubmit}>
            <input 
              type="text" 
              placeholder="Recreate a song or vibe..."
              .value=${this.songQuery}
              @input=${(e: Event) => this.songQuery = (e.target as HTMLInputElement).value}
              ?disabled=${this.isAnalyzing}
            />
            <button class="top-button analyze-button" type="submit" ?disabled=${this.isAnalyzing || !this.songQuery} aria-label="Analyze song">
                ${this.renderSparkIcon()}
            </button>
            <button class="top-button reset-button" type="button" @click=${this._resetToDefaults} ?hidden=${!this.songQuery} aria-label="Reset to defaults">
              ${this.renderResetIcon()}
            </button>
          </form>
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

  private renderResetIcon() {
    return svg`
      <svg viewBox="0 0 24 24">
        <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4"/>
        <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>
      </svg>
    `;
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-dj-midi': PromptDjMidi;
  }
}
