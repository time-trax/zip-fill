declare module 'zip-fill' {
  export interface Location {
    city: string;
    state: string;
    county: string;
  }

  export interface LookupResult {
    zip: string;
    locations: Location[];
    hasMultiple: boolean;
  }

  export interface BindOptions {
    zipInput: string | HTMLInputElement;
    cityInput?: string | HTMLInputElement;
    stateInput?: string | HTMLInputElement | HTMLSelectElement;
    countyInput?: string | HTMLInputElement;
    citySelect?: string | HTMLSelectElement;
    onLookup?: (result: LookupResult | null) => void;
    onMultiple?: (locations: Location[]) => void;
    onNotFound?: (zip: string) => void;
  }

  export default class ZipFill {
    constructor(data?: Record<string, Location[]>);
    
    /**
     * Load zip code data from URL or CDN
     */
    load(url?: string): Promise<this>;
    
    /**
     * Look up a zip code
     * @param zip - 5-digit zip code
     * @returns Location data or null if not found
     */
    lookup(zip: string): LookupResult | null;
    
    /**
     * Bind to form inputs for automatic autocomplete
     * @param options - Input selectors and callbacks
     * @returns Unbind function
     */
    bind(options: BindOptions): () => void;
  }

  export const instance: ZipFill;
}
