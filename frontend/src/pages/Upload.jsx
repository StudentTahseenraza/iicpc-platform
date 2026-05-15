import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { submissions } from '../services/api';
import toast from 'react-hot-toast';

export default function Upload({ setIsAuthenticated }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a ZIP file');
      return;
    }

    setUploading(true);
    toast.loading('Uploading and deploying...', { id: 'upload' });

    try {
      const res = await submissions.upload(file);
      toast.success('Submission deployed successfully!', { id: 'upload' });
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Upload failed', { id: 'upload' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Upload Trading Engine</h1>
          <div className="flex gap-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-300 hover:text-white">
              Back to Dashboard
            </button>
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-gray-800 rounded-lg p-8">
          <h2 className="text-xl font-bold text-white mb-4">Submit Your Trading Engine</h2>
          
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h3 className="text-yellow-400 font-semibold mb-2">📋 Requirements</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• ZIP file containing your code</li>
              <li>• Must include a Dockerfile</li>
              <li>• Expose port 8080 for WebSocket/REST</li>
              <li>• Implement /health endpoint for health checks</li>
              <li>• Max file size: 50MB</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-gray-300 mb-2">Select ZIP File</label>
              <input
                type="file"
                accept=".zip"
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700"
                required
              />
            </div>

            <div className="bg-blue-900/50 rounded-lg p-4 mb-6">
              <h3 className="text-blue-400 font-semibold mb-2">💡 Example Dockerfile</h3>
              <pre className="text-xs text-gray-300 bg-gray-900 p-3 rounded overflow-x-auto">
{`FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s CMD node -e "require('http').get('http://localhost:8080/health',(r)=>{r.statusCode===200?process.exit(0):process.exit(1)})"
CMD ["node", "server.js"]`}
              </pre>
            </div>

            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold"
            >
              {uploading ? 'Deploying...' : 'Upload & Deploy'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}