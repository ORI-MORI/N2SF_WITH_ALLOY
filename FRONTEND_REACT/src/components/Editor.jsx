import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Background,
    useReactFlow,
    useOnSelectionChange,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Play, Home as HomeIcon, Save as SaveIcon, Trash as TrashIcon } from 'lucide-react';

import Sidebar from './Sidebar';
import ZoneNode from './ZoneNode';
import SystemNode from './SystemNode';
import PropertyPanel from './PropertyPanel';
import DataFlowEdge from './DataFlowEdge';
import ScoreDashboard from './ScoreDashboard';

import useStore from '../store';
import { convertGraphToJSON } from '../utils/graphConverter';
import { analyzeGraph } from '../api/analyze';
import ConfirmModal from './ConfirmModal';

const nodeTypes = {
    zone: ZoneNode,
    system: SystemNode,
};

const edgeTypes = {
    dataFlow: DataFlowEdge,
};

let id = 0;
const getId = () => `dndnode_${id++}`;

const EditorContent = ({ initialData, onExit }) => {
    const reactFlowWrapper = useRef(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const { screenToFlowPosition, setViewport, toObject } = useReactFlow();
    const { selectedElement, setSelectedElement } = useStore();
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [selectedThreatId, setSelectedThreatId] = useState(null);
    const [isClearModalOpen, setIsClearModalOpen] = useState(false);
    const [analysisError, setAnalysisError] = useState(null);

    // Initialization & ID Sync
    useEffect(() => {
        if (initialData) {
            setNodes(initialData.nodes || []);
            setEdges(initialData.edges || []);
            if (initialData.viewport) {
                setViewport(initialData.viewport);
            }

            // Sync ID Counter
            const allIds = [
                ...(initialData.nodes || []).map(n => n.id),
                ...(initialData.edges || []).map(e => e.id)
            ];

            let maxId = 0;
            allIds.forEach(itemId => {
                // Look for patterns like "dndnode_123" or just numbers if any
                const match = itemId.match(/(\d+)$/);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num) && num > maxId) {
                        maxId = num;
                    }
                }
            });

            // Set global id to max + 1 to avoid collisions
            id = maxId + 1;
        } else {
            // New Project
            id = 0;
            setNodes([]);
            setEdges([]);
            setViewport({ x: 0, y: 0, zoom: 1 });
        }
    }, [initialData, setNodes, setEdges, setViewport]);

    const handleSave = () => {
        const flow = toObject();
        const data = {
            meta: {
                title: "AMADEUS Project",
                version: "1.0",
                date: new Date().toISOString()
            },
            nodes: flow.nodes,
            edges: flow.edges,
            viewport: flow.viewport
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `amadeus_project_${new Date().getTime()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    useOnSelectionChange({
        onChange: ({ nodes, edges }) => {
            if (nodes.length > 0) {
                setSelectedElement(nodes[0]);
            } else if (edges.length > 0) {
                setSelectedElement(edges[0]);
            } else {
                setSelectedElement(null);
            }
        },
    });

    const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, type: 'dataFlow', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#000000' }, data: { isBidirectional: true } }, eds)), []);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            const label = event.dataTransfer.getData('application/reactflow-label');

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            let defaultType = label;
            let zIndex = 1; // Default z-index for systems

            if (type === 'zone') {
                defaultType = 'Internet'; // Default Zone Type
                zIndex = -1; // Send zones to back
            } else if (type === 'system') {
                if (label === 'PC') defaultType = 'Terminal';
                else if (label === 'Gateway') defaultType = 'NetworkDevice';
                else if (label === 'Server') defaultType = 'Server';
                else if (label === 'Mobile') defaultType = 'Mobile';
                else if (label === 'Security Device') defaultType = 'SecurityDevice';
                else if (label === 'DNS Server') defaultType = 'DNS Server';
                else if (label === 'Wireless AP') defaultType = 'WirelessAP';
                else if (label === 'SaaS') defaultType = 'SaaS';
                else defaultType = 'Terminal';
            }

            const isZone = type === 'zone';
            const newNode = {
                id: getId(),
                type,
                position,
                zIndex: isZone ? -1 : 10, // Zones at bottom (-1), Systems on top (10)
                data: { label, grade: 'Open', type: defaultType },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, setNodes]
    );

    // Auto-detect Zone on Drag Stop
    const onNodeDragStop = useCallback(
        (event, node) => {
            if (node.type === 'zone') return; // Zones don't need location

            // Calculate node center
            const nodeCenterX = node.position.x + (node.width || 150) / 2;
            const nodeCenterY = node.position.y + (node.height || 40) / 2;

            // Find intersecting zones
            const zones = nodes.filter((n) => n.type === 'zone');
            let foundZone = null;

            for (const zone of zones) {
                const zoneX = zone.position.x;
                const zoneY = zone.position.y;
                const zoneW = zone.width || 100; // Default width if not resized
                const zoneH = zone.height || 100; // Default height if not resized

                if (
                    nodeCenterX >= zoneX &&
                    nodeCenterX <= zoneX + zoneW &&
                    nodeCenterY >= zoneY &&
                    nodeCenterY <= zoneY + zoneH
                ) {
                    foundZone = zone;
                    break; // Assume belonging to the first found zone (nested zones not fully supported yet)
                }
            }

            const newLoc = foundZone ? foundZone.id : '';

            // Update node location if changed
            if (node.data.loc !== newLoc) {
                setNodes((nds) =>
                    nds.map((n) => {
                        if (n.id === node.id) {
                            return { ...n, data: { ...n.data, loc: newLoc } };
                        }
                        return n;
                    })
                );
            }
        },
        [nodes, setNodes]
    );

    // Auto-save to localStorage periodically
    useEffect(() => {
        const timer = setInterval(() => {
            if (nodes.length > 0) {
                try {
                    const flow = toObject();
                    const autoSave = {
                        meta: { title: "AMADEUS Auto-save", version: "1.0", date: new Date().toISOString() },
                        nodes: flow.nodes,
                        edges: flow.edges,
                        viewport: flow.viewport
                    };
                    localStorage.setItem('amadeus_autosave', JSON.stringify(autoSave));
                } catch (e) { /* ignore quota errors */ }
            }
        }, 30000); // Save every 30 seconds
        return () => clearInterval(timer);
    }, [nodes.length, toObject]);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setAnalysisError(null);

        // 1. Empty Diagram Check
        if (nodes.length === 0) {
            setAnalysisResult({ error: 'NO_DIAGRAM' });
            setIsAnalyzing(false);
            return;
        }

        try {
            const graphData = convertGraphToJSON(nodes, edges);
            const result = await analyzeGraph(graphData);
            setAnalysisResult(result);
        } catch (error) {
            console.error("Analysis failed:", error);
            setAnalysisError(error.message || '분석 서버에 연결할 수 없습니다.');
            setAnalysisResult(null);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleClearClick = () => {
        setIsClearModalOpen(true);
    };

    const confirmClear = () => {
        setNodes([]);
        setEdges([]);
        setAnalysisResult(null);
        id = 0; // Reset ID counter
    };

    const handleThreatClick = (threatId) => {
        setSelectedThreatId(prev => prev === threatId ? null : threatId);
    };

    // Effect to highlight nodes/edges: Red for ANY threat, distinct for SELECTED threat
    useEffect(() => {
        // Helper update function
        const updateElements = (elements, allThreatSet, selectedThreatSet) => {
            let hasChanges = false;
            const newElements = elements.map(el => {
                // Check Global Threat Status
                const isGlobalThreat = (
                    allThreatSet.has(el.id) ||
                    (el.data.label && allThreatSet.has(el.data.label))
                );

                // Check Selected Threat Status
                const isSelectedThreat = (
                    selectedThreatSet.has(el.id) ||
                    (el.data.label && selectedThreatSet.has(el.data.label))
                );

                // Update if changed
                if (!!el.data.isThreat !== isGlobalThreat || !!el.data.isSelectedThreat !== isSelectedThreat) {
                    hasChanges = true;
                    return { ...el, data: { ...el.data, isThreat: isGlobalThreat, isSelectedThreat: isSelectedThreat } };
                }
                return el;
            });
            return hasChanges ? newElements : elements;
        };

        // Helper to sanitize ID consistent with graphConverter
        const sanitizeId = (id) => id.toString().replace(/[^a-zA-Z0-9]/g, '_');

        // Helper to match ID against a Set using heuristics (exact, sanitized, reverse lookup)
        const isMatch = (elementId, involveSet) => {
            if (!elementId) return false;
            if (involveSet.has(elementId)) return true;
            const cleanId = sanitizeId(elementId);
            if (involveSet.has(cleanId)) return true;
            if (involveSet.has(cleanId + '_return')) return true;

            for (const rawThreatId of involveSet) {
                let threatId = rawThreatId.split('$')[0].trim();
                if (threatId === elementId) return true;
                if (threatId === cleanId) return true;
                if (threatId.endsWith('_' + cleanId)) return true;
                if (cleanId.endsWith('_' + threatId)) return true;
                if (threatId.includes('/')) {
                    const pathPart = threatId.split('/').pop();
                    if (pathPart === cleanId) return true;
                }
            }
            return false;
        };

        // --- 1. Calculate All Threats Set ---
        const allThreatIds = new Set();
        if (analysisResult && analysisResult.threats) {
            Object.values(analysisResult.threats).forEach(threatList => {
                threatList.forEach(t => {
                    if (t.system) allThreatIds.add(t.system);
                    if (t.connection) allThreatIds.add(t.connection);
                });
            });
        }

        // Inference for Edges (All Threats)
        edges.forEach(e => {
            if (isMatch(e.id, allThreatIds)) {
                allThreatIds.add(e.source);
                allThreatIds.add(e.target);
            }
        });

        // --- 2. Calculate Selected Threat Set ---
        const selectedThreatIds = new Set();
        if (selectedThreatId && analysisResult && analysisResult.threats) {
            const lastDashIndex = selectedThreatId.lastIndexOf('-');
            const threatType = selectedThreatId.substring(0, lastDashIndex);
            const indicesStr = selectedThreatId.substring(lastDashIndex + 1);
            const indices = indicesStr.split(',').map(idx => parseInt(idx, 10));

            indices.forEach(index => {
                if (analysisResult.threats[threatType]) {
                    const threat = analysisResult.threats[threatType][index];
                    if (threat) {
                        if (threat.system) selectedThreatIds.add(threat.system);
                        if (threat.connection) selectedThreatIds.add(threat.connection);
                    }
                }
            });

            // Inference for Edges (Selected Threat)
            edges.forEach(e => {
                if (isMatch(e.id, selectedThreatIds)) {
                    selectedThreatIds.add(e.source);
                    selectedThreatIds.add(e.target);
                }
            });
        }

        // Apply Updates
        // Note: We need extended sets that include matches (because our sets currently contain raw ID strings from Alloy)

        const realAllThreatIds = new Set();
        const realSelectedThreatIds = new Set();

        const resolveToRealIds = (sourceSet, targetSet) => {
            nodes.forEach(n => {
                if (isMatch(n.id, sourceSet) || (n.data.label && isMatch(n.data.label, sourceSet))) {
                    targetSet.add(n.id);
                }
            });
            edges.forEach(e => {
                if (isMatch(e.id, sourceSet)) {
                    targetSet.add(e.id);
                }
            });
        };

        resolveToRealIds(allThreatIds, realAllThreatIds);
        resolveToRealIds(selectedThreatIds, realSelectedThreatIds);

        setNodes(nds => updateElements(nds, realAllThreatIds, realSelectedThreatIds));
        setEdges(eds => updateElements(eds, realAllThreatIds, realSelectedThreatIds));

    }, [selectedThreatId, analysisResult]);

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-slate-950">
            <Sidebar />

            {/* Main Canvas Area */}
            <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onNodeDragStop={onNodeDragStop}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    proOptions={{ hideAttribution: true }}
                    style={{ background: '#0f172a' }}
                >
                    <Background variant="dots" gap={20} size={1} color="#334155" />
                </ReactFlow>
            </div>

            {/* Floating UI Layer */}

            {/* Score Dashboard (Top Left) */}
            <ScoreDashboard
                nodes={nodes}
                edges={edges}
                analysisResult={analysisResult}
                isAnalyzing={isAnalyzing}
            />

            {/* Error Banner */}
            {analysisError && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30 bg-red-900/90 border border-red-700 text-red-200 px-6 py-3 shadow-lg flex items-center gap-3 max-w-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span className="text-sm">{analysisError}</span>
                    <button onClick={() => setAnalysisError(null)} className="text-red-400 hover:text-white ml-2 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            )}

            {/* Top Center Actions */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex gap-2 bg-slate-800 border-2 border-slate-700 p-1.5 shadow-lg">
                <button
                    onClick={onExit}
                    className="px-4 py-2 text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-2"
                    title="메인으로"
                >
                    <HomeIcon size={16} />
                    홈
                </button>
                <div className="w-px bg-slate-700 my-1"></div>
                <button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm font-medium text-slate-200 hover:text-emerald-400 hover:bg-slate-700 transition-colors flex items-center gap-2"
                    title="프로젝트 저장"
                >
                    <SaveIcon size={16} />
                    저장
                </button>
                <div className="w-px bg-slate-700 my-1"></div>
                <button
                    onClick={handleClearClick}
                    className="px-4 py-2 text-sm font-medium text-slate-200 hover:text-red-400 hover:bg-slate-700 transition-colors flex items-center gap-2"
                    title="캔버스 초기화"
                >
                    <TrashIcon size={16} />
                    초기화
                </button>
                <div className="w-px bg-slate-700 my-1"></div>
                <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className={`px-6 py-2 text-sm font-bold shadow-sm flex items-center gap-2 transition-all ${isAnalyzing
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-indigo-700 text-white hover:bg-indigo-600 border border-indigo-500 hover:shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                        }`}
                >
                    {isAnalyzing ? (
                        <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            분석 중...
                        </>
                    ) : (
                        <>
                            <Play size={16} fill="currentColor" /> 위협 분석
                        </>
                    )}
                </button>
            </div>



            <PropertyPanel
                analysisResult={analysisResult}
                onThreatClick={handleThreatClick}
                selectedThreatId={selectedThreatId}
            />

            <ConfirmModal
                isOpen={isClearModalOpen}
                onClose={() => setIsClearModalOpen(false)}
                onConfirm={confirmClear}
                title="캔버스 초기화 확인"
                message={`모든 노드와 연결이 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`}
            />
        </div>
    );
};

export default function Editor(props) {
    return (
        <EditorContent {...props} />
    );
}
