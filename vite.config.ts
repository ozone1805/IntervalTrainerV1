import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Served from a GitHub Pages project subpath, not the domain root, so asset
  // URLs need the repo name in front of them.
  base: "/IntervalTrainerV1/",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
