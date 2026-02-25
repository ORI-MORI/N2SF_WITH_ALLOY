/**
 * Simple Property Validator (Group B Logic)
 * Performs fast checks for attributes that don't require Alloy's SAT solver.
 */

// Threat Messages Configuration (Copied from alloyExecutor.js for consistency)
const THREAT_MSGS = {
    'FindUnpatchedExposure': "[N2SF-IN-1] 취약점 노출: 외부 접점에 패치되지 않은 취약한 시스템이 존재합니다.",
    'FindEOL': "[N2SF-IN-9] EOL 자산: 기술 지원이 종료된 자산(EOL)을 중요 시스템으로 사용 중입니다.",
    'FindAuditFailure': "[N2SF-AC-M2] 감사 로그 미비: 중요 시스템의 감사 로그 기록 설정이 비활성화되어 있습니다.",
    'FindTimeSyncFailure': "[N2SF-IF-M2] 시각 동기화 미비: 로그의 신뢰성을 위해 안전한 시각 동기화(NTP)가 필요합니다.",
    'FindWeakSession': "[N2SF-SN-3] 세션 설정 미흡: 타임아웃 및 동시 접속 제한 등 세션 통제 정책을 강화하십시오.",
    'FindShadowIT': "[N2SF-DV-M1] 미등록 자산: 보안 관리 대장에 등록되지 않은 자산이 연결되었습니다."
};

const log = (...args) => { if (process.env.NODE_ENV !== 'production') console.log(...args); };

/**
 * Validate Common Properties
 * @param {Object} data - The full graph JSON data
 * @returns {Object} - threats object { threatKey: [ { system: "SystemX", remediation: "..." } ] }
 */
function validateCommonProperties(data) {
    const threats = {
        'FindUnpatchedExposure': [],
        'FindEOL': [],
        'FindAuditFailure': [],
        'FindTimeSyncFailure': [],
        'FindWeakSession': [],
        'FindShadowIT': []
    };

    let total_count = 0;

    if (!data.systems) return { threats, total_count };

    // Helper to find zone type
    const getZoneType = (locId) => {
        if (!data.locations) return 'Unknown';
        const loc = data.locations.find(l => l.id == locId);
        return loc ? loc.type : 'Unknown';
    };

    data.systems.forEach(sys => {
        const sysLabel = `System${sys.id}`; // Matches Alloy Atom Name
        const zoneType = getZoneType(sys.location || sys.loc);
        const patchStatus = sys.patch_status || sys.patchStatus || 'UpToDate';

        log(`[JSValidator] Checking ${sysLabel}: Zone=${zoneType}, Patch=${patchStatus}, Grade=${sys.grade}`);

        // 1. FindUnpatchedExposure (Patch Status)
        // Rule: patchStatus == Vulnerable AND Zone in [Internet, DMZ, Cloud]
        const isExternal = ['Internet', 'DMZ', 'Cloud'].includes(zoneType);

        if (patchStatus === 'Vulnerable' && isExternal) {
            threats['FindUnpatchedExposure'].push({
                system: sysLabel,
                remediation: THREAT_MSGS['FindUnpatchedExposure']
            });
            total_count++;
        }

        // 2. FindEOL (LifeCycle)
        // Rule: grade in [Sensitive, Classified] AND lifeCycle == EOL
        const grade = sys.grade || 'Open';
        const isCritical = ['Sensitive', 'Classified'].includes(grade);
        const lifeCycle = sys.eol_status || sys.lifeCycle || 'Active';

        if (isCritical && lifeCycle === 'EOL') {
            threats['FindEOL'].push({
                system: sysLabel,
                remediation: THREAT_MSGS['FindEOL']
            });
            total_count++;
        }

        // 3. FindAuditFailure (Audit Logging)
        // Rule: grade in [Sensitive, Classified] AND hasAuditLogging == 0 (false)
        const hasAudit = sys.audit_log || sys.hasAuditLogging || false;
        if (isCritical && !hasAudit) {
            threats['FindAuditFailure'].push({
                system: sysLabel,
                remediation: THREAT_MSGS['FindAuditFailure']
            });
            total_count++;
        }

        // 4. FindTimeSyncFailure (Time Sync)
        // Rule: hasAuditLogging == 1 AND hasSecureClock == 0
        const hasClock = sys.ntp_sync || sys.hasSecureClock || false;
        if (hasAudit && !hasClock) {
            threats['FindTimeSyncFailure'].push({
                system: sysLabel,
                remediation: THREAT_MSGS['FindTimeSyncFailure']
            });
            total_count++;
        }

        // 5. FindWeakSession (Session Policy)
        // Rule: grade in [Sensitive, Classified] AND sessionPolicy != Strict
        const sessionPolicy = sys.session_policy || sys.sessionPolicy || 'Unsafe';
        if (isCritical && sessionPolicy !== 'Strict_Timeout_Concurrency') {
            threats['FindWeakSession'].push({
                system: sysLabel,
                remediation: THREAT_MSGS['FindWeakSession']
            });
            total_count++;
        }

        // 6. FindShadowIT (Registration)
        // Rule: isRegistered == false AND in a zone (has location)
        // Default isRegistered is true if undefined? Alloy generator defaults:
        // const isRegistered = (sys.is_registered ... : true)) ? '1' : '0';
        // Let's match Alloy default: default is true.
        const isReg = (sys.is_registered !== undefined) ? sys.is_registered :
            (sys.isRegistered !== undefined) ? sys.isRegistered : true;

        if (!isReg && (sys.location || sys.loc)) {
            threats['FindShadowIT'].push({
                system: sysLabel,
                remediation: THREAT_MSGS['FindShadowIT']
            });
            total_count++;
        }
    });

    return { threats, total_count };
}

module.exports = { validateCommonProperties };
