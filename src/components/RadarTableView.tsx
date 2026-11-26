import { ArrowUpDown, ChevronRight, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MINISTRIES, STRATEGIC_DOMAINS, WORKFLOW_STATUSES } from '../data/initialGrants';
import {
  FitGrade,
  GrantNotice,
  Ministry,
  StrategicDomain,
  WorkflowStatus,
} from '../types/grant';
import { formatDDay, formatKoreanDate, getDaysRemaining } from '../utils/diagnostics';

interface RadarTableViewProps {
  grants: GrantNotice[];
  selectedGrantId: string | null;
  onSelectGrant: (grant: GrantNotice) => void;
  onGoToDiagnose: () => void;
}

type SortKey = 'deadline' | 'score' | 'budget' | 'announced';

export function RadarTableView({
  grants,
  selectedGrantId,
  onSelectGrant,
  onGoToDiagnose,
}: RadarTableViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<StrategicDomain | '전체'>('전체');
  const [selectedMinistry, setSelectedMinistry] = useState<Ministry | '전체'>('전체');
  const [selectedStatus, setSelectedStatus] = useState<WorkflowStatus | '전체'>('전체');
  const [selectedGrade, setSelectedGrade] = useState<FitGrade | '전체'>('전체');
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('deadline');

  const kpi = useMemo(() => {
    const active = grants.filter((g) => g.status !== '보류' && g.status !== '제출완료');
    const newThisWeek = grants.filter((g) => g.isNewThisWeek).length;
    const gradeA = active.filter((g) => g.diagnostic.grade === 'A');
    const urgent = active.filter((g) => {
      const d = getDaysRemaining(g.deadlineDate);
      return d >= 0 && d <= 7;
    });
    const nearestUrgentDays =
      urgent.length > 0
        ? Math.min(...urgent.map((g) => getDaysRemaining(g.deadlineDate)))
        : null;
    const confirmed = grants.filter(
      (g) => g.status === '응모확정' || g.status === '제출완료'
    );
    const confirmedNationalBudget = confirmed.reduce((sum, g) => sum + g.nationalBudget, 0);
    const activeTotalBudget = active.reduce((sum, g) => sum + g.nationalBudget, 0);

    return {
      activeCount: active.length,
      newThisWeek,
      activeTotalBudget,
      gradeACount: gradeA.length,
      unassignedGradeACount: gradeA.filter((g) => !g.assignedDept).length,
      urgentCount: urgent.length,
      nearestUrgentDays,
      confirmedCount: confirmed.length,
      confirmedNationalBudget,
    };
  }, [grants]);

  const filteredGrants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return grants
      .filter((g) => {
        if (selectedDomain !== '전체' && g.domain !== selectedDomain) return false;
        if (selectedMinistry !== '전체' && g.ministry !== selectedMinistry) return false;
        if (selectedStatus !== '전체' && g.status !== selectedStatus) return false;
        if (selectedGrade !== '전체' && g.diagnostic.grade !== selectedGrade) return false;
        if (onlyUnreviewed && g.status !== '미검토') return false;
        if (onlyUrgent) {
          const d = getDaysRemaining(g.deadlineDate);
          if (d < 0 || d > 14 || g.status === '보류' || g.status === '제출완료') return false;
        }
        if (q) {
          const hay = [
            g.title,
            g.ministry,
            g.domain,
            g.noticeCode,
            g.assignedDept,
            g.assignedOfficer,
            g.summary,
            g.diagnostic.recommendedDept,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'deadline') {
          return getDaysRemaining(a.deadlineDate) - getDaysRemaining(b.deadlineDate);
        }
        if (sortBy === 'score') {
          return b.diagnostic.scoreOutOf5 - a.diagnostic.scoreOutOf5;
        }
        if (sortBy === 'budget') {
          return b.nationalBudget - a.nationalBudget;
        }
        return b.announcedDate.localeCompare(a.announcedDate);
      });
  }, [
    grants,
    searchQuery,
    selectedDomain,
    selectedMinistry,
    selectedStatus,
    selectedGrade,
    onlyUrgent,
    onlyUnreviewed,
    sortBy,
  ]);

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedDomain !== '전체' ||
    selectedMinistry !== '전체' ||
    selectedStatus !== '전체' ||
    selectedGrade !== '전체' ||
    onlyUrgent ||
    onlyUnreviewed;

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedDomain('전체');
    setSelectedMinistry('전체');
    setSelectedStatus('전체');
    setSelectedGrade('전체');
    setOnlyUrgent(false);
    setOnlyUnreviewed(false);
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip — Flat single-elevation hairline grid */}
      <section
        aria-label="공모사업 핵심 현황"
        className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
      >
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">접수·검토 진행 공모</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
              {kpi.activeCount}건
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              금주 신규 {kpi.newThisWeek}건
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 tabular-nums">
            국비 총 {kpi.activeTotalBudget.toLocaleString()}억 원 규모
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">논산시 적극 추천 (A등급)</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-700 font-mono tabular-nums">
              {kpi.gradeACount}건
            </span>
            <span className="text-xs text-slate-500 tabular-nums">4.2점 이상 (5점 만점)</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 tabular-nums">
            부서 미배정 {kpi.unassignedGradeACount}건 즉시 배정 필요
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">7일 이내 마감 임박</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-red-700 font-mono tabular-nums">
              {kpi.urgentCount}건
            </span>
            {kpi.nearestUrgentDays !== null && (
              <span className="text-xs font-medium text-red-700 font-mono tabular-nums">
                최단 {formatDDay(kpi.nearestUrgentDays)}
              </span>
            )}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            결재 및 전자접수 마감 일정 점검
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">응모 확정 · 제출완료</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-blue-800 font-mono tabular-nums">
              {kpi.confirmedCount}건
            </span>
            <span className="text-xs text-slate-500 tabular-nums">목표 국비 확보</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-600 font-medium tabular-nums">
            국비 신청 {kpi.confirmedNationalBudget.toLocaleString()}억 원
          </div>
        </div>
      </section>

      {/* Filter & Search Toolbar */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5">
        {/* Row 1: Domain segmented buttons + quick toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md"
            role="tablist"
            aria-label="논산 전략분야 필터"
          >
            {(['전체', ...STRATEGIC_DOMAINS] as const).map((domain) => {
              const active = selectedDomain === domain;
              return (
                <button
                  key={domain}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedDomain(domain)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {domain}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyUnreviewed((v) => !v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                onlyUnreviewed
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              미검토만 보기
            </button>
            <button
              type="button"
              onClick={() => setOnlyUrgent((v) => !v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                onlyUrgent
                  ? 'bg-red-700 text-white border-red-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              마감임박(D-14)
            </button>
          </div>
        </div>

        {/* Row 2: Search input + selects */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="공모명, 중앙부처, 담당부서, 키워드 검색 (예: 국방산단, 딸기, 탑정호)"
              className="w-full h-9 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              aria-label="중앙부처 필터"
              value={selectedMinistry}
              onChange={(e) => setSelectedMinistry(e.target.value as Ministry | '전체')}
              className="h-9 px-2.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-700"
            >
              <option value="전체">전체 부처</option>
              {MINISTRIES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              aria-label="적합도 등급 필터"
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value as FitGrade | '전체')}
              className="h-9 px-2.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-700"
            >
              <option value="전체">적합도 전체</option>
              <option value="A">A등급 (적극 추천)</option>
              <option value="B">B등급 (검토 권장)</option>
              <option value="C">C등급 (조건부 검토)</option>
              <option value="D">D등급 (적합도 낮음)</option>
            </select>

            <select
              aria-label="추진상태 필터"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as WorkflowStatus | '전체')}
              className="h-9 px-2.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-700"
            >
              <option value="전체">상태 전체</option>
              {WORKFLOW_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="inline-flex items-center h-9 px-2.5 bg-white border border-slate-200 rounded-md text-xs text-slate-600 gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                aria-label="정렬 기준"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="bg-transparent font-medium text-slate-800 focus:outline-none"
              >
                <option value="deadline">마감임박순</option>
                <option value="score">적합도 높은순</option>
                <option value="budget">국비 규모순</option>
                <option value="announced">최신 공고순</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 h-9 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>초기화</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main High-Density Grant Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="tabular-nums">
            검색 결과 <strong className="text-slate-900 font-semibold">{filteredGrants.length}건</strong> / 전체 {grants.length}건
          </span>
          <span>행 클릭 시 5대 적합성 진단 및 체크리스트 열림</span>
        </div>

        {filteredGrants.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900">
              조건에 해당하는 중앙부처 공모사업이 없습니다.
            </p>
            <p className="text-xs text-slate-500">
              필터를 초기화하거나, 새로 입수한 공고를 적합성 진단기에서 직접 등록할 수 있습니다.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                필터 초기화
              </button>
              <button
                type="button"
                onClick={onGoToDiagnose}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                신규 공모 진단·등록
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 pl-5 pr-3 min-w-[320px]">공모사업명 · 주관부처</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">전략분야</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">국비(보조율)</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">논산 적합도</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">마감 일정</th>
                  <th className="py-2.5 pl-3 pr-5 whitespace-nowrap">추진상태 · 담당부서</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredGrants.map((grant) => {
                  const days = getDaysRemaining(grant.deadlineDate);
                  const isSelected = selectedGrantId === grant.id;
                  const doneCount = grant.checklist.filter((c) => c.done).length;

                  const gradeColor =
                    grant.diagnostic.grade === 'A'
                      ? 'text-emerald-700'
                      : grant.diagnostic.grade === 'B'
                        ? 'text-blue-800'
                        : grant.diagnostic.grade === 'C'
                          ? 'text-amber-700'
                          : 'text-slate-500';

                  const urgencyColor =
                    grant.status === '제출완료' || grant.status === '보류'
                      ? 'text-slate-400'
                      : days <= 7
                        ? 'text-red-700 font-semibold'
                        : days <= 14
                          ? 'text-amber-700 font-semibold'
                          : 'text-slate-800';

                  const statusColor =
                    grant.status === '응모확정'
                      ? 'text-blue-800 font-semibold'
                      : grant.status === '제출완료'
                        ? 'text-emerald-700 font-semibold'
                        : grant.status === '검토중'
                          ? 'text-slate-900 font-medium'
                          : grant.status === '보류'
                            ? 'text-slate-400'
                            : 'text-amber-700 font-medium';

                  return (
                    <tr
                      key={grant.id}
                      onClick={() => onSelectGrant(grant)}
                      className={`group cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3.5 pl-5 pr-3 align-top">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 group-hover:text-blue-800 transition-colors leading-snug">
                              {grant.title}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
                              <span className="font-medium text-slate-700">{grant.ministry}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{grant.noticeCode}</span>
                              {grant.factors.populationDeclineBonus && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-emerald-700">인구감소지역 가점</span>
                                </>
                              )}
                              {grant.isNewThisWeek && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-blue-700 font-medium">금주 신규</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-top whitespace-nowrap text-xs text-slate-700">
                        {grant.domain}
                      </td>

                      <td className="py-3.5 px-3 align-top text-right whitespace-nowrap">
                        <div className="font-mono tabular-nums font-semibold text-slate-900 text-xs">
                          {grant.nationalBudget.toLocaleString()}억 원
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                          국비 {grant.nationalRatio}% · 시비 약 {grant.diagnostic.estimatedLocalMatch}억
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-top text-right whitespace-nowrap">
                        <div className={`font-mono tabular-nums font-semibold text-xs ${gradeColor}`}>
                          {grant.diagnostic.scoreOutOf5.toFixed(1)} / 5.0
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {grant.diagnostic.grade}등급 · {grant.diagnostic.gradeLabel}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-top text-right whitespace-nowrap">
                        <div className={`font-mono tabular-nums text-xs ${urgencyColor}`}>
                          {formatDDay(days)}
                          {days >= 0 && days <= 7 && grant.status !== '제출완료' && grant.status !== '보류'
                            ? ' 긴급'
                            : ''}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                          {formatKoreanDate(grant.deadlineDate)}
                        </div>
                      </td>

                      <td className="py-3.5 pl-3 pr-5 align-top whitespace-nowrap">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className={`text-xs ${statusColor}`}>
                              {grant.status}
                              {grant.status === '응모확정' || grant.status === '검토중' ? (
                                <span className="ml-1.5 font-mono tabular-nums text-slate-400 font-normal">
                                  ({doneCount}/{grant.checklist.length})
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {grant.assignedDept ? (
                                <>
                                  {grant.assignedDept}
                                  {grant.assignedOfficer ? ` · ${grant.assignedOfficer}` : ''}
                                </>
                              ) : (
                                <span className="text-slate-400">
                                  미배정 (추천: {grant.diagnostic.recommendedDept})
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 shrink-0 transition-colors" />
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
