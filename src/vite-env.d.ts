/// <reference types="vite/client" />

import type { ScreenwriterApi } from '../electron/preload';

declare global {
  interface Window {
    screenwriter?: ScreenwriterApi;
  }
}
