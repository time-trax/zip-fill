#!/usr/bin/env node
/**
 * ZipFill API Server
 * 
 * Endpoints:
 *   GET /api/lookup/:zip     - Lookup a single zip code
 *   GET /api/lookup?zip=...  - Lookup (query param)
 *   GET /api/batch           - Lookup multiple zips (POST body or query)
 *   GET /api/states          - List all states/territories
 *   GET /health              - Health check
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Load data
const dataPath = path.join(__dirname, '../dist/zip-data.min.json');
const statesPath = path.join(__dirname, '../dist/states.json');

let zipData = {};
let states = [];

try {
  zipData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  states = JSON.parse(fs.readFileSync(statesPath, 'utf8'));
  console.log(`Loaded ${Object.keys(zipData).length} zip codes`);
} catch (e) {
  console.error('Failed to load data:', e.message);
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

/**
 * Normalize zip code to 5 digits
 */
function normalizeZip(zip) {
  if (!zip) return null;
  const normalized = String(zip).trim().padStart(5, '0').slice(0, 5);
  return /^\d{5}$/.test(normalized) ? normalized : null;
}

/**
 * Lookup a zip code
 */
function lookupZip(zip) {
  const normalized = normalizeZip(zip);
  if (!normalized) {
    return { error: 'Invalid zip code format', zip };
  }
  
  const locations = zipData[normalized];
  if (!locations) {
    return { error: 'Zip code not found', zip: normalized };
  }
  
  return {
    zip: normalized,
    locations: Array.isArray(locations) ? locations : [locations],
    hasMultiple: Array.isArray(locations) && locations.length > 1
  };
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    zipCodes: Object.keys(zipData).length,
    states: states.length
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'ZipFill API',
    version: '1.0.0',
    endpoints: {
      'GET /api/lookup/:zip': 'Lookup a zip code',
      'GET /api/lookup?zip=12345': 'Lookup via query param',
      'POST /api/batch': 'Lookup multiple zips { "zips": ["12345", "90210"] }',
      'GET /api/states': 'List all states/territories'
    },
    example: '/api/lookup/90210'
  });
});

// Lookup by path param
app.get('/api/lookup/:zip', (req, res) => {
  const result = lookupZip(req.params.zip);
  
  if (result.error) {
    return res.status(404).json(result);
  }
  
  res.json(result);
});

// Lookup by query param
app.get('/api/lookup', (req, res) => {
  const zip = req.query.zip;
  
  if (!zip) {
    return res.status(400).json({ error: 'Missing zip parameter' });
  }
  
  const result = lookupZip(zip);
  
  if (result.error) {
    return res.status(404).json(result);
  }
  
  res.json(result);
});

// Batch lookup
app.post('/api/batch', (req, res) => {
  const { zips } = req.body;
  
  if (!zips || !Array.isArray(zips)) {
    return res.status(400).json({ error: 'Missing or invalid zips array' });
  }
  
  if (zips.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 zips per request' });
  }
  
  const results = zips.map(zip => lookupZip(zip));
  
  res.json({ results });
});

// List states
app.get('/api/states', (req, res) => {
  res.json({ states });
});

// Serve demo
app.use('/demo', express.static(path.join(__dirname, '../demo')));
app.use('/dist', express.static(path.join(__dirname, '../dist')));

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
📮 ZipFill API running on http://localhost:${PORT}

Endpoints:
  GET  /api/lookup/:zip     Lookup a zip code
  GET  /api/lookup?zip=...  Lookup via query
  POST /api/batch           Batch lookup
  GET  /api/states          List states
  GET  /health              Health check
  GET  /demo                Interactive demo
  `);
});
