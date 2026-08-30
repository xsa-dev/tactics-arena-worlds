import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDeterministicPackage,
  inspectZipArchive,
  zipArguments,
  smokePackagedArtifact,
  validateZipListing,
  verifyChecksums,
  validateArchiveEntries,
} from "../../scripts/release-tools.mjs";

const testRoots = [];
const makeTestRoot = async (prefix) => {
  const root = await mkdtemp(join(tmpdir(), prefix));
  testRoots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(
    testRoots.splice(0).map((root) =>
      rm(root, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe("release archive tooling", () => {
  it("rejects every structural, path, host, and size violation", () => {
    const valid = [
      {
        path: "index.html",
        size: 20,
        content: "<script src='./app.js'></script>",
      },
      { path: "app.js", size: 2, content: "ok" },
    ];
    expect(validateArchiveEntries(valid)).toEqual([]);
    expect(validateArchiveEntries(valid.slice(1))).toContain(
      "missing root index.html",
    );
    expect(validateArchiveEntries([...valid, valid[0]])).toContain(
      "duplicate index.html",
    );
    expect(
      validateArchiveEntries([
        { path: "app/index.html", size: 1, content: "" },
      ]),
    ).toContain("index.html must be at archive root");
    expect(
      validateArchiveEntries([
        { path: "dist/index.html", size: 1, content: "" },
      ]),
    ).toContain("dist wrapper is forbidden");
    expect(
      validateArchiveEntries([
        ...valid,
        { path: "bad name.js", size: 1, content: "" },
      ]),
    ).toContain("path must be ASCII and space-free: bad name.js");
    expect(
      validateArchiveEntries([
        ...valid,
        { path: "путь.js", size: 1, content: "" },
      ]),
    ).toContain("path must be ASCII and space-free: путь.js");
    expect(
      validateArchiveEntries([
        {
          path: "index.html",
          size: 1,
          content: '<script src="https://forbidden.example/a.js"></script>',
        },
      ]),
    ).toContain("forbidden absolute host: forbidden.example");
    for (const [path, content] of [
      ["network.css", 'body{background:url("https://css.example/a.png")}'],
      ["network.js", 'const endpoint=new URL("https://url.example/a")'],
      [
        "network.js",
        'new XMLHttpRequest().open("GET","https://xhr.example/a")',
      ],
      ["network.js", 'const socket=new WebSocket("wss://socket.example/a")'],
      ["network.js", 'navigator.sendBeacon("//beacon.example/a", data)'],
    ])
      expect(
        validateArchiveEntries([
          valid[0],
          { path, size: content.length, content },
        ]).some((error) => error.startsWith("forbidden absolute host:")),
      ).toBe(true);
    expect(
      validateArchiveEntries([
        { path: "index.html", size: 100 * 1024 * 1024, content: "" },
      ]),
    ).toContain("uncompressed size must be below 100 MB");
    for (const path of [
      "/absolute.js",
      "../escape.js",
      "dir/../escape.js",
      "dir\\escape.js",
      "-option.js",
      "dir/-option.js",
    ])
      expect(validateArchiveEntries([...valid, { path, size: 1 }])).toContain(
        `unsafe archive path: ${path}`,
      );
    expect(zipArguments("/tmp/release.zip", ["index.html"])).toEqual([
      "-X",
      "-q",
      "/tmp/release.zip",
      "--",
      "index.html",
    ]);
    expect(
      validateZipListing([
        { path: "index.html", uncompressedSize: 10, type: "file" },
        { path: "assets/app.js", uncompressedSize: 20, type: "file" },
      ]),
    ).toEqual([]);
    for (const entry of [
      { path: "../escape", uncompressedSize: 1, type: "file" },
      { path: "/absolute", uncompressedSize: 1, type: "file" },
      { path: "dir\\escape", uncompressedSize: 1, type: "file" },
      { path: "-option", uncompressedSize: 1, type: "file" },
      { path: "link", uncompressedSize: 1, type: "symlink" },
      { path: "bad name.js", uncompressedSize: 1, type: "file" },
      { path: "путь.js", uncompressedSize: 1, type: "file" },
      { path: "control\n.js", uncompressedSize: 1, type: "file" },
      {
        path: "bomb.bin",
        uncompressedSize: 100 * 1024 * 1024,
        type: "file",
      },
    ])
      expect(
        validateZipListing([
          { path: "index.html", uncompressedSize: 1, type: "file" },
          entry,
        ]),
      ).not.toEqual([]);
  });

  it("machine-parses hostile central-directory names before extraction", async () => {
    for (const name of ["bad name.js", "путь.js", "control\n.js", "-dash.js"]) {
      const root = await makeTestRoot("tactics-hostile-zip-test-");
      await writeFile(join(root, "index.html"), "ok");
      await writeFile(join(root, name), "hostile");
      const zip = join(root, "hostile.zip");
      execFileSync("zip", ["-q", zip, "--", "index.html", name], {
        cwd: root,
      });
      expect(() => inspectZipArchive(zip)).toThrow(
        /path must be ASCII and space-free|unsafe archive path/,
      );
    }

    const root = await makeTestRoot("tactics-hostile-link-zip-test-");
    await writeFile(join(root, "index.html"), "ok");
    await symlink("index.html", join(root, "link.html"));
    const zip = join(root, "link.zip");
    execFileSync("zip", ["-q", "-y", zip, "--", "index.html", "link.html"], {
      cwd: root,
    });
    expect(() => inspectZipArchive(zip)).toThrow(/non-regular archive entry/);
  });

  it("rejects source symlinks without reading outside the build root", async () => {
    const root = await makeTestRoot("tactics-source-link-test-");
    const source = join(root, "source");
    await mkdir(source);
    await writeFile(join(source, "index.html"), "ok");
    await writeFile(join(root, "outside.js"), "outside");
    await symlink(join(root, "outside.js"), join(source, "linked.js"));
    await expect(
      createDeterministicPackage(source, join(root, "out"), {
        version: "0.1.0",
        profile: "study-draft",
        sourceCommit: "0123456789abcdef0123456789abcdef01234567",
        sourceDateEpoch: 1_800_000_000,
        nodeVersion: "v24.1.0",
        npmVersion: "11.0.0",
        evidence: [{ id: "test", path: "test", sha256: "a".repeat(64) }],
      }),
    ).rejects.toThrow(/symbolic link/);
  });

  it("removes its package staging root after successful creation", async () => {
    const root = await makeTestRoot("tactics-stage-cleanup-test-");
    const source = join(root, "source");
    await mkdir(source);
    await writeFile(join(source, "index.html"), "ok");
    const before = (await readdir(tmpdir())).filter((name) =>
      name.startsWith("tactics-package-stage-"),
    );
    await createDeterministicPackage(source, join(root, "out"), {
      version: "0.1.0",
      profile: "study-draft",
      sourceCommit: "0123456789abcdef0123456789abcdef01234567",
      sourceDateEpoch: 1_800_000_000,
      nodeVersion: "v24.1.0",
      npmVersion: "11.0.0",
      evidence: [{ id: "test", path: "test", sha256: "a".repeat(64) }],
    });
    expect(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith("tactics-package-stage-"),
      ),
    ).toEqual(before);
  });

  it("verifies checksum output for compiled entries larger than one megabyte", async () => {
    const root = await makeTestRoot("tactics-large-checksum-test-");
    const source = join(root, "source");
    await mkdir(source);
    await writeFile(join(source, "index.html"), "ok");
    await writeFile(join(source, "large.js"), "x".repeat(2 * 1024 * 1024));
    const artifact = await createDeterministicPackage(
      source,
      join(root, "out"),
      {
        version: "0.1.0",
        profile: "study-draft",
        sourceCommit: "0123456789abcdef0123456789abcdef01234567",
        sourceDateEpoch: 1_800_000_000,
        nodeVersion: "v24.1.0",
        npmVersion: "11.0.0",
        evidence: [{ id: "test", path: "test", sha256: "a".repeat(64) }],
      },
    );
    expect(await verifyChecksums(artifact.zip, artifact.checksums)).toEqual([]);
  });

  it("rejects traversal and option-like release version output names", async () => {
    const root = await makeTestRoot("tactics-version-test-");
    const source = join(root, "source");
    await mkdir(source);
    await writeFile(join(source, "index.html"), "ok");
    const base = {
      profile: "study-draft",
      sourceCommit: "0123456789abcdef0123456789abcdef01234567",
      sourceDateEpoch: 1_800_000_000,
      nodeVersion: "v24.1.0",
      npmVersion: "11.0.0",
      evidence: [{ id: "test", path: "test", sha256: "a".repeat(64) }],
    };
    await expect(
      createDeterministicPackage(source, join(root, "out"), {
        ...base,
        version: "../escape",
      }),
    ).rejects.toThrow(/version/);
    await expect(
      createDeterministicPackage(source, join(root, "out"), {
        ...base,
        version: "-option",
      }),
    ).rejects.toThrow(/version/);
  });

  it("produces identical ZIP/checksums from two clean fixtures and detects mutation", async () => {
    const root = await makeTestRoot("tactics-release-test-");
    const makeFixture = async (name) => {
      const dir = join(root, name);
      await mkdir(dir);
      await writeFile(
        join(dir, "index.html"),
        "<!doctype html><button id='go'>ready</button><script>window.__PACKAGE_SMOKE__={ready:true};go.onclick=()=>go.textContent='victory'</script>",
      );
      await writeFile(join(dir, "app.js"), "console.info('fixture')\n");
      return dir;
    };
    const input = {
      version: "0.1.0",
      profile: "study-draft",
      sourceCommit: "0123456789abcdef0123456789abcdef01234567",
      sourceDateEpoch: 1_800_000_000,
      nodeVersion: "v24.1.0",
      npmVersion: "11.0.0",
      evidence: [
        {
          id: "tdd-red-green",
          path: "artifacts/tdd-evidence.md",
          sha256: "a".repeat(64),
        },
        {
          id: "scoped-openspec-tasks",
          path: "openspec/changes/prepare-yandex-games-release/tasks.md",
          sha256: "b".repeat(64),
        },
      ],
    };
    const one = await createDeterministicPackage(
      await makeFixture("one"),
      join(root, "out-one"),
      input,
    );
    const two = await createDeterministicPackage(
      await makeFixture("two"),
      join(root, "out-two"),
      input,
    );
    expect(await readFile(one.zip)).toEqual(await readFile(two.zip));
    expect(await readFile(one.manifest)).toEqual(await readFile(two.manifest));
    expect(await readFile(one.checksums)).toEqual(
      await readFile(two.checksums),
    );
    const manifest = JSON.parse(await readFile(one.manifest, "utf8"));
    expect(manifest.archive).toEqual({
      compressedBytes: (await stat(one.zip)).size,
      uncompressedBytes:
        Buffer.byteLength(
          "<!doctype html><button id='go'>ready</button><script>window.__PACKAGE_SMOKE__={ready:true};go.onclick=()=>go.textContent='victory'</script>",
        ) + Buffer.byteLength("console.info('fixture')\n"),
    });
    expect(manifest.evidence).toEqual(input.evidence);
    expect(await verifyChecksums(one.zip, one.checksums)).toEqual([]);
    const completeChecksums = await readFile(one.checksums, "utf8");
    await writeFile(one.checksums, completeChecksums.split("\n")[0] + "\n");
    expect(await verifyChecksums(one.zip, one.checksums)).toContain(
      "missing checksum: app/index.html",
    );
    await writeFile(one.checksums, completeChecksums);
    await writeFile(one.zip, "mutated");
    expect(await verifyChecksums(one.zip, one.checksums)).not.toEqual([]);
  });

  it("cleans extraction and closes its server when browser launch fails", async () => {
    const root = await makeTestRoot("tactics-smoke-cleanup-test-");
    const source = join(root, "source");
    await mkdir(source);
    await writeFile(join(source, "index.html"), "ok");
    const artifact = await createDeterministicPackage(
      source,
      join(root, "out"),
      {
        version: "0.1.0",
        profile: "study-draft",
        sourceCommit: "0123456789abcdef0123456789abcdef01234567",
        sourceDateEpoch: 1_800_000_000,
        nodeVersion: "v24.1.0",
        npmVersion: "11.0.0",
        evidence: [{ id: "test", path: "test", sha256: "a".repeat(64) }],
      },
    );
    const before = (await readdir(tmpdir())).filter((name) =>
      name.startsWith("tactics-package-smoke-"),
    );
    const closeServer = vi.fn((callback) => callback());
    const fakeServer = {
      listen: (_port, _host, callback) => callback(),
      address: () => ({ port: 43123 }),
      close: closeServer,
    };
    await expect(
      smokePackagedArtifact(artifact.zip, {
        launchBrowser: async () => {
          throw new Error("forced launch failure");
        },
        createHttpServer: () => fakeServer,
      }),
    ).rejects.toThrow(/forced launch failure/);
    expect(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith("tactics-package-smoke-"),
      ),
    ).toEqual(before);
    expect(closeServer).toHaveBeenCalledOnce();
  });

  it("closes browser/server and cleans extraction when navigation fails", async () => {
    const root = await makeTestRoot("tactics-nav-cleanup-test-");
    const source = join(root, "source");
    await mkdir(source);
    await writeFile(join(source, "index.html"), "ok");
    const artifact = await createDeterministicPackage(
      source,
      join(root, "out"),
      {
        version: "0.1.0",
        profile: "study-draft",
        sourceCommit: "0123456789abcdef0123456789abcdef01234567",
        sourceDateEpoch: 1_800_000_000,
        nodeVersion: "v24.1.0",
        npmVersion: "11.0.0",
        evidence: [{ id: "test", path: "test", sha256: "a".repeat(64) }],
      },
    );
    const before = (await readdir(tmpdir())).filter((name) =>
      name.startsWith("tactics-package-smoke-"),
    );
    const closeServer = vi.fn((callback) => callback());
    const closeBrowser = vi.fn(async () => undefined);
    const fakeServer = {
      listen: (_port, _host, callback) => callback(),
      address: () => ({ port: 43123 }),
      close: closeServer,
    };
    const fakePage = {
      on: vi.fn(),
      goto: vi.fn(async () => {
        throw new Error("forced navigation failure");
      }),
      evaluate: vi.fn(async () => null),
    };
    await expect(
      smokePackagedArtifact(artifact.zip, {
        launchBrowser: async () => ({
          newPage: async () => fakePage,
          close: closeBrowser,
        }),
        createHttpServer: () => fakeServer,
      }),
    ).rejects.toThrow(/forced navigation failure/);
    expect(closeBrowser).toHaveBeenCalledOnce();
    expect(closeServer).toHaveBeenCalledOnce();
    expect(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith("tactics-package-smoke-"),
      ),
    ).toEqual(before);
  });

  it("fails explicitly on HTTP error responses and failed requests", async () => {
    const root = await makeTestRoot("tactics-network-failure-test-");
    const source = join(root, "source");
    await mkdir(source);
    await writeFile(join(source, "index.html"), "ok");
    const artifact = await createDeterministicPackage(
      source,
      join(root, "out"),
      {
        version: "0.1.0",
        profile: "study-draft",
        sourceCommit: "0123456789abcdef0123456789abcdef01234567",
        sourceDateEpoch: 1_800_000_000,
        nodeVersion: "v24.1.0",
        npmVersion: "11.0.0",
        evidence: [{ id: "test", path: "test", sha256: "a".repeat(64) }],
      },
    );
    const handlers = new Map();
    const fakePage = {
      on: vi.fn((name, handler) => handlers.set(name, handler)),
      goto: vi.fn(async () => {
        handlers.get("response")?.({
          status: () => 404,
          url: () => "http://127.0.0.1/missing.js",
        });
        handlers.get("requestfailed")?.({
          url: () => "http://127.0.0.1/broken.css",
          failure: () => ({ errorText: "net::ERR_FAILED" }),
        });
        return { ok: () => true, status: () => 200 };
      }),
      evaluate: vi.fn(async () => null),
    };
    const fakeServer = {
      listen: (_port, _host, callback) => callback(),
      address: () => ({ port: 43123 }),
      close: (callback) => callback(),
      once: vi.fn(),
      removeListener: vi.fn(),
    };
    await expect(
      smokePackagedArtifact(artifact.zip, {
        launchBrowser: async () => ({
          newPage: async () => fakePage,
          close: async () => undefined,
        }),
        createHttpServer: () => fakeServer,
      }),
    ).rejects.toThrow(/HTTP 404.*request failed.*ERR_FAILED/);
  });

  it("recreates an existing ZIP so removed application entries cannot survive", async () => {
    const root = await makeTestRoot("tactics-repeat-package-test-");
    const source = join(root, "source");
    await mkdir(source);
    await writeFile(join(source, "index.html"), "ok");
    await writeFile(join(source, "removed.js"), "remove me");
    const input = {
      version: "0.1.0",
      profile: "study-draft",
      sourceCommit: "0123456789abcdef0123456789abcdef01234567",
      sourceDateEpoch: 1_800_000_000,
      nodeVersion: "v24.1.0",
      npmVersion: "11.0.0",
      evidence: [{ id: "test", path: "test", sha256: "a".repeat(64) }],
    };
    const output = join(root, "out");
    const first = await createDeterministicPackage(source, output, input);
    expect(
      execFileSync("unzip", ["-Z1", first.zip], { encoding: "utf8" }),
    ).toContain("removed.js");
    await rm(join(source, "removed.js"));
    const second = await createDeterministicPackage(source, output, input);
    expect(
      execFileSync("unzip", ["-Z1", second.zip], { encoding: "utf8" }),
    ).not.toContain("removed.js");
  });
});
