import React from 'react';

export default function Sidebar() {
    const onDragStart = (event, nodeType, label) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.setData('application/reactflow-label', label);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="absolute left-4 top-48 z-10 w-52 bg-slate-800 border-2 border-slate-700 p-4 flex flex-col gap-4 shadow-xl rugged-box">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b-2 border-slate-700 pb-2">
                구성 요소 (Palette)
            </h2>

            <div className="space-y-3">
                <div>
                    <div className="text-xs font-bold text-white uppercase tracking-wider mb-2">영역 (Zone)</div>
                    <div
                        className="bg-slate-900 hover:bg-slate-700 p-3 border border-slate-700 cursor-grab transition-all hover:translate-x-1 flex items-center gap-2"
                        onDragStart={(event) => onDragStart(event, 'zone', 'New Zone')}
                        draggable
                    >
                        <div className="w-3 h-3 border-2 border-dashed border-slate-400"></div>
                        <span className="text-sm font-mono text-slate-200">영역</span>
                    </div>
                </div>

                <div>
                    <div className="text-[10px] font-bold text-white uppercase mb-2">시스템 (Systems)</div>
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            { type: 'Server', color: 'bg-indigo-600', label: '서버' },
                            { type: 'PC', color: 'bg-emerald-600', label: 'PC / 단말기' },
                            { type: 'Gateway', color: 'bg-orange-600', label: '게이트웨이' },
                            { type: 'Mobile', color: 'bg-pink-600', label: '모바일' },
                            { type: 'Security Device', color: 'bg-red-600', label: '보안 장비' },
                            { type: 'DNS Server', color: 'bg-violet-600', label: 'DNS 서버' },
                            { type: 'Wireless AP', color: 'bg-cyan-600', label: '무선 AP' },
                            { type: 'SaaS', color: 'bg-sky-600', label: 'SaaS (클라우드)' }
                        ].map((item) => (
                            <div
                                key={item.type}
                                className="bg-slate-900 hover:bg-slate-700 p-2 border border-slate-700 cursor-grab transition-all hover:translate-x-1 flex items-center gap-2"
                                onDragStart={(event) => onDragStart(event, 'system', item.type)}
                                draggable
                            >
                                <div className={`w-3 h-3 ${item.color} rounded-sm`}></div>
                                <span className="text-sm font-mono text-slate-200">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
