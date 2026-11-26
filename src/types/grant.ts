export type Ministry =
  | '농림축산식품부'
  | '행정안전부'
  | '국토교통부'
  | '산업통상자원부'
  | '문화체육관광부'
  | '중소벤처기업부'
  | '환경부'
  | '보건복지부'
  | '과학기술정보통신부'
  | '방위사업청';

export type StrategicDomain =
  | '국방·산업'
  | '스마트농업'
  | '문화·관광'
  | '정주·인구'
  | '환경·안전';

export type WorkflowStatus =
  | '미검토'
  | '검토중'
  | '응모확정'
  | '제출완료'
  | '보류';

export type FitGrade = 'A' | 'B' | 'C' | 'D';

export type NonsanDepartment =
  | '국방산업과'
  | '미래전략실'
  | '투자유치과'
  | '농촌활력과'
  | '농산물유통지원센터'
  | '농업기술센터'
  | '관광과'
  | '문화예술과'
  | '도시재생과'
  | '인구청년과'
  | '복지정책과'
  | '환경과'
  | '안전총괄과'
  | '기획감사실';

export type StrategyPriority = '핵심' | '중점' | '일반';

export type AlertChannel = '새올행정' | '알림톡' | '이메일' | 'SMS';

export interface NonsanStrategicProject {
  id: string;
  name: string;
  domain: StrategicDomain;
  priority: StrategyPriority;
  keywords: string[];
  coreAsset: string;
  active: boolean;
}

export interface DepartmentResource {
  dept: NonsanDepartment;
  domains: StrategicDomain[];
  availableBudget: number; // 가용 시비 매칭 예산 (억원)
  availableStaff: number; // 공모 대응 가능 전담 인력 (명)
  hasReadySite: boolean; // 즉시 활용 가능 시유지·협의부지 보유
  canRunFeasibility: boolean; // 타당성 용역·기초통계 자체 대응 역량
  leadOfficer: string;
  officerContact: string;
  officerEmail: string;
  preferredChannels: AlertChannel[];
}

export interface NonsanProfile {
  strategicProjects: NonsanStrategicProject[];
  departmentResources: DepartmentResource[];
}

export interface DiagnosticCriterion {
  key: 'strategy' | 'fiscal' | 'capacity' | 'eligibility' | 'infrastructure';
  label: string;
  weightPercent: number;
  scoreOutOf5: number; // 0.0 ~ 5.0
  score: number; // weighted contribution to 100 scale (for compatibility)
  maxScore: number;
  status: '충족' | '보완필요' | '미충족';
  summary: string;
}

export interface DiagnosticResult {
  scoreOutOf5: number; // 0.0 ~ 5.0 (핵심 5점 만점 지표)
  totalScore: number; // 0 ~ 100 환산
  grade: FitGrade;
  gradeLabel: string;
  criteria: DiagnosticCriterion[];
  matchedStrategies: string[];
  strengths: string[];
  cautions: string[];
  recommendedDept: NonsanDepartment;
  collaboratingDepts: NonsanDepartment[];
  estimatedLocalMatch: number; // 추산 시비 매칭 (억원)
  deptBudgetCoveragePct: number; // 추천/배정 부서 가용예산 대비 충족률
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  dueOffsetDays: number;
}

export interface GrantInputFactors {
  populationDeclineBonus: boolean;
  urbanRuralFit: boolean;
  requiresSiteSecured: boolean;
  requiresFeasibilityStudy: boolean;
  linksExistingAsset: boolean;
  existingAssetNote: string;
}

export interface GrantNotice {
  id: string;
  noticeCode: string;
  title: string;
  ministry: Ministry;
  domain: StrategicDomain;
  summary: string;
  eligibilityText: string;
  announcedDate: string; // YYYY-MM-DD
  deadlineDate: string; // YYYY-MM-DD
  nationalBudget: number; // 국비 지원 규모 (억원)
  nationalRatio: number; // 국비 보조율 (%)
  totalProjectBudget: number; // 총사업비 추산 (억원)
  status: WorkflowStatus;
  assignedDept: NonsanDepartment | '';
  assignedOfficer: string;
  factors: GrantInputFactors;
  diagnostic: DiagnosticResult;
  checklist: ChecklistItem[];
  notes: string;
  sourceUrlLabel: string;
  isNewThisWeek?: boolean;
}

export interface DiagnosticFormInput {
  title: string;
  ministry: Ministry;
  domain: StrategicDomain;
  summary: string;
  eligibilityText: string;
  deadlineDate: string;
  nationalBudget: number;
  nationalRatio: number;
  populationDeclineBonus: boolean;
  urbanRuralFit: boolean;
  requiresSiteSecured: boolean;
  requiresFeasibilityStudy: boolean;
  linksExistingAsset: boolean;
  existingAssetNote: string;
}

export interface AlertRuleConfig {
  triggerDays: number; // 기본 3일 전 (D-3)
  escalationDay: number; // 기본 1일 전 (D-1)
  dispatchTime: string; // 예: "08:30"
  skipSubmittedAndDeferred: boolean;
  includeUnfinishedChecklist: boolean;
  enabledChannels: AlertChannel[];
}

export interface AlertDispatchLog {
  id: string;
  grantId: string;
  grantTitle: string;
  dDayLabel: string;
  recipientDept: NonsanDepartment;
  recipientName: string;
  channels: AlertChannel[];
  sentAt: string;
  status: '발송완료' | '예약대기';
  messagePreview: string;
}

export type AuditSeverity = '심각' | '주의' | '경미';

export type AuditCategory =
  | '일정·알림'
  | '예산초과'
  | '배정누락'
  | '계획서검증'
  | '시스템·API';

export interface RuntimeErrorLog {
  id: string;
  occurredAt: string;
  source: string;
  code: string;
  message: string;
}

export interface AuditIssue {
  id: string;
  severity: AuditSeverity;
  category: AuditCategory;
  department: NonsanDepartment | '공통·시스템';
  targetTitle: string;
  detail: string;
  recommendation: string;
  grantId?: string;
  targetTab?: ActiveTab;
}

export type ActiveTab =
  | 'dashboard'
  | 'radar'
  | 'matching'
  | 'proposal'
  | 'alerts'
  | 'diagnose'
  | 'errors';

