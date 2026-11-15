/// <reference types="vitest/config" />
import { reactRouter } from "@react-router/dev/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vite";

const isTest = process.env.VITEST === "true";

export default defineConfig({
  // The React Router plugin cannot run inside Vitest; load only the paths
  // resolver when testing so unit tests import `~/*` modules cleanly.
  plugins: isTest ? [tsconfigPaths()] : [reactRouter(), tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    globals: true,
  },
});
