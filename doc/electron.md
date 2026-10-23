Electron development
=============


We learned a lot from Vuika 2019 book  
("Electron Projects: Build over 9 cross-platform desktop applications from scratch").

There is also a interesting and inspiring (e.g. tabs) open-source-project of a
[Electron based PDF Viewer](https://github.com/sagargurtu/lector).

IPC
-------------
There is a hard distinction between the main process and the browser process.
If the browser wants to tell anything to the main process it
sends an according signal, let's call it `click-button`

```
<script>
    const {ipcRenderer} = require('electron');
    function clickButton() {
        console.log("firing click-button signal");
        ipcRenderer.send('click-button', null, true)
    }
</script>
<button onclick="clickButton()" id="new-window">Open File</button>
```

and the main process picks it up via
```
ipcMain.on('click-button', (event, arg) => {
    console.log("click-button received ", event, arg);
    }
})
```
If the main process, e.g. the menu, wants to tell anything to the browser it also 
sends a signal, e.g.
```
    const window=BrowserWindow.getFocusedWindow();
    window.webContents.send('eventForBrowser', null, true)
```
and in the browser's script the event can be picked up like this
```
    ipcRenderer.on('eventForBrowser', (event, data) => {
        console.log("received event for browser", event, data)
    })
```

To send signals from Vue3 to the main process you can define a function in 
`app/preload.js` e.g. like 

```
sendMySig: () => {
    ipcRenderer.send('myX');
}
```
and in `app/main.js` you can subscribe like this:

```
ipcMain.on("myX", async () => {
    console.log("Whoaaa")
});

```

When you then fire `window.api.sendMySig();` in Vue your app/main.js ipcMain will pick it up. 


XSLT/Saxon
-------------
Quba uses [saxon-js](https://www.saxonica.com/saxon-js/) as XSLT processor to apply
some [available](https://github.com/itplr-kosit/xrechnung-visualization) XSLT style sheets which are
compiled to .sef.json files with the xslt3 utility at build time.

Only the `.xsl` files are under version control. `npm start`, `npm run build` and
`npm run dist` compile them first (`npm run build:xslt`, see `scripts/build-xslt.js`;
only changed sources are recompiled, `-- --force` recompiles all).
The mapping from source to compiled file is:

| Source | Compiled |
|---|---|
| `cii-xr.xsl` | `cii-xr.sef.json` |
| `cio-xr.xsl` | `cio-xr.sef.json` |
| `ubl-invoice-xr.xsl` | `ubl-xr.sef.json` |
| `ubl-creditnote-xr.xsl` | `ubl-creditnote-xr.sef.json` |
| `xrechnung-html.uni.xsl` | `xrechnung-html.uni.sef.json` |
| `ZUGFeRD_1p0_c1p0_s1p0.xslt` | `ZUGFeRD_1p0_c1p0_s1p0.sef.json` |

`npm run test:xslt` runs the sample invoices in `000resources` through the stylesheets;
`npm run test:xslt -- --compare <dir>` also compares the output with the `.sef.json`
files in another directory, e.g. to check a stylesheet change for side effects.

Since xrechnung-viewer.css and xrechnung-viewer.js are required via the XSLT file
this will bypass the usual javascript loading routines, which is not an issue
for a development version but a severe issue in a deployed version where those
files would have to be read from the ASAR file.
The current workaround is copy/pasting the contents of those files into the
xrechung-html.xsl XSL file to generate a self sufficient xrechung-html.sef.json.


Since the input XML can be UN/CEFACT CII or UBL, the XRechnung visualization
conversion is a two-step process,
* from the input XML to an intermediate XR format using `cii-xr.sef.json` and
* from this XR format to HTML using `xrechnung-html.sef.json`

of course if the root note is detected to be UBL
the first step will be using `ubl-xr.sef.json`.

Have a look at
[the saxon documentaion](https://www.saxonica.com/saxon-js/documentation/index.html) for further info.

XSLT Parameters
-------------

As [documented](https://www.saxonica.com/saxon-js/documentation2/index.html#!api/transform/parameters) If the xslt-file says in the header
```
<xsl:param name="stringsVar" as="xs:string*"/>
<xsl:param name="arrayVar" as="array(*)"/>
<xsl:param name="my:mapVar" xmlns:my="my.uri" as="map(*)"/>
```
one can use  
`<xsl:value-of select="$stringsVar"/>`
in the content and pass the parameters from Javascript as 
`stylesheetParams`, e.g.

```
return SaxonJS.transform(
{
stylesheetFileName: path.join(
__dirname,
"xslt",
"xrechnung-html." + currentLanguage + ".sef.json"
),
stylesheetParams: {
"stringsVar": ["er", "I'm excited"],
"Q{}arrayVar": [[1, 2, 3]],
"Q{my.uri}mapVar": {"a": [1, 2]}
},
sourceText: xrXML,
destination: "serialized",
},
"async"
)
```

We're using this for the translation vars, displaying the IDs and 
few conditionals like not showing payment details for orders. 


Codelists
-------------


Codelists are lists of attribute values, like for countries, currencies, units or tax exemption codes.
The [codelists](https://ec.europa.eu/cefdigital/wiki/display/CEFDIGITAL/Registry+of+supporting+artefacts+to+implement+EN16931) 
for UBL and CII are the same and they are maintained by the CEF (not to be confused with CEFACT, which is a UN body).

Apparently the [OpenXRechnungToolbox](https://github.com/jcthiele/OpenXRechnungToolbox) has downloaded them 
and made them [available](https://github.com/jcthiele/xrechnung-visualization-codelist-resolve/) 
as patch on [Kosit's XRechnung Visualization](https://github.com/itplr-kosit/xrechnung-visualization).
Quba is using this patch so that instead of 15 times a "H87" of a product can be resolved into the more unterstandable
15 times a "piece" of a product: unit-wise apart from "Piece" H87 or C61 "one", there are thousands of unit codes also covering 
e.g. sixpack, hours, kilogram, metres, square metres, litres or cubic foot.



Vue
-------------

We do internationalization with [i18next](https://www.i18next.com/overview/api), [see also](https://www.smashingmagazine.com/2020/06/internationalization-vue-i18n/) .
How to work with vue in conjunction with PDF is [explained here](https://pdfjs.express/blog/how-build-pdf-viewer-vuejs-pdfjs) 

