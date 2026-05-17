import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [activeTests, setActiveTests] = useState([]);
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const api = axios.create({
    baseURL: '/api/admin',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [statusRes, testsRes, healthRes, metricsRes] = await Promise.all([
        api.get('/status'),
        api.get('/active-tests'),
        api.get('/health'),
        api.get('/metrics')
      ]);
      setSystemStatus(statusRes.data);
      setActiveTests(testsRes.data);
      setHealth(healthRes.data);
      setMetrics(metricsRes.data);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      toast.error('Failed to fetch system status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const killContainer = async (submissionId) => {
    if (!confirm('Are you sure you want to kill this container?')) return;
    
    try {
      const res = await api.post(`/kill/${submissionId}`);
      toast.success(res.data.message || 'Container killed');
      fetchData();
    } catch (error) {
      toast.error('Failed to kill container');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading Admin Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <nav className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">🛠️ Admin Dashboard</h1>
            <span className="bg-red-600 text-xs px-2 py-1 rounded">System Admin</span>
          </div>
          <div className="flex gap-4">
            <button onClick={fetchData} disabled={refreshing} className="text-gray-300 hover:text-white">
              {refreshing ? '⟳ Refreshing...' : '🔄 Refresh'}
            </button>
            <button onClick={() => navigate('/dashboard')} className="text-gray-300 hover:text-white">
              ← Dashboard
            </button>
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Health Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">🏥 System Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`rounded-lg p-4 ${health?.checks.database ? 'bg-green-900' : 'bg-red-900'}`}>
              <h3 className="text-white font-semibold">Database</h3>
              <p className={health?.checks.database ? 'text-green-400' : 'text-red-400'}>
                {health?.checks.database ? '✅ Healthy' : '❌ Down'}
              </p>
            </div>
            <div className={`rounded-lg p-4 ${health?.checks.redis ? 'bg-green-900' : 'bg-red-900'}`}>
              <h3 className="text-white font-semibold">Redis</h3>
              <p className={health?.checks.redis ? 'text-green-400' : 'text-red-400'}>
                {health?.checks.redis ? '✅ Healthy' : '❌ Down'}
              </p>
            </div>
            <div className={`rounded-lg p-4 ${health?.checks.docker ? 'bg-green-900' : 'bg-red-900'}`}>
              <h3 className="text-white font-semibold">Docker</h3>
              <p className={health?.checks.docker ? 'text-green-400' : 'text-red-400'}>
                {health?.checks.docker ? '✅ Running' : '❌ Not Running'}
              </p>
            </div>
            <div className="bg-blue-900 rounded-lg p-4">
              <h3 className="text-white font-semibold">Overall Status</h3>
              <p className={health?.status === 'healthy' ? 'text-green-400' : 'text-yellow-400'}>
                {health?.status === 'healthy' ? '✅ All Systems Go' : '⚠️ Degraded'}
              </p>
            </div>
          </div>
        </div>

        {/* System Metrics */}
        {systemStatus?.metrics && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">📊 System Metrics (Last Hour)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Avg TPS</p>
                <p className="text-2xl font-bold text-blue-400">
                  {Math.round(systemStatus.metrics.avg_tps || 0)}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Avg Score</p>
                <p className="text-2xl font-bold text-green-400">
                  {Math.round(systemStatus.metrics.avg_score || 0)}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Avg p99 Latency</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {Math.round(systemStatus.metrics.avg_p99 || 0)}ms
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Tests</p>
                <p className="text-2xl font-bold text-white">
                  {systemStatus.metrics.total_tests || 0}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Submission Stats */}
        {systemStatus?.submissions?.stats && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">📦 Submission Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Total</p>
                <p className="text-2xl font-bold text-white">{systemStatus.submissions.stats.total}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Running</p>
                <p className="text-2xl font-bold text-green-400">{systemStatus.submissions.stats.running}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Testing</p>
                <p className="text-2xl font-bold text-yellow-400">{systemStatus.submissions.stats.testing}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Completed</p>
                <p className="text-2xl font-bold text-blue-400">{systemStatus.submissions.stats.completed}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Failed</p>
                <p className="text-2xl font-bold text-red-400">{systemStatus.submissions.stats.failed}</p>
              </div>
            </div>
          </div>
        )}

        {/* Active Tests */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">🔄 Active Tests</h2>
          {activeTests.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No active tests running</p>
          ) : (
            <div className="space-y-2">
              {activeTests.map((test) => (
                <div key={test.id} className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <div>
                    <p className="text-white font-mono">ID: {test.id}</p>
                    <p className="text-gray-400 text-sm">{test.email}</p>
                    <p className="text-yellow-400 text-xs">
                      Running for {Math.round(test.running_seconds)}s
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      test.status === 'testing' ? 'bg-yellow-600' : 'bg-green-600'
                    }`}>
                      {test.status}
                    </span>
                    <button
                      onClick={() => killContainer(test.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Kill
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Docker Containers */}
        {systemStatus?.containers?.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">🐳 Docker Containers</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-300">Name</th>
                    <th className="px-4 py-2 text-left text-gray-300">Status</th>
                    <th className="px-4 py-2 text-left text-gray-300">Image</th>
                    <th className="px-4 py-2 text-left text-gray-300">Ports</th>
                  </tr>
                </thead>
                <tbody>
                  {systemStatus.containers.map((container, idx) => (
                    <tr key={idx} className="border-t border-gray-700">
                      <td className="px-4 py-2 text-white font-mono text-sm">{container.name}</td>
                      <td className="px-4 py-2 text-green-400 text-sm">{container.status}</td>
                      <td className="px-4 py-2 text-gray-400 text-sm">{container.image}</td>
                      <td className="px-4 py-2 text-gray-400 text-sm">{container.ports}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Submissions */}
        {systemStatus?.submissions?.recent?.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">📋 Recent Submissions</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-300">ID</th>
                    <th className="px-4 py-2 text-left text-gray-300">User</th>
                    <th className="px-4 py-2 text-left text-gray-300">Status</th>
                    <th className="px-4 py-2 text-left text-gray-300">TPS</th>
                    <th className="px-4 py-2 text-left text-gray-300">Score</th>
                    <th className="px-4 py-2 text-left text-gray-300">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {systemStatus.submissions.recent.map((sub) => (
                    <tr key={sub.id} className="border-t border-gray-700">
                      <td className="px-4 py-2 text-white font-mono">{sub.id}</td>
                      <td className="px-4 py-2 text-gray-300">{sub.email}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          sub.status === 'running' ? 'bg-green-600' :
                          sub.status === 'testing' ? 'bg-yellow-600' :
                          sub.status === 'completed' ? 'bg-blue-600' :
                          sub.status === 'failed' ? 'bg-red-600' : 'bg-gray-600'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-blue-400">{sub.tps || '-'}</td>
                      <td className="px-4 py-2 text-green-400">{sub.score || '-'}</td>
                      <td className="px-4 py-2 text-gray-400 text-sm">
                        {new Date(sub.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}