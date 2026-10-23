Build and release process: findings and open questions
=============

Status: preliminary notes, to be analysed in more depth.
Date: 2026-10-23

Context
-------------
While fixing #160 and #161 (XSLT changes) it became clear that the build and
release process is largely manual. Several open issues look like symptoms of this.

Findings in the repository
-------------

### Compiled XSLT (`app/xslt/*.sef.json`) is checked in
* `app/main.js` loads only the compiled `.sef.json` files at runtime
  (`cii-xr`, `cio-xr`, `ubl-xr`, `ubl-creditnote-xr`, `xrechnung-html.uni`,
  `ZUGFeRD_1p0_c1p0_s1p0`), never the `.xsl` sources.
* None of the npm scripts (`start`, `build`, `pack`, `publish`) generate them,
  and `xslt3` is not in `package.json`. Contributors must run `xslt3` by hand
  (see `doc/electron.md`, `README.md`) and commit the result.
* Each file is a single minified JSON line (`cii-xr.sef.json` ~6.5 MB,
  `xrechnung-html.uni.sef.json` ~1.3 MB) with a build timestamp, so every change
  produces a huge, unreviewable diff and possible merge conflicts.
* `README.md` notes that `xslt3` on Windows only works in cmd.exe, not PowerShell.
* Existing files were compiled with `xslt3` 2.7 (SaxonJS 2.7); runtime is `saxon-js` 2.4.0.

### No CI
* There is no `.github/workflows` directory.
* `doc/development.md` describes a manual deployment:
  `GH_TOKEN` in a shell, `npm run publish`, then `npm run build` to create the
  `latest*.yml` files and upload them manually to the GitHub release.
* The MSI build needs a manual template patch
  (`cp doc/template.xml node_modules/app-builder-lib/templates/msi`) and a
  `package.json` edit to switch between msi and nsis targets.
* Only a Mac can build all three platforms; otherwise each platform is built
  separately by hand.
* The `build` script is Windows only (`electron-builder build --win`).
* `flatpak/generated-sources.json` exists; Flatpak builds offline from the
  checked-in files, so any build-time XSLT compilation must work there too.

Related issues
-------------

### Missing or incomplete release artifacts (likely caused by the manual process)
* #89 `latest-linux.yml` missing in release 1.4.2
* #66 update checks broken: `latest-linux.yml` 404 (1.4.0)
* #140 auto-update does not work, "update information missing"
* #164 (closed) AppImage missing in 1.5.1

### Installer and packaging options
* #174 MSI installer wanted for 2.0
* #92 install system wide (terminal servers)
* #95 selectable installer options
* #91 portable version for Windows
* #170 winget does not detect new versions
* Closed, for reference: #53 (silent MSI), #75 (newer Electron), #101/#106 (macOS)

### Signing
* #124 digitally sign Windows executables, DLLs and installers

Ideas to analyse
-------------
1. Generate `.sef.json` at build time (`xslt3` as devDependency, `build:xslt`
   script hooked into `prestart`/`prebuild`/`prepack`), remove them from Git
   and add them to `.gitignore`.
   * Check: start time impact (~6.5 s for the HTML stylesheet alone),
     Flatpak offline build, Windows cmd.exe vs. PowerShell behaviour,
     which `.sef.json` files are generated from which `.xsl`.
2. GitHub Actions release workflow on tag push:
   build all platforms (Windows, macOS, Linux), upload all artifacts including
   `latest.yml`, `latest-mac.yml`, `latest-linux.yml`.
   * Check: would fix #89, #66, #140, #164.
   * Check: secrets handling (`GH_TOKEN`, signing certificate for #124).
3. electron-builder configuration for #174, #92, #95, #91
   (MSI/NSIS options, per-machine install, portable target).
4. winget manifest update as part of the release (#170).

Open questions for the maintainer
-------------
* Is a CI based release acceptable, and who owns the signing certificate?
* Can `.sef.json` files be removed from Git, given the Flatpak build?
* Should MSI stay a supported target in 2.0 (#174)?
