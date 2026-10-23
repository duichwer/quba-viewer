#!/usr/bin/env node
// Compiles the XSLT stylesheets loaded by app/main.js into SaxonJS SEF files
// (app/xslt/*.sef.json). The SEF files are build output and not under version control.
//
//   npm run build:xslt            compile stylesheets whose sources changed
//   npm run build:xslt -- --force compile all stylesheets
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const xsltDir = path.join(__dirname, "..", "app", "xslt");
const xslt3 = require.resolve("xslt3/xslt3.js");

// source stylesheet -> SEF file loaded in app/main.js
const stylesheets = [
    ["cii-xr.xsl", "cii-xr.sef.json"],
    ["cio-xr.xsl", "cio-xr.sef.json"],
    ["ubl-invoice-xr.xsl", "ubl-xr.sef.json"],
    ["ubl-creditnote-xr.xsl", "ubl-creditnote-xr.sef.json"],
    ["xrechnung-html.uni.xsl", "xrechnung-html.uni.sef.json"],
    ["ZUGFeRD_1p0_c1p0_s1p0.xslt", "ZUGFeRD_1p0_c1p0_s1p0.sef.json"],
];

const force = process.argv.includes("--force");
const mtime = (file) => fs.statSync(file).mtimeMs;

// Stylesheets include each other (e.g. the code list files), so any changed
// source file or a changed compiler invalidates all SEF files.
const newestInput = Math.max(
    mtime(__filename),
    mtime(require.resolve("xslt3/package.json")),
    ...fs.readdirSync(xsltDir)
        .filter((f) => /\.xslt?$/.test(f))
        .map((f) => mtime(path.join(xsltDir, f)))
);

function compile(source, target) {
    const sourcePath = path.join(xsltDir, source);
    const targetPath = path.join(xsltDir, target);
    const started = Date.now();
    return new Promise((resolve) => {
        // Running xslt3 through node avoids shell differences (cmd.exe vs. PowerShell vs. sh).
        const child = spawn(
            process.execPath,
            [xslt3, `-xsl:${sourcePath}`, `-export:${targetPath}`, "-nogo"],
            { stdio: "inherit" }
        );
        child.on("close", (code) => {
            if (code !== 0 || !fs.existsSync(targetPath)) {
                console.error(`FAILED: ${source} -> ${target}`);
                fs.rmSync(targetPath, { force: true });
                resolve(false);
                return;
            }
            console.log(`compiled: ${source} -> ${target} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
            resolve(true);
        });
    });
}

(async () => {
    const queue = stylesheets.filter(([, target]) => {
        const targetPath = path.join(xsltDir, target);
        const upToDate = !force && fs.existsSync(targetPath) && mtime(targetPath) >= newestInput;
        if (upToDate) console.log(`up to date: ${target}`);
        return !upToDate;
    });
    // largest stylesheets first, a few in parallel
    const size = ([source]) => fs.statSync(path.join(xsltDir, source)).size;
    queue.sort((a, b) => size(b) - size(a));
    const workers = Math.max(1, Math.min(queue.length, (os.availableParallelism?.() ?? os.cpus().length) - 1, 4));
    let ok = true;
    await Promise.all(Array.from({ length: workers }, async () => {
        while (queue.length) {
            const [source, target] = queue.shift();
            ok = (await compile(source, target)) && ok;
        }
    }));
    process.exit(ok ? 0 : 1);
})();
