/**
 * Simple metrics collection for ZipFill API
 * Tracks requests, response times, and usage patterns
 */

class Metrics {
  constructor() {
    this.startTime = Date.now();
    
    // Request counters
    this.requests = {
      total: 0,
      byEndpoint: {},
      byStatus: {},
      byMethod: {}
    };
    
    // Response time tracking (in ms)
    this.responseTimes = {
      total: [],
      byEndpoint: {}
    };
    
    // Zip lookup stats
    this.lookups = {
      total: 0,
      found: 0,
      notFound: 0,
      topZips: {},      // Most looked up zips
      topStates: {}     // Most returned states
    };
    
    // Time-series data (hourly buckets)
    this.hourlyRequests = {};
    
    // Keep only last 1000 response times for memory efficiency
    this.maxResponseTimes = 1000;
  }

  /**
   * Record a request
   */
  recordRequest(req, res, responseTimeMs) {
    const endpoint = this._normalizeEndpoint(req.path);
    const method = req.method;
    const status = res.statusCode;
    const hour = this._getCurrentHour();
    
    // Total requests
    this.requests.total++;
    
    // By endpoint
    this.requests.byEndpoint[endpoint] = (this.requests.byEndpoint[endpoint] || 0) + 1;
    
    // By status code
    this.requests.byStatus[status] = (this.requests.byStatus[status] || 0) + 1;
    
    // By method
    this.requests.byMethod[method] = (this.requests.byMethod[method] || 0) + 1;
    
    // Hourly tracking
    if (!this.hourlyRequests[hour]) {
      this.hourlyRequests[hour] = 0;
      this._cleanOldHours();
    }
    this.hourlyRequests[hour]++;
    
    // Response times
    this.responseTimes.total.push(responseTimeMs);
    if (this.responseTimes.total.length > this.maxResponseTimes) {
      this.responseTimes.total.shift();
    }
    
    if (!this.responseTimes.byEndpoint[endpoint]) {
      this.responseTimes.byEndpoint[endpoint] = [];
    }
    this.responseTimes.byEndpoint[endpoint].push(responseTimeMs);
    if (this.responseTimes.byEndpoint[endpoint].length > 100) {
      this.responseTimes.byEndpoint[endpoint].shift();
    }
  }

  /**
   * Record a zip lookup
   */
  recordLookup(zip, result) {
    this.lookups.total++;
    
    if (result && !result.error) {
      this.lookups.found++;
      
      // Track popular zips
      this.lookups.topZips[zip] = (this.lookups.topZips[zip] || 0) + 1;
      
      // Track states
      if (result.locations && result.locations[0]) {
        const state = result.locations[0].state;
        this.lookups.topStates[state] = (this.lookups.topStates[state] || 0) + 1;
      }
      
      // Keep top zips list manageable
      if (Object.keys(this.lookups.topZips).length > 1000) {
        this._pruneTopZips();
      }
    } else {
      this.lookups.notFound++;
    }
  }

  /**
   * Get metrics summary
   */
  getSummary() {
    const uptime = Date.now() - this.startTime;
    const uptimeHours = uptime / (1000 * 60 * 60);
    
    return {
      uptime: {
        ms: uptime,
        formatted: this._formatUptime(uptime)
      },
      requests: {
        total: this.requests.total,
        perHour: uptimeHours > 0 ? Math.round(this.requests.total / uptimeHours) : 0,
        byEndpoint: this.requests.byEndpoint,
        byStatus: this.requests.byStatus,
        byMethod: this.requests.byMethod
      },
      responseTimes: {
        avg: this._average(this.responseTimes.total),
        p50: this._percentile(this.responseTimes.total, 50),
        p95: this._percentile(this.responseTimes.total, 95),
        p99: this._percentile(this.responseTimes.total, 99)
      },
      lookups: {
        total: this.lookups.total,
        found: this.lookups.found,
        notFound: this.lookups.notFound,
        hitRate: this.lookups.total > 0 
          ? Math.round((this.lookups.found / this.lookups.total) * 100) 
          : 0,
        topZips: this._getTopN(this.lookups.topZips, 10),
        topStates: this._getTopN(this.lookups.topStates, 10)
      },
      traffic: {
        last24h: this._getLast24hRequests(),
        hourly: this._getHourlyBreakdown()
      }
    };
  }

  /**
   * Get Prometheus-format metrics
   */
  getPrometheus() {
    const lines = [];
    
    // Request counters
    lines.push('# HELP zipfill_requests_total Total number of requests');
    lines.push('# TYPE zipfill_requests_total counter');
    lines.push(`zipfill_requests_total ${this.requests.total}`);
    
    // By endpoint
    lines.push('# HELP zipfill_requests_by_endpoint Requests by endpoint');
    lines.push('# TYPE zipfill_requests_by_endpoint counter');
    for (const [endpoint, count] of Object.entries(this.requests.byEndpoint)) {
      lines.push(`zipfill_requests_by_endpoint{endpoint="${endpoint}"} ${count}`);
    }
    
    // By status
    lines.push('# HELP zipfill_requests_by_status Requests by HTTP status');
    lines.push('# TYPE zipfill_requests_by_status counter');
    for (const [status, count] of Object.entries(this.requests.byStatus)) {
      lines.push(`zipfill_requests_by_status{status="${status}"} ${count}`);
    }
    
    // Response times
    const avg = this._average(this.responseTimes.total);
    const p95 = this._percentile(this.responseTimes.total, 95);
    lines.push('# HELP zipfill_response_time_avg Average response time in ms');
    lines.push('# TYPE zipfill_response_time_avg gauge');
    lines.push(`zipfill_response_time_avg ${avg.toFixed(2)}`);
    lines.push('# HELP zipfill_response_time_p95 95th percentile response time');
    lines.push('# TYPE zipfill_response_time_p95 gauge');
    lines.push(`zipfill_response_time_p95 ${p95.toFixed(2)}`);
    
    // Lookups
    lines.push('# HELP zipfill_lookups_total Total zip lookups');
    lines.push('# TYPE zipfill_lookups_total counter');
    lines.push(`zipfill_lookups_total ${this.lookups.total}`);
    lines.push('# HELP zipfill_lookups_found Successful lookups');
    lines.push('# TYPE zipfill_lookups_found counter');
    lines.push(`zipfill_lookups_found ${this.lookups.found}`);
    lines.push('# HELP zipfill_lookups_not_found Failed lookups');
    lines.push('# TYPE zipfill_lookups_not_found counter');
    lines.push(`zipfill_lookups_not_found ${this.lookups.notFound}`);
    
    // Uptime
    lines.push('# HELP zipfill_uptime_seconds Uptime in seconds');
    lines.push('# TYPE zipfill_uptime_seconds gauge');
    lines.push(`zipfill_uptime_seconds ${Math.floor((Date.now() - this.startTime) / 1000)}`);
    
    return lines.join('\n');
  }

  // Helper methods
  _normalizeEndpoint(path) {
    // Normalize /api/lookup/12345 to /api/lookup/:zip
    return path.replace(/\/api\/lookup\/\d+/, '/api/lookup/:zip');
  }

  _getCurrentHour() {
    return new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  }

  _cleanOldHours() {
    const keys = Object.keys(this.hourlyRequests).sort();
    while (keys.length > 168) { // Keep 7 days
      delete this.hourlyRequests[keys.shift()];
    }
  }

  _pruneTopZips() {
    const entries = Object.entries(this.lookups.topZips)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 500);
    this.lookups.topZips = Object.fromEntries(entries);
  }

  _average(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  _percentile(arr, p) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  _getTopN(obj, n) {
    return Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));
  }

  _formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  _getLast24hRequests() {
    const now = new Date();
    let total = 0;
    
    for (let i = 0; i < 24; i++) {
      const hour = new Date(now - i * 60 * 60 * 1000).toISOString().slice(0, 13);
      total += this.hourlyRequests[hour] || 0;
    }
    
    return total;
  }

  _getHourlyBreakdown() {
    const now = new Date();
    const hours = [];
    
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now - i * 60 * 60 * 1000).toISOString().slice(0, 13);
      hours.push({
        hour: hour.slice(11, 13) + ':00',
        requests: this.hourlyRequests[hour] || 0
      });
    }
    
    return hours;
  }
}

module.exports = new Metrics();
