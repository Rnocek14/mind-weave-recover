import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Use CLI file filters for local focus, not committed .only markers.
    allowOnly: false,
    passWithNoTests: false,
    retry: 0,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
