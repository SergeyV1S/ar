import path from "path";
import { defineConfig } from "vite";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";

const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless"
};

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  server: {
    headers: isolationHeaders,
    proxy: {
      "/api": "http://127.0.0.1:3000"
    }
  },
  preview: {
    headers: isolationHeaders
  },
  build: {
    rolldownOptions: {
      input: {
        app: path.resolve(import.meta.dirname, "index.html"),
        sw: path.resolve(import.meta.dirname, "src/sw.ts")
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js")
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src")
    }
  }
});
