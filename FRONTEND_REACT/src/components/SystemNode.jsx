import React, { memo } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import { Server, Monitor, Shield, Smartphone, Globe, Router, Wifi, Cloud } from 'lucide-react';

const icons = {
    Server: Server,
    Terminal: Monitor,
    NetworkDevice: Router,
    SecurityDevice: Shield,
    Mobile: Smartphone,
    WirelessAP: Wifi,
    SaaS: Cloud,
    'DNS Server': Globe,
};

const connectionNodeIdSelector = (state) => state.connectionNodeId;

const SystemNode = ({ data, selected }) => {
    const Icon = icons[data.type] || Server;
    const connectionNodeId = useStore(connectionNodeIdSelector);
    const isConnecting = !!connectionNodeId;

    // Handles: Square and Industrial
    const handleStyle = { width: 10, height: 10, background: '#475569', border: '1px solid #94a3b8', borderRadius: 0 };
    const sourceStyle = { ...handleStyle, zIndex: isConnecting ? 0 : 1 };
    const targetStyle = { ...handleStyle, zIndex: isConnecting ? 1 : 0, opacity: isConnecting ? 1 : 0 };

    // Header Colors based on Type
    const getHeaderColor = (type) => {
        switch (type) {
            case 'Server': return 'bg-indigo-900 border-indigo-700 text-indigo-100';
            case 'Terminal': return 'bg-emerald-900 border-emerald-700 text-emerald-100';
            case 'NetworkDevice': return 'bg-orange-900 border-orange-700 text-orange-100';
            case 'SecurityDevice': return 'bg-red-900 border-red-700 text-red-100';
            case 'Mobile': return 'bg-pink-900 border-pink-700 text-pink-100';
            case 'WirelessAP': return 'bg-cyan-900 border-cyan-700 text-cyan-100';
            case 'SaaS': return 'bg-sky-900 border-sky-700 text-sky-100';
            case 'DNS Server': return 'bg-violet-900 border-violet-700 text-violet-100';
            default: return 'bg-slate-800 border-slate-600 text-slate-100';
        }
    };

    // Type Display Mapping
    const typeLabels = {
        Server: '서버',
        Terminal: '단말(PC)',
        NetworkDevice: '네트워크',
        SecurityDevice: '보안장비',
        Mobile: '모바일',
        WirelessAP: '무선AP',
        SaaS: 'SaaS',
        'DNS Server': 'DNS',
        Zone: '구역'
    };

    const headerClass = getHeaderColor(data.type);

    return (
        <div className="relative group">
            {/* Main Rugged Card */}
            <div className={`
                relative w-[180px] flex flex-col
                bg-slate-900 
                border-2 
                transition-all duration-200
                ${data.isSelectedThreat
                    ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] z-50'
                    : data.isThreat
                        ? 'border-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)] z-40'
                        : selected
                            ? 'border-indigo-500 shadow-[0_0_0_1px_rgba(99,102,241,1)]'
                            : 'border-slate-700 hover:border-slate-500'
                }
            `}>
                {/* Header Section */}
                <div className={`
                    flex items-center gap-2 px-3 py-2 border-b-2 border-inherit
                    ${headerClass}
                `}>
                    <Icon size={16} strokeWidth={2.5} />
                    <span className="text-xs font-bold uppercase tracking-wider truncate flex-1 leading-none">
                        {typeLabels[data.type] || data.type}
                    </span>
                </div>

                {/* Body Section */}
                <div className="p-3 bg-slate-900 text-slate-100">
                    <div className="text-sm font-bold truncate mb-2">{data.label}</div>

                    {/* Detailed Boolean Properties */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] font-mono text-white mt-2 border-t border-slate-700 pt-1">
                        <div className="flex justify-between">
                            <span className="text-slate-200">CDS:</span>
                            <span className={data.isCDS ? "text-emerald-300 font-bold" : "text-slate-400"}>{data.isCDS ? "yes" : "no"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-200">Log:</span>
                            <span className={data.hasAuditLogging ? "text-emerald-300 font-bold" : "text-slate-400"}>{data.hasAuditLogging ? "yes" : "no"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-200">Clock:</span>
                            <span className={data.hasSecureClock ? "text-emerald-300 font-bold" : "text-slate-400"}>{data.hasSecureClock ? "yes" : "no"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-200">Auth:</span>
                            <span className={data.isRegistered ? "text-emerald-300 font-bold" : "text-slate-400"}>{data.isRegistered ? "yes" : "no"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-200">Enc:</span>
                            <span className={data.isStorageEncrypted ? "text-emerald-300 font-bold" : "text-slate-400"}>{data.isStorageEncrypted ? "yes" : "no"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-200">Admin:</span>
                            <span className={data.isManagement ? "text-emerald-300 font-bold" : "text-slate-400"}>{data.isManagement ? "yes" : "no"}</span>
                        </div>
                        {data.type === 'Mobile' && (
                            <div className="flex justify-between">
                                <span className="text-slate-200">MDM:</span>
                                <span className={data.hasMDM ? "text-emerald-300 font-bold" : "text-slate-400"}>{data.hasMDM ? "yes" : "no"}</span>
                            </div>
                        )}
                        <div className="flex justify-between col-span-2 mt-1 pt-1 border-t border-slate-700">
                            <span className="text-slate-200">Grade:</span>
                            <span className={`font-bold ${data.grade === 'Classified' ? 'text-red-400' :
                                    data.grade === 'Sensitive' ? 'text-amber-400' :
                                        'text-emerald-400'
                                }`}>
                                {data.grade || 'Open'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Connection Handles - Industrial Square Style */}
            <Handle type="source" position={Position.Top} id="top-source" style={sourceStyle} />
            <Handle type="target" position={Position.Top} id="top-target" style={targetStyle} />

            <Handle type="source" position={Position.Left} id="left-source" style={sourceStyle} />
            <Handle type="target" position={Position.Left} id="left-target" style={targetStyle} />

            <Handle type="source" position={Position.Right} id="right-source" style={sourceStyle} />
            <Handle type="target" position={Position.Right} id="right-target" style={targetStyle} />

            <Handle type="source" position={Position.Bottom} id="bottom-source" style={sourceStyle} />
            <Handle type="target" position={Position.Bottom} id="bottom-target" style={targetStyle} />
        </div>
    );
};

export default memo(SystemNode);
