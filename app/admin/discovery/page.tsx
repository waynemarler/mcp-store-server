'use client';

import { useState, useEffect } from 'react';

interface DiscoveredServer {
  id: string;
  status: 'discovered' | 'contacted' | 'approved' | 'rejected';
  activated: boolean;
  repository: {
    owner: string;
    name: string;
    fullName: string;
    url: string;
    stars: number;
    forks: number;
    language?: string;
    description?: string;
  };
  analysis: {
    confidence: number;
    indicators: string[];
    hasManifest: boolean;
    inferredName?: string;
    inferredDescription?: string;
    inferredCapabilities?: string[];
    inferredCategories?: string[];
    trustScore?: number;
  };
  developer: {
    githubUsername: string;
    contactEmail?: string;
    approvalRequested: boolean;
  };
  discoveredAt: string;
  lastContactAt?: string;
}

interface DiscoveryStats {
  total: number;
  byStatus: Record<string, number>;
  totalStars: number;
  averageConfidence: number;
  topLanguages: Array<{ language: string; count: number }>;
}

export default function AdminDiscoveryPage() {
  const [servers, setServers] = useState<DiscoveredServer[]>([]);
  const [stats, setStats] = useState<DiscoveryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/discovery/catalog?status=${selectedStatus}&limit=50`);
      const data = await response.json();

      if (data.success) {
        setServers(data.servers);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load discovery data:', error);
    } finally {
      setLoading(false);
    }
  };

  const scanAndStore = async () => {
    try {
      setScanning(true);
      const response = await fetch('/api/discovery/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scan_and_store',
          query: 'mcp server OR "model context protocol"',
          limit: 30
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`Scan completed! Found ${data.results.candidatesDetected} candidates, stored ${data.results.serversStored} servers.`);
        await loadData();
      }
    } catch (error) {
      console.error('Scan failed:', error);
      alert('Scan failed. Check console for details.');
    } finally {
      setScanning(false);
    }
  };

  const updateServerStatus = async (serverId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/discovery/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          serverId,
          status: newStatus
        })
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const recordContact = async (serverId: string) => {
    try {
      const response = await fetch('/api/discovery/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_contact',
          serverId,
          method: 'email',
          template: 'initial-discovery',
          successful: true
        })
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to record contact:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'discovered': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 font-semibold';
    if (confidence >= 0.5) return 'text-yellow-600 font-medium';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading discovery catalog...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">MCP Discovery Catalog</h1>
          <p className="mt-2 text-gray-600">Discover and manage MCP servers found on GitHub</p>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900">Total Discovered</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900">Total Stars</h3>
              <p className="text-3xl font-bold text-green-600">{stats.totalStars.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900">Avg Confidence</h3>
              <p className="text-3xl font-bold text-purple-600">{(stats.averageConfidence * 100).toFixed(1)}%</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900">Approved</h3>
              <p className="text-3xl font-bold text-emerald-600">{stats.byStatus.approved || 0}</p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={scanAndStore}
              disabled={scanning}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {scanning ? 'Scanning...' : '🔍 Scan GitHub'}
            </button>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Status</option>
              <option value="discovered">Discovered</option>
              <option value="contacted">Contacted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <button
              onClick={loadData}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Servers List */}
        <div className="space-y-6">
          {servers.map((server) => (
            <div key={server.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {server.analysis.inferredName || server.repository.name}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(server.status)}`}>
                      {server.status}
                    </span>
                    <span className={`text-sm ${getConfidenceColor(server.analysis.confidence)}`}>
                      {(server.analysis.confidence * 100).toFixed(1)}% confidence
                    </span>
                  </div>

                  <p className="text-gray-600 mb-3">
                    {server.analysis.inferredDescription || server.repository.description || 'No description available'}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Repository</p>
                      <a
                        href={server.repository.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {server.repository.fullName}
                      </a>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Developer</p>
                      <p className="font-medium">{server.developer.githubUsername}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Stars / Language</p>
                      <p className="font-medium">⭐ {server.repository.stars} / {server.repository.language || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Trust Score</p>
                      <p className="font-medium">{server.analysis.trustScore?.toFixed(1) || 'N/A'}</p>
                    </div>
                  </div>

                  {server.analysis.inferredCapabilities && server.analysis.inferredCapabilities.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-1">Detected Capabilities</p>
                      <div className="flex flex-wrap gap-1">
                        {server.analysis.inferredCapabilities.map((cap, idx) => (
                          <span key={idx} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-1">Detection Indicators</p>
                    <div className="flex flex-wrap gap-1">
                      {server.analysis.indicators.map((indicator, idx) => (
                        <span key={idx} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                          {indicator}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="ml-6 flex flex-col gap-2">
                  {server.status === 'discovered' && (
                    <>
                      <button
                        onClick={() => recordContact(server.id)}
                        className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                      >
                        📧 Contact
                      </button>
                      <button
                        onClick={() => updateServerStatus(server.id, 'approved')}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => updateServerStatus(server.id, 'rejected')}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        ❌ Reject
                      </button>
                    </>
                  )}
                  {server.status === 'contacted' && (
                    <>
                      <button
                        onClick={() => updateServerStatus(server.id, 'approved')}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => updateServerStatus(server.id, 'rejected')}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        ❌ Reject
                      </button>
                    </>
                  )}
                  {server.status === 'approved' && (
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm font-medium">
                      ✅ Approved
                    </span>
                  )}
                  {server.status === 'rejected' && (
                    <span className="bg-red-100 text-red-800 px-3 py-1 rounded text-sm font-medium">
                      ❌ Rejected
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {servers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No discovered servers found.</p>
            <p className="text-gray-400">Try scanning GitHub to discover MCP servers.</p>
          </div>
        )}
      </div>
    </div>
  );
}