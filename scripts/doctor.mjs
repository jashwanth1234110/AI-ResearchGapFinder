#!/usr/bin/env node
/**
 * npm run doctor — plain-English environment check for researchgap-ai.
 *
 * Exists because this project has broken on startup after every multi-week
 * gap, always from environment drift rather than code: the venv's interpreter
 * is Xcode's Command Line Tools python, which OS updates replace; Homebrew
 * upgrades node under you; and an unpinned dependency set rebuilt months
 * later is simply a different stack. Each check below says what is wrong and
 * exactly what to type to fix it.
 */
import { execSync, execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENV = join(ROOT, "engine/.venv/bin/python3");
let fail = 0, warn = 0;

const sh = (cmd) => { try { return execSync(cmd, { stdio: ["ignore","pipe","ignore"] }).toString().trim(); } catch { return null; } };
const ok   = (m)      => console.log(`  \x1b[32mOK\x1b[0m    ${m}`);
const bad  = (m, fix) => { fail++; console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`); if (fix) console.log(`        fix: ${fix}`); };
const soft = (m, fix) => { warn++; console.log(`  \x1b[33mWARN\x1b[0m  ${m}`); if (fix) console.log(`        fix: ${fix}`); };

console.log("\nresearchgap-ai doctor\n" + "=".repeat(60));

// 1. Node version vs .nvmrc
console.log("\nNode");
const want = existsSync(join(ROOT, ".nvmrc")) ? readFileSync(join(ROOT, ".nvmrc"), "utf8").trim() : null;
const have = process.version.replace(/^v/, "");
if (!want) soft("no .nvmrc to compare against");
else if (have.split(".")[0] !== want.split(".")[0])
  soft(`node is ${have}, but this project was verified on ${want}`, `nvm install ${want} && nvm use ${want}`);
else ok(`node ${have} (matches .nvmrc major)`);

// 2. The venv interpreter — the single most common breakage
console.log("\nPython venv");
if (!existsSync(VENV)) {
  bad("engine/.venv is missing entirely",
      "cd engine && python3 -m venv .venv && .venv/bin/python3 -m pip install -r requirements.txt");
} else {
  let target = null;
  try { target = realpathSync(VENV); } catch { /* dangling symlink */ }
  if (!target) {
    bad("engine/.venv/bin/python3 points at an interpreter that no longer exists",
        "this is the classic post-Xcode-update break — rebuild: cd engine && rm -rf .venv && python3 -m venv .venv && .venv/bin/python3 -m pip install -r requirements.txt");
  } else {
    const v = sh(`"${VENV}" --version`);
    if (!v) bad("the venv interpreter exists but will not run", "rebuild the venv (see above)");
    else {
      ok(`${v} at ${target}`);
      if (target.includes("CommandLineTools"))
        soft("this venv is built on Xcode Command Line Tools python — an OS/Xcode update can replace it and silently break the engine",
             "for long-term stability: brew install python@3.12 and rebuild the venv on it");
    }
  }
}

// 3. Python deps importable (the real test, not just 'installed')
console.log("\nPython packages");
if (existsSync(VENV)) {
  // Run via execFileSync with an argv array: the probe contains quotes and
  // newlines, and routing it through a shell string mangled it.
  const probe = [
    "import importlib",
    "mods={'httpx':'httpx','sentence-transformers':'sentence_transformers','bertopic':'bertopic','python-dotenv':'dotenv','anthropic':'anthropic','fastapi':'fastapi','uvicorn':'uvicorn','weasyprint':'weasyprint','markdown':'markdown'}",
    "bad=[]",
    "for d,m in mods.items():",
    "    try: importlib.import_module(m)",
    "    except Exception as e: bad.append(d+': '+type(e).__name__)",
    "print('|'.join(bad))",
  ].join("\n");
  let out = null;
  try {
    out = execFileSync(VENV, ["-c", probe], {
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, DYLD_FALLBACK_LIBRARY_PATH: `/opt/homebrew/lib:/usr/local/lib:${process.env.HOME}/lib:/usr/lib` },
    }).toString().trim();
  } catch { out = null; }
  if (out === null) bad("could not run the import check", "rebuild the venv");
  else if (out === "") ok("all 9 engine packages import cleanly");
  else for (const e of out.split("|"))
    bad(`cannot import ${e}`, e.startsWith("weasyprint")
      ? "brew install pango glib cairo  (and start via `npm run dev`, which sets DYLD_FALLBACK_LIBRARY_PATH)"
      : "cd engine && .venv/bin/python3 -m pip install -r requirements.txt");
}

// 4. Secrets present (names only — never values)
console.log("\nAPI keys (engine/.env)");
const envPath = join(ROOT, "engine/.env");
if (!existsSync(envPath)) bad("engine/.env is missing", "create it with ANTHROPIC_API_KEY, S2_API_KEY, OPENALEX_API_KEY, OPENALEX_MAILTO");
else {
  const txt = readFileSync(envPath, "utf8");
  for (const k of ["ANTHROPIC_API_KEY", "S2_API_KEY", "OPENALEX_API_KEY", "OPENALEX_MAILTO"]) {
    const m = txt.match(new RegExp(`^\\s*${k}\\s*=\\s*(.*)$`, "m"));
    const val = m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
    if (!val) bad(`${k} is missing or empty`, `add ${k}=... to engine/.env`);
    else ok(`${k} present (${val.length} chars, value not shown)`);
  }
  if (!/ANTHROPIC_API_KEY/.test(txt)) {}
}

// 5. Ports — the port-fallback trap
console.log("\nPorts");
for (const p of [3001, 8001]) {
  const pids = sh(`lsof -ti:${p}`);
  if (!pids) ok(`${p} is free`);
  else soft(`${p} is held by pid(s) ${pids.split("\n").join(", ")}`,
            "`gapfinder` clears these automatically; manually: lsof -ti:3001,8001 | xargs kill -9");
}

// 6. Model cache — decides whether the first run re-downloads ~90MB
console.log("\nModel cache");
const hf = join(process.env.HOME, ".cache/huggingface/hub/models--sentence-transformers--all-MiniLM-L6-v2");
if (existsSync(hf)) ok("Sentence-BERT (all-MiniLM-L6-v2) is cached — no download on first run");
else soft("Sentence-BERT is NOT cached — the first analysis will download ~90MB",
          "run one analysis before demoing, on wifi you trust");

// 7. UI install
console.log("\nUI");
existsSync(join(ROOT, "ui/node_modules"))
  ? ok("ui/node_modules present")
  : bad("ui/node_modules missing", "npm install --prefix ui");

console.log("\n" + "=".repeat(60));
if (fail) console.log(`\x1b[31m${fail} problem(s) that will break startup\x1b[0m` + (warn ? `, ${warn} warning(s)` : ""));
else if (warn) console.log(`\x1b[33mNo blockers. ${warn} warning(s) worth knowing about.\x1b[0m`);
else console.log("\x1b[32mEverything checks out — npm run dev should work.\x1b[0m");
console.log("");
process.exit(fail ? 1 : 0);
