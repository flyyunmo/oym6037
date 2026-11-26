import {
  AlertDispatchLog,
  AlertRuleConfig,
  AuditCategory,
  AuditIssue,
  AuditSeverity,
  GrantNotice,
  NonsanDepartment,
  NonsanProfile,
  RuntimeErrorLog,
} from '../types/grant';
import {
  formatDDay,
  formatKoreanDate,
  getDaysRemaining,
  REFERENCE_DATE_STR,
} from './diagnostics';

export interface ErrorAuditSummary {
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  minorCount: number;
  checkedPoints: number;
  healthRatePct: number;
  issues: AuditIssue[];
  byCategory: Array<{
    category: AuditCategory;
    total: number;
    critical: number;
    warning: number;
    minor: number;
  }>;
  byDepartment: Array<{
    department: NonsanDepartment | '공통·시스템';
    total: number;
    critical: number;
    warning: number;
    minor: number;
  }>;
  proposalUnverifiedCount: number;
  runtimeErrorCount: number;
}

const ALL_CATEGORIES: AuditCategory[] = [
  '일정·알림',
  '예산초과',
  '배정누락',
  '계획서검증',
  '시스템·API',
];

const SEVERITY_ORDER: Record<AuditSeverity, number> = {
  심각: 0,
  주의: 1,
  경미: 2,
};

interface StoredProposalState {
  form?: {
    projectTitle?: string;
    department?: NonsanDepartment;
  };
  drafts?: Record<string, string>;
}

function readStoredProposalDraft(): StoredProposalState | null {
  try {
    const raw = window.localStorage.getItem('nonsan_grant_radar_proposal_draft_v1');
    if (!raw) return null;
    return JSON.parse(raw) as StoredProposalState;
  } catch {
    return null;
  }
}

export function runFullErrorAudit(params: {
  grants: GrantNotice[];
  profile: NonsanProfile;
  alertRule: AlertRuleConfig;
  dispatchLogs: AlertDispatchLog[];
  runtimeErrors: RuntimeErrorLog[];
}): ErrorAuditSummary {
  const { grants, profile, alertRule, dispatchLogs, runtimeErrors } = params;
  const issues: AuditIssue[] = [];
  let checkedPoints = 0;

  const activeGrants = grants.filter((g) => g.status !== '보류' && g.status !== '제출완료');

  // 1. 공고별 일정·알림·배정·실행요건 전수 점검
  activeGrants.forEach((g) => {
    const days = getDaysRemaining(g.deadlineDate);
    const dept = (g.assignedDept || g.diagnostic.recommendedDept) as NonsanDepartment;
    const unfinishedChecklist = g.checklist.filter((c) => !c.done);
    checkedPoints += 4;

    // (1-a) 마감 경과 미처리 오류
    if (days < 0) {
      issues.push({
        id: `err-overdue-${g.id}`,
        severity: '심각',
        category: '일정·알림',
        department: dept,
        targetTitle: g.title,
        detail: `접수 마감일(${formatKoreanDate(g.deadlineDate)})이 ${Math.abs(days)}일 경과했으나 상태가 '${g.status}'로 유지되고 있습니다.`,
        recommendation: '실제 접수 여부를 확인해 제출완료 또는 보류로 상태를 갱신하세요.',
        grantId: g.id,
      });
    }

    // (1-b) D-3 자동 알림 미발송 및 체크리스트 미완료
    if (days >= 0 && days <= alertRule.triggerDays) {
      const sentToday = dispatchLogs.some(
        (log) => log.grantId === g.id && log.sentAt.startsWith(REFERENCE_DATE_STR)
      );
      if (!sentToday) {
        issues.push({
          id: `err-alert-unsent-${g.id}`,
          severity: '심각',
          category: '일정·알림',
          department: dept,
          targetTitle: g.title,
          detail: `마감 ${formatDDay(days)}(${formatKoreanDate(g.deadlineDate)}) 자동 알림 대상이나 기준일(${REFERENCE_DATE_STR}) 담당자 발송 이력이 없습니다.`,
          recommendation: '마감·D-3 알림 센터에서 즉시 담당자 알림을 발송하세요.',
          grantId: g.id,
          targetTab: 'alerts',
        });
      }

      if (unfinishedChecklist.length > 0) {
        issues.push({
          id: `err-checklist-urgent-${g.id}`,
          severity: days <= 2 ? '심각' : '주의',
          category: '일정·알림',
          department: dept,
          targetTitle: g.title,
          detail: `마감 ${formatDDay(days)} 임박 상태에서 필수 사전 절차 ${unfinishedChecklist.length}건이 미완료 상태입니다 (${unfinishedChecklist[0].label}).`,
          recommendation: '공고 상세 서랍에서 미완료 체크리스트와 결재 진행 상황을 점검하세요.',
          grantId: g.id,
        });
      }
    }

    // (1-c) 고적합·추진 공고 부서/담당자 미배정
    if (!g.assignedDept && g.diagnostic.scoreOutOf5 >= 4.0) {
      issues.push({
        id: `err-unassigned-dept-${g.id}`,
        severity: days <= 14 ? '심각' : '주의',
        category: '배정누락',
        department: g.diagnostic.recommendedDept,
        targetTitle: g.title,
        detail: `적합도 ${g.diagnostic.scoreOutOf5.toFixed(1)}/5.0 우수 공고이나 주관 부서가 배정되지 않았습니다 (추천: ${g.diagnostic.recommendedDept}).`,
        recommendation: '전략·자원 매칭 또는 상세 패널에서 담당 부서를 즉시 배정하세요.',
        grantId: g.id,
        targetTab: 'matching',
      });
    } else if (g.assignedDept && !g.assignedOfficer.trim()) {
      issues.push({
        id: `err-unassigned-officer-${g.id}`,
        severity: '경미',
        category: '배정누락',
        department: g.assignedDept,
        targetTitle: g.title,
        detail: `${g.assignedDept} 배정 공고에 담당자(주무관/팀장) 성명이 누락되어 D-3 개별 알림 정확도가 저하됩니다.`,
        recommendation: '공고 상세 패널에서 실무 담당자 성명을 기입하세요.',
        grantId: g.id,
      });
    }

    // (1-d) 필수 요건(부지/타당성) 미충족 리스크
    const deptRes = profile.departmentResources.find((r) => r.dept === dept);
    if (g.factors.requiresSiteSecured && deptRes && !deptRes.hasReadySite) {
      issues.push({
        id: `err-site-gap-${g.id}`,
        severity: '주의',
        category: '배정누락',
        department: dept,
        targetTitle: g.title,
        detail: `사전 부지 확보 필수 공고이나 ${dept} 자원 프로필상 즉시 활용 부지가 미보유 상태입니다.`,
        recommendation: '공유재산·토지사용승낙 사전 확보 또는 부서 자원 현황을 갱신하세요.',
        grantId: g.id,
        targetTab: 'matching',
      });
    }
  });

  // 2. 부서별 시비 매칭 예산 초과 전수 점검
  const deptLocalMap = new Map<NonsanDepartment, { sum: number; count: number }>();
  activeGrants.forEach((g) => {
    const dept = (g.assignedDept || g.diagnostic.recommendedDept) as NonsanDepartment;
    const prev = deptLocalMap.get(dept) || { sum: 0, count: 0 };
    prev.sum = Math.round((prev.sum + g.diagnostic.estimatedLocalMatch) * 10) / 10;
    prev.count += 1;
    deptLocalMap.set(dept, prev);
  });

  deptLocalMap.forEach((val, dept) => {
    checkedPoints += 1;
    const res = profile.departmentResources.find((r) => r.dept === dept);
    const avail = res?.availableBudget ?? 0;
    if (val.sum > avail) {
      const gap = Math.round((val.sum - avail) * 10) / 10;
      issues.push({
        id: `err-budget-over-${dept}`,
        severity: gap >= 15 ? '심각' : '주의',
        category: '예산초과',
        department: dept,
        targetTitle: `${dept} 시비 매칭 한도 초과 (${val.count}건 합산)`,
        detail: `진행·추천 공고 매칭 시비 합계(${val.sum}억 원)가 부서 가용 시비 예산(${avail}억 원)을 ${gap}억 원 초과했습니다.`,
        recommendation: '기획감사실 추경·재원조정 협의 또는 우선순위 하위 공고 보류 검토가 필요합니다.',
        targetTab: 'matching',
      });
    }
  });

  // 3. 계획서 AI 초안 품질·수치([확인 필요])·문체 검증
  const storedProposal = readStoredProposalDraft();
  let proposalUnverifiedCount = 0;
  checkedPoints += 3;

  if (storedProposal?.drafts) {
    const sectionNames: Record<string, string> = {
      background: '배경·필요성',
      overview: '사업개요',
      plan: '세부추진계획',
      effects: '기대효과',
      risks: '리스크·대응',
    };
    const draftEntries = Object.entries(sectionNames);
    const filled = draftEntries.filter(
      ([key]) => (storedProposal.drafts?.[key] || '').trim().length > 0
    );

    if (filled.length > 0) {
      const missing = draftEntries
        .filter(([key]) => !(storedProposal.drafts?.[key] || '').trim())
        .map(([, label]) => label);
      if (missing.length > 0) {
        issues.push({
          id: 'err-proposal-missing-sections',
          severity: '경미',
          category: '계획서검증',
          department: storedProposal.form?.department || '공통·시스템',
          targetTitle: storedProposal.form?.projectTitle || '작성 중인 공모 계획서',
          detail: `계획서 5개 목차 중 ${missing.length}개 목차가 미작성 상태입니다 (${missing.join(', ')}).`,
          recommendation: '계획서 AI 초안 메뉴에서 누락된 목차를 생성하거나 직접 작성하세요.',
          targetTab: 'proposal',
        });
      }

      const fullText = filled.map(([key]) => storedProposal.drafts?.[key] || '').join('\n');
      const needsCheckMatches = fullText.match(/\[확인 필요\]/g);
      proposalUnverifiedCount = needsCheckMatches ? needsCheckMatches.length : 0;
      if (proposalUnverifiedCount > 0) {
        issues.push({
          id: 'err-proposal-needs-check',
          severity: '주의',
          category: '계획서검증',
          department: storedProposal.form?.department || '공통·시스템',
          targetTitle: storedProposal.form?.projectTitle || '작성 중인 공모 계획서',
          detail: `계획서 초안 본문에 미검증 수치 [확인 필요] 표기가 ${proposalUnverifiedCount}건 남아 있습니다.`,
          recommendation: '최종 제출 전 공식 통계·부서 산출근거로 모든 [확인 필요] 항목을 대체하세요.',
          targetTab: 'proposal',
        });
      }

      const politeMatches = fullText.match(/(합니다|입니다|하겠습니다|됩니다)/g);
      if (politeMatches && politeMatches.length > 0) {
        issues.push({
          id: 'err-proposal-tone',
          severity: '경미',
          category: '계획서검증',
          department: storedProposal.form?.department || '공통·시스템',
          targetTitle: storedProposal.form?.projectTitle || '작성 중인 공모 계획서',
          detail: `공문서 명사형 종결(~함, ~임) 원칙과 달리 경어체 표현이 ${politeMatches.length}회 감지되었습니다.`,
          recommendation: '계획서 직접 수정 모드에서 개조식 명사형 종결로 교정하세요.',
          targetTab: 'proposal',
        });
      }
    }
  }

  // 4. 시스템·API 런타임 오류 이력 통합
  checkedPoints += 1;
  runtimeErrors.forEach((err) => {
    issues.push({
      id: err.id,
      severity: '심각',
      category: '시스템·API',
      department: '공통·시스템',
      targetTitle: `${err.source} (${err.code})`,
      detail: `[${err.occurredAt}] ${err.message}`,
      recommendation: '네트워크 상태 및 Settings > Secrets의 API 키 설정을 확인한 뒤 재시도하세요.',
      targetTab: 'proposal',
    });
  });

  // 정렬: 심각도 → 카테고리 → 부서
  issues.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.category.localeCompare(b.category, 'ko');
  });

  const criticalCount = issues.filter((i) => i.severity === '심각').length;
  const warningCount = issues.filter((i) => i.severity === '주의').length;
  const minorCount = issues.filter((i) => i.severity === '경미').length;

  const byCategory = ALL_CATEGORIES.map((category) => {
    const subset = issues.filter((i) => i.category === category);
    return {
      category,
      total: subset.length,
      critical: subset.filter((i) => i.severity === '심각').length,
      warning: subset.filter((i) => i.severity === '주의').length,
      minor: subset.filter((i) => i.severity === '경미').length,
    };
  });

  const deptSet = new Map<
    NonsanDepartment | '공통·시스템',
    { total: number; critical: number; warning: number; minor: number }
  >();
  issues.forEach((i) => {
    const prev = deptSet.get(i.department) || { total: 0, critical: 0, warning: 0, minor: 0 };
    prev.total += 1;
    if (i.severity === '심각') prev.critical += 1;
    else if (i.severity === '주의') prev.warning += 1;
    else prev.minor += 1;
    deptSet.set(i.department, prev);
  });

  const byDepartment = Array.from(deptSet.entries())
    .map(([department, counts]) => ({ department, ...counts }))
    .sort((a, b) => b.critical - a.critical || b.total - a.total);

  const weightedPenalty = criticalCount * 2 + warningCount * 1 + minorCount * 0.5;
  const healthRatePct = Math.max(
    0,
    Math.min(100, Math.round(((checkedPoints - weightedPenalty) / Math.max(1, checkedPoints)) * 100))
  );

  return {
    totalIssues: issues.length,
    criticalCount,
    warningCount,
    minorCount,
    checkedPoints,
    healthRatePct,
    issues,
    byCategory,
    byDepartment,
    proposalUnverifiedCount,
    runtimeErrorCount: runtimeErrors.length,
  };
}

export function buildErrorReportText(summary: ErrorAuditSummary): string {
  const lines = [
    `[논산시 공모사업레이더 전체 오류 통계 보고서]`,
    `□ 보고 기준일: ${formatKoreanDate(REFERENCE_DATE_STR)}`,
    `□ 전수 점검 결과 요약`,
    `  ○ 총 탐지 오류: ${summary.totalIssues}건 (심각 ${summary.criticalCount}건 / 주의 ${summary.warningCount}건 / 경미 ${summary.minorCount}건)`,
    `  ○ 데이터·일정 건전성 지수: ${summary.healthRatePct}% (전체 점검 항목 ${summary.checkedPoints}건 기준)`,
    '',
    `□ 오류 유형별 통계`,
    ...summary.byCategory.map(
      (c) => `  ○ ${c.category}: 총 ${c.total}건 (심각 ${c.critical} / 주의 ${c.warning} / 경미 ${c.minor})`
    ),
    '',
    `□ 부서별 오류 집중 현황`,
    ...(summary.byDepartment.length > 0
      ? summary.byDepartment.map(
          (d) => `  ○ ${d.department}: 총 ${d.total}건 (심각 ${d.critical} / 주의 ${d.warning} / 경미 ${d.minor})`
        )
      : ['  ○ 부서별 탐지 오류 없음 (전 부서 정상)']),
    '',
    `□ 주요 오류 상세 및 권고 조치`,
    ...(summary.issues.length > 0
      ? summary.issues.map(
          (item, idx) =>
            `  ${idx + 1}) [${item.severity}·${item.category}] ${item.department} | ${item.targetTitle}\n     - 원인: ${item.detail}\n     - 조치: ${item.recommendation}`
        )
      : ['  ○ 현재 조치 필요한 오류가 없습니다.']),
  ];
  return lines.join('\n');
}
