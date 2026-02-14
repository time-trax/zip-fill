/**
 * ZipFill - US Address Autocomplete from Zip Code
 * 
 * Usage:
 *   import ZipFill from 'zip-fill';
 *   
 *   // Lookup a zip code
 *   const result = ZipFill.lookup('90210');
 *   // { zip: '90210', locations: [{ city: 'Beverly Hills', state: 'CA', county: 'Los Angeles' }] }
 *   
 *   // Auto-wire a form
 *   ZipFill.bind({
 *     zipInput: '#zip',
 *     cityInput: '#city',
 *     stateInput: '#state',
 *     citySelect: '#city-select'  // Optional: dropdown for multi-city zips
 *   });
 */

class ZipFill {
  constructor(data = null) {
    this.data = data;
    this.loaded = false;
    this.loadPromise = null;
  }

  /**
   * Load zip data from URL or bundled data
   */
  async load(url = null) {
    if (this.loaded) return this;
    
    if (this.loadPromise) return this.loadPromise;
    
    this.loadPromise = (async () => {
      if (this.data) {
        this.loaded = true;
        return this;
      }
      
      // Try to load from CDN or local file
      const dataUrl = url || this._getDefaultDataUrl();
      
      try {
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error(`Failed to load: ${response.status}`);
        this.data = await response.json();
        this.loaded = true;
      } catch (e) {
        console.error('ZipFill: Failed to load zip data', e);
        throw e;
      }
      
      return this;
    })();
    
    return this.loadPromise;
  }

  /**
   * Get default data URL
   */
  _getDefaultDataUrl() {
    // Check for bundled data first (for bundlers like webpack/vite)
    if (typeof __ZIPFILL_DATA_URL__ !== 'undefined') {
      return __ZIPFILL_DATA_URL__;
    }
    // CDN fallback (update this with actual published URL)
    return 'https://unpkg.com/zip-fill@latest/dist/zip-data.min.json';
  }

  /**
   * Lookup a zip code
   * @param {string} zip - 5-digit zip code
   * @returns {object|null} - { zip, locations: [{city, state, county}] } or null
   */
  lookup(zip) {
    if (!this.loaded || !this.data) {
      console.warn('ZipFill: Data not loaded. Call load() first.');
      return null;
    }
    
    // Normalize zip
    const normalizedZip = String(zip).trim().padStart(5, '0').slice(0, 5);
    
    if (!/^\d{5}$/.test(normalizedZip)) {
      return null;
    }
    
    const locations = this.data[normalizedZip];
    
    if (!locations) {
      return null;
    }
    
    return {
      zip: normalizedZip,
      locations: Array.isArray(locations) ? locations : [locations],
      hasMultiple: Array.isArray(locations) && locations.length > 1
    };
  }

  /**
   * Bind to form inputs for auto-fill behavior
   * @param {object} options - Input selectors
   */
  bind(options) {
    const {
      zipInput,
      cityInput,
      stateInput,
      countyInput,
      citySelect,
      onLookup,
      onMultiple,
      onNotFound
    } = options;

    const zipEl = typeof zipInput === 'string' ? document.querySelector(zipInput) : zipInput;
    const cityEl = typeof cityInput === 'string' ? document.querySelector(cityInput) : cityInput;
    const stateEl = typeof stateInput === 'string' ? document.querySelector(stateInput) : stateInput;
    const countyEl = countyInput ? (typeof countyInput === 'string' ? document.querySelector(countyInput) : countyInput) : null;
    const selectEl = citySelect ? (typeof citySelect === 'string' ? document.querySelector(citySelect) : citySelect) : null;

    if (!zipEl) {
      console.error('ZipFill: zipInput not found');
      return;
    }

    const handleInput = () => {
      const zip = zipEl.value.trim();
      
      // Only lookup when we have 5 digits
      if (zip.length !== 5) {
        if (selectEl) {
          selectEl.style.display = 'none';
        }
        return;
      }
      
      const result = this.lookup(zip);
      
      if (onLookup) {
        onLookup(result);
      }
      
      if (!result) {
        if (onNotFound) {
          onNotFound(zip);
        }
        return;
      }
      
      const { locations, hasMultiple } = result;
      
      if (hasMultiple) {
        // Multiple cities - show dropdown
        if (selectEl) {
          this._populateSelect(selectEl, locations, cityEl, stateEl, countyEl);
          selectEl.style.display = '';
          if (cityEl) cityEl.style.display = 'none';
        } else if (onMultiple) {
          onMultiple(locations);
        } else {
          // No select element, just use first option
          this._fillFields(locations[0], cityEl, stateEl, countyEl);
        }
      } else {
        // Single city - auto-fill
        if (selectEl) {
          selectEl.style.display = 'none';
          if (cityEl) cityEl.style.display = '';
        }
        this._fillFields(locations[0], cityEl, stateEl, countyEl);
      }
    };

    zipEl.addEventListener('input', handleInput);
    zipEl.addEventListener('change', handleInput);
    
    // Return unbind function
    return () => {
      zipEl.removeEventListener('input', handleInput);
      zipEl.removeEventListener('change', handleInput);
    };
  }

  /**
   * Fill form fields with location data
   */
  _fillFields(location, cityEl, stateEl, countyEl) {
    if (cityEl) {
      cityEl.value = location.city;
      cityEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (stateEl) {
      // Handle both input and select elements
      if (stateEl.tagName === 'SELECT') {
        const option = Array.from(stateEl.options).find(
          opt => opt.value === location.state || opt.text === location.state
        );
        if (option) {
          stateEl.value = option.value;
        }
      } else {
        stateEl.value = location.state;
      }
      stateEl.dispatchEvent(new Event('input', { bubbles: true }));
      stateEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (countyEl) {
      countyEl.value = location.county;
      countyEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Populate city select dropdown for multi-city zips
   */
  _populateSelect(selectEl, locations, cityEl, stateEl, countyEl) {
    selectEl.innerHTML = '<option value="">Select city...</option>';
    
    locations.forEach((loc, i) => {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `${loc.city}, ${loc.state}`;
      selectEl.appendChild(option);
    });
    
    // Handle selection
    const handleChange = () => {
      const idx = parseInt(selectEl.value, 10);
      if (!isNaN(idx) && locations[idx]) {
        this._fillFields(locations[idx], null, stateEl, countyEl);
        if (cityEl) {
          cityEl.value = locations[idx].city;
        }
      }
    };
    
    selectEl.onchange = handleChange;
  }
}

// Singleton instance for convenience
const instance = new ZipFill();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZipFill;
  module.exports.default = ZipFill;
  module.exports.instance = instance;
} else if (typeof window !== 'undefined') {
  window.ZipFill = ZipFill;
  window.zipFill = instance;
}

export default ZipFill;
export { instance };
