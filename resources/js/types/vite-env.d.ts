/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** "true" in the static build published to GitHub Pages. */
    readonly VITE_STATIC?: string;
}
