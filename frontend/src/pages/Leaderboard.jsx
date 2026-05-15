import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaderboard } from '../services/api';
import { subscribeLeaderboard, initSocket, disconnectSocket } from '../services/socket';
import toast from 'react-hot-toast';

export default function Leaderboard({ setIsAuthenticated }) {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    initSocket();
    loadLeaderboard();
    
    const unsubscribe = subscribeLeaderboard((data) => {
      setRankings(data);
      setLastUpdate(new Date());
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const res = await leaderboard.get();
      setRankings(res.data);
      toast.success('Leaderboard refreshed');
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      if (error.response?.status === 401) {
        handleLogout();
      } else {
        toast.error('Failed to load leaderboard');
      }
    } finally {
      setLoading(false);
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

  const getMedalColor = (rank) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-amber-600';
    return 'text-gray-500';
  };

  const getMedalIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}`;
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">🏆 Live Leaderboard</h1>
            <span className="text-gray-400 text-xs">Auto-updates every 5s</span>
          </div>
          <div className="flex gap-4">
            <button onClick={loadLeaderboard} className="text-gray-300 hover:text-white transition text-sm">
              🔄 Refresh
            </button>
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300 transition text-sm">
              Logout
            </button>
            <button onClick={() => navigate('/dashboard')} className="text-gray-300 hover:text-white transition">
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Last update info */}
        <div className="text-right text-gray-500 text-sm mb-4">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>

        {/* Leaderboard Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Rank</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">User</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">TPS</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">p50 (ms)</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">p90 (ms)</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">p99 (ms)</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Error %</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                      Loading leaderboard...
                    </div>
                   </td>
                 </tr>
              ) : rankings.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-400">
                    <div className="text-6xl mb-2">📊</div>
                    No submissions yet. Upload your trading engine to appear on the leaderboard!
                   </td>
                 </tr>
              ) : (
                rankings.map((entry) => (
                  <tr key={entry.rank} className="hover:bg-gray-700 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${getMedalColor(entry.rank)}`}>
                          {getMedalIcon(entry.rank)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white font-medium">{entry.userId}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-blue-400 font-mono font-bold">{entry.tps.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-300 font-mono">{entry.p50Latency.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-gray-300 font-mono">{entry.p90Latency.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-mono font-bold ${
                        entry.p99Latency < 10 ? 'text-green-400' :
                        entry.p99Latency < 50 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {entry.p99Latency.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-mono ${
                        entry.errorRate < 1 ? 'text-green-400' :
                        entry.errorRate < 5 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {entry.errorRate.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-green-400 font-bold text-lg">{entry.score}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Scoring Explanation */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-white font-semibold mb-3">📊 Scoring Formula</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-700 rounded-lg p-3">
              <span className="text-blue-400 font-bold">TPS Score (50%)</span>
              <p className="text-gray-400 text-xs mt-1">(TPS / 10,000) × 50 points</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <span className="text-yellow-400 font-bold">Latency Score (30%)</span>
              <p className="text-gray-400 text-xs mt-1">30 - (p99 / 10) points</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <span className="text-green-400 font-bold">Correctness Score (20%)</span>
              <p className="text-gray-400 text-xs mt-1">20 - Error Rate points</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs text-center mt-4">
            Leaderboard updates automatically every 5 seconds via WebSocket
          </p>
        </div>
      </div>
    </div>
  );
}