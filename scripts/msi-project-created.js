// electron-builder hook "msiProjectCreated": called with the path of the generated
// WiX project (project.wxs) before it is compiled into the MSI.
//
// Adds the public MSI property AUTOUPDATE (default "true") and writes it to
// AppConfig.ini in the installation folder. app/main.js reads
// [AutoUpdate] performOnStartup from there, so administrators can disable the
// update check with:  msiexec /i Quba-X.Y.Z.msi AUTOUPDATE=false
//
// Uses only the documented hook and the stable WiX ids APPLICATIONFOLDER and
// ProductFeature instead of replacing electron-builder's internal template.
const fs = require("fs");

const fragment = `
    <Property Id="AUTOUPDATE" Value="true" Secure="yes"/>
    <DirectoryRef Id="APPLICATIONFOLDER">
      <Component Id="AppConfigIni" Guid="{7854C093-900A-4C42-BC20-0F447DA240DB}" KeyPath="yes" Feature="ProductFeature">
        <IniFile Id="AppConfigIniAutoUpdate" Name="AppConfig.ini" Directory="APPLICATIONFOLDER" Section="AutoUpdate" Key="performOnStartup" Value="[AUTOUPDATE]" Action="addLine"/>
      </Component>
    </DirectoryRef>
`;

module.exports = function msiProjectCreated(projectFile) {
    let wxs = fs.readFileSync(projectFile, "utf8");
    for (const required of ['Id="APPLICATIONFOLDER"', 'Id="ProductFeature"', "</Product>"]) {
        if (!wxs.includes(required)) {
            throw new Error(`msiProjectCreated: ${required} not found in ${projectFile}`);
        }
    }
    wxs = wxs.replace("</Product>", `${fragment}  </Product>`);
    fs.writeFileSync(projectFile, wxs);
};
