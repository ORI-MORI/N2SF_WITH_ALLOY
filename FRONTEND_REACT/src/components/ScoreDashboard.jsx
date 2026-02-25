import React, { useMemo, useState, useEffect } from 'react';
import { Shield, CheckCircle, Info } from 'lucide-react';

const ScoreDashboard = ({ nodes, edges, analysisResult, isAnalyzing }) => {
    const [hoveredMetric, setHoveredMetric] = useState(null);
    const [displayedSecurityScore, setDisplayedSecurityScore] = useState(null); // Initialize as null for "Not Analyzed" state

    // Update security score only when a new result is available
    useEffect(() => {
        if (analysisResult && analysisResult.threats) {
            // Count unique threats
            let threatCount = 0;
            const threats = analysisResult.threats;

            // Flatten threats object to count total violations
            Object.values(threats).forEach(violationList => {
                if (Array.isArray(violationList)) {
                    threatCount += violationList.length;
                }
            });

            // Calculate score using a non-linear decay formula to prevent negative values
            // Formula: 100 / (1 + (threatCount * 0.1))
            // 0 threats = 100%
            // 10 threats = 50%
            // 20 threats = 33%
            const score = Math.round(100 / (1 + (threatCount * 0.1)));
            setDisplayedSecurityScore(score);
        }
    }, [analysisResult]);

    // Calculate Modeling Completeness (Connected Node Ratio)
    const completenessData = useMemo(() => {
        // Filter out Zone nodes
        const systemNodes = nodes.filter(n => n.type !== 'zone');

        if (!systemNodes || systemNodes.length === 0) {
            return { ratio: null, text: "-", connected: 0, total: 0 };
        }
        const totalNodes = systemNodes.length;

        // Find all nodes that are connected (source or target of an edge)
        const connectedNodeIds = new Set();
        edges.forEach(edge => {
            connectedNodeIds.add(edge.source);
            connectedNodeIds.add(edge.target);
        });

        // Count how many of the current system nodes are in the connected set
        let connectedCount = 0;
        systemNodes.forEach(node => {
            if (connectedNodeIds.has(node.id)) {
                connectedCount++;
            }
        });

        const ratio = Math.round((connectedCount / totalNodes) * 100);
        return {
            ratio,
            text: `${connectedCount}/${totalNodes}`,
            connected: connectedCount,
            total: totalNodes
        };
    }, [nodes, edges]);

    // Helper to get color based on score
    const getScoreColor = (score) => {
        if (isAnalyzing) return 'text-blue-600';
        if (score === null) return 'text-gray-400'; // Gray for not analyzed
        if (score >= 80) return 'text-green-600';
        if (score >= 50) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getScoreBg = (score) => {
        if (isAnalyzing) return 'bg-blue-50 border-blue-200';
        if (score === null) return 'bg-gray-50 border-gray-200'; // Gray background for not analyzed
        if (score >= 80) return 'bg-green-50 border-green-200';
        if (score >= 50) return 'bg-yellow-50 border-yellow-200';
        return 'bg-red-50 border-red-200';
    };

    // Helper for completeness color (different thresholds)
    const getCompletenessColor = (ratio) => {
        if (ratio === null) return 'text-gray-400';
        if (ratio >= 90) return 'text-green-600';
        if (ratio >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getCompletenessBg = (ratio) => {
        if (ratio === null) return 'bg-gray-50 border-gray-200';
        if (ratio >= 90) return 'bg-green-50 border-green-200';
        if (ratio >= 60) return 'bg-yellow-50 border-yellow-200';
        return 'bg-red-50 border-red-200';
    };

    return (
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-3">
            {/* Security Score Card */}
            <div
                className={`relative flex items-center gap-3 px-4 py-3 border-2 transition-all duration-300 cursor-help shadow-lg rugged-box hover:translate-x-1 ${displayedSecurityScore === null ? 'bg-slate-800 border-slate-700' :
                    displayedSecurityScore >= 80 ? 'bg-slate-900 border-emerald-900' :
                        displayedSecurityScore >= 50 ? 'bg-slate-900 border-amber-900' :
                            'bg-slate-900 border-red-900'
                    }`}
                onMouseEnter={() => setHoveredMetric('security')}
                onMouseLeave={() => setHoveredMetric(null)}
            >
                <div className={`p-2 shadow-sm bg-slate-800 ${getScoreColor(displayedSecurityScore)}`}>
                    <Shield size={20} strokeWidth={2.5} className={isAnalyzing ? 'animate-pulse' : ''} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">보안 지수 (Health)</span>
                    <span className={`text-2xl font-black leading-none ${getScoreColor(displayedSecurityScore)}`}>
                        {isAnalyzing ? (
                            <span className="text-lg animate-pulse text-indigo-400">분석 중...</span>
                        ) : displayedSecurityScore === null ? (
                            <span className="text-lg text-slate-400">-</span>
                        ) : (
                            `${displayedSecurityScore}%`
                        )}
                    </span>
                </div>

                {/* Tooltip - Moved to Right */}
                {hoveredMetric === 'security' && (
                    <div className="absolute left-full top-0 ml-4 w-64 p-3 bg-slate-800 text-slate-200 text-xs border border-slate-600 shadow-2xl z-50 pointer-events-none animate-in fade-in slide-in-from-left-2">
                        <div className="font-bold mb-1 text-sm flex items-center gap-2 text-indigo-400">
                            <Shield size={14} /> 보안 지수 (Security Health)
                        </div>
                        <p className="leading-relaxed text-slate-400">
                            네트워크 구성의 보안 안전성을 나타냅니다.
                            <br />
                            • <span className="text-emerald-400">100%</span>: 위협이 발견되지 않음.
                            <br />
                            • <span className="text-red-400">낮음</span>: 위협이 증가할수록 점수가 감소합니다.
                        </p>
                    </div>
                )}
            </div>

            {/* Completeness Card */}
            <div
                className={`relative flex items-center gap-3 px-4 py-3 border-2 transition-all duration-300 cursor-help shadow-lg rugged-box hover:translate-x-1 ${completenessData.ratio === null ? 'bg-slate-800 border-slate-700' :
                    completenessData.ratio >= 90 ? 'bg-slate-900 border-emerald-900' :
                        completenessData.ratio >= 60 ? 'bg-slate-900 border-amber-900' :
                            'bg-slate-900 border-red-900'
                    }`}
                onMouseEnter={() => setHoveredMetric('completeness')}
                onMouseLeave={() => setHoveredMetric(null)}
            >
                <div className={`p-2 shadow-sm bg-slate-800 ${getCompletenessColor(completenessData.ratio)}`}>
                    <CheckCircle size={20} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">모델링 완성도</span>
                    <span className={`text-2xl font-black leading-none ${getCompletenessColor(completenessData.ratio)}`}>
                        {completenessData.text}
                    </span>
                </div>

                {/* Tooltip - Moved to Right */}
                {hoveredMetric === 'completeness' && (
                    <div className="absolute left-full top-0 ml-4 w-64 p-3 bg-slate-800 text-slate-200 text-xs border border-slate-600 shadow-2xl z-50 pointer-events-none animate-in fade-in slide-in-from-left-2">
                        <div className="font-bold mb-1 text-sm flex items-center gap-2 text-emerald-400">
                            <CheckCircle size={14} /> 완성도 (Completeness)
                        </div>
                        <p className="leading-relaxed text-slate-400">
                            전체 노드 대비 연결된 노드의 비율입니다.
                            <br />
                            • <span className="text-indigo-400">목표</span>: 모든 노드를 연결하세요.
                            <br />
                            • <span className="text-amber-400">팁</span>: 고립된 시스템이 없는지 확인하세요.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScoreDashboard;
