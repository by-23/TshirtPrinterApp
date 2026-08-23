/**
 * Zip/unzip using .NET ZipFile so entries are always real files.
 * Windows tar.exe and Compress-Archive drop NTFS junctions.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runPowershell(command) {
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15 * 60_000,
    maxBuffer: 20 * 1024 * 1024,
  });
}

function zipDirectory(srcDir, zipPath) {
  if (!fs.existsSync(srcDir)) throw new Error(`zip: source missing ${srcDir}`);
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  runPowershell(`
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory(${psQuote(srcDir)}, ${psQuote(zipPath)})
  `);
  if (!fs.existsSync(zipPath)) throw new Error(`zip: not created ${zipPath}`);
}

function extractZip(zipPath, destDir) {
  if (!fs.existsSync(zipPath)) throw new Error(`extract: zip missing ${zipPath}`);
  if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  runPowershell(`
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory(${psQuote(zipPath)}, ${psQuote(destDir)})
  `);
}

/** Old packer path — used in tests to prove junctions do not survive. */
function zipWithCompressArchive(srcDir, zipPath) {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  runPowershell(`
    $ErrorActionPreference = 'Stop'
    Compress-Archive -Path ${psQuote(path.join(srcDir, "*"))} -DestinationPath ${psQuote(zipPath)} -Force
  `);
}

module.exports = { zipDirectory, extractZip, zipWithCompressArchive };
