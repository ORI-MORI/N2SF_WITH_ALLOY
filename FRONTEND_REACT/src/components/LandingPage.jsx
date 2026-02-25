import React, { useRef } from 'react';
import { FileUp, Plus, LayoutTemplate } from 'lucide-react';
import model1 from '../data/presets/model1.json';
import model2 from '../data/presets/model2.json';

// Preset Registry
const PRESETS = [
    { id: 'model1', name: 'Model 1: Internet Terminal', data: model1 },
    { id: 'model2', name: 'Sample: 국방 통합 네트워크', data: model2 },
];

export default function LandingPage({ onStartProject }) {
    const fileInputRef = useRef(null);

    const handleNewProject = () => {
        onStartProject(null); // Empty project
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                // Basic validation could go here
                onStartProject(json);
            } catch (error) {
                alert('Invalid JSON file');
                console.error(error);
            }
        };
        reader.readAsText(file);
    };

    const handlePresetLoad = (preset) => {
        onStartProject(preset.data);
    };

    return (
        <div className="min-h-screen bg-slate-950 relative overflow-hidden flex flex-col items-center justify-center p-8">
            {/* Grid Background */}
            <div className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                    backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)',
                    backgroundSize: '30px 30px'
                }}
            ></div>

            <div className="max-w-5xl w-full space-y-16 relative z-10">

                {/* Header */}
                <div className="text-center space-y-6 mb-12">
                    <img src="/npluslab_logo.png" alt="Nplus Lab Logo" className="mx-auto w-[420px] h-auto object-contain animate-fade-in-up drop-shadow-2xl brightness-0 invert" />
                    <p className="text-slate-300 font-mono tracking-widest text-sm uppercase">Advanced Threat Modeling & Analysis Platform</p>
                </div>

                {/* Main Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* New Project */}
                    <button
                        onClick={handleNewProject}
                        className="group relative bg-slate-900 p-10 border-2 border-slate-700 hover:border-indigo-500 transition-all duration-300 text-left hover:shadow-[0_0_30px_rgba(99,102,241,0.15)] overflow-hidden"
                    >
                        {/* Corner Accents */}
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-slate-600 group-hover:border-indigo-400 transition-colors"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-slate-600 group-hover:border-indigo-400 transition-colors"></div>

                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Plus size={140} className="text-indigo-500" />
                        </div>

                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-slate-800 border border-slate-600 flex items-center justify-center mb-6 text-indigo-400 group-hover:text-indigo-300 group-hover:border-indigo-500 transition-colors shadow-lg">
                                <Plus size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-100 mb-3 uppercase tracking-wider group-hover:text-indigo-300 transition-colors">New Project</h3>
                            <p className="text-sm text-slate-300 leading-relaxed font-mono">
                                Initialize a clean workspace for new threat modeling architecture.
                            </p>
                        </div>
                    </button>

                    {/* Load File */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative bg-slate-900 p-10 border-2 border-slate-700 hover:border-emerald-500 transition-all duration-300 text-left hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] overflow-hidden"
                    >
                        {/* Corner Accents */}
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-slate-600 group-hover:border-emerald-400 transition-colors"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-slate-600 group-hover:border-emerald-400 transition-colors"></div>

                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <FileUp size={140} className="text-emerald-500" />
                        </div>

                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-slate-800 border border-slate-600 flex items-center justify-center mb-6 text-emerald-400 group-hover:text-emerald-300 group-hover:border-emerald-500 transition-colors shadow-lg">
                                <FileUp size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-100 mb-3 uppercase tracking-wider group-hover:text-emerald-300 transition-colors">Load Project</h3>
                            <p className="text-sm text-slate-300 leading-relaxed font-mono">
                                Restore workspace from existing .JSON architecture file.
                            </p>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".json"
                            onChange={handleFileUpload}
                        />
                    </button>
                </div>

                {/* Presets Section */}
                <div className="space-y-8 pt-8 border-t border-slate-800/50">
                    <div className="flex items-center gap-4">
                        <span className="w-2 h-2 bg-slate-700 transform rotate-45"></span>
                        <div className="h-px flex-1 bg-slate-800"></div>
                        <span className="text-xs font-bold text-white uppercase tracking-[0.2em]">System Templates</span>
                        <div className="h-px flex-1 bg-slate-800"></div>
                        <span className="w-2 h-2 bg-slate-700 transform rotate-45"></span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                onClick={() => handlePresetLoad(preset)}
                                className="group bg-slate-900/50 hover:bg-slate-900 p-5 border border-slate-800 hover:border-indigo-500/50 transition-all text-left flex items-start gap-4 relative overflow-hidden"
                            >
                                <div className="w-10 h-10 bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:text-indigo-400 group-hover:border-indigo-500/50 transition-colors shrink-0">
                                    <LayoutTemplate size={18} />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-300 mb-1 text-sm group-hover:text-white uppercase tracking-wide transition-colors">{preset.name}</div>
                                    <div className="text-[10px] text-slate-300 font-mono group-hover:text-white">Standard N2SF Configuration</div>
                                </div>
                            </button>
                        ))}

                        {/* Placeholder */}
                        <div className="p-5 border border-dashed border-slate-800 text-slate-400 text-xs font-mono flex items-center justify-center uppercase tracking-widest opacity-50 select-none">
                            More modules loading...
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
