import { useMemo, useState } from 'react';
import { GrantNotice, NonsanDepartment, NonsanProfile } from '../types/grant';

interface DepartmentBudgetBarChartProps {
  grants: GrantNotice[];
  profile: NonsanProfile;
  selectedDept: NonsanDepartment | null;
  onSelectDept: (dept: NonsanDepartment | null) => void;
}

type BudgetScope = 'planned' | 'confirmed';

function computeNiceMax(rawMax: number): number {
  if (rawMax <= 20) return 20;
  if (rawMax <= 50) return 50;
  if (rawMax <= 100) return 100;
  const step = rawMax <= 200 ? 40 : 50;
  return Math.ceil(rawMax / step) * step;
}

export function DepartmentBudgetBarChart({
  grants,
  profile,
  selectedDept,
  onSelectDept,
}: DepartmentBudgetBarChartProps) {
  const [scope, setScope] = useState<BudgetScope>('planned');
  const [hoveredDept, setHoveredDept] = useState<NonsanDepartment | null>(null);

  const chartData = useMemo(() => {
    const filtered = grants.filter((g) => {
      if (scope === 'confirmed') {
        return g.status === '응모확정' || g.status === '제출완료';
      }
      return g.status !== '보류';
    });

    const map = new Map<
      NonsanDepartment,
      {
        dept: NonsanDepartment;
        count: number;
        nationalSum: number;
        localMatchSum: number;
        availableBudget: number;
      }
    >();

    filtered.forEach((g) => {
      const dept = (g.assignedDept || g.diagnostic.recommendedDept) as NonsanDepartment;
      const res = profile.departmentResources.find((r) => r.dept === dept);
      const prev = map.get(dept) || {
        dept,
        count: 0,
        nationalSum: 0,
        localMatchSum: 0,
        availableBudget: res?.availableBudget ?? 20,
      };
      prev.count += 1;
      prev.nationalSum = Math.round((prev.nationalSum + g.nationalBudget) * 10) / 10;
      prev.localMatchSum =
        Math.round((prev.localMatchSum + g.diagnostic.estimatedLocalMatch) * 10) / 10;
      map.set(dept, prev);
    });

    const rows = Array.from(map.values()).sort(
      (a, b) => b.nationalSum - a.nationalSum || b.localMatchSum - a.localMatchSum
    );

    const rawMax = Math.max(
      10,
      ...rows.map((r) => Math.max(r.nationalSum, r.localMatchSum))
    );
    const yMax = computeNiceMax(rawMax);
    const totalNational =
      Math.round(rows.reduce((sum, r) => sum + r.nationalSum, 0) * 10) / 10;
    const totalLocal =
      Math.round(rows.reduce((sum, r) => sum + r.localMatchSum, 0) * 10) / 10;

    return { rows, yMax, totalNational, totalLocal };
  }, [grants, profile.departmentResources, scope]);

  const yTicks = useMemo(() => {
    const { yMax } = chartData;
    return [yMax, Math.round(yMax * 0.75), Math.round(yMax * 0.5), Math.round(yMax * 0.25), 0];
  }, [chartData]);

  const activeInfoRow = useMemo(() => {
    const targetDept = hoveredDept ?? selectedDept;
    if (!targetDept) return chartData.rows[0] ?? null;
    return chartData.rows.find((r) => r.dept === targetDept) ?? null;
  }, [hoveredDept, selectedDept, chartData.rows]);

  return (
    <section
      aria-label="부서별 신청 예정 국비 및 매칭 시비 바 차트"
      className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            부서별 신청 예정 국비 총액 · 매칭 시비 총액 비교
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-blue-700 inline-block rounded-xs" />
              신청 예정 국비{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {chartData.totalNational.toLocaleString()}억 원
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-amber-600 inline-block rounded-xs" />
              매칭 시비{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {chartData.totalLocal.toLocaleString()}억 원
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono tabular-nums">{chartData.rows.length}개 부서</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md"
            role="tablist"
            aria-label="예산 집계 범위"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'planned'}
              onClick={() => setScope('planned')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                scope === 'planned'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              신청 예정 전체
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'confirmed'}
              onClick={() => setScope('confirmed')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                scope === 'confirmed'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              응모확정·제출만
            </button>
          </div>

          {selectedDept && (
            <button
              type="button"
              onClick={() => onSelectDept(null)}
              className="text-xs font-medium text-blue-800 hover:underline whitespace-nowrap"
            >
              부서 필터 해제
            </button>
          )}
        </div>
      </div>

      {/* Grouped Vertical Bar Chart */}
      {chartData.rows.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">
          선택한 집계 범위에 해당하는 등록 공모사업이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto pt-2">
          <div className="min-w-[680px]">
            <div className="flex gap-3">
              {/* Y-Axis Labels */}
              <div className="w-12 h-60 flex flex-col justify-between items-end pr-2 text-[11px] font-mono tabular-nums text-slate-400 shrink-0 select-none">
                {yTicks.map((tick) => (
                  <span key={tick} className="leading-none">
                    {tick}억
                  </span>
                ))}
              </div>

              {/* Plot Area */}
              <div className="relative flex-1 h-60 border-b border-slate-300">
                {/* Horizontal Reference Gridlines */}
                <div
                  className="absolute inset-0 flex flex-col justify-between pointer-events-none"
                  aria-hidden="true"
                >
                  {yTicks.map((tick, idx) => (
                    <div
                      key={tick}
                      className={`w-full ${
                        idx === yTicks.length - 1
                          ? 'border-transparent'
                          : 'border-t border-dashed border-slate-200'
                      }`}
                    />
                  ))}
                </div>

                {/* Department Grouped Bars */}
                <div className="relative z-10 h-full flex items-end justify-around gap-2 px-2">
                  {chartData.rows.map((row) => {
                    const natPct = Math.min(100, (row.nationalSum / chartData.yMax) * 100);
                    const locPct = Math.min(100, (row.localMatchSum / chartData.yMax) * 100);
                    const isSelected = selectedDept === row.dept;
                    const isDimmed = selectedDept !== null && !isSelected;

                    return (
                      <button
                        key={row.dept}
                        type="button"
                        onClick={() => onSelectDept(isSelected ? null : row.dept)}
                        onMouseEnter={() => setHoveredDept(row.dept)}
                        onMouseLeave={() => setHoveredDept(null)}
                        onFocus={() => setHoveredDept(row.dept)}
                        onBlur={() => setHoveredDept(null)}
                        aria-label={`${row.dept}: 신청 예정 국비 ${row.nationalSum}억 원, 매칭 시비 ${row.localMatchSum}억 원`}
                        className={`group flex-1 max-w-[96px] h-full flex flex-col justify-end items-center px-1.5 rounded-t transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
                          isSelected
                            ? 'bg-blue-50/70'
                            : 'hover:bg-slate-50/80'
                        } ${isDimmed ? 'opacity-45 hover:opacity-85' : ''}`}
                      >
                        <div className="w-full h-full flex items-end justify-center gap-1.5">
                          {/* National Budget Bar */}
                          <div className="flex-1 max-w-[28px] h-full flex flex-col justify-end items-center">
                            <span className="mb-1 text-[10px] font-mono tabular-nums font-semibold text-blue-900 leading-none">
                              {row.nationalSum}
                            </span>
                            <div
                              className="w-full bg-blue-700 group-hover:bg-blue-800 rounded-t-xs transition-all duration-200"
                              style={{ height: `${row.nationalSum > 0 ? Math.max(2, natPct) : 0}%` }}
                            />
                          </div>

                          {/* Municipal Matching Bar */}
                          <div className="flex-1 max-w-[28px] h-full flex flex-col justify-end items-center">
                            <span className="mb-1 text-[10px] font-mono tabular-nums font-semibold text-amber-800 leading-none">
                              {row.localMatchSum}
                            </span>
                            <div
                              className="w-full bg-amber-600 group-hover:bg-amber-700 rounded-t-xs transition-all duration-200"
                              style={{
                                height: `${row.localMatchSum > 0 ? Math.max(2, locPct) : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* X-Axis Department Labels */}
            <div className="flex gap-3 mt-2">
              <div className="w-12 shrink-0" />
              <div className="flex-1 flex items-start justify-around gap-2 px-2">
                {chartData.rows.map((row) => {
                  const isSelected = selectedDept === row.dept;
                  return (
                    <div
                      key={row.dept}
                      className="flex-1 max-w-[96px] text-center px-0.5"
                    >
                      <div
                        className={`text-[11px] truncate ${
                          isSelected
                            ? 'font-bold text-blue-800'
                            : 'font-medium text-slate-700'
                        }`}
                        title={row.dept}
                      >
                        {row.dept}
                      </div>
                      <div className="text-[10px] font-mono tabular-nums text-slate-400">
                        {row.count}건
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Inspector Footer */}
      {activeInfoRow && (
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-semibold text-slate-900">
              {activeInfoRow.dept} ({activeInfoRow.count}건)
            </span>
            <span className="text-slate-300">·</span>
            <span>
              국비{' '}
              <strong className="font-mono tabular-nums text-blue-800">
                {activeInfoRow.nationalSum.toLocaleString()}억 원
              </strong>
            </span>
            <span className="text-slate-300">·</span>
            <span>
              매칭 시비{' '}
              <strong className="font-mono tabular-nums text-amber-800">
                {activeInfoRow.localMatchSum.toLocaleString()}억 원
              </strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-mono tabular-nums">
              부서 가용 시비 {activeInfoRow.availableBudget}억 원 (
              {activeInfoRow.localMatchSum > activeInfoRow.availableBudget ? (
                <span className="text-red-700 font-semibold">
                  {Math.round((activeInfoRow.localMatchSum - activeInfoRow.availableBudget) * 10) /
                    10}
                  억 초과
                </span>
              ) : (
                <span className="text-emerald-700 font-medium">
                  여유{' '}
                  {Math.round((activeInfoRow.availableBudget - activeInfoRow.localMatchSum) * 10) /
                    10}
                  억
                </span>
              )}
              )
            </span>
          </div>
          <span className="text-slate-400">막대 클릭 시 하단 임박순 목록 부서 필터링</span>
        </div>
      )}
    </section>
  );
}
