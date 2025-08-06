/**
 * @fileoverview Control real time music with a MIDI controller
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlaybackState, Prompt } from './types';
import { GoogleGenAI, LiveMusicFilteredPrompt } from '@google/genai';
import { PromptDjMidi } from './components/PromptDjMidi';
import { ToastMessage } from './components/ToastMessage';
import { LiveMusicHelper } from './utils/LiveMusicHelper';
import { AudioAnalyser } from './utils/AudioAnalyser';

// Create two separate clients. One for the experimental live music API,
// and one for the standard generative model API. This prevents potential
// versioning conflicts that can cause WebSocket errors.
const liveAi = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY, apiVersion: 'v1alpha' });
const generativeAi = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
const model = 'lyria-realtime-exp';

function main() {
  const app = new PromptDjMidi();
  app.generativeAi = generativeAi; // Pass standard AI client to the main component
  document.body.appendChild(app);

  const toastMessage = new ToastMessage();
  document.body.appendChild(toastMessage);

  const liveMusicHelper = new LiveMusicHelper(liveAi, model); // Use dedicated live music client
  liveMusicHelper.setWeightedPrompts(app.prompts);

  const audioAnalyser = new AudioAnalyser(liveMusicHelper.audioContext);
  liveMusicHelper.extraDestination = audioAnalyser.node;

  app.addEventListener('prompts-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<Map<string, Prompt>>;
    const prompts = customEvent.detail;
    liveMusicHelper.setWeightedPrompts(prompts);
  }));

  app.addEventListener('play-pause', () => {
    liveMusicHelper.playPause();
  });

  liveMusicHelper.addEventListener('playback-state-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<PlaybackState>;
    const playbackState = customEvent.detail;
    app.playbackState = playbackState;
    playbackState === 'playing' ? audioAnalyser.start() : audioAnalyser.stop();
  }));

  liveMusicHelper.addEventListener('filtered-prompt', ((e: Event) => {
    const customEvent = e as CustomEvent<LiveMusicFilteredPrompt>;
    const filteredPrompt = customEvent.detail;
    toastMessage.show(`Filtered prompt: "${filteredPrompt.text!}". Reason: ${filteredPrompt.filteredReason!}`);
    app.addFilteredPrompt(filteredPrompt.text!);
  }));

  const errorToast = ((e: Event) => {
    const customEvent = e as CustomEvent<string>;
    const error = customEvent.detail;
    toastMessage.show(error, 8000);
  });

  liveMusicHelper.addEventListener('error', errorToast);
  app.addEventListener('error', errorToast);

  audioAnalyser.addEventListener('audio-level-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<number>;
    const level = customEvent.detail;
    app.audioLevel = level;
  }));

}

main();