import { Check, Copy, Menu, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AlertArchitectureView } from './components/AlertArchitectureView';
import { DashboardView } from './components/DashboardView';
import { DiagnosticToolView } from './components/DiagnosticToolView';
import { ErrorReportView } from './components/ErrorReportView';
import { GrantDetailDrawer } from './components/GrantDetailDrawer';
import { ProposalDraftView } from './components/ProposalDraftView';
import { RadarTableView } from './components/RadarTableView';
import { Sidebar } from './components/Sidebar';
import { StrategyResourceView } from './components/StrategyResourceView';
import { INITIAL_GRANTS } from './data/initialGrants';
import { DEFAULT_ALERT_RULE, DEFAULT_NONSAN_PROFILE } from './data/nonsanProfile';
import {
  ActiveTab,
  AlertDispatchLog,
  AlertRuleConfig,
  GrantNotice,
  NonsanDepartment,
  NonsanProfile,
  RuntimeErrorLog,
} from './types/grant';
import {
  formatDDay,
  formatKoreanDate,
  getDaysRemaining,
  recomputeGrantsWithProfile,
  REFERENCE_DATE_STR,
} from './utils/diagnostics';
import { runFullErrorAudit } from './utils/errorAudit';

const STORAGE_KEYS = {
  grants: 'nonsan_grant_radar_v2_grants',
  profile: 'nonsan_grant_radar_v2_profile',
  alertRule: 'nonsan_grant_radar_v2_alert_rule',
  logs: 'nonsan_grant_radar_v2_alert_logs',
  runtimeErrors: 'nonsan_grant_radar_v2_runtime_errors',
};

const TAB_LABELS: Record<ActiveTab, string> = {
  dashboard: '종합 대시보드',
  radar: '공모 탐색',
  matching: '전략·자원 매칭',
  proposal: '계획서 AI 초안',
  alerts: '마감·D-3 알림',
  diagnose: '신규 공모 진단',
  errors: '오류 통계 보고서',
};

const INITIAL_DISPATCH_LOGS: AlertDispatchLog[] = [
  {
    id: 'log-seed-1',
    grantId: 'ns-2026-09',
    grantTitle: '스마트 홍수관리·급경사지 조기경보시스템 고도화 사업',
    dDayLabel: 'D-3',
    recipientDept: '안전총괄과',
    recipientName: '정우성 팀장',
    channels: ['새올행정', 'SMS', '알림톡'],
    sentAt: '2026-11-24 08:30',
    status: '발송완료',
    messagePreview:
      '[논산시 공모사업레이더 마감 D-3 자동 알림] 안전총괄과 정우성 팀장님, 스마트 홍수관리 사업 마감(2026.11.27) 3일 전입니다.',
  },
];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [profile, setProfile] = useState<NonsanProfile>(() =>
    loadFromStorage(STORAGE_KEYS.profile, DEFAULT_NONSAN_PROFILE)
  );
  const [rawGrants, setRawGrants] = useState<GrantNotice[]>(() =>
    loadFromStorage(STORAGE_KEYS.grants, INITIAL_GRANTS)
  );
  const [alertRule, setAlertRule] = useState<AlertRuleConfig>(() =>
    loadFromStorage(STORAGE_KEYS.alertRule, DEFAULT_ALERT_RULE)
  );
  const [dispatchLogs, setDispatchLogs] = useState<AlertDispatchLog[]>(() =>
    loadFromStorage(STORAGE_KEYS.logs, INITIAL_DISPATCH_LOGS)
  );
  const [runtimeErrors, setRuntimeErrors] = useState<RuntimeErrorLog[]>(() =>
    loadFromStorage(STORAGE_KEYS.runtimeErrors, [])
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('errors');
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [proposalPrefillGrant, setProposalPrefillGrant] = useState<GrantNotice | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 전략사업 또는 부서 가용자원 변경 시 모든 공고의 5점 적합도 자동 재계산
  const grants = useMemo(
    () => recomputeGrantsWithProfile(rawGrants, profile),
    [rawGrants, profile]
  );

  const errorAudit = useMemo(
    () =>
      runFullErrorAudit({
        grants,
        profile,
        alertRule,
        dispatchLogs,
        runtimeErrors,
      }),
    [grants, profile, alertRule, dispatchLogs, runtimeErrors, activeTab]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.grants, JSON.stringify(rawGrants));
      window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
      window.localStorage.setItem(STORAGE_KEYS.alertRule, JSON.stringify(alertRule));
      window.localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(dispatchLogs));
      window.localStorage.setItem(STORAGE_KEYS.runtimeErrors, JSON.stringify(runtimeErrors));
    } catch {
      // Ignore storage quota errors
    }
  }, [rawGrants, profile, alertRule, dispatchLogs, runtimeErrors]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const selectedGrant = useMemo(
    () => grants.find((g) => g.id === selectedGrantId) ?? null,
    [grants, selectedGrantId]
  );

  const handleUpdateGrant = (updated: GrantNotice) => {
    setRawGrants((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  };

  const handleDeleteGrant = (id: string) => {
    setRawGrants((prev) => prev.filter((g) => g.id !== id));
    showToast('공모사업을 목록에서 삭제했습니다.');
  };

  const handleRegisterGrant = (newGrant: GrantNotice) => {
    setRawGrants((prev) => [newGrant, ...prev]);
    showToast(`'${newGrant.title}' 공고를 레이더에 등록했습니다.`);
  };

  const handleQuickAssignDept = (grantId: string, dept: NonsanDepartment) => {
    const deptInfo = profile.departmentResources.find((r) => r.dept === dept);
    setRawGrants((prev) =>
      prev.map((g) =>
        g.id === grantId
          ? {
              ...g,
              assignedDept: dept,
              assignedOfficer: g.assignedOfficer || deptInfo?.leadOfficer || '',
              status: g.status === '미검토' ? '검토중' : g.status,
            }
          : g
      )
    );
    showToast(`${dept}에 공고를 배정하고 검토중으로 전환했습니다.`);
  };

  const handleDispatchBatch = (newLogs: AlertDispatchLog[]) => {
    if (newLogs.length === 0) return;
    setDispatchLogs((prev) => [...newLogs, ...prev]);
    showToast(`담당자 ${newLogs.length}건의 마감 알림 메시지를 발송했습니다.`);
  };

  const handleResetProfile = () => {
    setProfile(DEFAULT_NONSAN_PROFILE);
    showToast('논산시 전략사업 및 부서 가용자원을 기본값으로 복원했습니다.');
  };

  const handleRecordRuntimeError = (source: string, code: string, message: string) => {
    const nowTime = new Date().toTimeString().slice(0, 5);
    const entry: RuntimeErrorLog = {
      id: `rt-err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      occurredAt: `${REFERENCE_DATE_STR} ${nowTime}`,
      source,
      code,
      message,
    };
    setRuntimeErrors((prev) => [entry, ...prev].slice(0, 50));
  };

  const handleClearRuntimeErrors = () => {
    setRuntimeErrors([]);
    showToast('시스템·API 런타임 오류 이력을 정리했습니다.');
  };

  const handleResetAllData = () => {
    setRawGrants(INITIAL_GRANTS);
    setProfile(DEFAULT_NONSAN_PROFILE);
    setAlertRule(DEFAULT_ALERT_RULE);
    setDispatchLogs(INITIAL_DISPATCH_LOGS);
    setRuntimeErrors([]);
    setSelectedGrantId(null);
    try {
      Object.values(STORAGE_KEYS).forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // Ignore storage errors
    }
    showToast('논산시 공모사업레이더 초기 데이터로 복원했습니다.');
  };

  const buildWeeklyReportText = () => {
    const active = grants.filter((g) => g.status !== '보류' && g.status !== '제출완료');
    const urgent = active
      .filter((g) => {
        const d = getDaysRemaining(g.deadlineDate);
        return d >= 0 && d <= 14;
      })
      .sort((a, b) => getDaysRemaining(a.deadlineDate) - getDaysRemaining(b.deadlineDate));
    const confirmed = grants.filter((g) => g.status === '응모확정');
    const confirmedBudget = confirmed.reduce((sum, g) => sum + g.nationalBudget, 0);

    const lines = [
      `[논산시 주간 중앙부처 공모사업 동향 보고] (${formatKoreanDate(REFERENCE_DATE_STR)} 기준)`,
      `1. 전체 현황: 진행중 ${active.length}건 / 응모확정 ${confirmed.length}건 (국비 신청 목표 ${confirmedBudget}억 원)`,
      '',
      `2. 14일 이내 마감 임박 공고 (${urgent.length}건)`,
      ...urgent.map((g, i) => {
        const d = formatDDay(getDaysRemaining(g.deadlineDate));
        const dept = g.assignedDept || `미배정(추천:${g.diagnostic.recommendedDept})`;
        return `  ${i + 1}) [${d}] ${g.title} | ${g.ministry} | 국비 ${g.nationalBudget}억(${g.nationalRatio}%) | 적합도 ${g.diagnostic.scoreOutOf5.toFixed(1)}/5.0(${g.diagnostic.gradeLabel}) | ${dept} · ${g.status}`;
      }),
    ];
    return lines.join('\n');
  };

  const handleCopyWeeklyReport = async () => {
    const text = buildWeeklyReportText();
    try {
      await navigator.clipboard.writeText(text);
      showToast('주간 공모 동향 보고서를 클립보드에 복사했습니다.');
    } catch {
      showToast('클립보드 복사가 제한되어 CSV 내보내기를 이용해 주세요.');
    }
  };

  const handleExportCsv = () => {
    const headers = [
      '공고번호',
      '공모사업명',
      '주관부처',
      '전략분야',
      '국비(억원)',
      '국비율(%)',
      '추산시비(억원)',
      '적합도(5점만점)',
      '적합등급',
      '마감일',
      '잔여일',
      '추진상태',
      '담당부서',
      '담당자',
    ];
    const escapeCell = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
    const rows = grants.map((g) => [
      g.noticeCode,
      g.title,
      g.ministry,
      g.domain,
      g.nationalBudget,
      g.nationalRatio,
      g.diagnostic.estimatedLocalMatch,
      g.diagnostic.scoreOutOf5.toFixed(1),
      g.diagnostic.gradeLabel,
      g.deadlineDate,
      formatDDay(getDaysRemaining(g.deadlineDate)),
      g.status,
      g.assignedDept || `추천:${g.diagnostic.recommendedDept}`,
      g.assignedOfficer,
    ]);
    const csv =
      '\uFEFF' + [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `논산시_공모사업레이더_${REFERENCE_DATE_STR}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('공모사업 일정 CSV 파일을 내려받았습니다.');
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        grants={grants}
        triggerDays={alertRule.triggerDays}
        errorIssueCount={errorAudit.totalIssues}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onResetData={handleResetAllData}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar — Contextual Breadcrumb Left + 1-2 Crisp Actions Right */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="메뉴 열기"
              className="lg:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-md"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="현재 위치" className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                논산시 공모사업레이더
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 truncate">
                {TAB_LABELS[activeTab]}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyWeeklyReport}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>주간 보고서 복사</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('diagnose')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>공모 진단·등록</span>
            </button>
          </div>
        </header>

        {/* Main Workspace Canvas */}
        <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-6">
          {activeTab === 'dashboard' && (
            <DashboardView
              grants={grants}
              profile={profile}
              triggerDays={alertRule.triggerDays}
              onSelectGrant={(g) => setSelectedGrantId(g.id)}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'radar' && (
            <RadarTableView
              grants={grants}
              selectedGrantId={selectedGrantId}
              onSelectGrant={(g) => setSelectedGrantId(g.id)}
              onGoToDiagnose={() => setActiveTab('diagnose')}
            />
          )}

          {activeTab === 'matching' && (
            <StrategyResourceView
              profile={profile}
              grants={grants}
              onChangeProfile={setProfile}
              onResetProfile={handleResetProfile}
              onSelectGrant={(g) => setSelectedGrantId(g.id)}
              onQuickAssignDept={handleQuickAssignDept}
            />
          )}

          {activeTab === 'proposal' && (
            <ProposalDraftView
              grants={grants}
              prefillGrant={proposalPrefillGrant}
              onClearPrefill={() => setProposalPrefillGrant(null)}
              onNotify={showToast}
              onRecordRuntimeError={handleRecordRuntimeError}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertArchitectureView
              grants={grants}
              profile={profile}
              alertRule={alertRule}
              dispatchLogs={dispatchLogs}
              onChangeAlertRule={setAlertRule}
              onDispatchBatch={handleDispatchBatch}
              onSelectGrant={(g) => setSelectedGrantId(g.id)}
              onCopyWeeklyReport={handleCopyWeeklyReport}
              onExportCsv={handleExportCsv}
            />
          )}

          {activeTab === 'diagnose' && (
            <DiagnosticToolView
              profile={profile}
              onRegisterGrant={handleRegisterGrant}
            />
          )}

          {activeTab === 'errors' && (
            <ErrorReportView
              audit={errorAudit}
              onOpenGrant={(id) => setSelectedGrantId(id)}
              onNavigateTab={setActiveTab}
              onClearRuntimeErrors={handleClearRuntimeErrors}
              onNotify={showToast}
            />
          )}
        </main>
      </div>

      {/* Detail & 5-Point Diagnostic Slide-over Drawer */}
      <GrantDetailDrawer
        grant={selectedGrant}
        onClose={() => setSelectedGrantId(null)}
        onUpdateGrant={handleUpdateGrant}
        onDeleteGrant={handleDeleteGrant}
        onDraftProposal={(grant) => {
          setProposalPrefillGrant(grant);
          setActiveTab('proposal');
        }}
      />

      {/* Quiet Toast Feedback */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-md shadow-lg"
        >
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
