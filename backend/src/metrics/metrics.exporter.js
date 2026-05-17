const prometheus = require('prom-client');

// Create Prometheus metrics
const httpRequestsTotal = new prometheus.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status']
});

const httpRequestDuration = new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

const activeBotsGauge = new prometheus.Gauge({
    name: 'active_bots_count',
    help: 'Number of active bots currently testing'
});

const activeContainersGauge = new prometheus.Gauge({
    name: 'active_containers_count',
    help: 'Number of active submission containers'
});

const submissionsTotal = new prometheus.Counter({
    name: 'submissions_total',
    help: 'Total number of submissions uploaded'
});

const testDurationHistogram = new prometheus.Histogram({
    name: 'test_duration_seconds',
    help: 'Duration of bot tests in seconds',
    buckets: [5, 10, 30, 60, 120, 300]
});

const tpsGauge = new prometheus.Gauge({
    name: 'tps_current',
    help: 'Current Transactions Per Second'
});

const latencyHistogram = new prometheus.Histogram({
    name: 'order_latency_milliseconds',
    help: 'Order processing latency in milliseconds',
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000]
});

const errorRateGauge = new prometheus.Gauge({
    name: 'error_rate_percent',
    help: 'Current error rate percentage'
});

const containerMemoryGauge = new prometheus.Gauge({
    name: 'container_memory_usage_bytes',
    help: 'Memory usage of submission containers',
    labelNames: ['container_id']
});

const containerCpuGauge = new prometheus.Gauge({
    name: 'container_cpu_usage_percent',
    help: 'CPU usage of submission containers',
    labelNames: ['container_id']
});

class MetricsExporter {
    static recordRequest(method, route, status, durationMs) {
        httpRequestsTotal.inc({ method, route, status });
        httpRequestDuration.observe({ method, route }, durationMs / 1000);
    }
    
    static recordTest(botCount, duration, tps, p99Latency, errorRate) {
        activeBotsGauge.set(botCount);
        testDurationHistogram.observe(duration);
        tpsGauge.set(tps);
        latencyHistogram.observe(p99Latency);
        errorRateGauge.set(errorRate);
    }
    
    static recordSubmission() {
        submissionsTotal.inc();
    }
    
    static updateActiveContainers(count) {
        activeContainersGauge.set(count);
    }
    
    static updateContainerMetrics(containerId, memoryBytes, cpuPercent) {
        containerMemoryGauge.set({ container_id: containerId }, memoryBytes);
        containerCpuGauge.set({ container_id: containerId }, cpuPercent);
    }
    
    static getMetrics() {
        return prometheus.register.metrics();
    }
    
    static async collectMetrics() {
        // Auto-collect every 5 seconds
        setInterval(async () => {
            try {
                // Get Docker container stats
                const { exec } = require('child_process');
                const util = require('util');
                const execPromise = util.promisify(exec);
                
                const { stdout } = await execPromise('docker ps -q | wc -l');
                const containerCount = parseInt(stdout.trim()) || 0;
                this.updateActiveContainers(containerCount);
            } catch (err) {}
        }, 5000);
    }
}

module.exports = { MetricsExporter, prometheus };