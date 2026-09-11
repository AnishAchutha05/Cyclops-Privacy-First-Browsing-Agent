import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const file = (name: string) => new URL(name, import.meta.url).pathname;
export default defineConfig({
  plugins: [react()],
  publicDir: "src/ui/public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: file("index.html"),
        background: file("src/background/service-worker.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "background.js" : "assets/[name].js",
      },
    },
  },
});