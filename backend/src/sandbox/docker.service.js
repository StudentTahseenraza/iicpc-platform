const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const AdmZip = require('adm-zip');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class DockerSandboxService {
    constructor() {
        this.uploadsDir = path.join(__dirname, '../../../uploads');
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
        console.log('✅ Docker Sandbox Service initialized (CLI mode)');
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

        console.log(`🔨 Building image: ${imageName} from ${codePath}`);

        try {
            // Build the image using Docker CLI
            const buildCommand = `docker build -t ${imageName} "${codePath}"`;
            console.log(`Running: ${buildCommand}`);

            const { stdout, stderr } = await execPromise(buildCommand, { timeout: 120000 });

            if (stdout) console.log(`Build output: ${stdout.substring(0, 500)}`);
            if (stderr && !stderr.includes('deprecated')) console.log(`Build stderr: ${stderr}`);

            // Verify image exists using docker images
            const verifyCommand = `docker images ${imageName} --format "{{.Repository}}"`;
            const { stdout: verifyOutput } = await execPromise(verifyCommand);

            if (!verifyOutput.trim()) {
                throw new Error(`Image ${imageName} not found after build`);
            }

            console.log(`✅ Image built and verified: ${imageName}`);
            return imageName;
        } catch (error) {
            console.error(`Build failed: ${error.message}`);
            throw new Error(`Docker build failed: ${error.message}`);
        }
    }

    async runContainer(imageName, submissionId) {
        try {
            const containerName = `submission-${submissionId}`;

            console.log(`🚀 Starting container: ${containerName} from image: ${imageName}`);

            // Remove existing container if it exists
            try {
                await execPromise(`docker rm -f ${containerName}`);
                console.log(`🗑️ Removed existing container: ${containerName}`);
            } catch (err) {
                // Container doesn't exist, ignore
            }

            // Run container with resource limits and port mapping
            const runCommand = `docker run -d \
                --name ${containerName} \
                --memory=256m \
                --cpus=1 \
                --restart=no \
                -p 0:8080 \
                ${imageName}`;

            console.log(`Running: ${runCommand}`);

            const { stdout: containerId } = await execPromise(runCommand);
            const containerIdTrimmed = containerId.trim();
            console.log(`📦 Container created: ${containerIdTrimmed}`);

            // Wait a moment for container to start
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Get container port mapping
            const portCommand = `docker port ${containerName} 8080`;
            let containerPort = 8080;
            try {
                const { stdout: portOutput } = await execPromise(portCommand);
                const match = portOutput.match(/:(\d+)/);
                if (match) {
                    containerPort = match[1];
                }
            } catch (err) {
                console.log('Could not get port mapping, using default 8080');
            }

            const containerIP = 'localhost';
            console.log(`🌐 Container accessible at: ${containerIP}:${containerPort}`);

            // Wait for container to be ready
            await this.waitForContainer(containerIP, containerPort);

            return {
                containerId: containerIdTrimmed,
                containerIP,
                port: containerPort
            };
        } catch (error) {
            console.error('Container run error:', error);
            throw error;
        }
    }

    async waitForContainer(ip, port, timeout = 30000) {
        const startTime = Date.now();
        const maxAttempts = 30;

        console.log(`⏳ Waiting for container at http://${ip}:${port}/health...`);

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                let statusCode = 0;

                if (process.platform === 'win32') {
                    // Use curl if available, otherwise use Invoke-WebRequest with -UseBasicParsing
                    try {
                        const { stdout } = await execPromise(`curl -s -o /dev/null -w "%{http_code}" http://${ip}:${port}/health 2>nul`, { timeout: 3000 });
                        statusCode = parseInt(stdout.trim());
                    } catch (curlErr) {
                        // Fallback to PowerShell with -UseBasicParsing
                        try {
                            const command = `powershell -Command "try { (Invoke-WebRequest -Uri http://${ip}:${port}/health -UseBasicParsing -TimeoutSec 2).StatusCode } catch { 0 }"`;
                            const { stdout } = await execPromise(command, { timeout: 5000 });
                            statusCode = parseInt(stdout.trim());
                        } catch (psErr) {
                            // Still waiting
                        }
                    }
                } else {
                    const command = `curl -s -o /dev/null -w "%{http_code}" http://${ip}:${port}/health`;
                    const { stdout } = await execPromise(command, { timeout: 3000 });
                    statusCode = parseInt(stdout.trim());
                }

                if (statusCode === 200) {
                    console.log(`✅ Container ready after ${attempt} attempts`);
                    return true;
                }
            } catch (err) {
                // Still waiting
            }

            if (attempt % 5 === 0) {
                console.log(`⏳ Still waiting... (attempt ${attempt}/${maxAttempts})`);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        throw new Error(`Container readiness timeout after ${timeout}ms`);
    }

    async stopContainer(containerId) {
        try {
            await execPromise(`docker stop ${containerId}`);
            await execPromise(`docker rm ${containerId}`);
            console.log(`🛑 Stopped and removed container: ${containerId}`);
            return true;
        } catch (error) {
            console.error('Stop container error:', error);
            return false;
        }
    }

    async getContainerLogs(containerId) {
        try {
            const { stdout } = await execPromise(`docker logs ${containerId} --tail 50`);
            return stdout;
        } catch (error) {
            return '';
        }
    }
}

module.exports = DockerSandboxService;