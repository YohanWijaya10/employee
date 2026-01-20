"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable, Column } from '@/components/DataTable';
import { VisitStatusBadge, SeverityBadge } from '@/components/Badge';
import { format } from 'date-fns';
import { VisitPhotoPreview } from '@/components/VisitPhotoPreview';

export interface VisitListItem {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  distance: number;
  status: 'PENDING' | 'VERIFIED' | 'FLAGGED' | 'REJECTED';
  photoPath: string | null;
  checkInTime: Date | string;
  salesRep: { id: string; code: string; name: string };
  outlet: { id: string; code: string; name: string };
  auditFlags: { id: string; ruleCode: string; severity: 'INFO' | 'WARN' | 'HIGH'; message: string }[];
}

type SortableKey = 'checkInTime' | 'status' | 'distance' | 'salesRepCode' | 'outletCode';

export function VisitsTableClient({ data }: { data: VisitListItem[] }) {
  const [query, setQuery] = useState("");
  const [rep, setRep] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortableKey>('checkInTime');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const repOptions = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((v) => {
      const key = `${v.salesRep.code}—${v.salesRep.name}`;
      if (!map.has(key)) map.set(key, key);
    });
    return ['ALL', ...Array.from(map.keys())];
  }, [data]);

  const toggleSort = (key: SortableKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortHeader = ({ label, colKey }: { label: string; colKey: SortableKey }) => (
    <button type="button" onClick={() => toggleSort(colKey)} className="flex items-center gap-1 select-none" title="Sort">
      <span>{label}</span>
      <span className="text-xs" style={{ color: 'var(--muted)' }}>
        {sortKey === colKey ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </button>
  );

  const columns: Column<VisitListItem>[] = [
    {
      key: 'checkInTime',
      header: <SortHeader label="Check-In Time" colKey="checkInTime" />,
      render: (item) => (
        <Link href={`/visits/${item.id}`} className="text-blue-600 hover:underline font-medium">
          {format(new Date(item.checkInTime), 'MMM d, yyyy HH:mm')}
        </Link>
      ),
    },
    {
      key: 'status',
      header: <SortHeader label="Status" colKey="status" />,
      render: (item) => <VisitStatusBadge status={item.status} />,
    },
    {
      key: 'salesRep',
      header: <SortHeader label="Sales Rep" colKey="salesRepCode" />,
      render: (item) => (
        <div>
          <p className="font-medium">{item.salesRep.code}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{item.salesRep.name}</p>
        </div>
      ),
    },
    {
      key: 'outlet',
      header: <SortHeader label="Outlet" colKey="outletCode" />,
      render: (item) => (
        <div>
          <p className="font-medium">{item.outlet.code}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{item.outlet.name}</p>
        </div>
      ),
    },
    {
      key: 'distance',
      header: <SortHeader label="Distance" colKey="distance" />,
      render: (item) => (
        <span className={item.distance > 200 ? 'text-red-600 font-medium' : ''}>
          {item.distance.toFixed(0)}m
        </span>
      ),
    },
    {
      key: 'photo',
      header: 'Photo',
      render: (item) => (
        item.photoPath ? (
          <VisitPhotoPreview visitId={item.id} size="sm" />
        ) : (
          <span className="text-gray-400 text-sm">No photo</span>
        )
      ),
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (item) => (
        item.auditFlags.length > 0 ? (
          <div className="flex gap-1 flex-wrap">
            {item.auditFlags.slice(0, 2).map((flag) => (
              <SeverityBadge key={flag.id} severity={flag.severity} />
            ))}
            {item.auditFlags.length > 2 && (
              <span className="text-xs text-gray-500">+{item.auditFlags.length - 2}</span>
            )}
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = data.filter((v) =>
      [
        v.salesRep.code,
        v.salesRep.name,
        v.outlet.code,
        v.outlet.name,
        v.status,
        new Date(v.checkInTime).toISOString(),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
    if (rep !== 'ALL') {
      const [code, name] = rep.split('—');
      rows = rows.filter((v) => v.salesRep.code === code && v.salesRep.name === name);
    }
    if (statusFilter !== 'ALL') {
      rows = rows.filter((v) => v.status === statusFilter);
    }
    if (dateFrom) {
      const fromTs = new Date(dateFrom + 'T00:00:00').getTime();
      rows = rows.filter((v) => new Date(v.checkInTime).getTime() >= fromTs);
    }
    if (dateTo) {
      const toTs = new Date(dateTo + 'T23:59:59').getTime();
      rows = rows.filter((v) => new Date(v.checkInTime).getTime() <= toTs);
    }
    rows.sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      switch (sortKey) {
        case 'salesRepCode':
          va = a.salesRep.code; vb = b.salesRep.code; break;
        case 'outletCode':
          va = a.outlet.code; vb = b.outlet.code; break;
        case 'checkInTime':
          va = new Date(a.checkInTime).getTime(); vb = new Date(b.checkInTime).getTime(); break;
        case 'distance':
          va = a.distance; vb = b.distance; break;
        case 'status':
          va = a.status; vb = b.status; break;
        default:
          va = ''; vb = '';
      }
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va ?? '').localeCompare(String(vb ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [data, query, rep, statusFilter, dateFrom, dateTo, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="input-icon">
            <span className="icon">🔎</span>
            <input
              className="input"
              placeholder="Search by rep, outlet..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="input" value={rep} onChange={(e) => setRep(e.target.value)}>
            {repOptions.map((r) => (
              <option key={r} value={r}>{r === 'ALL' ? 'All Sales Reps' : r}</option>
            ))}
          </select>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="FLAGGED">Flagged</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <input
            type="date"
            className="input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From"
          />
          <input
            type="date"
            className="input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To"
          />
          {(query || rep !== 'ALL' || statusFilter !== 'ALL' || dateFrom || dateTo) && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setQuery('');
                setRep('ALL');
                setStatusFilter('ALL');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Reset
            </button>
          )}
        </div>
        <div className="text-sm" style={{ color: 'var(--muted)' }}>
          Showing {filtered.length} of {data.length}
        </div>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(item) => item.id}
        emptyMessage="No visits found"
      />
    </div>
  );
}
