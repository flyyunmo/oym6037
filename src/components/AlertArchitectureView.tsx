import {
  ArrowRight,
  Bell,
  Check,
  Clock,
  Database,
  Mail,
  Send,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  AlertChannel,
  AlertDispatchLog,
  AlertRuleConfig,
  GrantNotice,
  NonsanDepartment,
  NonsanProfile,
} from '../types/grant';
import {
  buildD3AlertMessage,
  formatDDay,
  formatKoreanDate,
  getDaysRemaining,
  REFERENCE_DATE_STR,
} from '../utils/diagnostics';
import { ScheduleView } from './ScheduleView';

interface AlertArchitectureViewProps {
  grants: GrantNotice[];
  profile: NonsanProfile;
  alertRule: AlertRuleConfig;
  dispatchLogs: AlertDispatchLog[];
  onChangeAlertRule: (next: AlertRuleConfig) => void;
  onDispatchBatch: (logs: AlertDispatchLog[]) => void;
  onSelectGrant: (grant: GrantNotice) => void;
  onCopyWeeklyReport: () => void;
  onExportCsv: () => void;
}

const ALL_CHANNELS: AlertChannel[] = ['새올행정', '알림톡', '이메일', 'SMS'];

const ARCHITECTURE_STAGES = [
  {
    step: '01',
    name: '중앙부처 공고 수집 계층',
    tech: '정부24 · e나라도움 · 부처별 RSS/API 스케줄러',
    detail: '매일 07:00 신규 공고 크롤링·정규화(공고번호, 마감일시, 국비율, 신청자격 추출)',
    icon: Database,
  },
  {
    step: '02',
    name: '5점 적합성 매칭 엔진',
    tech: '논산 전략사업·부서자원 대조 룰 엔진',
    detail: '신규 공고 유입 즉시 5대 가중치 평가 및 최적 담당부서·담당자 자동 매핑',
    icon: SlidersHorizontal,
  },
  {
    step: '03',
    name: 'D-3 마감 감시 스케줄러',
    tech: '일일 배치 Cron (매일 08:30 KST)',
    detail: '마감일 - 기준일 ≤ 3일 대상 추출 (제출완료·보류 자동 제외, D-1 미제출 시 팀장 에스컬레이션)',
    icon: Clock,
  },
  {
    step: '04',
    name: '중복 방지·알림 메시지 큐',
    tech: 'Idempotency Key (grantId + targetDate + D-Day)',
    detail: '동일 공고·동일 일자 중복 발송 차단, 미완료 체크리스트 동적 삽입 및 재시도(DLQ) 보장',
    icon: ShieldCheck,
  },
  {
    step: '05',
    name: '다채널 발송 게이트웨이',
    tech: '새올행정 메신저 · 카카오 알림톡 · 공직자 메일 · SMS',
    detail: '부서별 선호 채널 우선 발송 후 수신확인·클릭 로그를 공모 레이더 DB에 실시간 환류',
    icon: Mail,
  },
];

export function AlertArchitectureView({
  grants,
  profile,
  alertRule,
  dispatchLogs,
  onChangeAlertRule,
  onDispatchBatch,
  onSelectGrant,
  onCopyWeeklyReport,
  onExportCsv,
}: AlertArchitectureViewProps) {
  const [subView, setSubView] = useState<'alerts' | 'calendar'>('alerts');
  const [previewGrantId, setPreviewGrantId] = useState<string | null>(null);

  const alertCandidates = useMemo(() => {
    return grants
      .map((g) => {
        const days = getDaysRemaining(g.deadlineDate);
        const deptName = (g.assignedDept || g.diagnostic.recommendedDept) as NonsanDepartment;
        const deptRes = profile.departmentResources.find((r) => r.dept === deptName);
        const isSkipped =
          alertRule.skipSubmittedAndDeferred &&
          (g.status === '제출완료' || g.status === '보류');
        const isWithinTrigger = days >= 0 && days <= alertRule.triggerDays;
        const channels = (deptRes?.preferredChannels ?? ['새올행정', '이메일']).filter((c) =>
          alertRule.enabledChannels.includes(c)
        );
        const alreadySentToday = dispatchLogs.some(
          (log) => log.grantId === g.id && log.sentAt.startsWith(REFERENCE_DATE_STR)
        );
        return {
          grant: g,
          days,
          deptName,
          deptRes,
          isSkipped,
          isWithinTrigger,
          channels: channels.length > 0 ? channels : alertRule.enabledChannels.slice(0, 1),
          alreadySentToday,
        };
      })
      .filter((item) => item.days >= 0 && item.days <= Math.max(7, alertRule.triggerDays))
      .sort((a, b) => a.days - b.days);
  }, [grants, profile.departmentResources, alertRule, dispatchLogs]);

  const activeTriggerTargets = useMemo(
    () => alertCandidates.filter((c) => c.isWithinTrigger && !c.isSkipped),
    [alertCandidates]
  );

  const previewCandidate =
    alertCandidates.find((c) => c.grant.id === previewGrantId) ??
    activeTriggerTargets[0] ??
    alertCandidates[0] ??
    null;

  const previewMessage = previewCandidate
    ? buildD3AlertMessage(previewCandidate.grant, previewCandidate.deptRes, alertRule)
    : '';

  const toggleChannel = (ch: AlertChannel) => {
    const exists = alertRule.enabledChannels.includes(ch);
    const next = exists
      ? alertRule.enabledChannels.filter((c) => c !== ch)
      : [...alertRule.enabledChannels, ch];
    if (next.length === 0) return;
    onChangeAlertRule({ ...alertRule, enabledChannels: next });
  };

  const handleRunAutoDispatch = () => {
    if (activeTriggerTargets.length === 0) return;
    const nowTime = new Date().toTimeString().slice(0, 5);
    const newLogs: AlertDispatchLog[] = activeTriggerTargets.map((target) => ({
      id: `log-${target.grant.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      grantId: target.grant.id,
      grantTitle: target.grant.title,
      dDayLabel: formatDDay(target.days),
      recipientDept: target.deptName,
      recipientName: target.grant.assignedOfficer || target.deptRes?.leadOfficer || '담당자',
      channels: target.channels,
      sentAt: `${REFERENCE_DATE_STR} ${nowTime}`,
      status: '발송완료',
      messagePreview: buildD3AlertMessage(target.grant, target.deptRes, alertRule),
    }));
    onDispatchBatch(newLogs);
  };

  const handleSendSingle = (target: (typeof alertCandidates)[number]) => {
    const nowTime = new Date().toTimeString().slice(0, 5);
    const log: AlertDispatchLog = {
      id: `log-${target.grant.id}-${Date.now()}`,
      grantId: target.grant.id,
      grantTitle: target.grant.title,
      dDayLabel: formatDDay(target.days),
      recipientDept: target.deptName,
      recipientName: target.grant.assignedOfficer || target.deptRes?.leadOfficer || '담당자',
      channels: target.channels,
      sentAt: `${REFERENCE_DATE_STR} ${nowTime}`,
      status: '발송완료',
      messagePreview: buildD3AlertMessage(target.grant, target.deptRes, alertRule),
    };
    onDispatchBatch([log]);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            마감 3일 전(D-3) 자동 알림 센터 · 시스템 아키텍처
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            접수 마감 임박 공고를 자동 감지해 담당자에게 미완료 체크리스트와 함께 알림을 발송하는 운영 콘솔 및 시스템 구조입니다.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-md self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setSubView('alerts')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              subView === 'alerts'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            D-3 자동 알림 · 아키텍처
          </button>
          <button
            type="button"
            onClick={() => setSubView('calendar')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              subView === 'calendar'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            월간 마감 캘린더
          </button>
        </div>
      </div>

      {subView === 'calendar' ? (
        <ScheduleView
          grants={grants}
          onSelectGrant={onSelectGrant}
          onCopyWeeklyReport={onCopyWeeklyReport}
          onExportCsv={onExportCsv}
        />
      ) : (
        <div className="space-y-6">
          {/* 1. System Architecture Pipeline Blueprint */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  D-3 자동 알림 발송 시스템 아키텍처
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  공고 수집 → 5점 적합도 평가 → D-3 배치 감시 → 중복차단 큐 → 행정 다채널 게이트웨이 5단계 파이프라인
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                일일 배치 {alertRule.dispatchTime} KST · 발송 기준 D-{alertRule.triggerDays} / D-{alertRule.escalationDay} 재알림
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {ARCHITECTURE_STAGES.map((stage, idx) => {
                const Icon = stage.icon;
                return (
                  <div
                    key={stage.step}
                    className="relative p-3.5 bg-slate-50/80 border border-slate-200 rounded-md flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span className="font-mono font-semibold text-blue-800">{stage.step}</span>
                        <Icon className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="text-xs font-bold text-slate-900 leading-snug">
                        {stage.name}
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-blue-800 leading-snug">
                        {stage.tech}
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-600 leading-relaxed">
                        {stage.detail}
                      </p>
                    </div>
                    {idx < ARCHITECTURE_STAGES.length - 1 && (
                      <div className="hidden md:flex items-center justify-end text-slate-400">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Rule Controls + Live D-3 Queue & Message Preview */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left: Rule Configuration & Trigger Queue */}
            <div className="xl:col-span-7 space-y-5">
              {/* Alert Rule Policy Panel */}
              <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-900">자동 알림 발송 규칙 설정</h2>
                  <button
                    type="button"
                    onClick={handleRunAutoDispatch}
                    disabled={activeTriggerTargets.length === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:bg-slate-300 transition-colors whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      D-{alertRule.triggerDays} 대상 일괄 발송 ({activeTriggerTargets.length}건)
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <label className="block space-y-1">
                    <span className="font-medium text-slate-600">1차 자동 발송 시점</span>
                    <select
                      value={alertRule.triggerDays}
                      onChange={(e) =>
                        onChangeAlertRule({ ...alertRule, triggerDays: Number(e.target.value) })
                      }
                      className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-md text-slate-900 font-medium"
                    >
                      <option value={3}>마감 3일 전 (D-3 권장)</option>
                      <option value={5}>마감 5일 전 (D-5)</option>
                      <option value={7}>마감 7일 전 (D-7)</option>
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="font-medium text-slate-600">매일 배치 실행 시각</span>
                    <input
                      type="time"
                      value={alertRule.dispatchTime}
                      onChange={(e) =>
                        onChangeAlertRule({ ...alertRule, dispatchTime: e.target.value })
                      }
                      className="w-full h-9 px-2.5 font-mono tabular-nums bg-white border border-slate-200 rounded-md text-slate-900"
                    />
                  </label>

                  <div className="space-y-1">
                    <span className="block font-medium text-slate-600">예외·첨부 정책</span>
                    <label className="flex items-center gap-2 h-9 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alertRule.skipSubmittedAndDeferred}
                        onChange={(e) =>
                          onChangeAlertRule({
                            ...alertRule,
                            skipSubmittedAndDeferred: e.target.checked,
                          })
                        }
                        className="h-4 w-4 accent-slate-900"
                      />
                      <span>제출완료·보류 자동 제외</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500 font-medium">활성 발송 채널:</span>
                    {ALL_CHANNELS.map((ch) => {
                      const active = alertRule.enabledChannels.includes(ch);
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => toggleChannel(ch)}
                          className={`px-2.5 py-1 rounded border font-medium transition-colors whitespace-nowrap ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {ch}
                        </button>
                      );
                    })}
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alertRule.includeUnfinishedChecklist}
                      onChange={(e) =>
                        onChangeAlertRule({
                          ...alertRule,
                          includeUnfinishedChecklist: e.target.checked,
                        })
                      }
                      className="h-3.5 w-3.5 accent-slate-900"
                    />
                    <span>미완료 체크리스트 본문 포함</span>
                  </label>
                </div>
              </section>

              {/* Trigger Queue List */}
              <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    마감 감지 대기열 (기준일 {formatKoreanDate(REFERENCE_DATE_STR)})
                  </h2>
                  <span className="text-xs font-mono tabular-nums text-red-700 font-semibold">
                    발송 대상 {activeTriggerTargets.length}건
                  </span>
                </div>

                <ul className="divide-y divide-slate-200">
                  {alertCandidates.map((item) => {
                    const isPreviewed = previewCandidate?.grant.id === item.grant.id;
                    return (
                      <li
                        key={item.grant.id}
                        onClick={() => setPreviewGrantId(item.grant.id)}
                        className={`px-5 py-3.5 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isPreviewed ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 text-xs">
                            <span
                              className={`font-mono tabular-nums font-bold ${
                                item.isSkipped
                                  ? 'text-slate-400'
                                  : item.isWithinTrigger
                                    ? 'text-red-700'
                                    : 'text-amber-700'
                              }`}
                            >
                              {formatDDay(item.days)}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="font-medium text-slate-800">
                              {item.deptName} (
                              {item.grant.assignedOfficer || item.deptRes?.leadOfficer})
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500">{item.channels.join(', ')}</span>
                            {item.isSkipped && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="text-emerald-700 font-medium">
                                  {item.grant.status} (발송 제외)
                                </span>
                              </>
                            )}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {item.grant.title}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.isSkipped ? (
                            <span className="text-xs text-slate-400">자동 제외</span>
                          ) : item.alreadySentToday ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <Check className="w-3.5 h-3.5" />
                              금일 발송완료
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendSingle(item);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
                            >
                              <Bell className="w-3.5 h-3.5" />
                              <span>테스트 발송</span>
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>

            {/* Right: Personalized Alert Message Preview & Dispatch History */}
            <div className="xl:col-span-5 space-y-5">
              {/* Message Payload Preview */}
              <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">발송 메시지 페이로드 미리보기</h2>
                  {previewCandidate && (
                    <button
                      type="button"
                      onClick={() => onSelectGrant(previewCandidate.grant)}
                      className="text-xs font-medium text-blue-800 hover:underline whitespace-nowrap"
                    >
                      공고 상세 보기
                    </button>
                  )}
                </div>

                {previewCandidate ? (
                  <>
                    <div className="text-xs text-slate-600 space-y-1">
                      <div>
                        <span className="text-slate-400">수신 담당자: </span>
                        <strong className="text-slate-900">
                          {previewCandidate.deptName}{' '}
                          {previewCandidate.grant.assignedOfficer ||
                            previewCandidate.deptRes?.leadOfficer}
                        </strong>{' '}
                        ({previewCandidate.deptRes?.officerEmail} ·{' '}
                        {previewCandidate.deptRes?.officerContact})
                      </div>
                      <div>
                        <span className="text-slate-400">발송 채널: </span>
                        <span className="text-slate-800 font-medium">
                          {previewCandidate.channels.join(' / ')}
                        </span>
                      </div>
                    </div>

                    <pre className="p-4 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                      {previewMessage}
                    </pre>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">미리보기할 마감 임박 공고가 없습니다.</p>
                )}
              </section>

              {/* Dispatch Audit Log */}
              <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">최근 알림 발송 이력</h2>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {dispatchLogs.length}건
                  </span>
                </div>

                {dispatchLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    아직 발송된 알림 이력이 없습니다. 상단 ‘일괄 발송’ 또는 ‘테스트 발송’을 실행해 보세요.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-200 max-h-[320px] overflow-y-auto">
                    {dispatchLogs.map((log) => (
                      <li key={log.id} className="px-5 py-3 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">
                            {log.recipientDept} {log.recipientName}
                          </span>
                          <span className="font-mono tabular-nums text-slate-500">
                            {log.sentAt} · <strong className="text-emerald-700">{log.status}</strong>
                          </span>
                        </div>
                        <div className="text-slate-700 truncate">
                          [{log.dDayLabel}] {log.grantTitle}
                        </div>
                        <div className="text-slate-500">채널: {log.channels.join(', ')}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
