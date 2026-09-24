import React from 'react';
import { Radio, Database, Cpu, Wifi, Server, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../../components/ui/BaseUI';

export const SystemHealthPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Server className="text-[#062326]" size={22} /> Sức khỏe & Giám sát Hạ tầng Hệ thống (System Health)
        </h1>
        <p className="text-xs text-slate-600 mt-1">Giám sát hiệu năng realtime của .NET 8 Backend API, MQTT Broker, TimescaleDB & PostgreSQL RLS.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#062326] uppercase tracking-wider flex items-center gap-1.5">
              <Server size={16} /> .NET 8 Web API Cluster
            </span>
            <StatusBadge status="ACTIVE" label="Healthy" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">18 ms <span className="text-xs text-slate-500 font-sans font-normal">Latency</span></div>
          <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
            <div className="flex justify-between"><span>Request Throughput:</span><span className="text-slate-900 font-mono font-semibold">450 req/s</span></div>
            <div className="flex justify-between"><span>Memory Usage:</span><span className="text-slate-900 font-mono font-semibold">1.2 GB / 8 GB</span></div>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
              <Radio size={16} /> EMQX MQTT Broker v5.0
            </span>
            <StatusBadge status="ACTIVE" label="Online" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">1,240 <span className="text-xs text-slate-500 font-sans font-normal">msg/sec</span></div>
          <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
            <div className="flex justify-between"><span>Active LoRa Gateways:</span><span className="text-slate-900 font-mono font-semibold">44 Connection</span></div>
            <div className="flex justify-between"><span>TLS 1.3 Encryption:</span><span className="text-[#062326] font-semibold">Enabled</span></div>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <Database size={16} /> PostgreSQL + TimescaleDB
            </span>
            <StatusBadge status="ACTIVE" label="Optimal" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">91.4% <span className="text-xs text-slate-500 font-sans font-normal">Compression</span></div>
          <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
            <div className="flex justify-between"><span>PostGIS Spatial Index:</span><span className="text-[#062326] font-semibold">GIST Active</span></div>
            <div className="flex justify-between"><span>Total Telemetry Rows:</span><span className="text-slate-900 font-mono font-semibold">148.5M Rows</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
