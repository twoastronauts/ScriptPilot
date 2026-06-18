/// <reference types="vite/client" />

import type { ScreenwriterApi } from '../electron/preload';

declare global {
  interface Window {
    screenwriter?: ScreenwriterApi;
  }
}

declare module '*.mp3' {
  const src: string;
  export default src;
}
