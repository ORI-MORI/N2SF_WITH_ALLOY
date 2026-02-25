const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * [Implementation Principles]
 * 1. Enum Mapping: JSON strings must map to Alloy Enum Atoms exactly as defined in n2sf_base.als.
 * 2. Set Operations: Arrays must be joined with '+' or become 'none' if empty.
 * 3. Boolean Conversion: JSON true/false -> Alloy Int 1/0.
 * 4. Injection Prevention: All enum values are validated against whitelists before insertion.
 * 5. Concurrency Safety: Each request generates a uniquely-named file to prevent race conditions.
 */

// ============================================================
// Enum Whitelists (must match n2sf_base.als exactly)
// ============================================================
const ENUMS = {
    Grade: ['Open', 'Sensitive', 'Classified'],
    ZoneType: ['Internet', 'Intranet', 'DMZ', 'Cloud', 'PPP', 'Wireless', 'ManagementZone', 'DevTestZone'],
    ZoneProtection: ['NoProtection', 'WIPS_Active'],
    DeviceType: ['Generic_PC', 'Server', 'Mobile', 'IoT', 'SecurityGear', 'DNS_Server', 'Gateway'],
    ServiceModel: ['OnPremise', 'IaaS', 'PaaS', 'SaaS'],
    LifecycleStatus: ['Active', 'EOL'],
    PatchStatus: ['UpToDate', 'Vulnerable'],
    Volatility: ['Volatile_Memory', 'Persistent_Disk'],
    CDSType: ['NotCDS', 'OneWay_Out', 'OneWay_In', 'TwoWay_Relay', 'Access_CDS', 'MLS_CDS'],
    KeyMgmtType: ['NoKey', 'Local_Storage', 'Separated_HSM'],
    AuthType: ['Single_Factor', 'Multi_Factor'],
    VirtualizationType: ['Physical', 'Virtual_Secured', 'Virtual_Insecure'],
    TenantIsolation: ['Dedicated', 'Shared_Logical', 'Shared_Unsafe'],
    ConnectionType: ['FileTransfer', 'ScreenView', 'ControlSignal'],
    EncryptionQuality: ['NoEncryption', 'Weak_Algo', 'Validated_Module', 'Opaque_Traffic'],
    IntegrityStatus: ['NoIntegrity', 'Hmac_Signed'],
    ConnectionDuration: ['Persistent', 'Ephemeral'],
    Protocol: ['Generic_TCP', 'DNS', 'SSH', 'RDP', 'HTTPS', 'VPN_Tunnel', 'ClearText', 'SQL'],
    AccessPolicy: ['Permanent', 'Temporary_Approval'],
    IsolationMethod: ['Direct_Browser', 'VDI_RBI_Separation'],
    PortType: ['ServicePort', 'ManagementPort'],
    SessionConfig: ['Unsafe', 'Timeout_Only', 'Strict_Timeout_Concurrency'],
    FailureMode: ['Fail_Secure', 'Fail_Open'],
    DataType: ['GeneralData', 'PII', 'AuthCredential'],
};

// ============================================================
// Frontend type → Alloy DeviceType mapping
// ============================================================
const DEVICE_TYPE_MAP = {
    'Terminal': 'Generic_PC',
    'Generic_PC': 'Generic_PC',
    'Server': 'Server',
    'Mobile': 'Mobile',
    'SecurityDevice': 'SecurityGear',
    'SecurityGear': 'SecurityGear',
    'NetworkDevice': 'Gateway',
    'Gateway': 'Gateway',
    'WirelessAP': 'IoT',
    'IoT': 'IoT',
    'SaaS': 'Server',
    'DNS_Server': 'DNS_Server',
};

// Frontend connType → Alloy ConnectionType mapping
const CONN_TYPE_MAP = {
    'FileTransfer': 'FileTransfer',
    'ScreenView': 'ScreenView',
    'ControlSignal': 'ControlSignal',
    'RemoteAccess': 'ScreenView',
    'WebBrowsing': 'ScreenView',
    'DatabaseQuery': 'ControlSignal',
    'AdminSession': 'ControlSignal',
    'DNSQuery': 'ControlSignal',
    'APICall': 'ControlSignal',
};

// Frontend encryption → Alloy EncryptionQuality mapping
const ENCRYPTION_MAP = {
    'NoEncryption': 'NoEncryption',
    'Weak_Algo': 'Weak_Algo',
    'Validated_Module': 'Validated_Module',
    'Opaque_Traffic': 'Opaque_Traffic',
    'SSL_TLS': 'Validated_Module',
    'None': 'NoEncryption',
};

// Frontend isolation → Alloy IsolationMethod mapping
const ISOLATION_MAP = {
    'Direct_Browser': 'Direct_Browser',
    'VDI_RBI_Separation': 'VDI_RBI_Separation',
    'VDI_Session': 'VDI_RBI_Separation',
    'RBI_Container': 'VDI_RBI_Separation',
    'VDI': 'VDI_RBI_Separation',
    'RBI': 'VDI_RBI_Separation',
    'None': 'Direct_Browser',
};

// Frontend accessPolicy → Alloy AccessPolicy mapping
const ACCESS_POLICY_MAP = {
    'Permanent': 'Permanent',
    'Temporary_Approval': 'Temporary_Approval',
    'Always_On': 'Permanent',
    'MFA_Gated': 'Temporary_Approval',
};

// ============================================================
// Helpers
// ============================================================

/** Validate value against an enum whitelist, returning default if invalid */
const validateEnum = (value, enumName, defaultValue) => {
    const valid = ENUMS[enumName];
    if (!valid) throw new Error(`Unknown enum: ${enumName}`);
    if (valid.includes(value)) return value;
    return defaultValue;
};

/** Map value through a lookup table, with fallback */
const mapValue = (value, map, fallback) => {
    if (!value) return fallback;
    return map[value] || fallback;
};

/** Format boolean to Alloy Int (1 or 0) */
const formatBoolean = (val) => val ? '1' : '0';

/** Format an array of IDs as Alloy set expression */
const formatList = (list, prefix = '') => {
    if (!list || list.length === 0) return 'none';
    if (typeof list[0] === 'number' || typeof list[0] === 'string') {
        return list.map(id => prefix + id).join(' + ');
    }
    return 'none';
};

/** Sanitize an ID to contain only alphanumeric and underscore */
const sanitizeId = (id) => {
    if (!id) return 'unknown';
    return id.toString().replace(/[^a-zA-Z0-9_]/g, '_');
};

// ============================================================
// Main Generator (async for non-blocking operation)
// ============================================================
const generateAlloyFile = async (jsonData) => {
    const logger = process.env.NODE_ENV === 'production' ? { log: () => {}, warn: console.warn, error: console.error } : console;
    logger.log("Starting generateAlloyFile...");

    // Directory Configuration
    const alloyDir = path.join(__dirname, '..', 'alloy');
    const templatePath = path.join(alloyDir, 'user_instance.als');

    // Unique output file per request (prevents race conditions)
    const requestId = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
    const outputPath = path.join(alloyDir, `user_instance_${requestId}.als`);

    logger.log(`Template: ${templatePath}, Output: ${outputPath}`);

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
    }

    // Read template with async retry
    let als = null;
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            als = fs.readFileSync(templatePath, 'utf8');
            break;
        } catch (err) {
            logger.warn(`Attempt ${attempt + 1}: Error reading template: ${err.message}`);
            if (attempt < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
            }
        }
    }

    if (!als) {
        throw new Error(`Template file unreadable after ${maxAttempts} attempts: ${templatePath}`);
    }

    // Update module name to match unique filename
    als = als.replace('module user_instance', `module user_instance_${requestId}`);

    let zonesCode = "";
    let dataCode = "";
    let systemsCode = "";
    let connectionsCode = "";

    // ============================================================
    // [1. Zone Definitions]
    // ============================================================
    logger.log("Processing Zones...");
    if (jsonData.locations && jsonData.locations.length > 0) {
        jsonData.locations.forEach(loc => {
            const id = sanitizeId(loc.id);
            const grade = validateEnum(loc.grade, 'Grade', 'Open');
            const type = validateEnum(loc.type, 'ZoneType', 'Internet');
            const wips = loc.wips_enabled
                ? validateEnum('WIPS_Active', 'ZoneProtection', 'NoProtection')
                : 'NoProtection';

            zonesCode += `one sig Zone${id} extends Zone {}\n`;
            zonesCode += `fact { Zone${id}.grade = ${grade} and Zone${id}.type = ${type} and Zone${id}.wipsStatus = ${wips} }\n\n`;
        });
    }

    // ============================================================
    // [2. Data Definitions]
    // ============================================================
    logger.log("Processing Data...");
    if (jsonData.data && jsonData.data.length > 0) {
        jsonData.data.forEach(d => {
            const id = sanitizeId(d.id);
            const grade = validateEnum(d.grade, 'Grade', 'Sensitive');
            const dataType = validateEnum(d.dataType, 'DataType', 'GeneralData');

            dataCode += `one sig Data${id} extends Data {}\n`;
            dataCode += `fact { Data${id}.grade = ${grade} and Data${id}.dataType = ${dataType} }\n\n`;
        });
    }

    // ============================================================
    // [3. System Definitions]
    // ============================================================

    // Pre-compute connectedZones: for each system, find all zones reachable via connections
    const systemConnectedZones = {};
    if (jsonData.systems) {
        // Build system→zone map
        const sysZoneMap = {};
        jsonData.systems.forEach(sys => {
            sysZoneMap[sanitizeId(sys.id)] = sanitizeId(sys.location || sys.loc);
        });
        // Initialize with own zone
        jsonData.systems.forEach(sys => {
            const sysId = sanitizeId(sys.id);
            systemConnectedZones[sysId] = new Set([sysZoneMap[sysId]]);
        });
        // Add zones from connected systems
        if (jsonData.connections) {
            jsonData.connections.forEach(conn => {
                const fromId = sanitizeId(conn.from);
                const toId = sanitizeId(conn.to);
                if (systemConnectedZones[fromId] && sysZoneMap[toId]) {
                    systemConnectedZones[fromId].add(sysZoneMap[toId]);
                }
                if (systemConnectedZones[toId] && sysZoneMap[fromId]) {
                    systemConnectedZones[toId].add(sysZoneMap[fromId]);
                }
            });
        }
    }

    logger.log("Processing Systems...");
    if (jsonData.systems && jsonData.systems.length > 0) {
        jsonData.systems.forEach(sys => {
            const id = sanitizeId(sys.id);
            const locId = sanitizeId(sys.location || sys.loc);
            logger.log(`Processing System ${id}: loc=${locId}`);

            // Data stores
            const stores = formatList(sys.stores, 'Data');

            // Enum values (all validated)
            const grade = validateEnum(sys.grade, 'Grade', 'Open');
            const rawDeviceType = sys.deviceType || sys.type || 'Server';
            const deviceType = mapValue(rawDeviceType, DEVICE_TYPE_MAP, 'Server');
            const serviceModel = validateEnum(sys.serviceModel, 'ServiceModel', rawDeviceType === 'SaaS' ? 'SaaS' : 'OnPremise');
            const lifeCycle = validateEnum(sys.eol_status || sys.lifeCycle, 'LifecycleStatus', 'Active');
            const patchStatus = validateEnum(sys.patch_status || sys.patchStatus, 'PatchStatus', 'UpToDate');
            const cdsType = validateEnum(sys.cds_type || sys.cdsType || (sys.isCDS ? 'TwoWay_Relay' : 'NotCDS'), 'CDSType', 'NotCDS');
            const authRaw = sys.auth_type || sys.authType || 'Single_Factor';
            const authMechanism = validateEnum(
                authRaw === 'Single' ? 'Single_Factor' : (authRaw === 'Multi' ? 'Multi_Factor' : authRaw),
                'AuthType', 'Single_Factor'
            );
            const keyMgmt = validateEnum(sys.key_storage || sys.keyMgmt, 'KeyMgmtType', 'Local_Storage');
            const virtStatus = validateEnum(sys.virt_status || sys.virtStatus, 'VirtualizationType', 'Physical');
            const tenantIsolation = validateEnum(
                (sys.tenant_isolation || sys.tenantIsolation) === 'None' ? 'Dedicated' : (sys.tenant_isolation || sys.tenantIsolation),
                'TenantIsolation', 'Dedicated'
            );
            const dataVolatility = validateEnum(sys.data_volatility || sys.dataVolatility, 'Volatility', 'Persistent_Disk');
            const failureMode = validateEnum(
                sys.failure_mode || sys.failureMode || (deviceType === 'Gateway' ? 'Fail_Secure' : 'Fail_Open'),
                'FailureMode', 'Fail_Open'
            );
            const sessionPolicy = validateEnum(sys.session_policy || sys.sessionPolicy, 'SessionConfig', 'Unsafe');

            // Boolean/Int conversions
            const isManagementDevice = formatBoolean(sys.is_admin || sys.isManagement);
            const isRegistered = formatBoolean(
                sys.is_registered !== undefined ? sys.is_registered :
                (sys.isRegistered !== undefined ? sys.isRegistered : true)
            );
            const isCertified = formatBoolean(sys.is_certified || sys.isCertified);
            const hasHwIntegrity = formatBoolean(sys.has_tpm || sys.hasHwIntegrity);
            const hasSwIntegrity = formatBoolean(sys.has_os_sign || sys.hasSwIntegrity);
            const hasContainer = formatBoolean(deviceType === 'Mobile' || sys.has_container || sys.hasContainer);
            const hasWirelessInterface = formatBoolean(deviceType === 'Mobile' || rawDeviceType === 'WirelessAP' || sys.has_wifi || sys.hasWirelessInterface);
            const hasPhysicalPortControl = formatBoolean(sys.usb_control || sys.hasPhysicalPortControl);
            const hasAuditLogging = formatBoolean(sys.audit_log || sys.hasAuditLogging);
            const isHardened = formatBoolean(sys.os_hardening || sys.isHardened);
            const isRedundant = formatBoolean(sys.is_ha || sys.isRedundant);
            const hasSecureClock = formatBoolean(sys.ntp_sync || sys.hasSecureClock);
            const hasDDoSProtection = formatBoolean(sys.ddos_agent || sys.hasDDoSProtection);

            systemsCode += `one sig System${id} extends System {}\n`;
            systemsCode += `fact {\n`;
            systemsCode += `    System${id}.grade = ${grade}\n`;
            systemsCode += `    System${id}.stores = ${stores}\n`;
            systemsCode += `    System${id}.supportedGrades = ${grade}\n`;
            systemsCode += `    System${id}.physicalLoc = Zone${locId}\n`;
            // connectedZones: all zones this system can reach via connections
            const zones = systemConnectedZones[id];
            const connZonesExpr = zones && zones.size > 0
                ? Array.from(zones).map(z => `Zone${z}`).join(' + ')
                : `Zone${locId}`;
            systemsCode += `    System${id}.connectedZones = ${connZonesExpr}\n`;

            systemsCode += `    System${id}.deviceType = ${deviceType}\n`;
            systemsCode += `    System${id}.serviceModel = ${serviceModel}\n`;
            systemsCode += `    System${id}.isManagementDevice = ${isManagementDevice}\n`;
            systemsCode += `    System${id}.isRegistered = ${isRegistered}\n`;
            systemsCode += `    System${id}.lifeCycle = ${lifeCycle}\n`;
            systemsCode += `    System${id}.patchStatus = ${patchStatus}\n`;
            systemsCode += `    System${id}.isCertified = ${isCertified}\n`;

            systemsCode += `    System${id}.cdsType = ${cdsType}\n`;
            systemsCode += `    System${id}.hasHwIntegrity = ${hasHwIntegrity}\n`;
            systemsCode += `    System${id}.hasSwIntegrity = ${hasSwIntegrity}\n`;
            systemsCode += `    System${id}.authMechanism = ${authMechanism}\n`;
            systemsCode += `    System${id}.hasContainer = ${hasContainer}\n`;
            systemsCode += `    System${id}.hasWirelessInterface = ${hasWirelessInterface}\n`;
            systemsCode += `    System${id}.hasPhysicalPortControl = ${hasPhysicalPortControl}\n`;
            systemsCode += `    System${id}.keyMgmt = ${keyMgmt}\n`;
            systemsCode += `    System${id}.virtStatus = ${virtStatus}\n`;
            systemsCode += `    System${id}.tenantIsolation = ${tenantIsolation}\n`;

            systemsCode += `    System${id}.dataVolatility = ${dataVolatility}\n`;
            systemsCode += `    System${id}.failureMode = ${failureMode}\n`;
            systemsCode += `    System${id}.hasAuditLogging = ${hasAuditLogging}\n`;
            systemsCode += `    System${id}.isHardened = ${isHardened}\n`;
            systemsCode += `    System${id}.isRedundant = ${isRedundant}\n`;
            systemsCode += `    System${id}.hasSecureClock = ${hasSecureClock}\n`;
            systemsCode += `    System${id}.hasDDoSProtection = ${hasDDoSProtection}\n`;
            systemsCode += `    System${id}.sessionPolicy = ${sessionPolicy}\n`;

            // New C-group attributes
            const hasStorageEncryption = formatBoolean(sys.storage_encryption || sys.hasStorageEncryption);
            const hasBluetoothInterface = formatBoolean(sys.has_bluetooth || sys.hasBluetoothInterface);
            systemsCode += `    System${id}.hasStorageEncryption = ${hasStorageEncryption}\n`;
            systemsCode += `    System${id}.hasBluetoothInterface = ${hasBluetoothInterface}\n`;

            systemsCode += `}\n\n`;
        });
    }

    // ============================================================
    // [4. Connection Definitions]
    // ============================================================
    logger.log("Processing Connections...");
    if (jsonData.connections && jsonData.connections.length > 0) {
        jsonData.connections.forEach((conn, index) => {
            const connId = sanitizeId(conn.id || index);
            const fromId = sanitizeId(conn.from);
            const toId = sanitizeId(conn.to);

            // Data carried
            const carries = formatList(conn.carries, 'Data');

            // Inspection capabilities set
            let inspections = 'none';
            if (conn.inspections && Array.isArray(conn.inspections) && conn.inspections.length > 0) {
                const validInspections = conn.inspections.filter(i =>
                    ['AntiVirus', 'DLP', 'CDR', 'FormatCheck', 'AI_Filter', 'DeIdentification'].includes(i)
                );
                inspections = validInspections.length > 0 ? validInspections.join(' + ') : 'none';
            }

            // Enum values (all validated with correct mappings)
            const connType = mapValue(conn.conn_type || conn.connType, CONN_TYPE_MAP, 'FileTransfer');
            const protocol = validateEnum(conn.protocol, 'Protocol', 'Generic_TCP');

            // Encryption: handle both direct enum and boolean flag
            let encQuality;
            const rawEnc = conn.encryption || conn.encQuality;
            if (rawEnc) {
                encQuality = mapValue(rawEnc, ENCRYPTION_MAP, 'NoEncryption');
            } else {
                encQuality = conn.isEncrypted ? 'Validated_Module' : 'NoEncryption';
            }
            encQuality = validateEnum(encQuality, 'EncryptionQuality', 'NoEncryption');

            const integrityStatus = validateEnum(
                conn.integrity_check || conn.integrityStatus,
                'IntegrityStatus', 'NoIntegrity'
            );
            const duration = validateEnum(conn.duration, 'ConnectionDuration', 'Ephemeral');
            const accessPolicy = mapValue(
                conn.access_policy || conn.accessPolicy,
                ACCESS_POLICY_MAP, 'Temporary_Approval'
            );
            const targetPortType = validateEnum(
                conn.target_port || conn.targetPortType,
                'PortType', 'ServicePort'
            );
            const isolationMethod = mapValue(
                conn.isolation || conn.isolationMethod,
                ISOLATION_MAP, 'Direct_Browser'
            );

            // Boolean/Int conversions
            const isAdminTraffic = formatBoolean(conn.is_admin_traffic || conn.isAdminTraffic);
            const hasContentFilter = formatBoolean(conn.has_dlp || conn.hasDLP);
            const hasCDR = formatBoolean(conn.has_cdr || conn.hasCDR);

            connectionsCode += `one sig Connection${connId} extends Connection {}\n`;
            connectionsCode += `fact {\n`;
            connectionsCode += `    Connection${connId}.from = System${fromId}\n`;
            connectionsCode += `    Connection${connId}.to = System${toId}\n`;
            connectionsCode += `    Connection${connId}.carries = ${carries}\n`;
            connectionsCode += `    Connection${connId}.connType = ${connType}\n`;
            connectionsCode += `    Connection${connId}.protocol = ${protocol}\n`;
            connectionsCode += `    Connection${connId}.encQuality = ${encQuality}\n`;
            connectionsCode += `    Connection${connId}.integrityStatus = ${integrityStatus}\n`;
            connectionsCode += `    Connection${connId}.duration = ${duration}\n`;
            connectionsCode += `    Connection${connId}.accessPolicy = ${accessPolicy}\n`;
            connectionsCode += `    Connection${connId}.targetPortType = ${targetPortType}\n`;
            connectionsCode += `    Connection${connId}.isAdminTraffic = ${isAdminTraffic}\n`;
            connectionsCode += `    Connection${connId}.isolationMethod = ${isolationMethod}\n`;
            connectionsCode += `    Connection${connId}.hasContentFilter = ${hasContentFilter}\n`;
            connectionsCode += `    Connection${connId}.hasCDR = ${hasCDR}\n`;
            connectionsCode += `    Connection${connId}.inspections = ${inspections}\n`;

            // New C-group attributes
            const hasMessageEncryption = formatBoolean(conn.has_msg_encryption || conn.hasMessageEncryption);
            const isPrivateLine = formatBoolean(conn.is_private_line || conn.isPrivateLine);
            connectionsCode += `    Connection${connId}.hasMessageEncryption = ${hasMessageEncryption}\n`;
            connectionsCode += `    Connection${connId}.isPrivateLine = ${isPrivateLine}\n`;

            connectionsCode += `}\n\n`;
        });
    }

    // ============================================================
    // [5. AnalysisResult Definition]
    // ============================================================
    let analysisResultCode = "";
    analysisResultCode += `one sig AnalysisResult {\n`;
    analysisResultCode += `    FindSplitTunneling: set System,\n`;
    analysisResultCode += `    FindDirectConnection: set Connection,\n`;
    analysisResultCode += `    FindFlowViolations: set Connection -> Data,\n`;
    analysisResultCode += `    FindStorageViolations: set System -> Data,\n`;
    analysisResultCode += `    FindWeakCrypto: set Connection,\n`;
    analysisResultCode += `    FindIntegrityLoss: set Connection,\n`;
    analysisResultCode += `    FindInsecureKey: set System,\n`;
    analysisResultCode += `    FindWeakAuth: set System,\n`;
    analysisResultCode += `    FindExposedAdmin: set Connection,\n`;
    analysisResultCode += `    FindPermanentAdmin: set Connection,\n`;
    analysisResultCode += `    FindShadowIT: set System,\n`;
    analysisResultCode += `    FindIntegrityFailure: set System,\n`;
    analysisResultCode += `    FindUnpatchedExposure: set System,\n`;
    analysisResultCode += `    FindEOL: set System,\n`;
    analysisResultCode += `    FindUncertifiedGear: set System,\n`;
    analysisResultCode += `    FindWirelessThreat: set System,\n`;
    analysisResultCode += `    FindPortRisk: set System,\n`;
    analysisResultCode += `    FindMobileRisk: set System,\n`;
    analysisResultCode += `    FindMissingCDR: set Connection,\n`;
    analysisResultCode += `    FindFormatRisk: set Connection,\n`;
    analysisResultCode += `    FindDLPFailure: set Connection,\n`;
    analysisResultCode += `    FindAIFilterFailure: set Connection,\n`;
    analysisResultCode += `    FindPIILeakage: set Connection,\n`;
    analysisResultCode += `    FindBrowserIsolation: set Connection,\n`;
    analysisResultCode += `    FindVirtRisk: set System,\n`;
    analysisResultCode += `    FindAuditFailure: set System,\n`;
    analysisResultCode += `    FindTimeSyncFailure: set System,\n`;
    analysisResultCode += `    FindHardeningFailure: set System,\n`;
    analysisResultCode += `    FindRedundancyFailure: set System,\n`;
    analysisResultCode += `    FindFailOpenRisk: set System,\n`;
    analysisResultCode += `    FindDDoSRisk: set System,\n`;
    analysisResultCode += `    FindWeakSession: set System,\n`;
    analysisResultCode += `    FindPersistentRisk: set Connection,\n`;
    analysisResultCode += `    FindResidualData: set System,\n`;
    analysisResultCode += `    FindDNSViolation: set Connection,\n`;
    analysisResultCode += `    FindDevProdViolation: set System,\n`;
    analysisResultCode += `    FindOpaqueTraffic: set Connection,\n`;
    analysisResultCode += `    FindTransitiveLeaks: set System -> Data,\n`;
    analysisResultCode += `    FindBypass: set Connection,\n`;
    analysisResultCode += `    FindWeakUserAuth: set Connection,\n`;
    analysisResultCode += `    FindVPNBypass: set Connection,\n`;
    analysisResultCode += `    FindOutboundThreat: set Connection,\n`;
    analysisResultCode += `    FindCDSBypass: set Connection,\n`;
    analysisResultCode += `    FindWeakWireless: set Connection,\n`;
    analysisResultCode += `    FindExcessiveEndpoints: set System,\n`;
    analysisResultCode += `    FindCredentialExposure: set Connection,\n`;
    analysisResultCode += `    FindClassifiedInternet: set System,\n`;
    analysisResultCode += `    FindInternalExposure: set System,\n`;
    analysisResultCode += `    FindRogueWireless: set System,\n`;
    analysisResultCode += `    FindMissingAntiVirus: set Connection,\n`;
    analysisResultCode += `    FindUnencryptedAdmin: set Connection,\n`;
    analysisResultCode += `    FindUnregisteredCDSAccess: set Connection,\n`;
    analysisResultCode += `    FindZoneGradeMismatch: set System,\n`;
    analysisResultCode += `    FindClassifiedCloud: set System,\n`;
    analysisResultCode += `    FindIoTDataRisk: set System,\n`;
    analysisResultCode += `    FindUnencryptedStorage: set System,\n`;
    analysisResultCode += `    FindBluetoothRisk: set System,\n`;
    analysisResultCode += `    FindNoMessageEncryption: set Connection,\n`;
    analysisResultCode += `    FindNoPrivateLine: set Connection\n`;
    analysisResultCode += `}\n\n`;

    const ruleNames = [
        'FindSplitTunneling', 'FindDirectConnection', 'FindFlowViolations',
        'FindStorageViolations', 'FindWeakCrypto', 'FindIntegrityLoss', 'FindInsecureKey',
        'FindWeakAuth', 'FindExposedAdmin', 'FindPermanentAdmin',
        'FindShadowIT', 'FindIntegrityFailure', 'FindUnpatchedExposure', 'FindEOL', 'FindUncertifiedGear',
        'FindWirelessThreat', 'FindPortRisk', 'FindMobileRisk',
        'FindMissingCDR', 'FindFormatRisk', 'FindDLPFailure', 'FindAIFilterFailure', 'FindPIILeakage', 'FindBrowserIsolation', 'FindVirtRisk',
        'FindAuditFailure', 'FindTimeSyncFailure', 'FindHardeningFailure', 'FindRedundancyFailure', 'FindFailOpenRisk', 'FindDDoSRisk', 'FindWeakSession', 'FindPersistentRisk', 'FindResidualData', 'FindDNSViolation', 'FindDevProdViolation', 'FindOpaqueTraffic',
        'FindTransitiveLeaks', 'FindBypass',
        'FindWeakUserAuth', 'FindVPNBypass', 'FindOutboundThreat', 'FindCDSBypass', 'FindWeakWireless', 'FindExcessiveEndpoints', 'FindCredentialExposure',
        'FindClassifiedInternet', 'FindInternalExposure', 'FindRogueWireless', 'FindMissingAntiVirus', 'FindUnencryptedAdmin', 'FindUnregisteredCDSAccess',
        'FindZoneGradeMismatch', 'FindClassifiedCloud', 'FindIoTDataRisk',
        'FindUnencryptedStorage', 'FindBluetoothRisk', 'FindNoMessageEncryption', 'FindNoPrivateLine'
    ];

    analysisResultCode += `fact DefineAnalysisResult {\n`;
    ruleNames.forEach(name => {
        analysisResultCode += `    AnalysisResult.${name} = ${name}\n`;
    });
    analysisResultCode += `}\n\n`;

    // Inject generated content into the template
    als = als.replace('// [ZONES_HERE]', zonesCode);
    als = als.replace('// [DATA_HERE]', dataCode);
    als = als.replace('// [SYSTEMS_HERE]', systemsCode);
    als = als.replace('// [CONNECTIONS_HERE]', connectionsCode);

    // Append AnalysisResult and run command
    als += '\n' + analysisResultCode + '\nrun CheckViolations { some AnalysisResult }\n';

    fs.writeFileSync(outputPath, als);

    if (process.env.NODE_ENV !== 'production') {
        try {
            fs.writeFileSync(path.join(alloyDir, 'server_debug.als'), als);
        } catch (e) { /* ignore debug write failure */ }
    }

    logger.log(`Alloy file generated: ${outputPath} (${als.length} chars)`);
    return outputPath;
};

module.exports = { generateAlloyFile };
