# 📮 ZipFill

Lightweight US address autocomplete from zip codes. Enter a zip → get city, state, and county automatically.

## Features

- 🚀 **Zero dependencies** — Pure JavaScript, works everywhere
- 📦 **Small footprint** — ~2.6MB data file (compressed ~400KB gzipped)
- 🏙️ **Multi-city support** — Handles zip codes that span multiple cities with a dropdown
- 🔌 **Easy integration** — Works with any form, any framework
- 💾 **Offline-capable** — Bundle the data or load from CDN

## Installation

```bash
npm install zip-fill
```

Or include via CDN:

```html
<script src="https://unpkg.com/zip-fill@latest/dist/zip-fill.min.js"></script>
```

## Quick Start

```html
<form>
  <input type="text" id="zip" placeholder="Zip Code" maxlength="5">
  <input type="text" id="city" placeholder="City">
  <select id="city-select" style="display:none"></select>
  <input type="text" id="state" placeholder="State">
</form>

<script type="module">
import ZipFill from 'zip-fill';

const zf = new ZipFill();
await zf.load();

zf.bind({
  zipInput: '#zip',
  cityInput: '#city',
  stateInput: '#state',
  citySelect: '#city-select'  // Shows when zip has multiple cities
});
</script>
```

## API

### `new ZipFill(data?)`

Create a new instance. Optionally pass pre-loaded data.

### `zf.load(url?)`

Load zip code data. Returns a promise.

- `url` (optional): Custom URL to load data from. Defaults to CDN.

```js
const zf = new ZipFill();
await zf.load();  // Load from CDN
// or
await zf.load('/path/to/zip-data.min.json');  // Custom path
```

### `zf.lookup(zip)`

Look up a zip code. Returns location data or null.

```js
const result = zf.lookup('90210');

// Returns:
{
  zip: '90210',
  locations: [
    { city: 'Beverly Hills', state: 'CA', county: 'Los Angeles' }
  ],
  hasMultiple: false
}
```

For zip codes that span multiple cities:

```js
const result = zf.lookup('12345');

// Returns:
{
  zip: '12345',
  locations: [
    { city: 'Schenectady', state: 'NY', county: 'Schenectady' },
    { city: 'Rotterdam', state: 'NY', county: 'Schenectady' }
  ],
  hasMultiple: true
}
```

### `zf.bind(options)`

Auto-wire form inputs for seamless autocomplete.

```js
zf.bind({
  zipInput: '#zip',           // Required: zip code input
  cityInput: '#city',         // City text input
  stateInput: '#state',       // State input (text or select)
  countyInput: '#county',     // Optional: county input
  citySelect: '#city-select', // Optional: dropdown for multi-city zips
  
  // Callbacks
  onLookup: (result) => {},   // Called on every lookup
  onMultiple: (locations) => {}, // Called when zip has multiple cities
  onNotFound: (zip) => {}     // Called when zip not found
});
```

## Framework Examples

### React

```jsx
import { useEffect, useRef } from 'react';
import ZipFill from 'zip-fill';

function AddressForm() {
  const zipRef = useRef();
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  
  useEffect(() => {
    const zf = new ZipFill();
    zf.load().then(() => {
      zipRef.current?.addEventListener('input', (e) => {
        const result = zf.lookup(e.target.value);
        if (result && !result.hasMultiple) {
          setCity(result.locations[0].city);
          setState(result.locations[0].state);
        }
      });
    });
  }, []);
  
  return (
    <form>
      <input ref={zipRef} placeholder="Zip" maxLength={5} />
      <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
      <input value={state} onChange={e => setState(e.target.value)} placeholder="State" />
    </form>
  );
}
```

### Vue

```vue
<template>
  <form>
    <input v-model="zip" @input="onZipInput" maxlength="5" placeholder="Zip">
    <input v-model="city" placeholder="City">
    <input v-model="state" placeholder="State">
  </form>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import ZipFill from 'zip-fill';

const zip = ref('');
const city = ref('');
const state = ref('');

let zf;

onMounted(async () => {
  zf = new ZipFill();
  await zf.load();
});

function onZipInput() {
  if (zip.value.length !== 5) return;
  const result = zf.lookup(zip.value);
  if (result && !result.hasMultiple) {
    city.value = result.locations[0].city;
    state.value = result.locations[0].state;
  }
}
</script>
```

## Data

The zip code data is sourced from public USPS and Census data. It includes:

- **42,741** unique zip codes
- All 50 US states + territories
- City, state, and county for each zip

### Self-hosting the data

Download `dist/zip-data.min.json` and serve it from your own CDN:

```js
const zf = new ZipFill();
await zf.load('https://your-cdn.com/zip-data.min.json');
```

## REST API

ZipFill includes a ready-to-deploy REST API.

### Run locally

```bash
npm start
# API running on http://localhost:3000
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lookup/:zip` | Lookup a zip code |
| GET | `/api/lookup?zip=12345` | Lookup via query param |
| POST | `/api/batch` | Batch lookup (up to 100) |
| GET | `/api/states` | List all states |
| GET | `/health` | Health check |

### Examples

```bash
# Single lookup
curl https://api.example.com/api/lookup/90210

# Response
{
  "zip": "90210",
  "locations": [
    { "city": "Beverly Hills", "state": "CA", "county": "Los Angeles" }
  ],
  "hasMultiple": false
}

# Batch lookup
curl -X POST https://api.example.com/api/batch \
  -H "Content-Type: application/json" \
  -d '{"zips": ["90210", "10001", "60601"]}'
```

### Deploy with Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t zip-fill .
docker run -p 3000:3000 zip-fill
```

## Browser Support

- Chrome, Firefox, Safari, Edge (all modern versions)
- IE11 with polyfills for `fetch` and `Promise`

## License

MIT © 2025
