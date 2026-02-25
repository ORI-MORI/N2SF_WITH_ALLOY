const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const isProduction = () => process.env.NODE_ENV === 'production';
const log = (...args) => { if (!isProduction()) console.log(...args); };

function executeAlloy(filePath) {
    return new Promise((resolve) => {
        const cwd = process.cwd();
        const normalizePath = (p) => p.replace(/\\/g, '/');

        const jarPath = normalizePath(path.join(cwd, 'alloy/alloy4.2_2015-02-22.jar'));
        const classpath = `.${path.delimiter}${jarPath}`;
        const runnerJava = normalizePath(path.join(cwd, 'src/AlloyRunner.java'));
        const runnerClass = path.join(cwd, 'src', 'AlloyRunner.class');
        const normalizedFilePath = normalizePath(filePath);
        const xmlPath = filePath.replace('.als', '.xml');

        log(`Alloy Executor: CWD=${cwd}, File=${normalizedFilePath}`);

        // Clean up existing XML file
        if (fs.existsSync(xmlPath)) {
            try { fs.unlinkSync(xmlPath); } catch (err) {
                console.error(`Failed to delete existing XML: ${err.message}`);
            }
        }

        // Step 1: Compile only if .class doesn't exist or is older than .java
        const needsCompile = (() => {
            if (!fs.existsSync(runnerClass)) return true;
            try {
                const javaStat = fs.statSync(runnerJava);
                const classStat = fs.statSync(runnerClass);
                return javaStat.mtimeMs > classStat.mtimeMs;
            } catch {
                return true;
            }
        })();

        const runAlloy = () => {
            const runCmd = `java -cp "src${path.delimiter}${classpath}" AlloyRunner "${normalizedFilePath}"`;
            log(`Executing: ${runCmd}`);

            exec(runCmd, { cwd, maxBuffer: 1024 * 1024 * 10, timeout: 120000 }, (runError, runStdout, runStderr) => {
                if (runError) {
                    console.error(`Alloy execution error: ${runError.message}`);
                    return resolve({ success: false, error: runStderr || runError.message });
                }

                log(`Alloy stdout: ${runStdout}`);

                if (fs.existsSync(xmlPath)) {
                    const xmlContent = fs.readFileSync(xmlPath, 'utf8');
                    const result = parseAlloyXML(xmlContent);

                    if (!isProduction()) {
                        try {
                            fs.writeFileSync('debug_result.json', JSON.stringify(result, null, 2));
                        } catch (e) { /* ignore */ }
                    }

                    resolve({ success: true, result });
                } else {
                    resolve({ success: false, error: "XML output not found after Alloy execution" });
                }
            });
        };

        if (needsCompile) {
            const compileCmd = `javac -cp "${classpath}" "${runnerJava}"`;
            log(`Compiling AlloyRunner: ${compileCmd}`);

            exec(compileCmd, { cwd, maxBuffer: 1024 * 1024 * 10 }, (compileError, _stdout, compileStderr) => {
                if (compileError) {
                    console.error(`Compilation error: ${compileError.message}`);
                    return resolve({ success: false, error: compileStderr || compileError.message });
                }
                runAlloy();
            });
        } else {
            log("AlloyRunner.class is up-to-date, skipping compilation.");
            runAlloy();
        }
    });
}

/**
 * Clean up temporary files generated for a specific analysis request.
 * Call this after results have been sent to the client.
 */
function cleanupTempFiles(alsFilePath) {
    const xmlPath = alsFilePath.replace('.als', '.xml');
    const filesToClean = [alsFilePath, xmlPath];

    filesToClean.forEach(f => {
        try {
            if (fs.existsSync(f)) {
                fs.unlinkSync(f);
                log(`Cleaned up: ${f}`);
            }
        } catch (err) {
            console.warn(`Failed to clean up ${f}: ${err.message}`);
        }
    });

    // Also clean SAT solver temp files in alloy directory
    const alloyDir = path.join(process.cwd(), 'alloy');
    try {
        if (!fs.existsSync(alloyDir)) return;
        const files = fs.readdirSync(alloyDir);
        files.forEach(file => {
            if (file.startsWith('tmp') || file.endsWith('.cnf') || file.endsWith('.tmp')) {
                try {
                    fs.unlinkSync(path.join(alloyDir, file));
                } catch (e) { /* ignore */ }
            }
        });
    } catch (err) { /* ignore */ }
}

function parseAlloyXML(xml) {
    const threats = {};
    let total_count = 0;

    const cleanLabel = (l) => {
        if (!l) return '';
        const parts = l.split('/');
        let lastPart = parts[parts.length - 1];
        lastPart = lastPart.split('$')[0];

        if (lastPart.startsWith('System') && lastPart.length > 6) return lastPart.substring(6);
        if (lastPart.startsWith('Location') && lastPart.length > 8) return lastPart.substring(8);
        if (lastPart.startsWith('Connection') && lastPart.length > 10) return lastPart.substring(10);
        if (lastPart.startsWith('Data') && lastPart.length > 4) return lastPart.substring(4);
        if (lastPart.startsWith('Zone') && lastPart.length > 4) return lastPart.substring(4);

        return lastPart;
    };

    // Initialize all threat categories
    const engines = [
        'FindSplitTunneling', 'FindDirectConnection', 'FindFlowViolations',
        'FindStorageViolations', 'FindWeakCrypto', 'FindIntegrityLoss', 'FindInsecureKey',
        'FindWeakAuth', 'FindWeakUserAuth', 'FindExposedAdmin', 'FindPermanentAdmin',
        'FindShadowIT', 'FindIntegrityFailure', 'FindUnpatchedExposure', 'FindEOL', 'FindUncertifiedGear',
        'FindWirelessThreat', 'FindPortRisk', 'FindMobileRisk',
        'FindMissingCDR', 'FindFormatRisk', 'FindDLPFailure', 'FindAIFilterFailure', 'FindPIILeakage', 'FindBrowserIsolation', 'FindVirtRisk',
        'FindAuditFailure', 'FindTimeSyncFailure', 'FindHardeningFailure', 'FindRedundancyFailure', 'FindFailOpenRisk', 'FindDDoSRisk', 'FindWeakSession', 'FindPersistentRisk', 'FindResidualData', 'FindDNSViolation', 'FindDevProdViolation', 'FindOpaqueTraffic',
        'FindTransitiveLeaks', 'FindBypass',
        'FindVPNBypass', 'FindOutboundThreat', 'FindCDSBypass', 'FindWeakWireless', 'FindExcessiveEndpoints', 'FindCredentialExposure',
        'FindClassifiedInternet', 'FindInternalExposure', 'FindRogueWireless', 'FindMissingAntiVirus', 'FindUnencryptedAdmin', 'FindUnregisteredCDSAccess',
        'FindZoneGradeMismatch', 'FindClassifiedCloud', 'FindIoTDataRisk',
        'FindUnencryptedStorage', 'FindBluetoothRisk', 'FindNoMessageEncryption', 'FindNoPrivateLine'
    ];
    engines.forEach(key => threats[key] = []);

    // Threat configuration
    const threatConfig = {
        'FindSplitTunneling': { msg: "[N2SF-EB-4] 망 분리 위반: 업무망 단말이 인터넷망과 동시에 연결되어 있습니다. 망 분리 기술을 적용하십시오.", type: 'System' },
        'FindDirectConnection': { msg: "[N2SF-EB-5] 망 간 직접 연결: 이종 보안 구역 간에는 반드시 Gateway/CDS를 경유해야 합니다.", type: 'Connection' },
        'FindFlowViolations': { msg: "[N2SF-IF-5] 정보 흐름 위반: 하위 등급으로 데이터 전송 시 적절한 망연계(CDS) 장비를 경유해야 합니다.", type: 'ConnectionData' },
        'FindStorageViolations': { msg: "[N2SF-DU-1] 저장 위반: 시스템이 취급 인가 등급보다 높은 데이터를 저장하고 있습니다.", type: 'SystemData' },
        'FindWeakCrypto': { msg: "[N2SF-EA-1] 암호화 품질 미비: 외부/무선 구간 전송 시 검증필 암호 모듈을 사용해야 합니다.", type: 'Connection' },
        'FindIntegrityLoss': { msg: "[N2SF-DT-6] 전송 무결성 미비: 중요 정보 전송 시 위변조 방지(HMAC 등) 조치가 필요합니다.", type: 'Connection' },
        'FindInsecureKey': { msg: "[N2SF-EK-3] 키 관리 위반: 암호 키는 HSM 등 안전한 별도 저장소에 보관해야 합니다.", type: 'System' },
        'FindWeakAuth': { msg: "[N2SF-MA-1] 관리자 인증 미비: 관리자 계정에 다중요소 인증(MFA)을 적용하십시오.", type: 'System' },
        'FindWeakUserAuth': { msg: "[N2SF-MA-2] 사용자 인증 미비: 비인가 경로에서 중요 시스템 접속 시 MFA가 필요합니다.", type: 'Connection' },
        'FindExposedAdmin': { msg: "[N2SF-EB-8] 관리 포트 노출: 관리 트래픽은 관리망 또는 전용 단말에서만 허용되어야 합니다.", type: 'Connection' },
        'FindPermanentAdmin': { msg: "[N2SF-LP-4] 상시 원격 관리: 외부 원격 관리는 한시적 허용 정책을 적용해야 합니다.", type: 'Connection' },
        'FindShadowIT': { msg: "[N2SF-DV-M1] 미등록 자산: 보안 관리 대장에 등록되지 않은 자산이 연결되었습니다.", type: 'System' },
        'FindIntegrityFailure': { msg: "[N2SF-DV-1] 시스템 무결성: 중요 시스템은 TPM 및 SW 서명 검증 등 무결성 확보가 필요합니다.", type: 'System' },
        'FindUnpatchedExposure': { msg: "[N2SF-IN-1] 취약점 노출: 외부 접점에 패치되지 않은 취약한 시스템이 존재합니다.", type: 'System' },
        'FindEOL': { msg: "[N2SF-IN-9] EOL 자산: 기술 지원이 종료된 자산(EOL)을 중요 시스템으로 사용 중입니다.", type: 'System' },
        'FindUncertifiedGear': { msg: "[N2SF-EA-1] 미인증 보안 제품: 보안 기능이 있는 장비는 검증필 암호모듈 등 적합성 검증을 받아야 합니다.", type: 'System' },
        'FindWirelessThreat': { msg: "[N2SF-WA-2] 무선 보안 미비: 무선망 사용 시 WIPS(무선침입방지) 등을 적용해야 합니다.", type: 'System' },
        'FindPortRisk': { msg: "[N2SF-DV-3] 물리 포트 미통제: 중요 정보를 다루는 단말은 물리적 포트(USB 등) 통제가 필요합니다.", type: 'System' },
        'FindMobileRisk': { msg: "[N2SF-MD-5] 모바일 보안 미비: 중요 정보를 다루는 모바일 기기는 컨테이너 기술 등을 적용해야 합니다.", type: 'System' },
        'FindMissingCDR': { msg: "[N2SF-CD-6] CDR 미적용: 망 간 파일 전송 시 악성코드 무해화(CDR) 솔루션을 적용하십시오.", type: 'Connection' },
        'FindFormatRisk': { msg: "[N2SF-CD-7] 포맷 검증 미비: 파일 전송 시 알려진 포맷인지 검증해야 합니다.", type: 'Connection' },
        'FindDLPFailure': { msg: "[N2SF-IF-6] DLP 미적용: 외부로 나가는 중요 정보에 대해 유출 방지(DLP) 솔루션이 필요합니다.", type: 'Connection' },
        'FindAIFilterFailure': { msg: "[N2SF-IF-6] AI 필터링 미비: AI/클라우드 서비스 이용 시 개인/민감 정보 입력 방지 필터가 필요합니다.", type: 'Connection' },
        'FindPIILeakage': { msg: "[N2SF-EB-M1] 개인정보 유출: 개인정보(PII) 등은 비식별화 조치 후 클라우드로 전송해야 합니다.", type: 'Connection' },
        'FindBrowserIsolation': { msg: "[N2SF-EB-5] 브라우저 격리 미비: 민감 업무 단말에서의 인터넷 접속은 VDI/RBI 등 통신 경유 강제화가 필요합니다.", type: 'Connection' },
        'FindVirtRisk': { msg: "[N2SF-IS-5] 가상화 격리 미비: 클라우드/가상환경에서 테넌트 간 분리 및 하이퍼바이저 보안이 미흡합니다.", type: 'System' },
        'FindAuditFailure': { msg: "[N2SF-AC-M2] 감사 로그 미비: 중요 시스템의 감사 로그 기록 설정이 비활성화되어 있습니다.", type: 'System' },
        'FindTimeSyncFailure': { msg: "[N2SF-IF-M2] 시각 동기화 미비: 로그의 신뢰성을 위해 안전한 시각 동기화(NTP)가 필요합니다.", type: 'System' },
        'FindHardeningFailure': { msg: "[N2SF-AM-4] 보안 설정 미흡: 기본 패스워드 제거 등 OS Hardening 조치가 안 되어 있습니다.", type: 'System' },
        'FindRedundancyFailure': { msg: "[N2SF-IF-12] 이중화 미비: 가용성이 중요한 관문 장비는 이중화(HA) 구성이 필수입니다.", type: 'System' },
        'FindFailOpenRisk': { msg: "[N2SF-EB-11] Fail-Open 위험: 중요 보안 장비는 장애 시 차단(Fail-Secure) 모드로 동작해야 합니다.", type: 'System' },
        'FindDDoSRisk': { msg: "[N2SF-EB-11] DDoS 대응 미비: 인터넷 접점에는 DDoS 방어 장비 등 경계 보호 기능 유지가 필요합니다.", type: 'System' },
        'FindWeakSession': { msg: "[N2SF-SN-3] 세션 설정 미흡: 타임아웃 및 동시 접속 제한 등 세션 통제 정책을 강화하십시오.", type: 'System' },
        'FindPersistentRisk': { msg: "[N2SF-IN-14] 불필요한 지속 연결: 관리자/외부 연결 세션은 업무 종료 시 즉시 해제되어야 합니다.", type: 'Connection' },
        'FindResidualData': { msg: "[N2SF-IN-13] 잔존 데이터: 중요/공용 단말은 사용 후 데이터 완전 소거(Volatility) 대책이 필요합니다.", type: 'System' },
        'FindDNSViolation': { msg: "[N2SF-EB-14] 비인가 DNS: 내부망에서는 인가된 내부 DNS만 사용해야 합니다.", type: 'Connection' },
        'FindDevProdViolation': { msg: "[N2SF-SG-5] 개발/운영 혼재: 개발계와 운영계는 물리적/논리적으로 완전히 분리되어야 합니다.", type: 'System' },
        'FindOpaqueTraffic': { msg: "[N2SF-IF-2] 불투명 트래픽: 암호화된 트래픽의 내부를 검사할 수 있는 가시성(SSL Decryption 등) 확보가 필요합니다.", type: 'Connection' },
        'FindTransitiveLeaks': { msg: "[N2SF-IF-7] 전이적 데이터 유출: 다단계 경로를 통해 낮은 등급의 시스템으로 데이터가 흘러갈 수 있습니다.", type: 'SystemData' },
        'FindBypass': { msg: "[N2SF-EB-3] 보안 검사 미경유: 외부에서 내부로 보안 검사 없이 직접 연결되는 경로가 존재합니다.", type: 'Connection' },
        'FindVPNBypass': { msg: "[N2SF-EB-15] VPN 우회 통신: 내부망에서 비인가 VPN 터널을 통해 외부로 직접 연결하는 경로가 탐지되었습니다.", type: 'Connection' },
        'FindOutboundThreat': { msg: "[N2SF-EB-6] 비인가 아웃바운드: 내부에서 외부로 평문(ClearText) 프로토콜을 사용하는 비인가 통신이 탐지되었습니다.", type: 'Connection' },
        'FindCDSBypass': { msg: "[N2SF-CD-9] CDS 우회: 등급이 다른 보안도메인 간 CDS를 경유하지 않는 파일 전송 경로가 존재합니다.", type: 'Connection' },
        'FindWeakWireless': { msg: "[N2SF-WA-1] 무선 구간 암호화 미비: 무선망 구간에서 암호화 없이 통신하고 있습니다.", type: 'Connection' },
        'FindExcessiveEndpoints': { msg: "[N2SF-EB-1] 외부 접점 과다: 내부 시스템이 다수의 외부 연결 접점을 보유하고 있어 공격 표면이 확대됩니다.", type: 'System' },
        'FindCredentialExposure': { msg: "[N2SF-LI-1] 인증정보 노출: 인증 정보가 암호화되지 않은 채 네트워크를 통해 전송되고 있습니다.", type: 'Connection' },
        'FindClassifiedInternet': { msg: "[N2SF-IF-11] 기밀 시스템 인터넷 연결: 기밀(C)등급 시스템이 인터넷과 연결되어 있습니다. 기밀 시스템은 인터넷과 완전히 격리해야 합니다.", type: 'System' },
        'FindInternalExposure': { msg: "[N2SF-EB-10] 내부 시스템 외부 노출: 내부망 시스템이 인터넷에서 직접 접근 가능합니다. 내부 구성요소가 외부에 노출되지 않도록 차단하십시오.", type: 'System' },
        'FindRogueWireless': { msg: "[N2SF-WA-4] 비인가 무선장비: 보안구역(업무망/관리망) 내 중요 시스템에 무선 인터페이스가 활성화되어 있습니다. 비인가 무선장비를 차단하십시오.", type: 'System' },
        'FindMissingAntiVirus': { msg: "[N2SF-IN-16] 악성코드 검사 미적용: 외부에서 내부로 유입되는 연결에 악성코드 탐지(AntiVirus) 검사가 적용되지 않았습니다.", type: 'Connection' },
        'FindUnencryptedAdmin': { msg: "[N2SF-RA-2] 원격 관리 세션 미암호화: 외부에서의 원격 관리 접속이 암호화되지 않아 관리 정보가 노출될 수 있습니다.", type: 'Connection' },
        'FindUnregisteredCDSAccess': { msg: "[N2SF-CD-12] CDS 접근 단말 미등록: 자산 대장에 등록되지 않은 단말이 CDS(망연계) 장비에 접속하고 있습니다.", type: 'Connection' },
        'FindZoneGradeMismatch': { msg: "[N2SF-IF-14] 구역 등급 부적합: 시스템의 보안등급이 배치된 구역의 등급보다 높습니다. 보안등급 기반 흐름 통제에 따라 적절한 구역에 배치하십시오.", type: 'System' },
        'FindClassifiedCloud': { msg: "[N2SF-IF-11] 기밀 자산 클라우드 배치: 기밀(C)등급 시스템 또는 기밀 데이터가 클라우드에 위치합니다. 기밀 자산은 클라우드에 배치할 수 없습니다.", type: 'System' },
        'FindIoTDataRisk': { msg: "[N2SF-DV-5] IoT 중요 데이터 보유: 보안 기능이 제한적인 IoT 장비에 민감/기밀 데이터가 저장되어 있습니다. IoT 장비에서 중요 데이터를 분리하십시오.", type: 'System' },
        'FindUnencryptedStorage': { msg: "[N2SF-DU-2] 저장 암호화 미적용: 민감/기밀 데이터를 보유한 시스템에 저장 암호화가 적용되지 않았습니다. 데이터 암호화 기술을 적용하여 기밀성을 보장하십시오.", type: 'System' },
        'FindBluetoothRisk': { msg: "[N2SF-BC-1] 블루투스 통신 위험: 보안구역 내 중요 시스템에 블루투스 인터페이스가 활성화되어 있습니다. 블루투스 데이터 통신을 차단하십시오.", type: 'System' },
        'FindNoMessageEncryption': { msg: "[N2SF-DT-4] 메시지 암호화 미적용: 민감/기밀 데이터 전송 시 메시지(페이로드) 자체 암호화가 적용되지 않았습니다. 전송 구간 암호화 외에 메시지 레벨 암호화를 적용하십시오.", type: 'Connection' },
        'FindNoPrivateLine': { msg: "[N2SF-IF-15] 전용회선 미사용: 기밀(C)등급 데이터가 전용회선 없이 서로 다른 보안구역 간 전송되고 있습니다. 전용 통신망(전용회선, 가상사설망 등)을 구성하십시오.", type: 'Connection' }
    };

    if (!isProduction()) {
        try {
            fs.writeFileSync('debug_last_run.xml', xml);
        } catch (err) { /* ignore */ }
    }

    log(`XML Content Length: ${xml.length}`);

    const fieldRegex = /<field label="([^"]+)"[^>]*>([\s\S]*?)<\/field>/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(xml)) !== null) {
        const fieldName = fieldMatch[1];
        const content = fieldMatch[2];

        if (threatConfig[fieldName]) {
            const config = threatConfig[fieldName];
            const tupleRegex = /<tuple>([\s\S]*?)<\/tuple>/g;
            let tupleMatch;

            while ((tupleMatch = tupleRegex.exec(content)) !== null) {
                const tupleContent = tupleMatch[1];
                const atomRegex = /<atom label="([^"]+)"/g;
                const atoms = [];
                let am;
                while ((am = atomRegex.exec(tupleContent)) !== null) {
                    atoms.push(cleanLabel(am[1]));
                }

                // atoms[0] is usually AnalysisResult$0, data starts from atoms[1]
                if (!atoms || atoms.length < 2) continue;

                if (config.type === 'System') {
                    threats[fieldName].push({ system: atoms[1], remediation: config.msg });
                    total_count++;
                } else if (config.type === 'Connection') {
                    threats[fieldName].push({ connection: atoms[1], remediation: config.msg });
                    total_count++;
                } else if (config.type === 'SystemData') {
                    threats[fieldName].push({ system: atoms[1], data: atoms[2], remediation: config.msg });
                    total_count++;
                } else if (config.type === 'ConnectionData') {
                    threats[fieldName].push({ connection: atoms[1], data: atoms[2], remediation: config.msg });
                    total_count++;
                }
            }
        }
    }

    // Deduplicate bidirectional connection threats (_return duplicates)
    Object.keys(threats).forEach(key => {
        if (threats[key].length > 0) {
            const seen = new Set();
            const deduped = [];
            threats[key].forEach(t => {
                const connId = t.connection || '';
                const sysId = t.system || '';
                const dataId = t.data || '';
                // For connections: treat "edge_0" and "edge_0_return" as the same
                const baseConn = connId.replace(/_return$/, '');
                const dedupKey = `${baseConn}|${sysId}|${dataId}`;
                if (!seen.has(dedupKey)) {
                    seen.add(dedupKey);
                    // Normalize connection ID to base (remove _return suffix)
                    if (t.connection) {
                        t.connection = baseConn;
                    }
                    deduped.push(t);
                }
            });
            threats[key] = deduped;
        }
    });

    // Recalculate total after dedup
    total_count = Object.values(threats).reduce((sum, arr) => sum + arr.length, 0);

    log(`Parsed Threats: ${total_count} total (after dedup)`);
    return { threats, total_count };
}

module.exports = { executeAlloy, cleanupTempFiles };
