import { Check, CheckSquare, FileText, Square, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NONSAN_DEPARTMENTS, WORKFLOW_STATUSES } from '../data/initialGrants';
import { GrantNotice, NonsanDepartment, WorkflowStatus } from '../types/grant';
import {
  formatDDay,
  formatKoreanDate,
  formatOffsetDate,
  getDaysRemaining,
} from '../utils/diagnostics';

interface GrantDetailDrawerProps {
  grant: GrantNotice | null;
  onClose: () => void;
  onUpdateGrant: (updated: GrantNotice) => void;
  onDeleteGrant: (id: string) => void;
  onDraftProposal: (grant: GrantNotice) => void;
}

export function GrantDetailDrawer({
  grant,
  onClose,
  onUpdateGrant,
  onDeleteGrant,
  onDraftProposal,
}: GrantDetailDrawerProps) {
  const [officerDraft, setOfficerDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    if (grant) {
      setOfficerDraft(grant.assignedOfficer);
      setNotesDraft(grant.notes);
      setSavedFeedback(false);
    }
  }, [grant?.id]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (grant) {
      window.addEventListener('keydown', handleKey);
    }
    return () => window.removeEventListener('keydown', handleKey);
  }, [grant, onClose]);

  if (!grant) return null;

  const days = getDaysRemaining(grant.deadlineDate);
  const completedCount = grant.checklist.filter((c) => c.done).length;
  const readinessPct =
    grant.checklist.length > 0
      ? Math.round((completedCount / grant.checklist.length) * 100)
      : 0;

  const handleStatusChange = (status: WorkflowStatus) => {
    onUpdateGrant({
      ...grant,
      status,
      assignedDept:
        !grant.assignedDept && (status === '검토중' || status === '응모확정')
          ? grant.diagnostic.recommendedDept
          : grant.assignedDept,
    });
  };

  const handleDeptChange = (dept: NonsanDepartment | '') => {
    onUpdateGrant({ ...grant, assignedDept: dept });
  };

  const handleToggleChecklist = (itemId: string) => {
    const nextChecklist = grant.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    onUpdateGrant({ ...grant, checklist: nextChecklist });
  };

  const handleSaveMemoAndOfficer = () => {
    onUpdateGrant({
      ...grant,
      assignedOfficer: officerDraft.trim(),
      notes: notesDraft.trim(),
    });
    setSavedFeedback(true);
    window.setTimeout(() => setSavedFeedback(false), 1800);
  };

  const gradeColor =
    grant.diagnostic.grade === 'A'
      ? 'text-emerald-700'
      : grant.diagnostic.grade === 'B'
        ? 'text-blue-800'
        : grant.diagnostic.grade === 'C'
          ? 'text-amber-700'
          : 'text-slate-600';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-grant-title"
    >
      <div
        className="fixed inset-0 bg-slate-900/35 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-2xl bg-white h-full border-l border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">{grant.ministry}</span>
              <span aria-hidden="true">·</span>
              <span>{grant.domain}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{grant.noticeCode}</span>
            </div>
            <h2
              id="drawer-grant-title"
              className="mt-1.5 text-lg font-bold text-slate-900 leading-snug text-balance"
            >
              {grant.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                onDraftProposal(grant);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>계획서 초안</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="상세 패널 닫기"
              className="p-2 -mr-2 text-slate-400 hover:text-slate-900 rounded-md transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {/* Overview & Key Numbers */}
          <section className="space-y-4">
            <p className="text-sm text-slate-700 leading-relaxed">{grant.summary}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/50">
              <div className="p-3.5">
                <div className="text-xs text-slate-500">접수 마감</div>
                <div
                  className={`mt-1 text-sm font-bold font-mono tabular-nums ${
                    days <= 7 && grant.status !== '제출완료' && grant.status !== '보류'
                      ? 'text-red-700'
                      : 'text-slate-900'
                  }`}
                >
                  {formatDDay(days)}
                </div>
                <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                  {formatKoreanDate(grant.deadlineDate)}
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-xs text-slate-500">국비 규모</div>
                <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900">
                  {grant.nationalBudget.toLocaleString()}억 원
                </div>
                <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                  국비율 {grant.nationalRatio}%
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-xs text-slate-500">추산 시비 매칭</div>
                <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900">
                  약 {grant.diagnostic.estimatedLocalMatch}억 원
                </div>
                <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                  총사업비 {grant.totalProjectBudget}억
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-xs text-slate-500">논산 적합도</div>
                <div className={`mt-1 text-sm font-bold font-mono tabular-nums ${gradeColor}`}>
                  {grant.diagnostic.scoreOutOf5.toFixed(1)} / 5.0
                </div>
                <div className={`text-xs font-medium mt-0.5 ${gradeColor}`}>
                  {grant.diagnostic.grade}등급 · {grant.diagnostic.gradeLabel}
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div>
                <span className="font-semibold text-slate-800">신청자격: </span>
                <span>{grant.eligibilityText}</span>
              </div>
              {grant.diagnostic.matchedStrategies.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-800">연계 시정 전략사업: </span>
                  <span>{grant.diagnostic.matchedStrategies.join(' · ')}</span>
                </div>
              )}
              <div>
                <span className="font-semibold text-slate-800">공고 출처: </span>
                <span>
                  {grant.sourceUrlLabel} (공고일 {formatKoreanDate(grant.announcedDate)})
                </span>
              </div>
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* 5-Axis Nonsan Fit Diagnosis (5.0-Point Scale) */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                전략·자원 대조 5점 적합성 평가
              </h3>
              <span className="text-xs text-slate-500">
                추천 주관부서:{' '}
                <strong className="text-slate-800">{grant.diagnostic.recommendedDept}</strong>
                {' · '}협업: {grant.diagnostic.collaboratingDepts.join(', ')}
              </span>
            </div>

            <div className="space-y-3">
              {grant.diagnostic.criteria.map((c) => {
                const pct = Math.round((c.scoreOutOf5 / 5) * 100);
                const statusColor =
                  c.status === '충족'
                    ? 'text-emerald-700'
                    : c.status === '보완필요'
                      ? 'text-amber-700'
                      : 'text-red-700';
                return (
                  <div key={c.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">
                        {c.label}{' '}
                        <span className="text-slate-400 font-mono">({c.weightPercent}%)</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={`font-medium ${statusColor}`}>{c.status}</span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900">
                          {c.scoreOutOf5.toFixed(1)} / 5.0
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          c.scoreOutOf5 >= 4.0
                            ? 'bg-emerald-600'
                            : c.scoreOutOf5 >= 3.0
                              ? 'bg-blue-700'
                              : 'bg-amber-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">{c.summary}</p>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-emerald-800">논산시 유리 요인</div>
                <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                  {grant.diagnostic.strengths.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-700 font-bold shrink-0">+</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-amber-800">사전 보완·유의사항</div>
                <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                  {grant.diagnostic.cautions.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-700 font-bold shrink-0">!</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* Workflow Assignment & Status */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">검토 상태 및 담당 부서 배정</h3>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="추진상태 변경">
              {WORKFLOW_STATUSES.map((status) => {
                const active = grant.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatusChange(status)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">담당 부서</span>
                <select
                  value={grant.assignedDept}
                  onChange={(e) =>
                    handleDeptChange(e.target.value as NonsanDepartment | '')
                  }
                  className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
                >
                  <option value="">
                    미배정 (추천: {grant.diagnostic.recommendedDept})
                  </option>
                  {NONSAN_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">담당자 (주무관/팀장)</span>
                <input
                  type="text"
                  value={officerDraft}
                  onChange={(e) => setOfficerDraft(e.target.value)}
                  placeholder="예: 김논산 주무관"
                  className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
                />
              </label>
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* Preparation Checklist & Milestones */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">마감 준비 체크리스트</h3>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                완료 {completedCount}/{grant.checklist.length} ({readinessPct}%)
              </span>
            </div>

            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 rounded-full transition-all duration-200"
                style={{ width: `${readinessPct}%` }}
              />
            </div>

            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {grant.checklist.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleToggleChecklist(item.id)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {item.done ? (
                        <CheckSquare className="w-4 h-4 text-blue-700 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span
                        className={`text-xs leading-snug ${
                          item.done ? 'line-through text-slate-400' : 'text-slate-800'
                        }`}
                      >
                        {item.label}
                      </span>
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                      목표 {formatOffsetDate(grant.deadlineDate, item.dueOffsetDays)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <hr className="border-slate-200" />

          {/* Working Memo */}
          <section className="space-y-2.5">
            <label htmlFor="grant-memo-input" className="block text-sm font-bold text-slate-900">
              실무 검토 메모
            </label>
            <textarea
              id="grant-memo-input"
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="부서 협의 결과, 충남도 경유 일정, 부지·예산 특이사항을 기록하세요."
              className="w-full p-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
            />
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  onDeleteGrant(grant.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>목록에서 삭제</span>
              </button>

              <button
                type="button"
                onClick={handleSaveMemoAndOfficer}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                {savedFeedback ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>저장 완료</span>
                  </>
                ) : (
                  <span>담당자·메모 저장</span>
                )}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
