module n2sf_base

open util/ordering[Grade]

// ============================================================
// 1. 보안 등급 및 구역 정의 (N2SF 제2장, 부록2)
// ============================================================
enum Grade { Open, Sensitive, Classified }
enum ZoneType { Internet, Intranet, DMZ, Cloud, PPP, Wireless, ManagementZone, DevTestZone }

// 구역별 보호 상태 (무선 WIPS, DDoS 등)
enum ZoneProtection { NoProtection, WIPS_Active }

// ============================================================
// 2. 자산 및 서비스 특성 (N2SF 제6장, 부록2 모델 3,8,9)
// ============================================================
enum DeviceType { Generic_PC, Server, Mobile, IoT, SecurityGear, DNS_Server, Gateway }
enum ServiceModel { OnPremise, IaaS, PaaS, SaaS }
enum LifecycleStatus { Active, EOL } // 기술지원 종료 여부
enum PatchStatus { UpToDate, Vulnerable } // 보안 패치 상태
enum Volatility { Volatile_Memory, Persistent_Disk } // 데이터 휘발성

// ============================================================
// 3. 보안 메커니즘 및 기술 (N2SF 제1~3장, 부록1)
// ============================================================
// 망연계(CDS) 유형 (부록2 모델 11)
enum CDSType { NotCDS, OneWay_Out, OneWay_In, TwoWay_Relay, Access_CDS, MLS_CDS }

// 암호 키 관리 (부록1 EK)
enum KeyMgmtType { NoKey, Local_Storage, Separated_HSM }

// 인증 방식 (부록1 MA)
enum AuthType { Single_Factor, Multi_Factor }

// 가상화/클라우드 격리 (부록1 IS, 부록2 모델 3)
enum VirtualizationType { Physical, Virtual_Secured, Virtual_Insecure }
enum TenantIsolation { Dedicated, Shared_Logical, Shared_Unsafe }

// ============================================================
// 4. 연결 및 검사 속성 (N2SF 제4장, 제5장, 부록1 IF/EB)
// ============================================================
enum ConnectionType { FileTransfer, ScreenView, ControlSignal }
enum EncryptionQuality { NoEncryption, Weak_Algo, Validated_Module, Opaque_Traffic }
enum IntegrityStatus { NoIntegrity, Hmac_Signed }
enum ConnectionDuration { Persistent, Ephemeral }
enum Protocol { Generic_TCP, DNS, SSH, RDP, HTTPS, VPN_Tunnel, ClearText, SQL }
enum AccessPolicy { Permanent, Temporary_Approval }
enum IsolationMethod { Direct_Browser, VDI_RBI_Separation }
enum PortType { ServicePort, ManagementPort }

// 심층 검사 기능 (Set으로 사용)
enum InspectionCapability { AntiVirus, DLP, CDR, FormatCheck, AI_Filter, DeIdentification }
enum SessionConfig { Unsafe, Timeout_Only, Strict_Timeout_Concurrency }

// ============================================================
// 5. 시그니처(Signature) 정의
// ============================================================

abstract sig Data {
    grade: Grade,
    dataType: DataType // 일반 데이터 vs 개인정보(PII)
}
enum DataType { GeneralData, PII, AuthCredential }

sig Zone {
    type: ZoneType,
    grade: Grade,
    wipsStatus: ZoneProtection // [모델 10] 무선 침입 방지
}

abstract sig System {
    // [기본 정보]
    grade: Grade,
    stores: set Data,
    supportedGrades: set Grade, // MLS CDS용 다중 등급
    physicalLoc: Zone,
    connectedZones: set Zone,
    
    // [자산 정보]
    deviceType: DeviceType,
    serviceModel: ServiceModel,
    isManagementDevice: Int, // 0:False, 1:True
    isRegistered: Int,       // 자산 등록 여부 (Shadow IT 방지)
    lifeCycle: LifecycleStatus,
    patchStatus: PatchStatus,
    isCertified: Int,        // CC인증 제품 여부

    // [보안 상태]
    cdsType: CDSType,
    hasHwIntegrity: Int,     // TPM 등
    hasSwIntegrity: Int,     // Code Signing
    authMechanism: AuthType,
    hasContainer: Int,       // 모바일 컨테이너 격리
    hasWirelessInterface: Int,
    hasPhysicalPortControl: Int, // USB 통제
    keyMgmt: KeyMgmtType,
    virtStatus: VirtualizationType,
    tenantIsolation: TenantIsolation,
    
    // [운영 상태]
    dataVolatility: Volatility, // 재부팅 시 데이터 소거 여부
    failureMode: FailureMode,   // 장애 시 동작 (Fail-Safe)
    hasAuditLogging: Int,
    isHardened: Int,            // Default PW 제거 등
    isRedundant: Int,           // 이중화(HA)
    hasSecureClock: Int,        // 시각 동기화
    hasDDoSProtection: Int,
    sessionPolicy: SessionConfig,
    hasStorageEncryption: Int,   // 저장 암호화 여부 [DU-2]
    hasBluetoothInterface: Int   // 블루투스 인터페이스 보유 [BC-1]
}
enum FailureMode { Fail_Secure, Fail_Open }

abstract sig Connection {
    from: System,
    to: System,
    carries: set Data,
    
    // 연결 속성
    connType: ConnectionType,
    protocol: Protocol,
    encQuality: EncryptionQuality,
    integrityStatus: IntegrityStatus,
    duration: ConnectionDuration,
    accessPolicy: AccessPolicy,
    targetPortType: PortType,
    isAdminTraffic: Int,
    isolationMethod: IsolationMethod,
    
    // 보안 필터링
    hasContentFilter: Int, // DLP 적용 여부
    hasCDR: Int,           // 무해화 적용 여부
    inspections: set InspectionCapability,
    hasMessageEncryption: Int, // 메시지 레벨 암호화 [DT-4]
    isPrivateLine: Int         // 전용회선 여부 [IF-15]
}