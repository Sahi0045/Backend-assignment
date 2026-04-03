import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  setupFilesAfterEnv: ["./tests/helpers/testSetup.ts"],
  collectCoverageFrom: ["src/**/*.ts"],
  coveragePathIgnorePatterns: ["src/config", "src/app.ts"],
  coverageReporters: ["text", "lcov", "clover", "html"],
  coverageDirectory: "coverage",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
  testTimeout: 30000,
  detectOpenHandles: true,
  forceExit: true,
};

export default config;
