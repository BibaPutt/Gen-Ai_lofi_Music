/**
 * @fileoverview Control real time music with a MIDI controller
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Prompt, PlaybackState, Note } from './types';
import { GoogleGenAI, type LiveMusicFilteredPrompt } from '@google/genai';
import { PromptDjMidi } from './components/PromptDjMidi';
import { ToastMessage } from './components/ToastMessage';
import { LiveMusicHelper } from './utils/LiveMusicHelper';
import { AudioAnalyser } from './utils/AudioAnalyser';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'lyria-realtime-exp';

async function generateMusic(userPrompt: string): Promise<Note[] | null> {
  if (!userPrompt) return null;

  const fullPrompt = `You are an expert music composition AI specializing in Lo-Fi and chill-out music. Your task is to generate a short, 4-measure musical piece based on a user's text prompt.

You must follow these rules strictly:
1.  Your entire response must be ONLY a valid JSON array of objects.
2.  Do not add any introductory text, explanations, or markdown formatting like \`\`\`json.
3.  Each object in the array represents a single musical note.
4.  Each note object must have exactly three properties:
    - "note": A string for the note's pitch (e.g., "C4", "F#3").
    - "time": A number for the note's start time in seconds.
    - "duration": A number for the note's length in seconds.

Here is a perfect example:
User's Prompt: "calm sunset over the ocean"
Your Response:
[
  {"note": "F3", "time": 0.0, "duration": 1.0},
  {"note": "A3", "time": 0.0, "duration": 1.0},
  {"note": "C4", "time": 0.0, "duration": 1.0},
  {"note": "G3", "time": 1.0, "duration": 1.0},
  {"note": "B3", "time": 1.0, "duration": 1.0},
  {"note": "D4", "time": 1.0, "duration": 1.0},
  {"note": "E3", "time": 2.0, "duration": 2.0},
  {"note": "G3", "time": 2.0, "duration": 2.0},
  {"note": "B3", "time": 2.0, "duration": 2.0}
]

Now, generate the JSON for the following user prompt.

User's Prompt: "${userPrompt}"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
    });
    
    // Clean up response and parse JSON
    const jsonText = response.text.trim().replace(/```json|```/g, '');
    const notes = JSON.parse(jsonText) as Note[];

    // Basic validation to ensure the response is in the correct format
    if (Array.isArray(notes) && notes.length > 0 && 'note' in notes[0] && 'time' in notes[0] && 'duration' in notes[0]) {
        return notes;
    }
    console.error("Parsed data is not in the expected Note[] format:", notes);
    return null;
  } catch (error) {
    console.error("Error generating or parsing music data:", error);
    return null;
  }
}

function main() {
  const pdjMidi = new PromptDjMidi();
  document.body.appendChild(pdjMidi);
  
  pdjMidi.musicGenerationFn = generateMusic;

  const toastMessage = new ToastMessage();
  document.body.appendChild(toastMessage);

  const liveMusicHelper = new LiveMusicHelper(ai, model);
  
  // Pass the audio context to the component for Tone.js
  pdjMidi.audioContext = liveMusicHelper.audioContext;

  const audioAnalyser = new AudioAnalyser(liveMusicHelper.audioContext);
  liveMusicHelper.extraDestination = audioAnalyser.node;

  pdjMidi.addEventListener('prompts-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<Map<string, Prompt>>;
    const prompts = customEvent.detail;
    liveMusicHelper.setWeightedPrompts(prompts);
  }));

  pdjMidi.addEventListener('play-pause', () => {
    liveMusicHelper.playPause();
  });

  liveMusicHelper.addEventListener('playback-state-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<PlaybackState>;
    const playbackState = customEvent.detail;
    pdjMidi.playbackState = playbackState;
    playbackState === 'playing' ? audioAnalyser.start() : audioAnalyser.stop();
  }));

  liveMusicHelper.addEventListener('filtered-prompt', ((e: Event) => {
    const customEvent = e as CustomEvent<LiveMusicFilteredPrompt>;
    const filteredPrompt = customEvent.detail;
    toastMessage.show(filteredPrompt.filteredReason!)
    pdjMidi.addFilteredPrompt(filteredPrompt.text!);
  }));

  const errorToast = ((e: Event) => {
    const customEvent = e as CustomEvent<string>;
    const error = customEvent.detail;
    toastMessage.show(error);
  });

  liveMusicHelper.addEventListener('error', errorToast);
  pdjMidi.addEventListener('error', errorToast);

  audioAnalyser.addEventListener('audio-level-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<number>;
    const level = customEvent.detail;
    pdjMidi.audioLevel = level;
  }));
}

main();
