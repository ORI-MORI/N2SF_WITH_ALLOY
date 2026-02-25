// Frontend system type → Alloy DeviceType mapping
const DEVICE_TYPE_MAP = {
    'Terminal': 'Generic_PC',
    'Server': 'Server',
    'Mobile': 'Mobile',
    'SecurityDevice': 'SecurityGear',
    'NetworkDevice': 'Gateway',
    'WirelessAP': 'IoT',
    'SaaS': 'Server',
    'DNS Server': 'DNS_Server',
};

export function convertGraphToJSON(nodes, edges) {
    const zones = nodes.filter((n) => n.type === 'zone');
    const systems = nodes.filter((n) => n.type === 'system');

    // Helper to check if inner node is within outer zone
    const isInside = (inner, outer) => {
        const innerW = inner.width || inner.measured?.width || 150;
        const innerH = inner.height || inner.measured?.height || 150;
        const outerW = outer.width || outer.measured?.width || 300;
        const outerH = outer.height || outer.measured?.height || 300;

        return (
            inner.position.x >= outer.position.x &&
            inner.position.x + innerW <= outer.position.x + outerW &&
            inner.position.y >= outer.position.y &&
            inner.position.y + innerH <= outer.position.y + outerH
        );
    };

    // Helper to sanitize IDs for Alloy (alphanumeric + underscore only)
    const sanitizeId = (id) => {
        if (!id) return 'unknown';
        return id.toString().replace(/[^a-zA-Z0-9]/g, '_');
    };

    // 1. Map Locations (Zones)
    let locations = zones.map((z) => ({
        id: sanitizeId(z.id),
        realId: z.id,
        type: z.data.type || 'Internet',
        grade: z.data.grade || 'Open',
        wips_enabled: z.data.wips_enabled || false,
    }));

    if (locations.length === 0) {
        locations.push({
            id: 'default_internet',
            realId: 'default-internet',
            type: 'Internet',
            grade: 'Open',
            wips_enabled: false,
        });
    }

    // 2. Map Systems
    const mappedSystems = systems.map((s) => {
        let parentZone = null;
        const data = s.data || {};

        // Manual zone override
        if (data.loc) {
            parentZone = locations.find(l => l.realId === data.loc);
        }

        // Fallback to spatial detection
        if (!parentZone) {
            parentZone = locations.find((loc) => {
                const zoneNode = zones.find((z) => z.id === loc.realId);
                if (!zoneNode) return false;
                return isInside(s, zoneNode);
            });
        }

        const locationId = parentZone ? parentZone.id : (locations[0]?.id || 'default_internet');

        // Parse stored data
        let storesIds = [];
        if (data.storedData && Array.isArray(data.storedData)) {
            storesIds = data.storedData.map(d => sanitizeId(d.id));
        } else if (data.stores && Array.isArray(data.stores)) {
            storesIds = data.stores.map(id => sanitizeId(id));
        }

        // Map frontend type to Alloy DeviceType
        const frontendType = data.type || 'Terminal';
        const deviceType = DEVICE_TYPE_MAP[frontendType] || 'Generic_PC';

        return {
            id: sanitizeId(s.id),
            realId: s.id,
            loc: locationId,
            grade: data.grade || (parentZone ? parentZone.grade : 'Open'),
            deviceType: deviceType,
            type: frontendType,

            // Security properties
            serviceModel: frontendType === 'SaaS' ? 'SaaS' : (data.serviceModel || 'OnPremise'),
            isCDS: data.isCDS === true,
            cdsType: data.isCDS ? (data.cdsType || 'TwoWay_Relay') : 'NotCDS',
            authType: data.authType || 'Single_Factor',
            isRegistered: data.isRegistered === true,
            hasStorageEncryption: data.isStorageEncrypted === true,
            isManagement: data.isManagement === true,
            hasMDM: data.hasMDM === true,
            hasWirelessInterface: data.hasWirelessInterface === true,
            hasBluetoothInterface: data.hasBluetoothInterface === true,

            // Patch & lifecycle
            patchStatus: data.patchStatus || 'UpToDate',
            lifeCycle: data.lifeCycle || 'Active',

            // Operational security
            hasAuditLogging: data.hasAuditLogging === true,
            hasSecureClock: data.hasSecureClock === true,
            sessionPolicy: data.sessionPolicy || 'Unsafe',

            // Additional security properties
            keyMgmt: data.keyMgmt || 'Local_Storage',
            virtStatus: data.virtStatus || 'Physical',
            tenantIsolation: data.tenantIsolation || 'Dedicated',
            isCertified: data.isCertified === true,
            hasHwIntegrity: data.hasHwIntegrity === true,
            hasSwIntegrity: data.hasSwIntegrity === true,
            hasPhysicalPortControl: data.hasPhysicalPortControl === true,
            isHardened: data.isHardened === true,
            hasDDoSProtection: data.hasDDoSProtection === true,
            isRedundant: data.isRedundant === true,
            failureMode: data.failureMode || (deviceType === 'Gateway' ? 'Fail_Secure' : 'Fail_Open'),
            dataVolatility: data.dataVolatility || 'Persistent_Disk',

            stores: storesIds,
            _storedDataObjects: data.storedData || [],
        };
    });

    // 3. Map Connections (Edges) - carries is always an array
    const connections = edges.flatMap((e, index) => {
        const fromSys = mappedSystems.find((s) => s.realId === e.source);
        const toSys = mappedSystems.find((s) => s.realId === e.target);
        const data = e.data || {};

        if (!fromSys || !toSys) return [];

        // Parse carries: normalize to array of sanitized IDs
        let carries = [];
        const rawCarries = data.carries;
        if (Array.isArray(rawCarries)) {
            carries = rawCarries.map(x => sanitizeId(String(x).trim())).filter(x => x && x !== 'unknown');
        } else if (typeof rawCarries === 'string' && rawCarries.trim() !== '') {
            carries = rawCarries.split(',').map(x => sanitizeId(x.trim())).filter(x => x && x !== 'unknown');
        }

        const baseId = sanitizeId(e.id);
        const isBidirectional = data.isBidirectional !== false;

        const forwardConnection = {
            id: baseId,
            from: fromSys.id,
            to: toSys.id,
            carries: carries,
            protocol: data.protocol || 'HTTPS',
            isEncrypted: data.isEncrypted === true,
            hasCDR: data.hasCDR === true,
            hasDLP: data.hasDLP === true,
            hasAntiVirus: data.hasAntiVirus === true,
            connType: data.connType || 'FileTransfer',
            encryption: data.encryption || data.encQuality,
            integrityStatus: data.integrityStatus,
            duration: data.duration,
            accessPolicy: data.accessPolicy,
            targetPortType: data.targetPortType,
            isolationMethod: data.isolationMethod,
            isAdminTraffic: data.isAdminTraffic === true,
            hasMessageEncryption: data.hasMessageEncryption === true,
            isPrivateLine: data.isPrivateLine === true,
            realId: e.id,
        };

        // Build inspections set from boolean flags
        const inspections = [];
        if (data.hasAntiVirus) inspections.push('AntiVirus');
        if (data.hasDLP) inspections.push('DLP');
        if (data.hasCDR) inspections.push('CDR');
        if (data.hasFormatCheck) inspections.push('FormatCheck');
        if (data.hasAIFilter) inspections.push('AI_Filter');
        if (data.hasDeIdentification) inspections.push('DeIdentification');
        forwardConnection.inspections = inspections;

        if (isBidirectional) {
            const backwardConnection = {
                ...forwardConnection,
                id: baseId + '_return',
                from: toSys.id,
                to: fromSys.id,
                realId: e.id,
            };
            return [forwardConnection, backwardConnection];
        }

        return [forwardConnection];
    });

    // 4. Collect Data definitions
    const allDataMap = new Map();

    mappedSystems.forEach(s => {
        if (s._storedDataObjects) {
            s._storedDataObjects.forEach(d => {
                const sId = sanitizeId(d.id);
                if (!allDataMap.has(sId)) {
                    allDataMap.set(sId, {
                        id: sId,
                        grade: d.grade || 'Sensitive',
                        dataType: d.dataType || 'GeneralData',
                    });
                }
            });
        }
    });

    const registerDataId = (id) => {
        const sId = sanitizeId(id);
        if (!allDataMap.has(sId)) {
            allDataMap.set(sId, { id: sId, grade: 'Sensitive', dataType: 'GeneralData' });
        }
    };

    mappedSystems.forEach(s => s.stores.forEach(registerDataId));
    connections.forEach(c => c.carries.forEach(registerDataId));

    const dataList = Array.from(allDataMap.values());

    return {
        locations: locations.map(({ realId, ...rest }) => rest),
        systems: mappedSystems.map(({ realId, _storedDataObjects, ...rest }) => rest),
        connections: connections.map(({ realId, ...rest }) => rest),
        data: dataList,
        _mapping: {
            systems: mappedSystems,
            connections: connections
        }
    };
}
