/**
 * @fileoverview Control real time music with a MIDI controller
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Prompt, PlaybackState } from './types';
import { GoogleGenAI, LiveMusicFilteredPrompt, Type } from '@google/genai';
import { PromptDjMidi } from './components/PromptDjMidi';
import { ToastMessage } from './components/ToastMessage';
import { LiveMusicHelper } from './utils/LiveMusicHelper';
import { AudioAnalyser } from './utils/AudioAnalyser';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
const model = 'lyria-realtime-exp';

async function analyzeSong(songTitle: string): Promise<string[] | null> {
  if (!songTitle) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the song: "${songTitle}"`,
      config: {
        systemInstruction: "You are a music analysis expert. Your task is to generate a list of exactly 16 short, evocative musical prompts based on a given song title. The prompts should capture the song's genre, mood, instrumentation, and overall vibe. Each prompt should be 2-4 words long.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompts: {
              type: Type.ARRAY,
              description: "A list of 16 musical prompts.",
              items: {
                type: Type.STRING
              }
            }
          }
        },
      },
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    if (result.prompts && Array.isArray(result.prompts) && result.prompts.length > 0) {
      return result.prompts;
    }
    return null;
  } catch (error) {
    console.error("Error analyzing song:", error);
    return null;
  }
}

function main() {
  const pdjMidi = new PromptDjMidi();
  document.body.appendChild(pdjMidi);
  
  pdjMidi.songAnalysisFn = analyzeSong;

  const toastMessage = new ToastMessage();
  document.body.appendChild(toastMessage);

  const liveMusicHelper = new LiveMusicHelper(ai, model);

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
