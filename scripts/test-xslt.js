#!/usr/bin/env node
// Runs the sample invoices through the same XSLT chain as app/main.js
// (XML -> XR intermediate format -> HTML) using the SEF files in app/xslt.
//
//   npm run test:xslt                          fail if a transformation throws
//   npm run test:xslt -- --compare <dir>       additionally compare the output with
//                                              the SEF files in <dir> (e.g. an older build)
const fs = require("fs");
const path = require("path");
const SaxonJS = require("saxon-js");

const root = path.join(__dirname, "..");
const xsltDir = path.join(root, "app", "xslt");
const sampleDirs = [path.join(root, "000resources", "testfiles"), path.join(root, "000resources")];

const compareIdx = process.argv.indexOf("--compare");
const compareDir = compareIdx > 0 ? path.resolve(process.argv[compareIdx + 1]) : null;

// root element -> first stylesheet, as selected in app/main.js
const firstStage = {
    CrossIndustryInvoice: "cii-xr.sef.json",
    SCRDMCCBDACIOMessageStructure: "cio-xr.sef.json",
    Invoice: "ubl-xr.sef.json",
    CreditNote: "ubl-creditnote-xr.sef.json",
    CrossIndustryDocument: "ZUGFeRD_1p0_c1p0_s1p0.sef.json",
};
const htmlStage = "xrechnung-html.uni.sef.json";
const languages = ["de", "en", "fr"];

const translations = Object.fromEntries(languages.map((lang) => [
    lang,
    JSON.parse(fs.readFileSync(path.join(root, "app", "locales", lang, "translation.json"), "utf8")),
]));

function rootElement(xml) {
    const m = xml.replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->/g, "").match(/<(?:[\w.-]+:)?([\w.-]+)[\s>/]/);
    return m && m[1];
}

async function transform(sefDir, sef, sourceText, params) {
    const result = await SaxonJS.transform({
        stylesheetFileName: path.join(sefDir, sef),
        sourceText,
        destination: "serialized",
        stylesheetParams: params,
    }, "async");
    return result.principalResult;
}

async function render(sefDir, xml, type, lang) {
    const first = firstStage[type];
    if (type === "CrossIndustryDocument") {
        return { html: await transform(sefDir, first, xml) };
    }
    const xr = await transform(sefDir, first, xml);
    const html = await transform(sefDir, htmlStage, xr, {
        isOrder: false,
        showIds: false,
        "Q{}i18n": translations[lang],
    });
    return { xr, html };
}

// SEF build metadata is not part of the output, but generated ids may be
const normalize = (s) => (s || "").replace(/\s+/g, " ").trim();

(async () => {
    const samples = sampleDirs.flatMap((dir) => fs.readdirSync(dir)
        .filter((f) => f.endsWith(".xml"))
        .map((f) => path.join(dir, f)));

    let errors = 0;
    let differences = 0;
    let checked = 0;
    for (const file of samples) {
        const xml = fs.readFileSync(file, "utf8");
        const type = rootElement(xml);
        if (!firstStage[type]) continue;
        const name = path.relative(root, file);
        for (const lang of languages) {
            let actual;
            try {
                actual = await render(xsltDir, xml, type, lang);
                if (!actual.html || !actual.html.includes("<")) throw new Error("empty HTML output");
            } catch (e) {
                console.error(`ERROR ${name} [${lang}]: ${e.message || e}`);
                errors++;
                continue;
            }
            checked++;
            if (!compareDir) continue;
            const expected = await render(compareDir, xml, type, lang);
            for (const stage of ["xr", "html"]) {
                if (normalize(actual[stage]) !== normalize(expected[stage])) {
                    console.error(`DIFF  ${name} [${lang}] ${stage}`);
                    differences++;
                }
            }
        }
    }
    console.log(`${checked} transformations ok, ${errors} errors` +
        (compareDir ? `, ${differences} differences to ${compareDir}` : ""));
    process.exit(errors || differences ? 1 : 0);
})();
