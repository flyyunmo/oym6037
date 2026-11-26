import { ChevronLeft, ChevronRight, Copy, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { GrantNotice } from '../types/grant';
import {
  formatDDay,
  formatKoreanDate,
  formatOffsetDate,
  getDaysRemaining,
  REFERENCE_DATE_STR,
} from '../utils/diagnostics';

interface ScheduleViewProps {
  grants: GrantNotice[];
  onSelectGrant: (grant: GrantNotice) => void;
  onCopyWeeklyReport: () => void;
  onExportCsv: () => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function ScheduleView({
  grants,
  onSelectGrant,
  onCopyWeeklyReport,
  onExportCsv,
}: ScheduleViewProps) {
  // Default view: December 2026 (where peak deadlines cluster), switchable to Nov 2026 & Jan 2027
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(12); // 1-12
  const [hideDeferred, setHideDeferred] = useState(true);

  const visibleGrants = useMemo(() => {
    return grants
      .filter((g) => (hideDeferred ? g.status !== '보류' : true))
      .sort((a, b) => getDaysRemaining(a.deadlineDate) - getDaysRemaining(b.deadlineDate));
  }, [grants, hideDeferred]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{
      dateStr: string | null;
      dayNum: number | null;
      items: GrantNotice[];
    }> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({ dateStr: null, dayNum: null, items: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(
        2,
        '0'
      )}`;
      const items = visibleGrants.filter((g) => g.deadlineDate === dateStr);
      cells.push({ dateStr, dayNum: d, items });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ dateStr: null, dayNum: null, items: [] });
    }
    return cells;
  }, [viewYear, viewMonth, visibleGrants]);

  const groupedTimeline = useMemo(() => {
    const active = visibleGrants.filter((g) => g.status !== '제출완료');
    return {
      urgent: active.filter((g) => {
        const d = getDaysRemaining(g.deadlineDate);
        return d >= 0 && d <= 7;
      }),
      thisMonth: active.filter((g) => {
        const d = getDaysRemaining(g.deadlineDate);
        return d > 7 && d <= 30;
      }),
      upcoming: active.filter((g) => getDaysRemaining(g.deadlineDate) > 30),
      submitted: visibleGrants.filter((g) => g.status === '제출완료'),
    };
  }, [visibleGrants]);

  const shiftMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewYear(y);
    setViewMonth(m);
  };

  return (
    <div className="space-y-6">
      {/* Header & Weekly Report Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            공모 마감 일정 및 주간 마일스톤
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            부처별 접수 마감일과 내부 준비 일정(예산협의·초안·결재)을 한눈에 관리하고 주간 보고서로 바로 정리합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setHideDeferred((v) => !v)}
            className={`px-3 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
              hideDeferred
                ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                : 'bg-slate-900 text-white border-slate-900'
            }`}
          >
            {hideDeferred ? '보류 공고 숨김 중' : '보류 공고 포함 표시'}
          </button>
          <button
            type="button"
            onClick={onCopyWeeklyReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>주간 보고서 복사</span>
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>일정 CSV 다운로드</span>
          </button>
        </div>
      </div>

      {/* Monthly Calendar */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900 font-mono tabular-nums">
              {viewYear}년 {viewMonth}월
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="이전 달"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewYear(2026);
                  setViewMonth(11);
                }}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors whitespace-nowrap"
              >
                11월
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewYear(2026);
                  setViewMonth(12);
                }}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors whitespace-nowrap"
              >
                12월
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewYear(2027);
                  setViewMonth(1);
                }}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors whitespace-nowrap"
              >
                1월
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="다음 달"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
            <span className="text-red-700 font-medium">D-7 긴급 마감</span>
            <span className="text-blue-800 font-medium">응모확정</span>
            <span className="text-slate-600">검토·미검토</span>
            <span className="text-emerald-700">제출완료</span>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`py-2 px-3 text-center ${
                i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-700' : ''
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
          {calendarCells.map((cell, idx) => {
            const isToday = cell.dateStr === REFERENCE_DATE_STR;
            return (
              <div
                key={idx}
                className={`min-h-[96px] p-2 ${
                  cell.dayNum === null
                    ? 'bg-slate-50/50'
                    : isToday
                      ? 'bg-blue-50/40'
                      : 'bg-white'
                }`}
              >
                {cell.dayNum !== null && (
                  <>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          isToday
                            ? 'font-bold text-blue-800'
                            : 'text-slate-500'
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                      {isToday && (
                        <span className="text-[11px] font-semibold text-blue-800">기준일</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      {cell.items.map((item) => {
                        const d = getDaysRemaining(item.deadlineDate);
                        const itemStyle =
                          item.status === '제출완료'
                            ? 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                            : d >= 0 && d <= 7
                              ? 'text-red-800 bg-red-50 hover:bg-red-100 font-semibold'
                              : item.status === '응모확정'
                                ? 'text-blue-900 bg-blue-50 hover:bg-blue-100 font-medium'
                                : 'text-slate-700 bg-slate-100 hover:bg-slate-200';
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelectGrant(item)}
                            className={`w-full text-left px-1.5 py-1 rounded text-[11px] leading-tight truncate transition-colors ${itemStyle}`}
                            title={`${item.title} (${item.ministry} · ${item.status})`}
                          >
                            [{item.ministry.slice(0, 2)}] {item.title}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Urgency-Grouped Action Timeline */}
      <section className="space-y-5">
        {(
          [
            {
              key: 'urgent',
              title: '긴급 마감 임박 (D-7 이내)',
              subtitle: '결재 상정 및 전자접수 마감 즉시 점검 필요',
              items: groupedTimeline.urgent,
              accent: 'text-red-700',
            },
            {
              key: 'thisMonth',
              title: '30일 이내 마감 (D-8 ~ D-30)',
              subtitle: '예산협의·부지확인 및 사업계획서 초안 작성 구간',
              items: groupedTimeline.thisMonth,
              accent: 'text-slate-900',
            },
            {
              key: 'upcoming',
              title: '사전 준비 (D-31 이후)',
              subtitle: '주관부서 배정 및 타당성 기초자료 확보 구간',
              items: groupedTimeline.upcoming,
              accent: 'text-slate-700',
            },
            {
              key: 'submitted',
              title: '접수 완료 · 결과 대기',
              subtitle: '현장실사 및 중앙부처 선정 평가 대응',
              items: groupedTimeline.submitted,
              accent: 'text-emerald-700',
            },
          ] as const
        ).map((group) => (
          <div key={group.key} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-2.5">
                <h3 className={`text-sm font-bold ${group.accent}`}>{group.title}</h3>
                <span className="text-xs text-slate-500 hidden sm:inline">{group.subtitle}</span>
              </div>
              <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 shrink-0">
                {group.items.length}건
              </span>
            </div>

            {group.items.length === 0 ? (
              <div className="px-5 py-6 text-xs text-slate-400">해당 기간에 예정된 공고가 없습니다.</div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {group.items.map((grant) => {
                  const d = getDaysRemaining(grant.deadlineDate);
                  const doneCount = grant.checklist.filter((c) => c.done).length;
                  const pct = Math.round((doneCount / Math.max(1, grant.checklist.length)) * 100);
                  const nextTask = grant.checklist.find((c) => !c.done);

                  return (
                    <li
                      key={grant.id}
                      onClick={() => onSelectGrant(grant)}
                      className="px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span
                            className={`font-mono tabular-nums font-bold ${
                              grant.status === '제출완료'
                                ? 'text-emerald-700'
                                : d <= 7
                                  ? 'text-red-700'
                                  : d <= 14
                                    ? 'text-amber-700'
                                    : 'text-slate-700'
                            }`}
                          >
                            {formatDDay(d)}
                          </span>
                          <span className="font-mono tabular-nums text-slate-500">
                            마감 {formatKoreanDate(grant.deadlineDate)}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="font-medium text-slate-700">{grant.ministry}</span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-slate-600">
                            {grant.assignedDept || `미배정 (추천: ${grant.diagnostic.recommendedDept})`}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="font-medium text-slate-800">{grant.status}</span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {grant.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {nextTask ? (
                            <>
                              다음 실무 단계: <strong className="text-slate-700">{nextTask.label}</strong>{' '}
                              <span className="font-mono tabular-nums">
                                (목표 {formatOffsetDate(grant.deadlineDate, nextTask.dueOffsetDays)})
                              </span>
                            </>
                          ) : (
                            <span className="text-emerald-700">모든 사전 체크리스트 완료</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-5 shrink-0 lg:text-right">
                        <div className="text-xs font-mono tabular-nums text-slate-700">
                          <div className="font-semibold">국비 {grant.nationalBudget}억</div>
                          <div className="text-slate-500">
                            적합도 {grant.diagnostic.scoreOutOf5.toFixed(1)} / 5.0
                          </div>
                        </div>

                        <div className="w-28 space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-600">
                            <span>준비율</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                pct === 100 ? 'bg-emerald-600' : 'bg-blue-700'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
