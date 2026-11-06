import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
    cssCodeSplit: true,
    sourcemap: false,
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
