#!/usr/bin/env node
/**
 * Build optimized zip code lookup data
 * Transforms raw data into a compact lookup format
 */

const fs = require('fs');
const path = require('path');

const RAW_FILE = path.join(__dirname, '../raw-data.json');
const OUTPUT_FILE = path.join(__dirname, '../dist/zip-data.json');
const OUTPUT_MIN_FILE = path.join(__dirname, '../dist/zip-data.min.json');

console.log('Loading raw data...');
const rawData = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));
console.log(`Loaded ${rawData.length} records`);

// Build lookup: zip -> [{city, state, county}]
// Some zips span multiple cities (border zips)
const lookup = {};

for (const record of rawData) {
  const zip = String(record.zip_code).padStart(5, '0');
  const entry = {
    city: record.city,
    state: record.state,
    county: record.county
  };
  
  if (!lookup[zip]) {
    lookup[zip] = [];
  }
  
  // Avoid duplicates
  const exists = lookup[zip].some(
    e => e.city === entry.city && e.state === entry.state
  );
  
  if (!exists) {
    lookup[zip].push(entry);
  }
}

// Stats
const totalZips = Object.keys(lookup).length;
const multiCityZips = Object.values(lookup).filter(v => v.length > 1).length;

console.log(`\nStats:`);
console.log(`  Total unique zips: ${totalZips}`);
console.log(`  Multi-city zips: ${multiCityZips}`);

// Ensure dist directory exists
const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Write formatted version
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(lookup, null, 2));
console.log(`\nWrote ${OUTPUT_FILE}`);

// Write minified version
fs.writeFileSync(OUTPUT_MIN_FILE, JSON.stringify(lookup));
const sizeKB = (fs.statSync(OUTPUT_MIN_FILE).size / 1024).toFixed(1);
console.log(`Wrote ${OUTPUT_MIN_FILE} (${sizeKB} KB)`);

// Also create a state abbreviation list
const states = [...new Set(rawData.map(r => r.state))].sort();
fs.writeFileSync(
  path.join(distDir, 'states.json'),
  JSON.stringify(states, null, 2)
);
console.log(`Wrote states.json (${states.length} states/territories)`);
