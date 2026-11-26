import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Printer,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  ActiveTab,
  AuditCategory,
  AuditIssue,
  AuditSeverity,
  NonsanDepartment,
} from '../types/grant';
import {
  buildErrorReportText,
  ErrorAuditSummary,
} from '../utils/errorAudit';
import { formatKoreanDate, REFERENCE_DATE_STR } from '../utils/diagnostics';

interface ErrorReportViewProps {
  audit: ErrorAuditSummary;
  onOpenGrant: (grantId: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onClearRuntimeErrors: () => void;
  onNotify: (msg: string) => void;
}

const SEVERITIES: Array<AuditSeverity | '전체'> = ['전체', '심각', '주의', '경미'];

export function ErrorReportView({
  audit,
  onOpenGrant,
  onNavigateTab,
  onClearRuntimeErrors,
  onNotify,
}: ErrorReportViewProps) {
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | '전체'>('전체');
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | '전체'>('전체');
  const [deptFilter, setDeptFilter] = useState<NonsanDepartment | '공통·시스템' | '전체'>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedDone, setCopiedDone] = useState(false);

  const filteredIssues = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return audit.issues.filter((item) => {
      if (severityFilter !== '전체' && item.severity !== severityFilter) return false;
      if (categoryFilter !== '전체' && item.category !== categoryFilter) return false;
      if (deptFilter !== '전체' && item.department !== deptFilter) return false;
      if (q) {
        const hay = `${item.targetTitle} ${item.department} ${item.detail} ${item.category} ${item.recommendation}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [audit.issues, severityFilter, categoryFilter, deptFilter, searchQuery]);

  const maxCategoryCount = Math.max(1, ...audit.byCategory.map((c) => c.total));
  const maxDeptCount = Math.max(1, ...audit.byDepartment.map((d) => d.total));

  const hasFilters =
    severityFilter !== '전체' ||
    categoryFilter !== '전체' ||
    deptFilter !== '전체' ||
    searchQuery !== '';

  const resetFilters = () => {
    setSeverityFilter('전체');
    setCategoryFilter('전체');
    setDeptFilter('전체');
    setSearchQuery('');
  };

  const handleCopyReport = async () => {
    const text = buildErrorReportText(audit);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDone(true);
      onNotify('전체 오류 통계 보고서를 공문서 개조식으로 클립보드에 복사했습니다.');
      window.setTimeout(() => setCopiedDone(false), 2000);
    } catch {
      onNotify('클립보드 복사가 제한되어 CSV 다운로드를 이용해 주세요.');
    }
  };

  const handleExportCsv = () => {
    const headers = ['심각도', '오류유형', '담당부서', '대상사업·항목', '상세원인', '권고조치'];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = audit.issues.map((i) => [
      i.severity,
      i.category,
      i.department,
      i.targetTitle,
      i.detail,
      i.recommendation,
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `논산시_공모사업레이더_전체오류통계보고서_${REFERENCE_DATE_STR}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify('전체 오류 통계 CSV 파일을 내려받았습니다.');
  };

  const handleAction = (item: AuditIssue) => {
    if (item.targetTab) {
      onNavigateTab(item.targetTab);
      if (item.grantId && item.targetTab !== 'alerts' && item.targetTab !== 'matching') {
        onOpenGrant(item.grantId);
      }
      return;
    }
    if (item.grantId) {
      onOpenGrant(item.grantId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Report Export Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            전체 오류 통계 보고서
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            기준일 {formatKoreanDate(REFERENCE_DATE_STR)} 기준 등록 공고·부서 예산·D-3 알림·계획서 초안·API 실행 이력을 전수 점검해 오류 통계를 산출합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>인쇄 · PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>오류 통계 CSV</span>
          </button>

          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            {copiedDone ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>보고서 복사 완료</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>개조식 보고서 복사</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Top 4-Metric KPI Strip */}
      <section
        aria-label="전체 오류 핵심 통계"
        className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
      >
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">전체 탐지 오류</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {audit.totalIssues}건
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              점검 {audit.checkedPoints}개 항목
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
            심각 {audit.criticalCount} · 주의 {audit.warningCount} · 경미 {audit.minorCount}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">심각 (즉시 조치 필요)</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                audit.criticalCount > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              {audit.criticalCount}건
            </span>
            <span className="text-xs text-slate-500">
              {audit.criticalCount > 0 ? '마감·예산·API 우선' : '긴급 오류 없음'}
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            발생 부서 {audit.byDepartment.filter((d) => d.critical > 0).length}곳
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">데이터·일정 건전성 지수</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                audit.healthRatePct >= 85
                  ? 'text-emerald-700'
                  : audit.healthRatePct >= 65
                    ? 'text-blue-800'
                    : 'text-amber-700'
              }`}
            >
              {audit.healthRatePct}%
            </span>
            <span className="text-xs text-slate-500">정상 통과율</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            오류 해결 시 실시간 자동 재산출
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">계획서 미확인 · 시스템 오류</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-amber-700">
              {audit.proposalUnverifiedCount + audit.runtimeErrorCount}건
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              API {audit.runtimeErrorCount}건
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono tabular-nums">
              [확인 필요] {audit.proposalUnverifiedCount}건
            </span>
            {audit.runtimeErrorCount > 0 && (
              <button
                type="button"
                onClick={onClearRuntimeErrors}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-red-700"
              >
                <Trash2 className="w-3 h-3" />
                <span>API 이력 비우기</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Two-Column Statistical Breakdown Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Chart 1: 오류 유형별 분포 */}
        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">오류 유형별 발생 통계</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                유형 행 클릭 시 하단 상세 내역 필터링 (심각·주의·경미 누적 막대)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-red-600 inline-block rounded-xs" />
                심각
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-amber-500 inline-block rounded-xs" />
                주의
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-slate-400 inline-block rounded-xs" />
                경미
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {audit.byCategory.map((row) => {
              const active = categoryFilter === row.category;
              const critPct = (row.critical / maxCategoryCount) * 100;
              const warnPct = (row.warning / maxCategoryCount) * 100;
              const minorPct = (row.minor / maxCategoryCount) * 100;

              return (
                <button
                  key={row.category}
                  type="button"
                  onClick={() =>
                    setCategoryFilter(active ? '전체' : row.category)
                  }
                  className={`w-full text-left p-2 -mx-2 rounded-md transition-colors ${
                    active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-900">{row.category}</span>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="text-slate-500">
                        심각 {row.critical} · 주의 {row.warning} · 경미 {row.minor}
                      </span>
                      <span className="font-bold text-slate-900 w-8 text-right">
                        {row.total}건
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden flex">
                    {row.critical > 0 && (
                      <div
                        className="h-full bg-red-600"
                        style={{ width: `${critPct}%` }}
                      />
                    )}
                    {row.warning > 0 && (
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${warnPct}%` }}
                      />
                    )}
                    {row.minor > 0 && (
                      <div
                        className="h-full bg-slate-400"
                        style={{ width: `${minorPct}%` }}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Chart 2: 부서별 오류 집중도 */}
        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">부서별 오류 집중 현황</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                부서 행 클릭 시 해당 부서의 미조치 오류 내역만 하단에 표시
              </p>
            </div>
            {deptFilter !== '전체' && (
              <button
                type="button"
                onClick={() => setDeptFilter('전체')}
                className="text-xs text-blue-800 hover:underline whitespace-nowrap"
              >
                부서 해제
              </button>
            )}
          </div>

          {audit.byDepartment.length === 0 ? (
            <div className="py-10 text-center text-xs text-emerald-700 flex flex-col items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>현재 탐지된 부서별 오류가 없습니다.</span>
            </div>
          ) : (
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {audit.byDepartment.map((row) => {
                const active = deptFilter === row.department;
                const critPct = (row.critical / maxDeptCount) * 100;
                const warnPct = (row.warning / maxDeptCount) * 100;
                const minorPct = (row.minor / maxDeptCount) * 100;

                return (
                  <button
                    key={row.department}
                    type="button"
                    onClick={() =>
                      setDeptFilter(active ? '전체' : row.department)
                    }
                    className={`w-full text-left p-2 -mx-2 rounded-md transition-colors ${
                      active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-900">{row.department}</span>
                      <div className="flex items-center gap-2 font-mono tabular-nums">
                        {row.critical > 0 && (
                          <span className="text-red-700 font-semibold">
                            심각 {row.critical}
                          </span>
                        )}
                        {row.warning > 0 && (
                          <span className="text-amber-700">주의 {row.warning}</span>
                        )}
                        {row.minor > 0 && (
                          <span className="text-slate-500">경미 {row.minor}</span>
                        )}
                        <span className="font-bold text-slate-900 w-8 text-right">
                          {row.total}건
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden flex">
                      {row.critical > 0 && (
                        <div className="h-full bg-red-600" style={{ width: `${critPct}%` }} />
                      )}
                      {row.warning > 0 && (
                        <div className="h-full bg-amber-500" style={{ width: `${warnPct}%` }} />
                      )}
                      {row.minor > 0 && (
                        <div className="h-full bg-slate-400" style={{ width: `${minorPct}%` }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Detailed Audit Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">전체 오류 상세 내역</h2>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {filteredIssues.length}건 / 전체 {audit.totalIssues}건
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div
              className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md"
              role="tablist"
              aria-label="심각도 필터"
            >
              {SEVERITIES.map((sev) => (
                <button
                  key={sev}
                  type="button"
                  role="tab"
                  aria-selected={severityFilter === sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    severityFilter === sev
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="부서·공고·원인 검색"
                className="h-8 pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-700 w-44"
              />
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 h-8 px-2 text-xs text-slate-600 hover:text-slate-900 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>초기화</span>
              </button>
            )}
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">
              {audit.totalIssues === 0
                ? '모든 전수 점검 항목이 정상 통과되었습니다.'
                : '선택한 조건에 해당하는 오류가 없습니다.'}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-medium text-blue-800 hover:underline"
              >
                필터 초기화
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">심각도 · 유형</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">담당 부서</th>
                  <th className="py-2.5 px-3 min-w-[300px]">대상 및 오류 원인</th>
                  <th className="py-2.5 px-3 min-w-[220px]">권고 조치</th>
                  <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap print:hidden">
                    바로가기
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredIssues.map((item) => {
                  const sevClass =
                    item.severity === '심각'
                      ? 'text-red-700 font-bold'
                      : item.severity === '주의'
                        ? 'text-amber-700 font-semibold'
                        : 'text-slate-600 font-medium';

                  return (
                    <tr key={item.id} className="align-top hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 pl-5 pr-3 whitespace-nowrap">
                        <div className={sevClass}>{item.severity}</div>
                        <div className="mt-0.5 text-slate-500">{item.category}</div>
                      </td>

                      <td className="py-3.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {item.department}
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900 text-sm leading-snug">
                          {item.targetTitle}
                        </div>
                        <p className="mt-1 text-slate-600 leading-relaxed">{item.detail}</p>
                      </td>

                      <td className="py-3.5 px-3 text-slate-700 leading-relaxed">
                        {item.recommendation}
                      </td>

                      <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap print:hidden">
                        <button
                          type="button"
                          onClick={() => handleAction(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                        >
                          <span>조치 이동</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
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
