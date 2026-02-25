import React, { useEffect, useState, useMemo } from 'react';
import { useReactFlow } from 'reactflow';
import { CheckCircle, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import useStore from '../store';
import ConfirmModal from './ConfirmModal';

// ============================================================
// Collapsible Section Component
// ============================================================
function Section({ title, defaultOpen = true, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-slate-700 bg-slate-850">
            <button
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-900 hover:bg-slate-800 transition-colors text-left"
                onClick={() => setOpen(!open)}
            >
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{title}</span>
                {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
            </button>
            {open && <div className="p-3 space-y-3">{children}</div>}
        </div>
    );
}

// ============================================================
// Reusable Field Components
// ============================================================
const inputClass = "mt-1 block w-full rounded-none border-2 border-slate-700 bg-slate-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 transition-all hover:border-slate-500 text-white placeholder-slate-400";
const labelClass = "block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1";

function SelectField({ label, value, onChange, options, hint }) {
    return (
        <div>
            <label className={labelClass}>{label}</label>
            <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            {hint && <p className="text-[10px] text-slate-500 mt-1 italic">{hint}</p>}
        </div>
    );
}

function CheckboxField({ id, label, checked, onChange }) {
    return (
        <div className="flex items-center gap-2 p-2 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700">
            <input
                type="checkbox"
                id={id}
                className="rounded-sm border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
                checked={checked || false}
                onChange={(e) => onChange(e.target.checked)}
            />
            <label htmlFor={id} className="text-sm font-medium text-slate-200 cursor-pointer">{label}</label>
        </div>
    );
}

export default function PropertyPanel({ analysisResult, onThreatClick, selectedThreatId }) {
    const { selectedElement, setSelectedElement } = useStore();
    const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();
    const [formData, setFormData] = useState({});
    const [activeTab, setActiveTab] = useState('properties');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        if (selectedElement) {
            setFormData(selectedElement.data || {});
            setActiveTab('properties');
        } else {
            setFormData({});
        }
    }, [selectedElement]);

    useEffect(() => {
        if (analysisResult) {
            setActiveTab('threats');
        }
    }, [analysisResult]);

    const handleChange = (key, value) => {
        const newData = { ...formData, [key]: value };
        setFormData(newData);

        if (selectedElement.source) {
            setEdges((edges) =>
                edges.map((edge) =>
                    edge.id === selectedElement.id ? { ...edge, data: newData } : edge
                )
            );
        } else {
            setNodes((nodes) =>
                nodes.map((node) =>
                    node.id === selectedElement.id ? { ...node, data: newData } : node
                )
            );
        }
        setSelectedElement({ ...selectedElement, data: newData });
    };

    const handleBatchChange = (updates) => {
        const newData = { ...formData, ...updates };
        setFormData(newData);

        if (selectedElement.source) {
            setEdges((edges) => edges.map((e) => e.id === selectedElement.id ? { ...e, data: newData } : e));
        } else {
            setNodes((nodes) => nodes.map((n) => n.id === selectedElement.id ? { ...n, data: newData } : n));
        }
        setSelectedElement({ ...selectedElement, data: newData });
    };

    const applyProfile = (profile) => {
        if (profile === 'GeneralPC') {
            handleBatchChange({
                profile: 'GeneralPC',
                type: 'Terminal',
                grade: 'Open',
                patchStatus: 'UpToDate',
                lifeCycle: 'Active',
                hasAuditLogging: false,
                authType: 'Single_Factor',
                isRegistered: true,
                sessionPolicy: 'Timeout_Only'
            });
        } else if (profile === 'ClassifiedServer') {
            handleBatchChange({
                profile: 'ClassifiedServer',
                type: 'Server',
                grade: 'Classified',
                patchStatus: 'UpToDate',
                lifeCycle: 'Active',
                hasAuditLogging: true,
                hasSecureClock: true,
                isStorageEncrypted: true,
                authType: 'Multi_Factor',
                isRegistered: true,
                sessionPolicy: 'Strict_Timeout_Concurrency'
            });
        } else {
            handleBatchChange({ profile: 'Custom' });
        }
    };

    // Data asset management
    const addData = () => {
        const currentData = formData.storedData || [];
        const newId = currentData.length > 0 ? Math.max(...currentData.map(d => d.id)) + 1 : 1;
        const newDataItem = { id: newId, grade: 'Sensitive', dataType: 'GeneralData' };

        handleChange('storedData', [...currentData, newDataItem]);

        setEdges((edges) => edges.map((edge) => {
            if (edge.source === selectedElement.id) {
                const currentCarries = Array.isArray(edge.data?.carries) ? edge.data.carries : [];
                return {
                    ...edge,
                    data: { ...edge.data, carries: [...currentCarries, newId] }
                };
            }
            return edge;
        }));
    };

    const removeData = (id) => {
        const currentData = formData.storedData || [];
        handleChange('storedData', currentData.filter(d => d.id !== id));
    };

    const updateData = (id, field, value) => {
        const currentData = formData.storedData || [];
        handleChange('storedData', currentData.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

    const handleDeleteClick = () => {
        if (!selectedElement) return;
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = () => {
        if (selectedElement.source) {
            setEdges((edges) => edges.filter((edge) => edge.id !== selectedElement.id));
        } else {
            setNodes((nodes) => nodes.filter((node) => node.id !== selectedElement.id));
        }
        setSelectedElement(null);
    };

    // ============================================================
    // PROPERTIES TAB
    // ============================================================
    const renderPropertiesTab = () => {
        if (!selectedElement) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center">
                    <div className="w-16 h-16 rounded shadow-lg bg-orange-900/10 border-2 border-orange-500/30 flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="9" y1="3" x2="9" y2="21"></line>
                        </svg>
                    </div>
                    <p className="text-base font-bold text-orange-400 uppercase tracking-widest">선택된 요소 없음</p>
                    <p className="text-xs text-slate-400 mt-2 font-mono">
                        속성을 보려면<br />노드나 연결선을 선택하세요.
                    </p>
                </div>
            );
        }

        const isNode = !selectedElement.source;
        const isZone = isNode && selectedElement.type === 'zone';
        const isSystem = isNode && selectedElement.type === 'system';
        const isEdge = !!selectedElement.source;

        return (
            <div className="flex flex-col gap-3">
                <div className="text-[10px] font-mono text-slate-200 bg-slate-900 p-1.5 rounded border border-slate-700 inline-block self-start shadow-sm">ID: {selectedElement.id}</div>

                {/* Common Label/Name */}
                {isNode && (
                    <div>
                        <label className={labelClass}>이름</label>
                        <input
                            type="text"
                            className={inputClass}
                            value={formData.label || ''}
                            onChange={(e) => handleChange('label', e.target.value)}
                            placeholder="이름 입력..."
                        />
                    </div>
                )}

                {/* ============ ZONE ============ */}
                {isZone && renderZoneProperties()}

                {/* ============ SYSTEM ============ */}
                {isSystem && renderSystemProperties()}

                {/* ============ EDGE (CONNECTION) ============ */}
                {isEdge && renderEdgeProperties()}

                {/* Delete Button */}
                <div className="border-t-2 border-slate-700 pt-4 mt-2 pb-4">
                    <button
                        onClick={handleDeleteClick}
                        className="w-full bg-red-900/20 text-red-500 border-2 border-red-900/50 py-2.5 rounded-none hover:bg-red-900/40 hover:text-red-400 transition-colors text-sm font-bold flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        삭제
                    </button>
                </div>
            </div>
        );
    };

    // ============================================================
    // ZONE PROPERTIES
    // ============================================================
    const renderZoneProperties = () => (
        <>
            <SelectField
                label="등급"
                value={formData.grade || 'Open'}
                onChange={(v) => handleChange('grade', v)}
                options={[
                    { value: 'Classified', label: '기밀 (Classified)' },
                    { value: 'Sensitive', label: '민감 (Sensitive)' },
                    { value: 'Open', label: '공개 (Open)' },
                ]}
            />
            <SelectField
                label="유형"
                value={formData.type || 'Internet'}
                onChange={(v) => handleChange('type', v)}
                options={[
                    { value: 'Internet', label: '인터넷망' },
                    { value: 'Intranet', label: '업무망(내부망)' },
                    { value: 'DMZ', label: 'DMZ' },
                    { value: 'Wireless', label: '무선망' },
                    { value: 'PPP', label: '폐쇄망(PPP)' },
                    { value: 'Cloud', label: '클라우드' },
                    { value: 'ManagementZone', label: '관리망' },
                    { value: 'DevTestZone', label: '개발/테스트망' },
                ]}
            />
            {formData.type === 'Wireless' && (
                <CheckboxField
                    id="wips_enabled"
                    label="WIPS(무선침입방지)가 활성화되어 있습니까?"
                    checked={formData.wips_enabled}
                    onChange={(v) => handleChange('wips_enabled', v)}
                />
            )}
        </>
    );

    // ============================================================
    // SYSTEM PROPERTIES (Sectioned)
    // ============================================================
    const renderSystemProperties = () => (
        <>
            {/* Profile Preset */}
            <div className="bg-indigo-900/20 p-2 border border-indigo-500/30">
                <label className={labelClass}>보안 프로파일 (자동 입력)</label>
                <select
                    className="w-full text-xs bg-slate-900 border-slate-700 text-slate-200 rounded-none p-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.profile || 'Custom'}
                    onChange={(e) => applyProfile(e.target.value)}
                >
                    <option value="Custom">사용자 정의 (Custom)</option>
                    <option value="GeneralPC">일반 PC (공개/자동)</option>
                    <option value="ClassifiedServer">기밀 서버 (보안)</option>
                </select>
            </div>

            {/* Section 1: Basic Info */}
            <Section title="기본 정보" defaultOpen={true}>
                <SelectField
                    label="위치 (구역)"
                    value={formData.loc || ''}
                    onChange={(v) => handleChange('loc', v)}
                    options={[
                        { value: '', label: '(없음)' },
                        ...getNodes().filter(n => n.type === 'zone').map(zone => ({
                            value: zone.id,
                            label: zone.data.label || `Zone ${zone.id}`
                        }))
                    ]}
                    hint="자동 배치를 재정의합니다."
                />
                <SelectField
                    label="등급"
                    value={formData.grade || 'Open'}
                    onChange={(v) => handleChange('grade', v)}
                    options={[
                        { value: 'Classified', label: '기밀 (Classified)' },
                        { value: 'Sensitive', label: '민감 (Sensitive)' },
                        { value: 'Open', label: '공개 (Open)' },
                    ]}
                />
                <SelectField
                    label="장비 유형"
                    value={formData.type || 'Server'}
                    onChange={(v) => handleChange('type', v)}
                    options={[
                        { value: 'Terminal', label: '단말(PC)' },
                        { value: 'Server', label: '서버' },
                        { value: 'SecurityDevice', label: '보안 장비' },
                        { value: 'NetworkDevice', label: '네트워크 장비' },
                        { value: 'Mobile', label: '모바일' },
                        { value: 'WirelessAP', label: '무선 AP' },
                        { value: 'DNS Server', label: 'DNS 서버' },
                        { value: 'SaaS', label: 'SaaS' },
                    ]}
                />
                <SelectField
                    label="서비스 모델"
                    value={formData.serviceModel || (formData.type === 'SaaS' ? 'SaaS' : 'OnPremise')}
                    onChange={(v) => handleChange('serviceModel', v)}
                    options={[
                        { value: 'OnPremise', label: '온프레미스 (On-Premise)' },
                        { value: 'IaaS', label: 'IaaS' },
                        { value: 'PaaS', label: 'PaaS' },
                        { value: 'SaaS', label: 'SaaS' },
                    ]}
                />
            </Section>

            {/* Section 2: Security Status */}
            <Section title="보안 상태" defaultOpen={true}>
                <SelectField
                    label="인증 방식"
                    value={formData.authType || 'Single_Factor'}
                    onChange={(v) => handleChange('authType', v)}
                    options={[
                        { value: 'Single_Factor', label: '단일 인증 (1FA)' },
                        { value: 'Multi_Factor', label: '다중 인증 (MFA)' },
                    ]}
                />
                <SelectField
                    label="패치 상태"
                    value={formData.patchStatus || 'UpToDate'}
                    onChange={(v) => handleChange('patchStatus', v)}
                    options={[
                        { value: 'UpToDate', label: '최신 (자동)' },
                        { value: 'Vulnerable', label: '취약 (구버전)' },
                    ]}
                />
                <SelectField
                    label="수명 주기"
                    value={formData.lifeCycle || 'Active'}
                    onChange={(v) => handleChange('lifeCycle', v)}
                    options={[
                        { value: 'Active', label: '운영 중 (Active)' },
                        { value: 'EOL', label: '단종 (EOL)' },
                    ]}
                />
                <SelectField
                    label="세션 정책"
                    value={formData.sessionPolicy || 'Unsafe'}
                    onChange={(v) => handleChange('sessionPolicy', v)}
                    options={[
                        { value: 'Unsafe', label: '취약 (Unsafe)' },
                        { value: 'Timeout_Only', label: '타임아웃 적용' },
                        { value: 'Strict_Timeout_Concurrency', label: '엄격 (타임아웃+동시접속 제한)' },
                    ]}
                />
                <div className="space-y-1">
                    <CheckboxField id="isRegistered" label="등록된 기기" checked={formData.isRegistered} onChange={(v) => handleChange('isRegistered', v)} />
                    <CheckboxField id="isStorageEncrypted" label="저장소 암호화" checked={formData.isStorageEncrypted} onChange={(v) => handleChange('isStorageEncrypted', v)} />
                    <CheckboxField id="isManagement" label="관리자 전용 단말" checked={formData.isManagement} onChange={(v) => handleChange('isManagement', v)} />
                    <CheckboxField id="isCertified" label="CC인증 제품" checked={formData.isCertified} onChange={(v) => handleChange('isCertified', v)} />
                    <CheckboxField id="isHardened" label="OS Hardening 적용" checked={formData.isHardened} onChange={(v) => handleChange('isHardened', v)} />
                    <CheckboxField id="hasAuditLogging" label="감사 로그 기록" checked={formData.hasAuditLogging} onChange={(v) => handleChange('hasAuditLogging', v)} />
                    <CheckboxField id="hasSecureClock" label="보안 시각 동기화" checked={formData.hasSecureClock} onChange={(v) => handleChange('hasSecureClock', v)} />
                </div>
            </Section>

            {/* Section 3: Network / Physical */}
            <Section title="네트워크 / 물리" defaultOpen={false}>
                <div className="space-y-1">
                    <CheckboxField id="hasWirelessInterface" label="무선 인터페이스 보유 (Wi-Fi)" checked={formData.hasWirelessInterface} onChange={(v) => handleChange('hasWirelessInterface', v)} />
                    <CheckboxField id="hasBluetoothInterface" label="블루투스 인터페이스 보유" checked={formData.hasBluetoothInterface} onChange={(v) => handleChange('hasBluetoothInterface', v)} />
                    <CheckboxField id="hasPhysicalPortControl" label="물리 포트(USB 등) 통제" checked={formData.hasPhysicalPortControl} onChange={(v) => handleChange('hasPhysicalPortControl', v)} />
                    <CheckboxField id="hasDDoSProtection" label="DDoS 방어" checked={formData.hasDDoSProtection} onChange={(v) => handleChange('hasDDoSProtection', v)} />
                    <CheckboxField id="isRedundant" label="이중화(HA) 구성" checked={formData.isRedundant} onChange={(v) => handleChange('isRedundant', v)} />
                    {formData.type === 'Mobile' && (
                        <CheckboxField id="hasMDM" label="MDM 적용" checked={formData.hasMDM} onChange={(v) => handleChange('hasMDM', v)} />
                    )}
                </div>
                <CheckboxField id="isCDS" label="망연계(CDS) 장비" checked={formData.isCDS} onChange={(v) => handleChange('isCDS', v)} />
                {formData.isCDS && (
                    <SelectField
                        label="CDS 유형"
                        value={formData.cdsType || 'TwoWay_Relay'}
                        onChange={(v) => handleChange('cdsType', v)}
                        options={[
                            { value: 'OneWay_Out', label: '단방향 (외부→내부 차단)' },
                            { value: 'OneWay_In', label: '단방향 (내부→외부 차단)' },
                            { value: 'TwoWay_Relay', label: '양방향 중계' },
                            { value: 'Access_CDS', label: '접근통제형' },
                            { value: 'MLS_CDS', label: '다중등급(MLS)' },
                        ]}
                    />
                )}
            </Section>

            {/* Section 4: Integrity / Virtualization */}
            <Section title="무결성 / 가상화" defaultOpen={false}>
                <div className="space-y-1">
                    <CheckboxField id="hasHwIntegrity" label="하드웨어 무결성 (TPM)" checked={formData.hasHwIntegrity} onChange={(v) => handleChange('hasHwIntegrity', v)} />
                    <CheckboxField id="hasSwIntegrity" label="소프트웨어 서명 검증 (Code Signing)" checked={formData.hasSwIntegrity} onChange={(v) => handleChange('hasSwIntegrity', v)} />
                </div>
                <SelectField
                    label="키 관리 방식"
                    value={formData.keyMgmt || 'Local_Storage'}
                    onChange={(v) => handleChange('keyMgmt', v)}
                    options={[
                        { value: 'NoKey', label: '키 없음' },
                        { value: 'Local_Storage', label: '로컬 저장' },
                        { value: 'Separated_HSM', label: 'HSM 분리 보관' },
                    ]}
                />
                <SelectField
                    label="가상화 상태"
                    value={formData.virtStatus || 'Physical'}
                    onChange={(v) => handleChange('virtStatus', v)}
                    options={[
                        { value: 'Physical', label: '물리 서버' },
                        { value: 'Virtual_Secured', label: '가상화 (보안적용)' },
                        { value: 'Virtual_Insecure', label: '가상화 (미적용)' },
                    ]}
                />
                <SelectField
                    label="테넌트 격리"
                    value={formData.tenantIsolation || 'Dedicated'}
                    onChange={(v) => handleChange('tenantIsolation', v)}
                    options={[
                        { value: 'Dedicated', label: '전용 (Dedicated)' },
                        { value: 'Shared_Logical', label: '공유 - 논리적 분리' },
                        { value: 'Shared_Unsafe', label: '공유 - 미분리' },
                    ]}
                />
                <SelectField
                    label="장애 모드"
                    value={formData.failureMode || 'Fail_Open'}
                    onChange={(v) => handleChange('failureMode', v)}
                    options={[
                        { value: 'Fail_Secure', label: 'Fail-Secure (차단)' },
                        { value: 'Fail_Open', label: 'Fail-Open (허용)' },
                    ]}
                />
                <SelectField
                    label="데이터 휘발성"
                    value={formData.dataVolatility || 'Persistent_Disk'}
                    onChange={(v) => handleChange('dataVolatility', v)}
                    options={[
                        { value: 'Persistent_Disk', label: '영구 저장 (디스크)' },
                        { value: 'Volatile_Memory', label: '휘발성 (RAM)' },
                    ]}
                />
            </Section>

            {/* Section 5: Data Assets */}
            <Section title="데이터 자산" defaultOpen={true}>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">이 시스템에 저장된 데이터</span>
                    <button
                        onClick={addData}
                        className="text-xs bg-indigo-900/20 text-indigo-400 border border-indigo-500/30 px-2 py-1.5 hover:bg-indigo-900/40 font-medium transition-colors"
                    >
                        + 데이터 추가
                    </button>
                </div>

                <div className="space-y-3">
                    {(formData.storedData || []).map((data) => (
                        <div key={data.id} className="bg-slate-900 p-3 border-2 border-slate-700 text-xs shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-indigo-400">Data #{data.id}</span>
                                <button
                                    onClick={() => removeData(data.id)}
                                    className="text-red-400 hover:text-red-300 font-medium"
                                >
                                    삭제
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">등급</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded-none text-xs p-1.5 focus:ring-indigo-500 focus:border-indigo-500 text-white"
                                        value={data.grade}
                                        onChange={(e) => updateData(data.id, 'grade', e.target.value)}
                                    >
                                        <option value="Open">공개</option>
                                        <option value="Sensitive">민감</option>
                                        <option value="Classified">기밀</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">데이터 유형</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded-none text-xs p-1.5 focus:ring-indigo-500 focus:border-indigo-500 text-white"
                                        value={data.dataType || 'GeneralData'}
                                        onChange={(e) => updateData(data.id, 'dataType', e.target.value)}
                                    >
                                        <option value="GeneralData">일반 데이터</option>
                                        <option value="PII">개인정보 (PII)</option>
                                        <option value="AuthCredential">인증정보</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}
                    {(formData.storedData || []).length === 0 && (
                        <div className="text-xs text-slate-500 italic text-center py-4 border border-dashed border-slate-700 rounded-none">
                            저장된 데이터 없음.
                        </div>
                    )}
                </div>
            </Section>
        </>
    );

    // ============================================================
    // EDGE (CONNECTION) PROPERTIES (Sectioned)
    // ============================================================
    const renderEdgeProperties = () => {
        const sourceNode = getNodes().find(n => n.id === selectedElement.source);
        const targetNode = getNodes().find(n => n.id === selectedElement.target);
        const sourceLabel = sourceNode?.data?.label || sourceNode?.id || 'Source';
        const targetLabel = targetNode?.data?.label || targetNode?.id || 'Target';

        return (
            <>
                {/* Section 1: Basic Connection */}
                <Section title="기본 연결" defaultOpen={true}>
                    <SelectField
                        label="프로토콜"
                        value={formData.protocol || 'HTTPS'}
                        onChange={(v) => handleChange('protocol', v)}
                        options={[
                            { value: 'HTTPS', label: 'HTTPS' },
                            { value: 'SSH', label: 'SSH' },
                            { value: 'RDP', label: 'RDP' },
                            { value: 'VPN_Tunnel', label: 'VPN Tunnel' },
                            { value: 'DNS', label: 'DNS' },
                            { value: 'SQL', label: 'SQL' },
                            { value: 'Generic_TCP', label: 'TCP (일반)' },
                            { value: 'ClearText', label: 'ClearText (HTTP/Telnet)' },
                        ]}
                    />
                    <SelectField
                        label="연결 유형"
                        value={formData.connType || 'FileTransfer'}
                        onChange={(v) => handleChange('connType', v)}
                        options={[
                            { value: 'FileTransfer', label: '파일 전송' },
                            { value: 'ScreenView', label: '화면 전송 (원격 접속)' },
                            { value: 'ControlSignal', label: '제어 신호 (API/관리)' },
                        ]}
                    />

                    {/* Direction */}
                    <div>
                        <label className={labelClass}>전송 방식</label>
                        <select
                            className={inputClass}
                            value={formData.isBidirectional !== false ? 'bidirectional' : 'unidirectional'}
                            onChange={(e) => handleChange('isBidirectional', e.target.value === 'bidirectional')}
                        >
                            <option value="bidirectional">양방향 (Bidirectional)</option>
                            <option value="unidirectional">단방향 (Unidirectional)</option>
                        </select>
                    </div>

                    {formData.isBidirectional === false && (
                        <div>
                            <label className="block text-[10px] text-slate-400 mb-1">방향</label>
                            <div className="flex items-center justify-between p-2 bg-slate-900 rounded-none border border-slate-700">
                                <span className="text-xs text-white font-medium truncate max-w-[150px]" title={`${sourceLabel} → ${targetLabel}`}>
                                    {sourceLabel} → {targetLabel}
                                </span>
                                <button
                                    onClick={() => {
                                        const oldEdge = getEdges().find(e => e.id === selectedElement.id);
                                        if (oldEdge) {
                                            const mapToSourceHandle = (handleId) => {
                                                if (!handleId) return 'right-source';
                                                if (handleId.includes('-target')) return handleId.replace('-target', '-source');
                                                if (handleId.includes('-source')) return handleId;
                                                return `${handleId}-source`;
                                            };
                                            const mapToTargetHandle = (handleId) => {
                                                if (!handleId) return 'left-target';
                                                if (handleId.includes('-source')) return handleId.replace('-source', '-target');
                                                if (handleId.includes('-target')) return handleId;
                                                return `${handleId}-target`;
                                            };
                                            const newEdge = {
                                                ...oldEdge,
                                                id: `e-${Date.now()}`,
                                                source: oldEdge.target,
                                                target: oldEdge.source,
                                                sourceHandle: mapToSourceHandle(oldEdge.targetHandle),
                                                targetHandle: mapToTargetHandle(oldEdge.sourceHandle),
                                                data: { ...oldEdge.data, isBidirectional: false }
                                            };
                                            setEdges((eds) => eds.filter(e => e.id !== oldEdge.id).concat(newEdge));
                                            setSelectedElement(newEdge);
                                        }
                                    }}
                                    className="px-2 py-1 text-xs bg-slate-800 border-2 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white shadow-none flex items-center gap-1 transition-colors"
                                    title="방향 전환"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
                                    교체
                                </button>
                            </div>
                        </div>
                    )}

                    <CheckboxField id="isAdminTraffic" label="관리 트래픽 (Admin)" checked={formData.isAdminTraffic} onChange={(v) => handleChange('isAdminTraffic', v)} />

                    <SelectField
                        label="접근 정책"
                        value={formData.accessPolicy || 'Temporary_Approval'}
                        onChange={(v) => handleChange('accessPolicy', v)}
                        options={[
                            { value: 'Permanent', label: '상시 접근 (Permanent)' },
                            { value: 'Temporary_Approval', label: '승인 후 접근 (Temporary)' },
                        ]}
                    />
                </Section>

                {/* Section 2: Security */}
                <Section title="보안" defaultOpen={true}>
                    <SelectField
                        label="암호화 품질"
                        value={formData.encQuality || (formData.isEncrypted ? 'Validated_Module' : 'NoEncryption')}
                        onChange={(v) => {
                            handleBatchChange({
                                encQuality: v,
                                isEncrypted: v !== 'NoEncryption',
                            });
                        }}
                        options={[
                            { value: 'NoEncryption', label: '암호화 없음' },
                            { value: 'Weak_Algo', label: '취약한 알고리즘' },
                            { value: 'Validated_Module', label: '검증된 모듈 (TLS 등)' },
                            { value: 'Opaque_Traffic', label: '불투명 트래픽' },
                        ]}
                    />
                    <SelectField
                        label="무결성 검증"
                        value={formData.integrityStatus || 'NoIntegrity'}
                        onChange={(v) => handleChange('integrityStatus', v)}
                        options={[
                            { value: 'NoIntegrity', label: '무결성 없음' },
                            { value: 'Hmac_Signed', label: 'HMAC 서명' },
                        ]}
                    />
                    <CheckboxField id="hasMessageEncryption" label="메시지 레벨 암호화" checked={formData.hasMessageEncryption} onChange={(v) => handleChange('hasMessageEncryption', v)} />
                    <CheckboxField id="isPrivateLine" label="전용회선 사용" checked={formData.isPrivateLine} onChange={(v) => handleChange('isPrivateLine', v)} />
                    <SelectField
                        label="격리 방식"
                        value={formData.isolationMethod || 'Direct_Browser'}
                        onChange={(v) => handleChange('isolationMethod', v)}
                        options={[
                            { value: 'Direct_Browser', label: '직접 접속' },
                            { value: 'VDI_RBI_Separation', label: 'VDI/RBI 격리' },
                        ]}
                    />
                </Section>

                {/* Section 3: Inspection / Filters */}
                <Section title="검사 / 필터" defaultOpen={true}>
                    <div className="space-y-1">
                        <CheckboxField id="hasAntiVirus" label="백신 (AntiVirus)" checked={formData.hasAntiVirus} onChange={(v) => handleChange('hasAntiVirus', v)} />
                        <CheckboxField id="hasDLP" label="DLP (정보유출방지)" checked={formData.hasDLP} onChange={(v) => handleChange('hasDLP', v)} />
                        <CheckboxField id="hasCDR" label="CDR (무해화)" checked={formData.hasCDR} onChange={(v) => handleChange('hasCDR', v)} />
                        <CheckboxField id="hasFormatCheck" label="포맷 검사 (FormatCheck)" checked={formData.hasFormatCheck} onChange={(v) => handleChange('hasFormatCheck', v)} />
                        <CheckboxField id="hasAIFilter" label="AI 필터" checked={formData.hasAIFilter} onChange={(v) => handleChange('hasAIFilter', v)} />
                        <CheckboxField id="hasDeIdentification" label="비식별화 (De-Identification)" checked={formData.hasDeIdentification} onChange={(v) => handleChange('hasDeIdentification', v)} />
                    </div>
                </Section>

                {/* Section 4: Advanced */}
                <Section title="고급" defaultOpen={false}>
                    <SelectField
                        label="연결 지속성"
                        value={formData.duration || 'Ephemeral'}
                        onChange={(v) => handleChange('duration', v)}
                        options={[
                            { value: 'Persistent', label: '상시 연결 (Persistent)' },
                            { value: 'Ephemeral', label: '일시 연결 (Ephemeral)' },
                        ]}
                    />
                    <SelectField
                        label="대상 포트 유형"
                        value={formData.targetPortType || 'ServicePort'}
                        onChange={(v) => handleChange('targetPortType', v)}
                        options={[
                            { value: 'ServicePort', label: '서비스 포트' },
                            { value: 'ManagementPort', label: '관리 포트' },
                        ]}
                    />
                </Section>

                {/* Section 5: Data Flow */}
                <Section title="데이터 흐름" defaultOpen={true}>
                    {(() => {
                        const availableData = sourceNode?.data?.storedData || [];

                        let currentCarries = [];
                        if (Array.isArray(formData.carries)) {
                            currentCarries = formData.carries.map(String);
                        } else if (typeof formData.carries === 'string' && formData.carries.trim() !== '') {
                            currentCarries = formData.carries.split(',').map(x => x.trim()).filter(x => x !== '');
                        }

                        const handleAddData = () => {
                            if (availableData.length === 0) return;
                            const firstAvailable = availableData[0].id;
                            handleChange('carries', [...currentCarries, firstAvailable]);
                        };

                        const handleRemoveData = (indexToRemove) => {
                            handleChange('carries', currentCarries.filter((_, idx) => idx !== indexToRemove));
                        };

                        const handleUpdateData = (indexToUpdate, newValue) => {
                            const newCarries = [...currentCarries];
                            newCarries[indexToUpdate] = newValue;
                            handleChange('carries', newCarries);
                        };

                        if (availableData.length === 0) {
                            return (
                                <div className="text-xs text-orange-300 italic bg-slate-900 p-3 border border-dashed border-slate-700 text-center shadow-sm">
                                    소스 노드에 데이터가 없습니다.
                                    <br />"저장된 데이터 자산"에 먼저 추가하세요.
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-2">
                                {currentCarries.map((dataId, idx) => {
                                    const dataItem = availableData.find(d => String(d.id) === String(dataId));
                                    const dataTypeLabel = dataItem?.dataType === 'PII' ? 'PII' : dataItem?.dataType === 'AuthCredential' ? '인증' : '일반';
                                    return (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <select
                                                className="block w-full rounded-none bg-slate-900 border-slate-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-xs border p-1.5"
                                                value={dataId}
                                                onChange={(e) => handleUpdateData(idx, e.target.value)}
                                            >
                                                {availableData.map(d => (
                                                    <option key={d.id} value={d.id}>
                                                        Data #{d.id} ({d.dataType === 'PII' ? 'PII' : d.dataType === 'AuthCredential' ? '인증' : '일반'})
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => handleRemoveData(idx)}
                                                className="text-red-500 hover:text-red-400 p-1.5 hover:bg-red-900/20 transition-colors"
                                                title="Remove"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                        </div>
                                    );
                                })}

                                <button
                                    onClick={handleAddData}
                                    className="w-full py-2 text-xs border border-dashed border-indigo-500/30 text-indigo-400 hover:bg-indigo-900/20 transition-colors flex items-center justify-center gap-1 font-medium"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    데이터 흐름 추가
                                </button>
                            </div>
                        );
                    })()}
                </Section>
            </>
        );
    };

    // ============================================================
    // THREATS TAB (unchanged logic, style fixes only)
    // ============================================================
    const mergeThreatItems = (items) => {
        const merged = [];
        const processedIndices = new Set();

        items.forEach((item, index) => {
            if (processedIndices.has(index)) return;

            const group = {
                primary: item,
                indices: [index],
                allData: item.data ? [item.data] : []
            };

            for (let i = index + 1; i < items.length; i++) {
                if (processedIndices.has(i)) continue;
                const other = items[i];

                const sameSystem = item.system === other.system;
                const sameConnection = item.connection === other.connection;
                const sameRemediation = item.remediation === other.remediation;

                const isMatch = sameRemediation && (
                    (item.system && sameSystem) ||
                    (item.connection && sameConnection)
                );

                if (isMatch) {
                    group.indices.push(i);
                    if (other.data && !group.allData.includes(other.data)) {
                        group.allData.push(other.data);
                    }
                    processedIndices.add(i);
                }
            }

            merged.push(group);
            processedIndices.add(index);
        });
        return merged;
    };

    const mergedTotalCount = useMemo(() => {
        if (!analysisResult || !analysisResult.threats) return 0;
        let count = 0;
        Object.values(analysisResult.threats).forEach(items => {
            count += mergeThreatItems(items).length;
        });
        return count;
    }, [analysisResult]);

    const renderThreatsTab = () => {
        if (!analysisResult) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center">
                    <div className="w-16 h-16 rounded shadow-lg bg-orange-900/10 border-2 border-orange-500/30 flex items-center justify-center mb-4">
                        <Shield size={32} className="text-orange-500" strokeWidth={1.5} />
                    </div>
                    <p className="text-base font-bold text-orange-400 uppercase tracking-widest">분석 결과 없음</p>
                    <p className="text-xs text-slate-400 mt-2 font-mono">
                        상단 '위협 분석' 버튼을<br />클릭하세요.
                    </p>
                </div>
            );
        }

        if (analysisResult.error === 'NO_DIAGRAM') {
            return (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center">
                    <div className="w-16 h-16 rounded shadow-lg bg-orange-900/10 border-2 border-orange-500/30 flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <p className="text-base font-bold text-orange-400 uppercase tracking-widest">다이어그램 없음</p>
                    <p className="text-xs text-slate-400 mt-2 font-mono">분석할 시스템을 추가해주세요.</p>
                </div>
            );
        }

        const threats = analysisResult.threats || {};
        const total_count = analysisResult.total_count !== undefined
            ? analysisResult.total_count
            : Object.values(threats).reduce((acc, items) => acc + items.length, 0);

        const hasViolations = total_count > 0;

        if (!hasViolations) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center">
                    <div className="w-16 h-16 rounded shadow-lg bg-emerald-900/10 border-2 border-emerald-500/30 flex items-center justify-center mb-4">
                        <CheckCircle size={32} className="text-emerald-500" />
                    </div>
                    <p className="text-lg font-bold text-emerald-400 uppercase tracking-widest">안전함 (SECURE)</p>
                    <p className="text-xs text-slate-400 mt-2 font-mono">보안 위협이 발견되지 않았습니다.</p>
                </div>
            );
        }

        const visibleCount = mergedTotalCount;

        const mergedThreats = {};
        Object.entries(threats).forEach(([key, items]) => {
            const merged = mergeThreatItems(items);
            if (merged.length > 0) {
                mergedThreats[key] = merged;
            }
        });

        return (
            <div className="space-y-6 p-2">
                <div className="flex items-center gap-3 mb-4 bg-red-950/40 p-4 border-l-4 border-red-600 shadow-lg">
                    <div className="p-2 bg-red-900/20 rounded">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </div>
                    <div>
                        <span className="block text-xl font-black text-white">{visibleCount}</span>
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">위협 발견됨</span>
                    </div>
                </div>

                {Object.entries(mergedThreats).map(([key, mergedItems]) => {
                    return (
                        <div key={key} className="mb-6">
                            <h4 className="flex items-center gap-2 font-bold text-slate-200 text-sm uppercase tracking-wider mb-2 pb-1 border-b border-slate-700">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-none"></span>
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </h4>

                            <div className="space-y-3">
                                {mergedItems.map((group, idx) => {
                                    const item = group.primary;
                                    const compositeId = `${key}-${group.indices.join(',')}`;
                                    const isSelected = selectedThreatId === compositeId;

                                    let contextLabel = '';
                                    if (item.system) {
                                        contextLabel = `SYS: ${item.system}`;
                                    } else if (item.connection) {
                                        const edge = getEdges().find(e => e.id === item.connection);
                                        if (edge) {
                                            const sNode = getNodes().find(n => n.id === edge.source);
                                            const tNode = getNodes().find(n => n.id === edge.target);
                                            const sLabel = sNode?.data?.label || 'Source';
                                            const tLabel = tNode?.data?.label || 'Target';
                                            contextLabel = `CONN: ${sLabel} → ${tLabel}`;
                                        } else {
                                            contextLabel = 'CONNECTION';
                                        }
                                    }

                                    return (
                                        <div
                                            key={idx}
                                            className={`group relative transition-all duration-200 ease-in-out cursor-pointer hover:bg-slate-800 ${isSelected
                                                ? 'bg-orange-900/10'
                                                : 'bg-transparent'
                                                }`}
                                            onClick={() => onThreatClick && onThreatClick(compositeId)}
                                        >
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${isSelected ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-red-900/40 group-hover:bg-red-500'}`}></div>

                                            <div className="pl-4 pr-2 py-3">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex flex-col">
                                                        <span className={`font-bold text-sm ${isSelected ? 'text-orange-200' : 'text-slate-200'}`}>
                                                            Violation #{idx + 1}
                                                        </span>
                                                        {group.indices.length > 1 && (
                                                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                                * {group.indices.length} merged items
                                                            </span>
                                                        )}
                                                    </div>

                                                    {isSelected && (
                                                        <span className="text-[10px] font-bold text-orange-100 bg-orange-600 px-1.5 py-0.5 shadow-sm">
                                                            SELECTED
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="mb-3">
                                                    <span className="inline-block bg-slate-800 border border-slate-600 text-slate-300 text-[10px] px-2 py-0.5 font-mono uppercase tracking-tight">
                                                        {contextLabel}
                                                    </span>
                                                </div>

                                                <div className={`bg-slate-900/50 p-2 border mb-3 transition-colors ${isSelected ? 'border-orange-500/30' : 'border-slate-700/50 hover:border-slate-600'}`}>
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <div className="p-0.5 bg-emerald-500/20 rounded-full">
                                                            <CheckCircle size={10} className="text-emerald-400" />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Remediation</span>
                                                    </div>
                                                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                                        {item.remediation}
                                                    </p>
                                                </div>

                                                {group.allData && group.allData.length > 0 && (
                                                    <div>
                                                        <div className="flex flex-wrap gap-1.5 items-center">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Assets:</span>
                                                            {group.allData.map((dataId, dIdx) => (
                                                                <span key={dIdx} className="bg-slate-800 text-indigo-300 border border-slate-600 px-1.5 py-0.5 text-[10px] font-mono hover:border-indigo-500 transition-colors">
                                                                    D-{dataId}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <>
            <div className="absolute right-4 top-4 bottom-4 w-80 bg-slate-800 border-2 border-slate-700 flex flex-col transition-all duration-300 z-20 shadow-2xl rugged-box">
                {/* Tabs */}
                <div className="flex border-b-2 border-slate-700 bg-slate-900">
                    <button
                        className={`flex-1 py-3 text-sm font-bold transition-colors uppercase tracking-wider ${activeTab === 'properties' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}
                        onClick={() => setActiveTab('properties')}
                    >
                        속성 (Properties)
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-bold transition-colors uppercase tracking-wider ${activeTab === 'threats' ? 'text-red-400 border-b-2 border-red-500 bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}
                        onClick={() => setActiveTab('threats')}
                    >
                        위협 감지
                        {mergedTotalCount > 0 && (
                            <span className="ml-2 bg-red-900 text-red-200 text-xs px-2 py-0.5 rounded-none border border-red-700">
                                {mergedTotalCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-800">
                    {activeTab === 'properties' ? renderPropertiesTab() : renderThreatsTab()}
                </div>
            </div>
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="요소 삭제 확인"
                message={`선택된 요소가 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`}
            />
        </>
    );

}
