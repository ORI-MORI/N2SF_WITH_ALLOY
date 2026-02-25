module n2sf_rules
open n2sf_base

// ============================================================
// Group A. 구조 및 흐름 위협 (Structure & Flow)
// ============================================================

// 1. 망 분리 우회 (Split Tunneling) [N2SF-EB-4]
// 인터넷과 업무망(Intranet)에 '동시' 연결된 단말 탐지
// 분할 터널링: 하나의 단말이 내·외부 통신을 동시에 수행하는 경우
// 경계장비(Gateway, SecurityGear)는 양 구역 연결이 본래 역할이므로 제외
fun FindSplitTunneling: System {
    { s: System |
      s.deviceType not in Gateway + SecurityGear
      and some c1, c2: Connection |
        c1.from = s and c2.from = s
        and c1.to.physicalLoc.type = Internet
        and c2.to.physicalLoc.type = Intranet
    }
}

// 2. 망 간 직접 연결 위반 (Direct Connection Violation) [N2SF-EB-5]
// 서로 다른 보안 구역 간 통신은 반드시 Gateway 또는 보안장비를 경유해야 함
// Gateway와 SecurityGear(방화벽 등)는 경계장비이므로 경유 대상에서 제외
fun FindDirectConnection: Connection {
    { c: Connection |
      c.from.physicalLoc.type != c.to.physicalLoc.type
      and c.from.deviceType not in Gateway + SecurityGear
      and c.to.deviceType not in Gateway + SecurityGear
    }
}

// 3. 등급 간 자료 전송 위반 (Flow Control) [N2SF-IF-5, IF-14]
// CDS 없이 하위 등급으로 파일 전송 금지, 기밀 정보는 일방향(OneWay) 필수
fun FindFlowViolations: Connection -> Data {
    { c: Connection, d: Data |
      d in c.carries and c.connType = FileTransfer
      and lt[c.to.grade, d.grade]
      and (
          c.from.cdsType = NotCDS
          or (d.grade = Classified and c.from.cdsType != OneWay_Out)
      )
    }
}

// ============================================================
// Group B. 데이터 및 암호화 위협 (Data Security)
// ============================================================

// 4. 기밀 데이터 저장 위반 (Storage Violation) [N2SF 본문]
// MLS 장비가 아닌데 상위 등급 데이터를 저장하면 위반
fun FindStorageViolations: System -> Data {
    { s: System, d: Data |
      d in s.stores
      and (
          (s.cdsType != MLS_CDS and lt[s.grade, d.grade])
          or (s.cdsType = MLS_CDS and !(d.grade in s.supportedGrades))
      )
    }
}

// 5. 암호화 품질 미비 (Weak Crypto) [N2SF-EA-1, DT-3]
// (1) 외부/무선/클라우드/DMZ 구간은 무조건 검증필 암호모듈 필수
// (2) S/C 등급 데이터를 전송하는 모든 연결에 검증필 암호모듈 필수
fun FindWeakCrypto: Connection {
    { c: Connection |
      c.encQuality in NoEncryption + Weak_Algo
      and (
          c.from.physicalLoc.type in Internet + Wireless + Cloud + DMZ
          or c.to.physicalLoc.type in Internet + Wireless + Cloud + DMZ
          or (some d: c.carries | d.grade in Sensitive + Classified)
      )
    }
}

// 6. 전송 무결성 미비 (Integrity Loss) [N2SF-DT-6]
// 중요 정보 전송 시 위변조 방지(HMAC/Sig) 필수
fun FindIntegrityLoss: Connection {
    { c: Connection |
      (some d: c.carries | d.grade in Sensitive + Classified)
      and c.integrityStatus = NoIntegrity
    }
}

// 7. 암호 키 보관 위반 (Insecure Key) [N2SF-EK-3]
// S등급 이상 데이터 저장 시 키는 HSM 등에 분리 보관
fun FindInsecureKey: System {
    { s: System |
      (some d: s.stores | d.grade in Sensitive + Classified)
      and s.keyMgmt in Local_Storage + NoKey
    }
}

// ============================================================
// Group C. 접근 통제 및 인증 (Access & Auth)
// ============================================================

// 8. 관리자 인증 강도 위반 (Weak Admin Auth) [N2SF-MA-1]
// 관리자 계정은 다중요소 인증(MFA) 필수
fun FindWeakAuth: System {
    { s: System |
      (s.isManagementDevice = 1 or s.physicalLoc.type in Internet + Cloud)
      and s.authMechanism = Single_Factor
    }
}

// 8-1. 사용자 인증 강도 위반 (Weak User Auth) [N2SF-MA-2]
// 미지정 경로/비인가 단말의 사용자 계정 접속 시 MFA 필수
fun FindWeakUserAuth: Connection {
    { c: Connection |
      c.from.physicalLoc.type != c.to.physicalLoc.type
      and c.to.grade in Sensitive + Classified
      and c.to.authMechanism = Single_Factor
      and c.isAdminTraffic = 0
    }
}

// 9. 관리 포트 노출 (Exposed Admin Port) [N2SF-EB-8]
// 관리 포트는 관리망/관리장비에서만 접근 가능
fun FindExposedAdmin: Connection {
    { c: Connection |
      c.targetPortType = ManagementPort
      and (c.from.isManagementDevice = 0 and c.from.physicalLoc.type != ManagementZone)
    }
}

// 10. 상시적 원격 관리 (Permanent Remote Access) [N2SF-LP-4(1)]
// 외부 원격 관리는 '한시적'으로만 허용 (인터넷 및 클라우드 모두 적용)
fun FindPermanentAdmin: Connection {
    { c: Connection |
      c.isAdminTraffic = 1 and c.from.physicalLoc.type in Internet + Cloud and c.accessPolicy = Permanent
    }
}

// ============================================================
// Group D. 자산 및 무결성 (Asset Integrity)
// ============================================================

// 11. 자산 미등록 (Shadow IT) -> JS Validator로 이관
fun FindShadowIT: System { none }

// 12. 시스템 무결성 위반 (Integrity Failure) [N2SF-DV-1, IN-15]
// S/C 등급 시스템은 TPM 및 SW 서명 검증 필수
fun FindIntegrityFailure: System {
    { s: System |
      s.grade in Sensitive + Classified
      and (s.hasHwIntegrity = 0 or s.hasSwIntegrity = 0)
    }
}

// 13. 취약한 시스템 노출 (Unpatched Exposure) [N2SF-IN-1]
// 패치 안 된 시스템이 외부 접점에 있으면 위협
// 13. 취약한 시스템 노출 (Unpatched Exposure) -> JS Validator로 이관
fun FindUnpatchedExposure: System { none }

// 14. EOL 자산 사용 (EOL Risk) -> JS Validator로 이관
fun FindEOL: System { none }

// 15. 미인증 보안 제품 (Uncertified Gear) [부록2 모델 9]
// 보안 장비는 CC인증 등 필수
fun FindUncertifiedGear: System {
    { s: System |
      (s.deviceType in SecurityGear + Gateway or s.cdsType != NotCDS)
      and s.isCertified = 0
    }
}

// ============================================================
// Group E. 물리 및 환경 보안 (Physical & Env)
// ============================================================

// 16. 무선망 WIPS 미비 (Wireless Threat) [N2SF 모델 10]
fun FindWirelessThreat: System {
    { s: System |
      (s.hasWirelessInterface = 1 or s.physicalLoc.type = Wireless)
      and s.physicalLoc.wipsStatus = NoProtection
    }
}

// 17. 물리적 포트 미통제 (Port Risk) [N2SF-DV-3]
fun FindPortRisk: System {
    { s: System |
      (some d: s.stores | d.grade in Sensitive + Classified)
      and s.hasPhysicalPortControl = 0 and s.serviceModel = OnPremise
    }
}

// 18. 모바일 격리 미비 (Mobile Risk) [N2SF-MD-5]
fun FindMobileRisk: System {
    { s: System | s.deviceType = Mobile and (some d: s.stores | d.grade in Sensitive + Classified) and s.hasContainer = 0 }
}

// ============================================================
// Group F. 콘텐츠 및 신기술 위협 (Content & New Tech)
// ============================================================

// 19. 콘텐츠 무해화 미비 (Missing CDR) [N2SF-CD-6]
// 망 간 파일 전송 시 CDR 필수
fun FindMissingCDR: Connection {
    { c: Connection |
      c.connType = FileTransfer and c.from.physicalLoc != c.to.physicalLoc
      and c.hasCDR = 0
    }
}

// 20. 파일 포맷 검증 미비 (Format Risk) [N2SF 모델 11]
fun FindFormatRisk: Connection {
    { c: Connection |
      c.connType = FileTransfer and c.from.physicalLoc != c.to.physicalLoc
      and !(FormatCheck in c.inspections)
    }
}

// 21. 정보 유출 필터링 미비 (DLP Failure) [N2SF-IF-6]
fun FindDLPFailure: Connection {
    { c: Connection |
      (some d: c.carries | d.grade in Sensitive + Classified)
      and c.to.physicalLoc.type in Internet + Cloud
      and c.hasContentFilter = 0
    }
}

// 22. AI 필터링 미비 (AI Filter Gap) [N2SF 모델 2, 5]
// AI/LLM 서비스 이용 시 민감정보 입력 방지 필터 필요
// 민감/기밀 데이터를 전송하는 SaaS/PaaS 연결에만 적용
fun FindAIFilterFailure: Connection {
    { c: Connection |
      c.to.serviceModel in SaaS + PaaS
      and c.to.physicalLoc.type in Internet + Cloud
      and some d: c.carries | d.grade in Sensitive + Classified
      and !(AI_Filter in c.inspections)
    }
}

// 23. 개인정보 유출 위협 (PII Leakage) [N2SF-EB-M1]
fun FindPIILeakage: Connection {
    { c: Connection |
      (some d: c.carries | d.dataType = PII)
      and c.to.physicalLoc.type in Internet + Cloud
      and !(DeIdentification in c.inspections)
    }
}

// 24. 인터넷 접속 격리 미비 (Browser Isolation Failure) [N2SF 모델 1, 4]
fun FindBrowserIsolation: Connection {
    { c: Connection |
      c.from.grade = Sensitive and c.to.physicalLoc.type = Internet
      and c.isolationMethod = Direct_Browser
    }
}

// 25. 클라우드/가상화 격리 미비 (Virt Risk) [N2SF-IS-5, 모델 3]
fun FindVirtRisk: System {
    { s: System |
      (some d: s.stores | d.grade in Sensitive + Classified)
      and (
          (s.serviceModel in OnPremise + IaaS and s.virtStatus = Virtual_Insecure)
          or (s.serviceModel in SaaS + PaaS and s.tenantIsolation = Shared_Unsafe)
      )
    }
}

// ============================================================
// Group G. 운영 및 가용성 (Ops & Availability)
// ============================================================

// 26. 감사 로그 미비 (Audit Failure) -> JS Validator로 이관
fun FindAuditFailure: System { none }

// 27. 시각 동기화 미비 (Time Sync Failure) -> JS Validator로 이관
fun FindTimeSyncFailure: System { none }

// 28. 보안 설정 강화 미흡 (Hardening Failure) [N2SF-AM-4, IN-6, IN-7]
// AM-4: 초기 인증수단 변경, IN-6: 불필요 구성요소 제거, IN-7: 주기적 점검
fun FindHardeningFailure: System {
    { s: System | (some d: s.stores | d.grade in Sensitive + Classified) and s.isHardened = 0 }
}

// 29. 이중화 미비 (Redundancy Failure) [N2SF-IF-12]
// 기밀망 접점 장비는 SPOF 방지 필수
fun FindRedundancyFailure: System {
    { s: System | s.grade = Classified and s.deviceType = Gateway and s.isRedundant = 0 }
}

// 30. 장애 시 보안 무력화 (Fail-Open Risk) [N2SF-EB-11]
// 장애 시 Fail-Secure(차단)여야 함
fun FindFailOpenRisk: System {
    { s: System |
      (s.deviceType in SecurityGear + Gateway or s.cdsType != NotCDS)
      and s.grade in Sensitive + Classified
      and s.failureMode = Fail_Open
    }
}

// 31. DDoS 방어 미비 (DDoS Risk) [N2SF 모델 10]
fun FindDDoSRisk: System {
    { s: System |
      s.deviceType = Gateway and s.physicalLoc.type in Internet + Cloud
      and s.hasDDoSProtection = 0
    }
}

// 32. 세션 정책 미비 (Session Policy) -> JS Validator로 이관
fun FindWeakSession: System { none }

// 33. 불필요한 지속 연결 (Persistent Conn) [N2SF-IN-14]
fun FindPersistentRisk: Connection {
    { c: Connection | (c.isAdminTraffic = 1 or c.from.physicalLoc.type in Internet) and c.duration = Persistent }
}

// 34. 잔존 데이터 위협 (Residual Data) [N2SF-IN-13]
fun FindResidualData: System {
    { s: System | (s.cdsType = Access_CDS or s.deviceType = Mobile) and (s.grade in Sensitive + Classified) and s.dataVolatility = Persistent_Disk }
}

// 35. 외부 DNS 직연결 (DNS Bypass) [N2SF-EB-14]
fun FindDNSViolation: Connection {
    { c: Connection | c.protocol = DNS and c.from.physicalLoc.type = Intranet and c.to.physicalLoc.type = Internet and c.to.deviceType != DNS_Server }
}

// 36. 개발/운영 혼재 (Dev/Prod Mix) [N2SF-SG-5]
fun FindDevProdViolation: System {
    { s: System | s.physicalLoc.type = DevTestZone and ((some z: s.connectedZones | z.type = Intranet) or (some d: s.stores | d.grade in Sensitive + Classified)) }
}

// 37. 불투명한 암호화 트래픽 (Opaque Traffic) [N2SF-IF-2]
// 암호화되었으나 검사 불가한 트래픽은 악성코드 통로
fun FindOpaqueTraffic: Connection {
    { c: Connection | c.from.physicalLoc.type in Internet and c.to.physicalLoc.type = Intranet and c.encQuality = Opaque_Traffic }
}

// 38. 다단계 데이터 세탁 (Transitive Leak) [논리적 추론]
// A(기밀) -> B(중계) -> C(공개) 흐름 탐지
fun insecureLink: System -> System {
    { s1, s2: System | some c: Connection | c.from = s1 and c.to = s2 and s1.cdsType = NotCDS }
}
fun FindTransitiveLeaks: System -> Data {
    { s: System, d: Data | d in s.stores and some dest: s.^insecureLink | lt[dest.grade, d.grade] }
}

// 39. 보안 검사 미경유 인바운드 연결 (Uninspected Inbound) [N2SF-EB-3, EB-5]
// 외부→내부 인바운드 연결 중 보안 검사(AntiVirus, DLP 등)가 전혀 없는 연결
fun FindBypass: Connection {
    { c: Connection |
      c.from.physicalLoc.type in Internet + Cloud
      and c.to.physicalLoc.type in Intranet + DMZ
      and c.from.deviceType != Gateway
      and c.to.deviceType != Gateway
      and no c.inspections
    }
}

// ============================================================
// Group H. 추가 N2SF 통제 규칙 (Supplementary Rules)
// ============================================================

// 40. VPN/우회 통신 탐지 (VPN Bypass) [N2SF-EB-15]
// 내부망에서 외부로 VPN 터널을 직접 생성하는 우회 경로 탐지
fun FindVPNBypass: Connection {
    { c: Connection |
      c.protocol = VPN_Tunnel
      and c.from.physicalLoc.type = Intranet
      and c.to.physicalLoc.type = Internet
      and c.from.deviceType != Gateway
    }
}

// 41. 외부향 비인가 아웃바운드 통신 (Outbound Threat) [N2SF-EB-6]
// 내부에서 외부로의 사이버위협 통신(ClearText, 비인가 프로토콜) 탐지
fun FindOutboundThreat: Connection {
    { c: Connection |
      c.from.physicalLoc.type in Intranet + DMZ
      and c.to.physicalLoc.type = Internet
      and c.protocol = ClearText
      and c.from.deviceType not in SecurityGear + Gateway
    }
}

// 42. CDS 우회 경로 (CDS Bypass) [N2SF-CD-9]
// CDS를 경유하지 않는 크로스도메인 데이터 전송 탐지
// CDS는 폐쇄망(Intranet/ManagementZone) 간 또는 기밀등급 관련 연계에만 요구
// 인터넷 접점(Internet/DMZ/Cloud) 간 연결에는 CDS 불필요
fun FindCDSBypass: Connection {
    { c: Connection |
      c.connType = FileTransfer
      and c.from.physicalLoc.type != c.to.physicalLoc.type
      and c.from.grade != c.to.grade
      and (c.from.physicalLoc.type in Intranet + ManagementZone + DevTestZone
           or c.to.physicalLoc.type in Intranet + ManagementZone + DevTestZone)
      and c.from.cdsType = NotCDS
      and c.to.cdsType = NotCDS
      and c.from.deviceType not in Gateway + SecurityGear
      and c.to.deviceType not in Gateway + SecurityGear
    }
}

// 43. 무선 구간 암호화 미적용 (Weak Wireless) [N2SF-WA-1]
// 무선망 구간의 인증 및 암호화 미적용 탐지
fun FindWeakWireless: Connection {
    { c: Connection |
      (c.from.physicalLoc.type = Wireless or c.to.physicalLoc.type = Wireless)
      and c.encQuality = NoEncryption
    }
}

// 44. 외부 연결 접점 과다 (Excessive Endpoints) [N2SF-EB-1]
// 외부 연결 접점 수가 과다한 비게이트웨이 시스템
fun FindExcessiveEndpoints: System {
    { s: System |
      s.physicalLoc.type = Intranet
      and s.deviceType != Gateway
      and #{ c: Connection | c.from = s and c.to.physicalLoc.type in Internet + Cloud } > 1
    }
}

// 45. 인증정보 평문 전송 (Credential Exposure) [N2SF-LI-1, AM-5]
// 인증정보(AuthCredential)가 암호화 없이 전송되는 경우
fun FindCredentialExposure: Connection {
    { c: Connection |
      (some d: c.carries | d.dataType = AuthCredential)
      and c.encQuality in NoEncryption + Weak_Algo
    }
}

// ============================================================
// Group I. 추가 갭 분석 규칙 (Gap Analysis Rules)
// ============================================================

// 46. 기밀(C)급 시스템 인터넷 연결 금지 (Classified Internet Ban) [N2SF-IF-11]
// C등급 시스템은 인터넷과 완전 격리 필수, 연결 존재 시 위반
fun FindClassifiedInternet: System {
    { s: System |
      s.grade = Classified
      and (some c: Connection |
        (c.from = s and c.to.physicalLoc.type = Internet)
        or (c.to = s and c.from.physicalLoc.type = Internet)
      )
    }
}

// 47. 내부 시스템 외부 직접 노출 (Internal Exposure) [N2SF-EB-10]
// Intranet 서버가 Internet에서 직접 도달 가능 (Gateway/보안장비가 아닌데 인바운드 존재)
fun FindInternalExposure: System {
    { s: System |
      s.physicalLoc.type = Intranet
      and s.deviceType not in Gateway + SecurityGear
      and (some c: Connection | c.from.physicalLoc.type = Internet and c.to = s)
    }
}

// 48. 보안구역 내 비인가 무선 인터페이스 (Rogue Wireless) [N2SF-WA-4]
// S/C 등급 보안구역(Intranet, ManagementZone)에서 무선 인터페이스 보유 시스템 탐지
fun FindRogueWireless: System {
    { s: System |
      s.hasWirelessInterface = 1
      and s.physicalLoc.type in Intranet + ManagementZone
      and s.grade in Sensitive + Classified
    }
}

// 49. 인바운드 안티바이러스 미적용 (Missing AntiVirus) [N2SF-IN-16]
// 외부→내부 연결에 AntiVirus 검사 누락
fun FindMissingAntiVirus: Connection {
    { c: Connection |
      c.from.physicalLoc.type in Internet + Cloud
      and c.to.physicalLoc.type in Intranet + DMZ
      and !(AntiVirus in c.inspections)
    }
}

// 50. 원격 관리 세션 암호화 미적용 (Unencrypted Admin) [N2SF-RA-2]
// 외부에서 내부로의 관리 세션이 암호화되지 않은 경우
fun FindUnencryptedAdmin: Connection {
    { c: Connection |
      c.isAdminTraffic = 1
      and c.from.physicalLoc.type in Internet + Cloud
      and c.encQuality in NoEncryption + Weak_Algo
    }
}

// 51. CDS 접근 단말 미등록 (Unregistered CDS Access) [N2SF-CD-12]
// 미등록 단말이 CDS 장비에 접속하는 경우
fun FindUnregisteredCDSAccess: Connection {
    { c: Connection |
      c.to.cdsType != NotCDS
      and c.from.isRegistered = 0
    }
}

// ============================================================
// Group J. 최종 갭 분석 규칙 (Final Gap Analysis)
// ============================================================

// 52. 구역 등급 부적합 배치 (Zone Grade Mismatch) [N2SF 본문 §2.3]
// 시스템의 보안등급이 배치된 구역의 등급보다 높으면 위반
// (Classified 시스템은 Classified 구역에만, Sensitive는 Sensitive 이상 구역에만 배치)
fun FindZoneGradeMismatch: System {
    { s: System |
      gt[s.grade, s.physicalLoc.grade]
    }
}

// 53. 기밀 자산 클라우드 금지 (Classified on Cloud) [N2SF-IF-11 확장]
// C등급 시스템 또는 C등급 데이터를 보유한 시스템이 클라우드에 위치하면 위반
fun FindClassifiedCloud: System {
    { s: System |
      s.physicalLoc.type = Cloud
      and (s.grade = Classified or (some d: s.stores | d.grade = Classified))
    }
}

// 54. IoT 장비 중요 데이터 보유 (IoT Data Risk) [N2SF-DV, IN-7]
// 보안 기능이 제한적인 IoT 장비가 S/C 등급 데이터를 보유하면 위협
fun FindIoTDataRisk: System {
    { s: System |
      s.deviceType = IoT
      and (some d: s.stores | d.grade in Sensitive + Classified)
    }
}

// ============================================================
// Group K. 최종 C군 규칙 (New Attribute-Based Rules)
// ============================================================

// 55. 중요 데이터 저장 암호화 미적용 (Unencrypted Storage) [N2SF-DU-2]
// S/C 등급 데이터를 보유한 시스템이 저장 암호화를 적용하지 않으면 위반
fun FindUnencryptedStorage: System {
    { s: System |
      (some d: s.stores | d.grade in Sensitive + Classified)
      and s.hasStorageEncryption = 0
    }
}

// 56. 보안구역 내 블루투스 통신 위험 (Bluetooth Risk) [N2SF-BC-1]
// S/C 등급 보안구역에서 블루투스 인터페이스가 활성화된 시스템 탐지
fun FindBluetoothRisk: System {
    { s: System |
      s.hasBluetoothInterface = 1
      and s.physicalLoc.type in Intranet + ManagementZone
      and s.grade in Sensitive + Classified
    }
}

// 57. 메시지 레벨 암호화 미적용 (No Message Encryption) [N2SF-DT-4]
// S/C 등급 데이터 전송 시 메시지(페이로드) 자체 암호화 미적용
fun FindNoMessageEncryption: Connection {
    { c: Connection |
      (some d: c.carries | d.grade in Sensitive + Classified)
      and c.hasMessageEncryption = 0
    }
}

// 58. 기밀 통신 전용회선 미사용 (No Private Line) [N2SF-IF-15]
// 기밀(C) 등급 데이터의 망 간 전송 시 전용회선 미사용
fun FindNoPrivateLine: Connection {
    { c: Connection |
      (some d: c.carries | d.grade = Classified)
      and c.from.physicalLoc.type != c.to.physicalLoc.type
      and c.isPrivateLine = 0
    }
}

run {}