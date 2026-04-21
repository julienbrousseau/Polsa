const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  return `${major}.${minor}.${patch + 1}`;
}

const rootPackagePath = path.join(__dirname, '..', 'package.json');
const companionPackagePath = path.join(__dirname, '..', 'companion', 'package.json');

const rootPackage = readJson(rootPackagePath);
const nextVersion = bumpPatch(rootPackage.version);

rootPackage.version = nextVersion;
writeJson(rootPackagePath, rootPackage);

const companionPackage = readJson(companionPackagePath);
companionPackage.version = nextVersion;
writeJson(companionPackagePath, companionPackage);

console.log(`Build version bumped to ${nextVersion} (root + companion)`);
