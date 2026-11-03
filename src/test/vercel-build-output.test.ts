import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("FixLens AI — Vercel Build Output & Nitro Configuration Verification", () => {
  const rootDir = process.cwd();
  const vercelOutputDir = path.join(rootDir, ".vercel", "output");
  const configJsonPath = path.join(vercelOutputDir, "config.json");
  const serverFuncDir = path.join(vercelOutputDir, "functions", "__server.func");
  const vcConfigJsonPath = path.join(serverFuncDir, ".vc-config.json");
  const staticDir = path.join(vercelOutputDir, "static");

  it("verifies Vercel Build Output API v3 config.json structure and routes", () => {
    expect(fs.existsSync(configJsonPath), "config.json should exist in .vercel/output").toBe(true);

    const configContent = fs.readFileSync(configJsonPath, "utf-8");
    const config = JSON.parse(configContent);

    // Vercel Build Output API specification version must be 3
    expect(config.version).toBe(3);
    expect(config.framework?.name).toBe("nitro");

    // Routes validation: assets caching, filesystem handling, fallback to __server
    expect(Array.isArray(config.routes)).toBe(true);
    expect(config.routes.length).toBeGreaterThanOrEqual(3);

    const assetRoute = config.routes.find((r: any) => r.src && r.src.includes("/assets/"));
    expect(assetRoute).toBeDefined();
    expect(assetRoute.headers?.["cache-control"]).toContain("immutable");

    const filesystemRoute = config.routes.find((r: any) => r.handle === "filesystem");
    expect(filesystemRoute).toBeDefined();

    const fallbackRoute = config.routes.find((r: any) => r.dest === "/__server");
    expect(fallbackRoute).toBeDefined();
  });

  it("verifies Vercel serverless SSR function configuration (.vc-config.json)", () => {
    expect(fs.existsSync(serverFuncDir), "__server.func directory must exist").toBe(true);
    expect(fs.existsSync(vcConfigJsonPath), ".vc-config.json must exist in function folder").toBe(true);

    const vcConfig = JSON.parse(fs.readFileSync(vcConfigJsonPath, "utf-8"));
    expect(vcConfig.handler).toBe("index.mjs");
    expect(vcConfig.launcherType).toBe("Nodejs");
    expect(vcConfig.runtime).toMatch(/nodejs/i);
    expect(vcConfig.supportsResponseStreaming).toBe(true);

    // Verify the entrypoint index.mjs exists
    const entrypointPath = path.join(serverFuncDir, "index.mjs");
    expect(fs.existsSync(entrypointPath), "index.mjs handler must exist").toBe(true);
  });

  it("verifies static assets bundle directory exists and contains client build", () => {
    expect(fs.existsSync(staticDir), "Static output directory must exist").toBe(true);
    const assetsDir = path.join(staticDir, "assets");
    expect(fs.existsSync(assetsDir), "Static assets folder must exist").toBe(true);

    const files = fs.readdirSync(assetsDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith(".js"))).toBe(true);
    expect(files.some((f) => f.endsWith(".css"))).toBe(true);
  });
});
