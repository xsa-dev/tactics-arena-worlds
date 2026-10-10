import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const releaseProfile =
    loadEnv(mode, ".", "").RELEASE_PROFILE ?? "study-draft";
  if (
    !(["study-draft", "catalog-release", "ai-exhibition"] as const).includes(
      releaseProfile as never,
    )
  )
    throw new Error(`Unknown RELEASE_PROFILE: ${releaseProfile}`);
  return {
    base: "./",
    define: {
      __RELEASE_PROFILE__: JSON.stringify(releaseProfile),
    },
    test: {
      environment: "node",
      include: ["tests/unit/**/*.test.{ts,mjs}"],
    },
  };
});
