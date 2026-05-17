const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

class SecureDockerSandboxService {
    constructor() {
        this.uploadsDir = path.join(__dirname, '../../../uploads');
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
        
        // Security limits
        this.MEMORY_LIMIT = '256m';
        this.CPU_LIMIT = '0.5';  // 0.5 CPU cores
        this.MAX_EXECUTION_TIME = 120; // 2 minutes max
        this.NETWORK_ISOLATION = true;
        
        console.log('✅ Secure Docker Sandbox initialized with strict limits');
    }

    async saveAndExtractZip(fileBuffer, submissionId) {
        const submissionDir = path.join(this.uploadsDir, `submission-${submissionId}`);
        if (!fs.existsSync(submissionDir)) {
            fs.mkdirSync(submissionDir, { recursive: true });
        }

        const zipPath = path.join(submissionDir, 'code.zip');
        fs.writeFileSync(zipPath, fileBuffer);

        const zip = new AdmZip(zipPath);
        zip.extractAllTo(submissionDir, true);
        
        console.log(`📁 Code extracted to: ${submissionDir}`);
        return submissionDir;
    }

    async buildImage(submissionId, codePath) {
        const imageName = `submission-${submissionId}`;
        
        console.log(`🔨 Building secure image: ${imageName}`);
        
        try {
            // Build with no cache for security
            const buildCommand = `docker build --no-cache -t ${imageName} "${codePath}"`;
            const { stdout, stderr } = await execPromise(buildCommand, { timeout: 120000 });
            
            console.log(`✅ Secure image built: ${imageName}`);
            return imageName;
        } catch (error) {
            console.error(`Build failed: ${error.message}`);
            throw new Error(`Secure build failed: ${error.message}`);
        }
    }

    async runContainer(imageName, submissionId) {
        try {
            const containerName = `secure-submission-${submissionId}`;
            const timeoutSeconds = this.MAX_EXECUTION_TIME;
            
            console.log(`🚀 Starting secure container: ${containerName}`);
            
            // Remove existing container
            try {
                await execPromise(`docker rm -f ${containerName}`);
            } catch (err) {}
            
            // Security flags:
            // - read-only root filesystem
            // - no new privileges
            // - drop all capabilities
            // - seccomp profile
            // - resource limits
            const runCommand = `docker run -d \
                --name ${containerName} \
                --memory=${this.MEMORY_LIMIT} \
                --memory-swap=${this.MEMORY_LIMIT} \
                --cpus=${this.CPU_LIMIT} \
                --read-only \
                --security-opt=no-new-privileges:true \
                --cap-drop=ALL \
                --cap-add=NET_RAW \
                --cap-add=NET_BIND_SERVICE \
                --security-opt=seccomp=./seccomp-profile.json \
                --restart=no \
                --network=isolated_network \
                -p 0:8080 \
                ${imageName}`
            
            const { stdout: containerId } = await execPromise(runCommand);
            const containerIdTrimmed = containerId.trim();
            
            // Set auto-kill timeout
            setTimeout(async () => {
                try {
                    await execPromise(`docker stop ${containerName}`);
                    await execPromise(`docker rm ${containerName}`);
                    console.log(`⏰ Container ${containerName} auto-killed after ${timeoutSeconds}s`);
                } catch (err) {}
            }, timeoutSeconds * 1000);
            
            // Get mapped port
            const portCommand = `docker port ${containerName} 8080`;
            const { stdout: portOutput } = await execPromise(portCommand);
            const match = portOutput.match(/:(\d+)/);
            const containerPort = match ? match[1] : '8080';
            
            console.log(`🌐 Secure container at: localhost:${containerPort}`);
            
            // Wait for container
            await this.waitForContainer('localhost', parseInt(containerPort));
            
            return {
                containerId: containerIdTrimmed,
                containerIP: 'localhost',
                port: parseInt(containerPort),
                containerName
            };
        } catch (error) {
            console.error('Secure container run error:', error);
            throw error;
        }
    }

    async waitForContainer(ip, port, timeout = 30000) {
        const startTime = Date.now();
        
        console.log(`⏳ Waiting for secure container at http://${ip}:${port}/health...`);
        
        while (Date.now() - startTime < timeout) {
            try {
                const command = `curl -s -o /dev/null -w "%{http_code}" http://${ip}:${port}/health`;
                const { stdout } = await execPromise(command);
                if (stdout.trim() === '200') {
                    console.log(`✅ Secure container ready`);
                    return true;
                }
            } catch (err) {}
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        throw new Error(`Container readiness timeout`);
    }

    async stopContainer(containerId) {
        try {
            await execPromise(`docker stop ${containerId}`);
            await execPromise(`docker rm ${containerId}`);
            console.log(`🛑 Stopped secure container: ${containerId}`);
            return true;
        } catch (error) {
            return false;
        }
    }

    async getResourceUsage(containerName) {
        try {
            const statsCommand = `docker stats ${containerName} --no-stream --format "{{.CPUPerc}},{{.MemUsage}}"`;
            const { stdout } = await execPromise(statsCommand);
            const [cpu, memory] = stdout.trim().split(',');
            return { cpu, memory, timestamp: Date.now() };
        } catch (error) {
            return null;
        }
    }
}

module.exports = SecureDockerSandboxService;