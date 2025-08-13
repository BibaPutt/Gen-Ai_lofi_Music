/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Throttles a callback to be called at most once per `delay` milliseconds.
 * Also returns the result of the last "fresh" call...
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => ReturnType<T> {
  let lastCall = -Infinity;
  let lastResult: ReturnType<T>;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;
    if (timeSinceLastCall >= delay) {
      lastResult = func(...args);
      lastCall = now;
    }
    return lastResult;
  };
}

/**
 * Debounces a function, ensuring it's only called after `delay` ms have passed
 * without any new calls.
 * @param immediate If true, trigger the function on the leading edge instead of the trailing.
 */
export function debounce<T extends (...args: Parameters<T>) => unknown>(
  func: T,
  delay: number,
  immediate = false,
): (...args: Parameters<T>) => void {
  let timeout: number | undefined;

  return function(this: unknown, ...args: Parameters<T>) {
    const context = this;

    const later = function() {
      timeout = undefined;
      if (!immediate) {
        func.apply(context, args);
      }
    };

    const callNow = immediate && timeout === undefined;

    clearTimeout(timeout);
    timeout = window.setTimeout(later, delay);

    if (callNow) {
      func.apply(context, args);
    }
  };
}
