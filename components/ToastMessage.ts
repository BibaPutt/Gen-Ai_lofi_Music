/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

@customElement('toast-message')
export class ToastMessage extends LitElement {
  static override styles = css`
    :host {
      --toast-duration: 5000ms;
    }
    .toast {
      line-height: 1.5;
      position: fixed;
      bottom: 20px;
      left: 20px;
      background-color: #1a1a1a;
      color: white;
      padding: 16px;
      border-radius: 8px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 15px;
      width: min(450px, 80vw);
      transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
      border: 1px solid #444;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      text-wrap: pretty;
      transform: translateY(150%);
      z-index: 9999;
      overflow: hidden;
    }
    .toast.showing {
      transform: translateY(0);
    }
    button {
      background: none;
      border: none;
      color: #aaa;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      font-size: 18px;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    button:hover {
      opacity: 1;
    }
    a {
      color: #8ab4f8;
      text-decoration: underline;
    }
    .progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 4px;
      background: #8ab4f8;
      width: 100%;
    }
    .toast.showing .progress {
      animation: shrink var(--toast-duration) linear forwards;
    }
    .toast:hover .progress {
      animation-play-state: paused;
    }

    @keyframes shrink {
      from { width: 100%; }
      to { width: 0%; }
    }
  `;

  @state() private message = '';
  @state() private showing = false;
  
  @query('.progress') private progressBar!: HTMLDivElement;
  private readonly animationEndListener = () => this.hide();

  override updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('showing') && this.progressBar) {
      this.progressBar.removeEventListener('animationend', this.animationEndListener);
      if (this.showing) {
        this.progressBar.addEventListener('animationend', this.animationEndListener, { once: true });
      }
    }
  }

  private renderMessageWithLinks() {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = this.message.split(urlRegex);
    return parts.map((part, i) => {
      if (i % 2 === 0) return part;
      return html`<a href=${part} target="_blank" rel="noopener">${part}</a>`;
    });
  }

  override render() {
    return html`
      <div class=${classMap({ showing: this.showing, toast: true })}>
        <div class="message">${this.renderMessageWithLinks()}</div>
        <button @click=${this.hide}>✕</button>
        <div class="progress"></div>
      </div>
    `;
  }

  show(message: string, duration = 5000) {
    if (this.showing) {
      // If a toast is already up, hide it first, then show the new one.
      this.showing = false;
      this.message = '';
      requestAnimationFrame(() => {
        this.style.setProperty('--toast-duration', `${duration}ms`);
        this.message = message;
        this.showing = true;
      });
    } else {
      this.style.setProperty('--toast-duration', `${duration}ms`);
      this.message = message;
      this.showing = true;
    }
  }

  hide() {
    this.showing = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'toast-message': ToastMessage
  }
}
