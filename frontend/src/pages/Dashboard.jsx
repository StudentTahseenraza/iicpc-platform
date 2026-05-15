import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { submissions, leaderboard } from '../services/api';
import { subscribeLeaderboard, subscribeTestCompleted, initSocket, disconnectSocket } from '../services/socket';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

export default function Dashboard({ setIsAuthenticated }) {
  const [userSubmissions, setUserSubmissions] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [testing, setTesting] = useState(null);
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if token exists
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    initSocket();
    loadUserSubmissions();
    loadLeaderboard();
    
    const unsubscribeLeaderboard = subscribeLeaderboard((data) => {
      setLeaderboardData(data);
    });
    
    const unsubscribeTestCompleted = subscribeTestCompleted((data) => {
      toast.success(`Test completed for submission #${data.submissionId}! Score: ${data.metrics.score}`, {
        duration: 5000,
      });
      loadUserSubmissions();
      loadLeaderboard();
    });
    
    return () => {
      unsubscribeLeaderboard();
      unsubscribeTestCompleted();
    };
  }, []);

  const loadUserSubmissions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      const res = await submissions.getUserSubmissions();
      setUserSubmissions(res.data);
    } catch (error) {
      console.error('Failed to load submissions:', error);
      if (error.response?.status === 401) {
        // Token expired or invalid
        handleLogout();
      } else {
        toast.error('Failed to load submissions');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await leaderboard.get();
      setLeaderboardData(res.data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  };

  const runTest = async (submissionId, botCount = 100, duration = 30) => {
    setTesting(submissionId);
    toast.loading(`Running test with ${botCount} bots for ${duration} seconds...`, { id: 'test' });
    
    try {
      const res = await submissions.runTest(submissionId, botCount, duration);
      toast.success(`✅ Test completed! TPS: ${res.data.metrics.tps}, Score: ${res.data.metrics.score}`, { id: 'test' });
      
      setMetricsHistory(prev => [...prev, {
        timestamp: new Date(),
        tps: res.data.metrics.tps,
        p99: res.data.metrics.p99,
        score: res.data.metrics.score,
        latency: res.data.metrics.p99
      }]);
      
      await loadUserSubmissions();
      await loadLeaderboard();
    } catch (error) {
      toast.error('❌ Test failed: ' + (error.response?.data?.error || 'Unknown error'), { id: 'test' });
    } finally {
      setTesting(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket();
    setIsAuthenticated(false);
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <nav className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">⚡ IICPC Trading Platform</h1>
            <span className="bg-blue-600 text-xs px-2 py-1 rounded">Phase 1 MVP</span>
          </div>
          <div className="flex gap-6">
            <button onClick={() => navigate('/dashboard')} className="text-gray-300 hover:text-white transition">Dashboard</button>
            <button onClick={() => navigate('/upload')} className="text-gray-300 hover:text-white transition">Upload</button>
            <button onClick={() => navigate('/leaderboard')} className="text-gray-300 hover:text-white transition">Leaderboard</button>
            <div className="w-px h-6 bg-gray-600"></div>
            <span className="text-blue-400">{user.email || 'User'}</span>
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300 transition">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-1">Total Submissions</h3>
            <p className="text-3xl font-bold text-white">{userSubmissions.length}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-1">Your Best Score</h3>
            <p className="text-3xl font-bold text-green-400">
              {Math.max(...userSubmissions.map(s => s.score || 0), 0)}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-1">Global Rank</h3>
            <p className="text-3xl font-bold text-blue-400">
              #{leaderboardData.findIndex(l => l.userId === user.email) + 1 || '-'}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-1">Active Submissions</h3>
            <p className="text-3xl font-bold text-yellow-400">
              {userSubmissions.filter(s => s.status === 'running').length}
            </p>
          </div>
        </div>

        {/* Metrics History Chart */}
        {metricsHistory.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">📈 Your Performance History</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metricsHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="timestamp" tickFormatter={(t) => t.toLocaleTimeString()} stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <Line type="monotone" dataKey="tps" stroke="#3B82F6" name="TPS" strokeWidth={2} />
                <Line type="monotone" dataKey="score" stroke="#10B981" name="Score" strokeWidth={2} />
                <Line type="monotone" dataKey="latency" stroke="#F59E0B" name="p99 Latency (ms)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* User Submissions */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">📦 Your Submissions</h2>
          {userSubmissions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🚀</div>
              <p className="text-gray-400 mb-6">No submissions yet. Upload your first trading engine!</p>
              <button 
                onClick={() => navigate('/upload')} 
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                Upload Trading Engine
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {userSubmissions.map((sub) => (
                <div key={sub.id} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-650 transition">
                  <div className="flex justify-between items-start flex-wrap gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-white font-mono text-sm bg-gray-900 px-2 py-1 rounded">ID: {sub.id}</span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          sub.status === 'running' ? 'bg-green-600 text-white' :
                          sub.status === 'testing' ? 'bg-yellow-600 text-white' :
                          sub.status === 'completed' ? 'bg-blue-600 text-white' :
                          sub.status === 'failed' ? 'bg-red-600 text-white' : 'bg-gray-600 text-white'
                        }`}>
                          {sub.status.toUpperCase()}
                        </span>
                        {sub.container_ip && (
                          <span className="text-gray-400 text-xs font-mono">IP: {sub.container_ip}</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">Created: {new Date(sub.created_at).toLocaleString()}</p>
                      {sub.score !== null && sub.score !== undefined && (
                        <div className="mt-2 flex gap-4">
                          <p className="text-green-400 text-sm">🏆 Score: <span className="font-bold">{sub.score}</span></p>
                          <p className="text-blue-400 text-sm">⚡ TPS: {sub.tps || '-'}</p>
                          <p className="text-yellow-400 text-sm">📊 p99: {sub.p99_latency || '-'}ms</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {sub.status === 'running' && (
                        <>
                          <button
                            onClick={() => runTest(sub.id, 100, 30)}
                            disabled={testing === sub.id}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium"
                          >
                            {testing === sub.id ? '⏳ Testing...' : '🎯 Quick Test (100 bots / 30s)'}
                          </button>
                          <button
                            onClick={() => runTest(sub.id, 500, 60)}
                            disabled={testing === sub.id}
                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 transition text-sm font-medium"
                          >
                            {testing === sub.id ? '⏳ Testing...' : '💪 Stress Test (500 bots / 60s)'}
                          </button>
                        </>
                      )}
                      {sub.status === 'testing' && (
                        <span className="bg-yellow-600 text-white px-4 py-2 rounded text-sm animate-pulse">
                          🔥 Testing in progress...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Performers Preview */}
        {leaderboardData.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mt-8 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">🏆 Top Performers</h2>
            <div className="space-y-2">
              {leaderboardData.slice(0, 5).map((entry) => (
                <div key={entry.rank} className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-4">
                    <span className={`text-2xl font-bold ${
                      entry.rank === 1 ? 'text-yellow-400' :
                      entry.rank === 2 ? 'text-gray-400' :
                      entry.rank === 3 ? 'text-amber-600' : 'text-gray-500'
                    }`}>
                      #{entry.rank}
                    </span>
                    <span className="text-white font-medium">{entry.userId}</span>
                  </div>
                  <div className="flex gap-6">
                    <span className="text-blue-400 font-mono">{entry.tps.toLocaleString()} TPS</span>
                    <span className="text-yellow-400 font-mono">{entry.p99Latency.toFixed(1)}ms</span>
                    <span className="text-green-400 font-bold">{entry.score} pts</span>
                  </div>
                </div>
              ))}
            </div>
            {leaderboardData.length > 5 && (
              <div className="text-center mt-4">
                <button onClick={() => navigate('/leaderboard')} className="text-blue-400 hover:text-blue-300 text-sm">
                  View full leaderboard →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}