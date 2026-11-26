import { ArrowRight, BellRing, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { STRATEGIC_DOMAINS } from '../data/initialGrants';
import {
  ActiveTab,
  GrantNotice,
  NonsanDepartment,
  NonsanProfile,
  StrategicDomain,
} from '../types/grant';
import { formatDDay, formatKoreanDate, getDaysRemaining } from '../utils/diagnostics';
import { DepartmentBudgetBarChart } from './DepartmentBudgetBarChart';

interface DashboardViewProps {
  grants: GrantNotice[];
  profile: NonsanProfile;
  triggerDays: number;
  onSelectGrant: (grant: GrantNotice) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

type UrgencyBucket = 'all' | 'd3' | 'd7' | 'd14' | 'd30' | 'd31plus';

export function DashboardView({
  grants,
  profile,
  triggerDays,
  onSelectGrant,
  onNavigateTab,
}: DashboardViewProps) {
  const [selectedBucket, setSelectedBucket] = useState<UrgencyBucket>('all');
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<StrategicDomain | null>(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<NonsanDepartment | null>(null);

  const activeGrants = useMemo(
    () => grants.filter((g) => g.status !== '보류' && g.status !== '제출완료'),
    [grants]
  );

  // 1. KPI Summary
  const summary = useMemo(() => {
    const d3Targets = activeGrants.filter((g) => {
      const d = getDaysRemaining(g.deadlineDate);
      return d >= 0 && d <= triggerDays;
    });
    const avgScore5 =
      activeGrants.length > 0
        ? activeGrants.reduce((s, g) => s + g.diagnostic.scoreOutOf5, 0) / activeGrants.length
        : 0;
    const topRecommended = activeGrants.filter((g) => g.diagnostic.scoreOutOf5 >= 4.2);
    const totalNational = activeGrants.reduce((s, g) => s + g.nationalBudget, 0);
    const confirmedNational = grants
      .filter((g) => g.status === '응모확정' || g.status === '제출완료')
      .reduce((s, g) => s + g.nationalBudget, 0);

    return {
      activeCount: activeGrants.length,
      d3Count: d3Targets.length,
      avgScore5,
      topRecommendedCount: topRecommended.length,
      totalNational,
      confirmedNational,
    };
  }, [activeGrants, grants, triggerDays]);

  // 2. 마감 임박순 버킷 데이터
  const urgencyBuckets = useMemo(() => {
    const counts = {
      d3: 0,
      d7: 0,
      d14: 0,
      d30: 0,
      d31plus: 0,
    };
    activeGrants.forEach((g) => {
      const d = getDaysRemaining(g.deadlineDate);
      if (d <= 3) counts.d3 += 1;
      else if (d <= 7) counts.d7 += 1;
      else if (d <= 14) counts.d14 += 1;
      else if (d <= 30) counts.d30 += 1;
      else counts.d31plus += 1;
    });
    const maxCount = Math.max(1, ...Object.values(counts));
    return [
      {
        key: 'd3' as const,
        label: `D-${triggerDays} 자동알림`,
        count: counts.d3,
        barClass: 'bg-red-600',
        textClass: 'text-red-700',
        pct: Math.round((counts.d3 / maxCount) * 100),
      },
      {
        key: 'd7' as const,
        label: 'D-4 ~ D-7 임박',
        count: counts.d7,
        barClass: 'bg-amber-600',
        textClass: 'text-amber-700',
        pct: Math.round((counts.d7 / maxCount) * 100),
      },
      {
        key: 'd14' as const,
        label: 'D-8 ~ D-14 주의',
        count: counts.d14,
        barClass: 'bg-blue-700',
        textClass: 'text-blue-800',
        pct: Math.round((counts.d14 / maxCount) * 100),
      },
      {
        key: 'd30' as const,
        label: 'D-15 ~ D-30 준비',
        count: counts.d30,
        barClass: 'bg-slate-600',
        textClass: 'text-slate-700',
        pct: Math.round((counts.d30 / maxCount) * 100),
      },
      {
        key: 'd31plus' as const,
        label: 'D-31 이후 장기',
        count: counts.d31plus,
        barClass: 'bg-slate-400',
        textClass: 'text-slate-600',
        pct: Math.round((counts.d31plus / maxCount) * 100),
      },
    ];
  }, [activeGrants, triggerDays]);

  // 3. 분야별 시각화 데이터
  const domainStats = useMemo(() => {
    const rows = STRATEGIC_DOMAINS.map((domain) => {
      const items = activeGrants.filter((g) => g.domain === domain);
      const nationalSum = items.reduce((s, g) => s + g.nationalBudget, 0);
      const avgScore5 =
        items.length > 0
          ? items.reduce((s, g) => s + g.diagnostic.scoreOutOf5, 0) / items.length
          : 0;
      const urgentCount = items.filter((g) => getDaysRemaining(g.deadlineDate) <= 7).length;
      return { domain, count: items.length, nationalSum, avgScore5, urgentCount };
    });
    const maxBudget = Math.max(1, ...rows.map((r) => r.nationalSum));
    return rows.map((r) => ({
      ...r,
      budgetPct: Math.round((r.nationalSum / maxBudget) * 100),
    }));
  }, [activeGrants]);

  // 4. 부서별 시각화 데이터 (필요 시비 매칭 vs 부서 가용예산 비교 포함)
  const deptStats = useMemo(() => {
    const deptMap = new Map<
      NonsanDepartment,
      {
        dept: NonsanDepartment;
        count: number;
        nationalSum: number;
        localMatchSum: number;
        availableBudget: number;
        avgScore5: number;
        nearestDays: number;
      }
    >();

    activeGrants.forEach((g) => {
      const dept = (g.assignedDept || g.diagnostic.recommendedDept) as NonsanDepartment;
      const res = profile.departmentResources.find((r) => r.dept === dept);
      const existing = deptMap.get(dept) || {
        dept,
        count: 0,
        nationalSum: 0,
        localMatchSum: 0,
        availableBudget: res?.availableBudget ?? 20,
        avgScore5: 0,
        nearestDays: 999,
      };
      const days = getDaysRemaining(g.deadlineDate);
      existing.count += 1;
      existing.nationalSum += g.nationalBudget;
      existing.localMatchSum =
        Math.round((existing.localMatchSum + g.diagnostic.estimatedLocalMatch) * 10) / 10;
      existing.avgScore5 += g.diagnostic.scoreOutOf5;
      existing.nearestDays = Math.min(existing.nearestDays, days);
      deptMap.set(dept, existing);
    });

    const list = Array.from(deptMap.values())
      .map((row) => ({
        ...row,
        avgScore5: Math.round((row.avgScore5 / Math.max(1, row.count)) * 10) / 10,
      }))
      .sort((a, b) => a.nearestDays - b.nearestDays);

    const maxBudgetScale = Math.max(
      1,
      ...list.map((r) => Math.max(r.availableBudget, r.localMatchSum))
    );

    return list.map((r) => ({
      ...r,
      localPct: Math.round((r.localMatchSum / maxBudgetScale) * 100),
      availPct: Math.round((r.availableBudget / maxBudgetScale) * 100),
      overBudget: r.localMatchSum > r.availableBudget,
    }));
  }, [activeGrants, profile.departmentResources]);

  // 5. 임박순 정렬 + 차트 인터랙션 필터 리스트
  const imminentList = useMemo(() => {
    return activeGrants
      .filter((g) => {
        const d = getDaysRemaining(g.deadlineDate);
        if (selectedBucket === 'd3' && d > 3) return false;
        if (selectedBucket === 'd7' && (d <= 3 || d > 7)) return false;
        if (selectedBucket === 'd14' && (d <= 7 || d > 14)) return false;
        if (selectedBucket === 'd30' && (d <= 14 || d > 30)) return false;
        if (selectedBucket === 'd31plus' && d <= 30) return false;
        if (selectedDomainFilter && g.domain !== selectedDomainFilter) return false;
        if (selectedDeptFilter) {
          const dept = g.assignedDept || g.diagnostic.recommendedDept;
          if (dept !== selectedDeptFilter) return false;
        }
        return true;
      })
      .sort((a, b) => getDaysRemaining(a.deadlineDate) - getDaysRemaining(b.deadlineDate));
  }, [activeGrants, selectedBucket, selectedDomainFilter, selectedDeptFilter]);

  const hasChartFilter =
    selectedBucket !== 'all' || selectedDomainFilter !== null || selectedDeptFilter !== null;

  return (
    <div className="space-y-6">
      {/* D-3 Automatic Alert Banner */}
      {summary.d3Count > 0 && (
        <div className="bg-white border border-red-200 rounded-lg px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <BellRing className="w-4 h-4 text-red-700 shrink-0 mt-0.5 sm:mt-0" />
            <div className="text-sm text-slate-900">
              <strong className="text-red-700 font-semibold">
                마감 {triggerDays}일 전(D-{triggerDays}) 자동 알림 대상 {summary.d3Count}건
              </strong>
              <span className="text-slate-600 ml-2 text-xs sm:text-sm">
                담당자 알림 발송 현황 및 미완료 절차를 바로 점검할 수 있습니다.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('alerts')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-800 whitespace-nowrap shrink-0"
          >
            <span>D-3 알림 발송 센터 열기</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top 4-Metric KPI Strip */}
      <section
        aria-label="종합 핵심 지표"
        className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
      >
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">진행중 중앙부처 공모</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {summary.activeCount}건
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              국비 {summary.totalNational.toLocaleString()}억
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            응모확정·제출 {summary.confirmedNational.toLocaleString()}억 원
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">논산 평균 적합도 (5점 만점)</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-blue-800">
              {summary.avgScore5.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 5.0</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            전략·자원 대조 4.2점 이상 적극추천 {summary.topRecommendedCount}건
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">D-{triggerDays} 자동 알림 대상</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-red-700">
              {summary.d3Count}건
            </span>
            <span className="text-xs text-red-700 font-medium">즉시 대응</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            매일 08:30 자동 스케줄러 기준 감지
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">연계 활성 전략사업</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
              {profile.strategicProjects.filter((p) => p.active).length}개
            </span>
            <span className="text-xs text-slate-500">
              부서자원 {profile.departmentResources.length}개 과 연동
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('matching')}
            className="mt-1.5 text-xs font-medium text-blue-800 hover:underline"
          >
            전략·자원 조건 조정하기
          </button>
        </div>
      </section>

      {/* Department National Grant vs Municipal Matching Bar Chart */}
      <DepartmentBudgetBarChart
        grants={grants}
        profile={profile}
        selectedDept={selectedDeptFilter}
        onSelectDept={setSelectedDeptFilter}
      />

      {/* Visualization Row: 1) 마감 임박순 분포  2) 분야별 규모·적합도 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Chart 1: 마감 임박순 분포 */}
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">마감 임박순 분포</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                구간 클릭 시 하단 임박순 목록 필터링
              </p>
            </div>
            {selectedBucket !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedBucket('all')}
                className="text-xs text-blue-800 hover:underline whitespace-nowrap"
              >
                전체 보기
              </button>
            )}
          </div>

          <div className="space-y-3">
            {urgencyBuckets.map((b) => {
              const isSelected = selectedBucket === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setSelectedBucket(isSelected ? 'all' : b.key)}
                  className={`w-full text-left p-2 -mx-2 rounded-md transition-colors ${
                    isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className={`font-medium ${b.textClass}`}>{b.label}</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {b.count}건
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className={`h-full rounded-sm transition-all duration-200 ${b.barClass}`}
                      style={{ width: `${b.count === 0 ? 0 : Math.max(8, b.pct)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Chart 2: 분야별 국비 규모 및 5점 적합도 */}
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">분야별 국비 규모 · 평균 적합도</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                분야 행 클릭 시 해당 분야 임박 공고만 하단에 표시
              </p>
            </div>
            {selectedDomainFilter && (
              <button
                type="button"
                onClick={() => setSelectedDomainFilter(null)}
                className="text-xs text-blue-800 hover:underline whitespace-nowrap"
              >
                분야 해제
              </button>
            )}
          </div>

          <div className="space-y-3">
            {domainStats.map((row) => {
              const active = selectedDomainFilter === row.domain;
              return (
                <button
                  key={row.domain}
                  type="button"
                  onClick={() => setSelectedDomainFilter(active ? null : row.domain)}
                  className={`w-full text-left p-2 -mx-2 rounded-md transition-colors ${
                    active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{row.domain}</span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono tabular-nums text-slate-600">{row.count}건</span>
                      {row.urgentCount > 0 && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-red-700 font-medium font-mono tabular-nums">
                            D-7 임박 {row.urgentCount}건
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span className="text-slate-900 font-semibold">
                        국비 {row.nationalSum.toLocaleString()}억
                      </span>
                      <span
                        className={`font-semibold ${
                          row.avgScore5 >= 4.2
                            ? 'text-emerald-700'
                            : row.avgScore5 >= 3.5
                              ? 'text-blue-800'
                              : 'text-amber-700'
                        }`}
                      >
                        평균 {row.avgScore5.toFixed(1)} / 5.0
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-slate-900 rounded-sm transition-all duration-200"
                      style={{ width: `${row.nationalSum === 0 ? 0 : Math.max(6, row.budgetPct)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Chart 3: 부서별 시비 매칭 소요 vs 가용 예산 비교 시각화 */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              부서별 공모 현황 · 가용 시비 예산 대비 매칭 부하
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              각 부서의 추진(또는 추천) 공고 추산 시비 합계와 현재 입력된 부서 가용예산을 비교합니다.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-slate-200 inline-block rounded-xs" />
              부서 가용예산
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-blue-700 inline-block rounded-xs" />
              추산 시비 매칭
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-red-600 inline-block rounded-xs" />
              예산 초과(협의 필요)
            </span>
            {selectedDeptFilter && (
              <button
                type="button"
                onClick={() => setSelectedDeptFilter(null)}
                className="text-blue-800 hover:underline font-medium"
              >
                부서 해제
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">
          {deptStats.map((row) => {
            const active = selectedDeptFilter === row.dept;
            return (
              <button
                key={row.dept}
                type="button"
                onClick={() => setSelectedDeptFilter(active ? null : row.dept)}
                className={`text-left p-2.5 -mx-2 rounded-md transition-colors ${
                  active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-slate-900 whitespace-nowrap">
                      {row.dept}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono tabular-nums text-slate-600">{row.count}건</span>
                    <span className="text-slate-300">·</span>
                    <span
                      className={`font-mono tabular-nums ${
                        row.nearestDays <= 3
                          ? 'text-red-700 font-semibold'
                          : 'text-slate-500'
                      }`}
                    >
                      최단 {formatDDay(row.nearestDays)}
                    </span>
                  </div>
                  <div className="font-mono tabular-nums text-right shrink-0">
                    <span className={row.overBudget ? 'text-red-700 font-semibold' : 'text-slate-900 font-semibold'}>
                      시비 {row.localMatchSum}억
                    </span>
                    <span className="text-slate-400"> / 가용 {row.availableBudget}억</span>
                  </div>
                </div>

                {/* Layered Comparative Bar */}
                <div className="relative h-3 w-full bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-slate-300/70 rounded-sm"
                    style={{ width: `${Math.max(4, row.availPct)}%` }}
                  />
                  <div
                    className={`absolute inset-y-0.5 left-0 rounded-xs transition-all duration-200 ${
                      row.overBudget ? 'bg-red-600' : 'bg-blue-700'
                    }`}
                    style={{ width: `${Math.max(4, row.localPct)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Bottom Interactive Table: 마감 임박순 실시간 우선순위 목록 */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-sm font-bold text-slate-900">접수 마감 임박순 우선 점검 목록</h2>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {imminentList.length}건
            </span>
          </div>
          {hasChartFilter && (
            <button
              type="button"
              onClick={() => {
                setSelectedBucket('all');
                setSelectedDomainFilter(null);
                setSelectedDeptFilter(null);
              }}
              className="text-xs font-medium text-blue-800 hover:underline"
            >
              차트 필터 모두 초기화
            </button>
          )}
        </div>

        {imminentList.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            선택한 조건에 해당하는 진행 중 공고가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">마감 임박</th>
                  <th className="py-2.5 px-3 min-w-[280px]">공모사업명 · 주관부처</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">분야</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">담당/추천부서</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">국비(추산시비)</th>
                  <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">5점 적합도</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {imminentList.map((grant) => {
                  const days = getDaysRemaining(grant.deadlineDate);
                  const isD3 = days >= 0 && days <= triggerDays;
                  return (
                    <tr
                      key={grant.id}
                      onClick={() => onSelectGrant(grant)}
                      className="group hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 pl-5 pr-3 whitespace-nowrap">
                        <div
                          className={`text-xs font-mono tabular-nums font-bold ${
                            isD3
                              ? 'text-red-700'
                              : days <= 7
                                ? 'text-amber-700'
                                : 'text-slate-800'
                          }`}
                        >
                          {formatDDay(days)}
                          {isD3 ? ' 자동알림' : ''}
                        </div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums">
                          {formatKoreanDate(grant.deadlineDate)}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-800 transition-colors leading-snug">
                          {grant.title}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {grant.ministry} · {grant.status}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-xs text-slate-700 whitespace-nowrap">
                        {grant.domain}
                      </td>

                      <td className="py-3 px-3 text-xs whitespace-nowrap">
                        <div className="text-slate-800 font-medium">
                          {grant.assignedDept || `${grant.diagnostic.recommendedDept} (추천)`}
                        </div>
                        {grant.assignedOfficer && (
                          <div className="text-slate-500">{grant.assignedOfficer}</div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {grant.nationalBudget.toLocaleString()}억
                        </div>
                        <div className="text-slate-500">
                          시비 약 {grant.diagnostic.estimatedLocalMatch}억
                        </div>
                      </td>

                      <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <div>
                            <div
                              className={`text-xs font-mono tabular-nums font-bold ${
                                grant.diagnostic.scoreOutOf5 >= 4.2
                                  ? 'text-emerald-700'
                                  : grant.diagnostic.scoreOutOf5 >= 3.5
                                    ? 'text-blue-800'
                                    : 'text-amber-700'
                              }`}
                            >
                              {grant.diagnostic.scoreOutOf5.toFixed(1)} / 5.0
                            </div>
                            <div className="text-xs text-slate-500">
                              {grant.diagnostic.gradeLabel}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
