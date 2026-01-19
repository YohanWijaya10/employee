'use client';

import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { SeverityBadge, Badge } from '@/components/Badge';
import { getFlagsAction, runFraudDetectionAction, generateAISummaryAction } from './actions';

interface Flag {
  id: string;
  entityType: string;
  entityId: string;
  ruleCode: string;
  severity: 'INFO' | 'WARN' | 'HIGH';
  message: string;
  createdAt: string;
  meta: Record<string, unknown>;
}

interface AISummary {
  period: { from: string; to: string };
  highlights: Array<{
    type: string;
    title: string;
    description: string;
    value?: string | number;
  }>;
  riskSignals: Array<{
    severity: 'INFO' | 'WARN' | 'HIGH';
    entity: string;
    entityType: string;
    description: string;
    recommendation?: string;
  }>;
  topEntities: {
    salesReps: Array<{ id: string; name: string; metric: string; value: string | number; flag?: string }>;
    outlets: Array<{ id: string; name: string; metric: string; value: string | number; flag?: string }>;
    skus: Array<{ id: string; name: string; metric: string; value: string | number; flag?: string }>;
  };
  investigationChecklist: string[];
  limitations: string[];
}

interface Metrics {
  orderMetrics: {
    totalOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    cancelRate: number;
    totalRevenue: number;
  };
  endOfMonthAnalysis: {
    endOfMonthOrders: number;
    spikeRatio: number;
    hasSpike: boolean;
  };
  preShipAnalysis: {
    preShipCancellations: number;
    preShipPercentage: number;
  };
}

export default function AntiFraudReportPage() {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [flags, setFlags] = useState<Flag[]>([]);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load flags on mount and date change
  useEffect(() => {
    loadFlags();
  }, [dateFrom, dateTo]);

  async function loadFlags() {
    setLoading(true);
    setError(null);
    try {
      const result = await getFlagsAction(dateFrom, dateTo);
      setFlags(result || []);
    } catch (err) {
      setError('Failed to load flags');
    } finally {
      setLoading(false);
    }
  }

  async function generateFlags() {
    setLoading(true);
    setError(null);
    try {
      const result = await runFraudDetectionAction(dateFrom, dateTo);
      setFlags(result || []);
    } catch (err) {
      setError('Failed to generate flags');
    } finally {
      setLoading(false);
    }
  }

  async function generateAISummary() {
    setAiLoading(true);
    setError(null);
    try {
      const data = await generateAISummaryAction(dateFrom, dateTo);
      setAiSummary(data.summary);
      setMetrics(data.rawMetrics);
    } catch (err) {
      setError('Failed to generate AI summary');
    } finally {
      setAiLoading(false);
    }
  }

  // Count flags by severity
  const flagCounts = {
    HIGH: flags.filter((f) => f.severity === 'HIGH').length,
    WARN: flags.filter((f) => f.severity === 'WARN').length,
    INFO: flags.filter((f) => f.severity === 'INFO').length,
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl guide-hero p-6 border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <h1 className="text-2xl font-bold text-text">Anti-Fraud Report</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Analyze sales patterns and identify risk indicators</p>
      </div>

      {/* Filters */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Report Filters</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input"
            />
          </div>
          <button
            onClick={generateFlags}
            disabled={loading}
            className="btn btn-secondary"
          >
            {loading ? 'Analyzing...' : 'Run Fraud Detection'}
          </button>
          <button
            onClick={generateAISummary}
            disabled={aiLoading}
            className="btn btn-primary"
          >
            {aiLoading ? 'Generating...' : 'Generate AI Summary'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Total Flags</p>
          <p className="text-2xl font-semibold">{flags.length}</p>
        </div>
        <div className="card border-red-200 bg-red-50">
          <p className="text-sm text-red-600">High Severity</p>
          <p className="text-2xl font-semibold text-red-700">{flagCounts.HIGH}</p>
        </div>
        <div className="card border-yellow-200 bg-yellow-50">
          <p className="text-sm text-yellow-700">Warning</p>
          <p className="text-2xl font-semibold text-yellow-700">{flagCounts.WARN}</p>
        </div>
        <div className="card border-blue-200 bg-blue-50">
          <p className="text-sm text-blue-600">Info</p>
          <p className="text-2xl font-semibold text-blue-700">{flagCounts.INFO}</p>
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="card border-blue-200 bg-blue-50">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">AI Analysis Summary</h2>

          {/* Highlights */}
          {aiSummary.highlights.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium text-blue-800 mb-2">Key Highlights</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiSummary.highlights.map((h, i) => (
                  <div key={i} className="bg-white p-3 rounded-md border border-blue-200">
                    <p className="font-medium text-gray-900">{h.title}</p>
                    <p className="text-sm text-gray-600">{h.description}</p>
                    {h.value && <p className="text-lg font-semibold text-blue-700 mt-1">{h.value}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Signals */}
          {aiSummary.riskSignals.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium text-blue-800 mb-2">Risk Signals</h3>
              <div className="space-y-2">
                {aiSummary.riskSignals.map((signal, i) => (
                  <div key={i} className="bg-white p-3 rounded-md border border-blue-200 flex items-start gap-3">
                    <SeverityBadge severity={signal.severity} />
                    <div>
                      <p className="font-medium text-gray-900">{signal.entity}</p>
                      <p className="text-sm text-gray-600">{signal.description}</p>
                      {signal.recommendation && (
                        <p className="text-sm text-blue-600 mt-1">Recommendation: {signal.recommendation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Investigation Checklist */}
          {aiSummary.investigationChecklist.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium text-blue-800 mb-2">Investigation Checklist</h3>
              <ul className="list-disc list-inside space-y-1 bg-white p-4 rounded-md border border-blue-200">
                {aiSummary.investigationChecklist.map((item, i) => (
                  <li key={i} className="text-sm text-gray-700">{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Limitations */}
          {aiSummary.limitations.length > 0 && (
            <div>
              <h3 className="font-medium text-blue-800 mb-2">Analysis Limitations</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <ul className="list-disc list-inside space-y-1">
                  {aiSummary.limitations.map((item, i) => (
                    <li key={i} className="text-sm text-yellow-700">{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metrics Summary */}
      {metrics && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Period Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-xl font-semibold">{metrics.orderMetrics.totalOrders}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Cancel Rate</p>
              <p className="text-xl font-semibold">{(metrics.orderMetrics.cancelRate * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">End-of-Month Spike</p>
              <p className="text-xl font-semibold">
                {metrics.endOfMonthAnalysis.spikeRatio.toFixed(2)}x
                {metrics.endOfMonthAnalysis.hasSpike && <Badge variant="warn" className="ml-2">Spike</Badge>}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Pre-Ship Cancels</p>
              <p className="text-xl font-semibold">
                {metrics.preShipAnalysis.preShipCancellations}
                <span className="text-sm font-normal text-gray-500 ml-1">
                  ({(metrics.preShipAnalysis.preShipPercentage * 100).toFixed(1)}%)
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Flags Table */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Audit Flags</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading flags...</div>
        ) : flags.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No flags found for this period. Click "Run Fraud Detection" to analyze.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left">Severity</th>
                  <th className="text-left">Rule</th>
                  <th className="text-left">Entity</th>
                  <th className="text-left">Message</th>
                  <th className="text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.id}>
                    <td><SeverityBadge severity={flag.severity} /></td>
                    <td className="font-mono text-sm">{flag.ruleCode}</td>
                    <td>
                      <Badge variant="default">{flag.entityType}</Badge>
                    </td>
                    <td className="max-w-md">
                      <p className="text-sm truncate" title={flag.message}>{flag.message}</p>
                    </td>
                    <td className="text-sm text-gray-500">
                      {(() => {
                        const d = new Date((flag as any).createdAt);
                        return isNaN(d.getTime()) ? '-' : format(d, 'MMM d, HH:mm');
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
