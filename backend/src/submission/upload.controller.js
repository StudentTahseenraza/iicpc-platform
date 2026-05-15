const multer = require('multer');
const path = require('path');
const Submission = require('../models/Submission');
const DockerSandboxService = require('../sandbox/docker.service');

const upload = multer({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('Only ZIP files are allowed'));
        }
    }
}).single('file');

const dockerService = new DockerSandboxService();

class SubmissionController {
    static async upload(req, res) {
        upload(req, res, async (err) => {
            let submission = null; // Declare outside try block
            
            if (err) {
                return res.status(400).json({ error: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            try {
                const userId = req.user.userId;
                
                // Create submission record
                submission = await Submission.create({
                    userId,
                    imageName: null,
                    containerId: null,
                    containerIp: null
                });

                console.log(`📝 Created submission ${submission.id} for user ${userId}`);

                // Update status to building
                await Submission.updateStatus(submission.id, 'building');

                // Extract code
                const codePath = await dockerService.saveAndExtractZip(req.file.buffer, submission.id);
                
                // Check if Dockerfile exists
                const fs = require('fs');
                const dockerfilePath = path.join(codePath, 'Dockerfile');
                if (!fs.existsSync(dockerfilePath)) {
                    await Submission.updateStatus(submission.id, 'failed');
                    return res.status(400).json({ error: 'Dockerfile not found in submission' });
                }

                // Build Docker image
                const imageName = await dockerService.buildImage(submission.id, codePath);
                await Submission.updateStatus(submission.id, 'building', imageName);

                // Run container
                const { containerId, containerIP, port } = await dockerService.runContainer(imageName, submission.id);
                await Submission.updateStatus(submission.id, 'running', null, containerIP);

                res.json({
                    success: true,
                    submission: {
                        id: submission.id,
                        status: 'running',
                        containerIp: containerIP,
                        port: port,
                        message: 'Submission deployed successfully'
                    }
                });
            } catch (error) {
                console.error('Upload error:', error);
                if (submission && submission.id) {
                    await Submission.updateStatus(submission.id, 'failed');
                }
                res.status(500).json({ error: 'Deployment failed: ' + error.message });
            }
        });
    }

    static async getStatus(req, res) {
        try {
            const submission = await Submission.findById(req.params.id);
            if (!submission) {
                return res.status(404).json({ error: 'Submission not found' });
            }
            
            // Check if user owns this submission
            if (submission.user_id !== req.user.userId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            res.json(submission);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getUserSubmissions(req, res) {
        try {
            const submissions = await Submission.findByUser(req.user.userId);
            res.json(submissions);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = SubmissionController;