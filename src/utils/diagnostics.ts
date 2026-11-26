import { DEFAULT_NONSAN_PROFILE } from '../data/nonsanProfile';
import {
  AlertRuleConfig,
  ChecklistItem,
  DepartmentResource,
  DiagnosticCriterion,
  DiagnosticFormInput,
  DiagnosticResult,
  FitGrade,
  GrantNotice,
  NonsanDepartment,
  NonsanProfile,
  StrategicDomain,
} from '../types/grant';

// 기준일: 2026-11-25
export const REFERENCE_DATE_STR = '2026-11-25';

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getDaysRemaining(deadlineDate: string, refDateStr = REFERENCE_DATE_STR): number {
  const target = parseDate(deadlineDate);
  const ref = parseDate(refDateStr);
  const diffMs = target.getTime() - ref.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDDay(days: number): string {
  if (days < 0) return `마감 +${Math.abs(days)}일`;
  if (days === 0) return 'D-Day';
  return `D-${days}`;
}

export function formatOffsetDate(deadlineDate: string, offsetDays: number): string {
  const target = parseDate(deadlineDate);
  target.setDate(target.getDate() - offsetDays);
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${m}.${d}`;
}

export function formatKoreanDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}.${m}.${d}`;
}

const DOMAIN_FALLBACK_DEPT: Record<
  StrategicDomain,
  { primary: NonsanDepartment; collaborators: NonsanDepartment[] }
> = {
  '국방·산업': { primary: '국방산업과', collaborators: ['투자유치과', '미래전략실'] },
  '스마트농업': { primary: '농촌활력과', collaborators: ['농산물유통지원센터', '농업기술센터'] },
  '문화·관광': { primary: '관광과', collaborators: ['문화예술과', '도시재생과'] },
  '정주·인구': { primary: '인구청년과', collaborators: ['도시재생과', '복지정책과'] },
  '환경·안전': { primary: '안전총괄과', collaborators: ['환경과', '농촌활력과'] },
};

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function findBestDepartment(
  domain: StrategicDomain,
  estimatedLocalMatch: number,
  requiresSiteSecured: boolean,
  requiresFeasibilityStudy: boolean,
  profile: NonsanProfile,
  explicitDept?: NonsanDepartment | ''
): { primary: DepartmentResource; collaborators: NonsanDepartment[] } {
  const resources = profile.departmentResources;
  const fallback = DOMAIN_FALLBACK_DEPT[domain];

  if (explicitDept) {
    const found = resources.find((r) => r.dept === explicitDept);
    if (found) {
      return {
        primary: found,
        collaborators: fallback.collaborators.filter((d) => d !== found.dept),
      };
    }
  }

  const domainCandidates = resources.filter((r) => r.domains.includes(domain));
  const pool = domainCandidates.length > 0 ? domainCandidates : resources;

  const scored = pool
    .map((dept) => {
      let fit = 0;
      if (dept.domains[0] === domain) fit += 20;
      if (dept.availableBudget >= estimatedLocalMatch) fit += 25;
      else fit += (dept.availableBudget / Math.max(1, estimatedLocalMatch)) * 20;
      fit += Math.min(15, dept.availableStaff * 4);
      if (!requiresSiteSecured || dept.hasReadySite) fit += 10;
      if (!requiresFeasibilityStudy || dept.canRunFeasibility) fit += 10;
      return { dept, fit };
    })
    .sort((a, b) => b.fit - a.fit);

  const primary = scored[0]?.dept ?? resources[0];
  const collaborators = scored
    .slice(1, 3)
    .map((s) => s.dept.dept)
    .concat(fallback.collaborators)
    .filter((d, idx, arr) => d !== primary.dept && arr.indexOf(d) === idx)
    .slice(0, 2);

  return { primary, collaborators };
}

/**
 * 논산시 전략사업 + 부서별 가용자원 대조 기반 5.0점 만점 자동 평가 엔진
 * 가중치:
 *  1. 전략사업 정합성 (30%)
 *  2. 부서 예산 매칭 여력 (25%)
 *  3. 전담 인력·실행 역량 (20%)
 *  4. 신청자격·지역 가점 (15%)
 *  5. 기존 거점·인프라 연계 (10%)
 */
export function evaluateNonsanFit(
  input: DiagnosticFormInput,
  profile: NonsanProfile = DEFAULT_NONSAN_PROFILE,
  explicitDept?: NonsanDepartment | ''
): DiagnosticResult {
  const daysRemaining = getDaysRemaining(input.deadlineDate);
  const ratio = clamp(input.nationalRatio, 10, 100);
  const totalProjectBudget = round1(input.nationalBudget / (ratio / 100));
  const localTotal = Math.max(0, totalProjectBudget - input.nationalBudget);
  // 도비 30% 분담 가정 시 순수 시비 매칭 추산
  const estimatedLocalMatch = round1(localTotal * 0.7);

  const { primary: deptResource, collaborators } = findBestDepartment(
    input.domain,
    estimatedLocalMatch,
    input.requiresSiteSecured,
    input.requiresFeasibilityStudy,
    profile,
    explicitDept
  );

  // 1. 전략사업 정합성 (가중치 30%, 5.0점 만점)
  const searchCorpus = `${input.title} ${input.summary} ${input.existingAssetNote} ${input.eligibilityText}`.toLowerCase();
  const activeStrategies = profile.strategicProjects.filter((sp) => sp.active);

  const matched = activeStrategies
    .map((sp) => {
      const domainMatch = sp.domain === input.domain;
      const keywordHits = sp.keywords.filter((kw) =>
        searchCorpus.includes(kw.toLowerCase())
      ).length;
      const priorityBonus = sp.priority === '핵심' ? 1.0 : sp.priority === '중점' ? 0.6 : 0.3;
      const rawRelevance = (domainMatch ? 3.2 : 0) + Math.min(1.4, keywordHits * 0.45) + (domainMatch || keywordHits > 0 ? priorityBonus : 0);
      return { sp, domainMatch, keywordHits, rawRelevance };
    })
    .filter((m) => m.domainMatch || m.keywordHits >= 2)
    .sort((a, b) => b.rawRelevance - a.rawRelevance);

  let strategyScore5 = 2.2;
  if (matched.length > 0) {
    strategyScore5 = round1(clamp(matched[0].rawRelevance, 2.5, 5.0));
  }
  const matchedStrategies = matched.slice(0, 2).map((m) => m.sp.name);
  const strategySummary =
    matched.length > 0
      ? `[${matched[0].sp.priority}] ${matched[0].sp.name} 연계 (키워드 ${matched[0].keywordHits}건 일치)`
      : '현재 활성화된 논산시 핵심 전략사업과 직접 연계 약함';

  // 2. 부서 예산 매칭 여력 (가중치 25%, 5.0점 만점)
  const deptBudget = Math.max(0, deptResource.availableBudget);
  const deptBudgetCoveragePct =
    estimatedLocalMatch <= 0
      ? 100
      : Math.min(150, Math.round((deptBudget / estimatedLocalMatch) * 100));

  let fiscalScore5 = 2.0;
  if (estimatedLocalMatch <= 0 || deptBudget >= estimatedLocalMatch * 1.2) {
    fiscalScore5 = ratio >= 70 ? 5.0 : 4.5;
  } else if (deptBudget >= estimatedLocalMatch) {
    fiscalScore5 = ratio >= 70 ? 4.4 : 4.0;
  } else if (deptBudget >= estimatedLocalMatch * 0.7) {
    fiscalScore5 = 3.2;
  } else if (deptBudget >= estimatedLocalMatch * 0.4) {
    fiscalScore5 = 2.2;
  } else {
    fiscalScore5 = 1.4;
  }
  const fiscalSummary = `${deptResource.dept} 가용예산 ${deptBudget}억 vs 추산 시비 ${estimatedLocalMatch}억 (충족률 ${Math.min(100, deptBudgetCoveragePct)}%, 국비 ${ratio}%)`;

  // 3. 전담 인력·실행 역량 (가중치 20%, 5.0점 만점)
  let capacityScore5 = 2.8;
  capacityScore5 += Math.min(1.2, deptResource.availableStaff * 0.35);
  if (input.requiresSiteSecured) {
    capacityScore5 += deptResource.hasReadySite ? 0.6 : -1.1;
  } else {
    capacityScore5 += 0.4;
  }
  if (input.requiresFeasibilityStudy) {
    capacityScore5 += deptResource.canRunFeasibility ? 0.4 : -0.9;
  } else {
    capacityScore5 += 0.3;
  }
  if (daysRemaining < 0) {
    capacityScore5 = 0.5;
  } else if (daysRemaining <= 3) {
    capacityScore5 -= 0.7;
  } else if (daysRemaining <= 7) {
    capacityScore5 -= 0.3;
  }
  capacityScore5 = round1(clamp(capacityScore5, 1.0, 5.0));

  const capacityNotes: string[] = [`전담 ${deptResource.availableStaff}명`];
  if (input.requiresSiteSecured) {
    capacityNotes.push(deptResource.hasReadySite ? '부지 확보 가능' : '사전 부지 미보유');
  }
  if (input.requiresFeasibilityStudy) {
    capacityNotes.push(deptResource.canRunFeasibility ? '타당성 대응 가능' : '용역 자문 필요');
  }
  const capacitySummary = `${deptResource.dept} 실행여력 (${capacityNotes.join(' · ')}, 마감 ${formatDDay(daysRemaining)})`;

  // 4. 신청자격·지역 가점 (가중치 15%, 5.0점 만점)
  let eligibilityScore5 = 2.6;
  const eligParts: string[] = [];
  if (input.populationDeclineBonus) {
    eligibilityScore5 += 1.6;
    eligParts.push('인구감소지역 가점');
  }
  if (input.urbanRuralFit) {
    eligibilityScore5 += 0.8;
    eligParts.push('도농복합시 적합');
  }
  eligibilityScore5 = round1(clamp(eligibilityScore5, 1.5, 5.0));
  const eligibilitySummary =
    eligParts.length > 0
      ? eligParts.join(' · ') + ' — 논산시 지역요건 우위'
      : '일반 지자체 공통 자격 (지역 우대 가점 없음)';

  // 5. 기존 거점·인프라 연계성 (가중치 10%, 5.0점 만점)
  let infraScore5 = input.linksExistingAsset ? 4.4 : 2.2;
  if (input.linksExistingAsset && input.existingAssetNote.trim().length > 6) {
    infraScore5 = 5.0;
  }
  const infraSummary = input.linksExistingAsset
    ? input.existingAssetNote.trim() || '논산시 기존 거점·선행사업 직접 연계 가능'
    : '기존 시 인프라 연계 근거 보강 필요';

  const toStatus = (s: number): '충족' | '보완필요' | '미충족' =>
    s >= 4.0 ? '충족' : s >= 2.8 ? '보완필요' : '미충족';

  const criteria: DiagnosticCriterion[] = [
    {
      key: 'strategy',
      label: '전략사업 정합성',
      weightPercent: 30,
      scoreOutOf5: strategyScore5,
      score: round1((strategyScore5 / 5) * 30),
      maxScore: 30,
      status: toStatus(strategyScore5),
      summary: strategySummary,
    },
    {
      key: 'fiscal',
      label: '부서 예산 매칭 여력',
      weightPercent: 25,
      scoreOutOf5: fiscalScore5,
      score: round1((fiscalScore5 / 5) * 25),
      maxScore: 25,
      status: toStatus(fiscalScore5),
      summary: fiscalSummary,
    },
    {
      key: 'capacity',
      label: '전담 인력·실행 역량',
      weightPercent: 20,
      scoreOutOf5: capacityScore5,
      score: round1((capacityScore5 / 5) * 20),
      maxScore: 20,
      status: toStatus(capacityScore5),
      summary: capacitySummary,
    },
    {
      key: 'eligibility',
      label: '자격·지역 가점',
      weightPercent: 15,
      scoreOutOf5: eligibilityScore5,
      score: round1((eligibilityScore5 / 5) * 15),
      maxScore: 15,
      status: toStatus(eligibilityScore5),
      summary: eligibilitySummary,
    },
    {
      key: 'infrastructure',
      label: '기존 거점 연계성',
      weightPercent: 10,
      scoreOutOf5: infraScore5,
      score: round1((infraScore5 / 5) * 10),
      maxScore: 10,
      status: toStatus(infraScore5),
      summary: infraSummary,
    },
  ];

  const weightedScoreOutOf5 = round1(
    criteria.reduce((sum, c) => sum + c.scoreOutOf5 * (c.weightPercent / 100), 0)
  );
  const totalScore = Math.round((weightedScoreOutOf5 / 5) * 100);

  let grade: FitGrade = 'D';
  let gradeLabel = '부적합·보류';
  if (weightedScoreOutOf5 >= 4.2) {
    grade = 'A';
    gradeLabel = '적극 추천';
  } else if (weightedScoreOutOf5 >= 3.5) {
    grade = 'B';
    gradeLabel = '검토 권장';
  } else if (weightedScoreOutOf5 >= 2.8) {
    grade = 'C';
    gradeLabel = '조건부 검토';
  }

  const strengths: string[] = [];
  const cautions: string[] = [];

  if (matched.length > 0) {
    strengths.push(`논산시 ${matched[0].sp.priority} 전략사업 '${matched[0].sp.name}'과 직접 부합`);
  }
  if (deptBudget >= estimatedLocalMatch) {
    strengths.push(
      `${deptResource.dept} 가용 시비(${deptBudget}억)로 추산 매칭액(${estimatedLocalMatch}억) 자체 수용 가능`
    );
  }
  if (input.populationDeclineBonus) {
    strengths.push('논산시 인구감소지역 지정 요건으로 서류·가점 평가 구조적 우위');
  }
  if (input.linksExistingAsset && input.existingAssetNote.trim()) {
    strengths.push(`기존 거점 연계 강점: ${input.existingAssetNote.trim()}`);
  }

  if (deptBudget < estimatedLocalMatch) {
    cautions.push(
      `${deptResource.dept} 가용예산(${deptBudget}억) 대비 시비 매칭(${estimatedLocalMatch}억) 초과 — 추경 또는 부서간 예산조정 필요`
    );
  }
  if (input.requiresSiteSecured && !deptResource.hasReadySite) {
    cautions.push(`${deptResource.dept} 즉시 활용 부지 미보유 — 공유재산·토지동의 사전 확보 필수`);
  }
  if (input.requiresFeasibilityStudy && !deptResource.canRunFeasibility) {
    cautions.push('사전 타당성 자료 요구 — 충남연구원 또는 외부 전문기관 자문 연계 권장');
  }
  if (daysRemaining >= 0 && daysRemaining <= 3) {
    cautions.push(`마감 ${daysRemaining}일 전(D-3 자동 알림 구간) — 최종 결재 및 전자접수 즉각 완료 필요`);
  } else if (daysRemaining > 3 && daysRemaining <= 10) {
    cautions.push(`접수 마감까지 ${daysRemaining}일 남음 — 부서 협조 공문 및 예산협의 단축 필요`);
  }
  if (matched.length === 0) {
    cautions.push('활성화된 논산시 전략사업 목록과의 직접 매칭 약함 — 시정 연계 논리 보강 필요');
  }

  if (strengths.length === 0) {
    strengths.push('기초지자체 기본 신청 자격 충족 및 부서 검토 가능');
  }
  if (cautions.length === 0) {
    cautions.push('주요 자원·자격 요건 모두 양호 — 공고문 세부 배점표 최종 점검 권장');
  }

  return {
    scoreOutOf5: weightedScoreOutOf5,
    totalScore,
    grade,
    gradeLabel,
    criteria,
    matchedStrategies,
    strengths,
    cautions,
    recommendedDept: deptResource.dept,
    collaboratingDepts: collaborators,
    estimatedLocalMatch,
    deptBudgetCoveragePct,
  };
}

export function recomputeGrantsWithProfile(
  grants: GrantNotice[],
  profile: NonsanProfile
): GrantNotice[] {
  return grants.map((g) => {
    const diagnostic = evaluateNonsanFit(
      {
        title: g.title,
        ministry: g.ministry,
        domain: g.domain,
        summary: g.summary,
        eligibilityText: g.eligibilityText,
        deadlineDate: g.deadlineDate,
        nationalBudget: g.nationalBudget,
        nationalRatio: g.nationalRatio,
        populationDeclineBonus: g.factors.populationDeclineBonus,
        urbanRuralFit: g.factors.urbanRuralFit,
        requiresSiteSecured: g.factors.requiresSiteSecured,
        requiresFeasibilityStudy: g.factors.requiresFeasibilityStudy,
        linksExistingAsset: g.factors.linksExistingAsset,
        existingAssetNote: g.factors.existingAssetNote,
      },
      profile,
      g.assignedDept
    );
    return { ...g, diagnostic };
  });
}

export function buildDefaultChecklist(input: {
  requiresSiteSecured: boolean;
  requiresFeasibilityStudy: boolean;
  nationalRatio: number;
}): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      id: 'chk-1',
      label: '공고문 세부 자격·배점표 검토 및 주관부서 확정',
      done: false,
      dueOffsetDays: 14,
    },
  ];

  if (input.nationalRatio < 85) {
    items.push({
      id: 'chk-2',
      label: '기획감사실 시비 매칭·예산 사전협의 완료',
      done: false,
      dueOffsetDays: 10,
    });
  }

  if (input.requiresSiteSecured) {
    items.push({
      id: 'chk-3',
      label: '대상 부지 현황·소유권 및 인허가 가능 여부 확인',
      done: false,
      dueOffsetDays: 9,
    });
  }

  if (input.requiresFeasibilityStudy) {
    items.push({
      id: 'chk-4',
      label: '기초 수요조사·타당성 근거 자료 및 관계기관 동의서 취합',
      done: false,
      dueOffsetDays: 7,
    });
  }

  items.push(
    {
      id: 'chk-5',
      label: '사업계획서 초안 작성 및 내부 검토회의',
      done: false,
      dueOffsetDays: 5,
    },
    {
      id: 'chk-6',
      label: '최종 결재 및 충남도 경유·중앙부처 전자접수',
      done: false,
      dueOffsetDays: 1,
    }
  );

  return items;
}

export function buildD3AlertMessage(
  grant: GrantNotice,
  deptInfo: DepartmentResource | undefined,
  rule: AlertRuleConfig
): string {
  const days = getDaysRemaining(grant.deadlineDate);
  const recipient = grant.assignedOfficer || deptInfo?.leadOfficer || '담당 주무관';
  const deptName = grant.assignedDept || grant.diagnostic.recommendedDept;
  const pendingItems = grant.checklist.filter((c) => !c.done);

  const lines = [
    `[논산시 공모사업레이더 마감 ${formatDDay(days)} 자동 알림]`,
    `수신: ${deptName} ${recipient}`,
    `사업명: ${grant.title} (${grant.ministry})`,
    `접수 마감: ${formatKoreanDate(grant.deadlineDate)} 18:00 (${formatDDay(days)})`,
    `적합도: ${grant.diagnostic.scoreOutOf5.toFixed(1)} / 5.0 (${grant.diagnostic.gradeLabel}) · 국비 ${grant.nationalBudget}억 원`,
  ];

  if (rule.includeUnfinishedChecklist) {
    if (pendingItems.length > 0) {
      lines.push(
        `미완료 필수 절차(${pendingItems.length}건): ${pendingItems
          .slice(0, 2)
          .map((item) => item.label)
          .join(' / ')}`
      );
    } else {
      lines.push('사전 체크리스트 전체 완료 — 전자접수 최종 제출 확인 바랍니다.');
    }
  }

  return lines.join('\n');
}
