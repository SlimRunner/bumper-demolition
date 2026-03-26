import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        format: "iife", // safer for legacy/global-style libs
      },
    },

    // TEMP safety: avoid breaking tiny-graphics
    // You can remove later once stable
    // @ts-ignore
    treeshake: false,
  },
  server: {
    open: true,
  },
  resolve: {
    alias: {
      "@": new URL("./src/game", import.meta.url).pathname,
      "@tiny": new URL("./src/tiny-graphics", import.meta.url).pathname,
    },
  },
});
