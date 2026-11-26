import {
  AlertTriangle,
  BellRing,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Radar,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { ActiveTab, GrantNotice } from '../types/grant';
import { getDaysRemaining } from '../utils/diagnostics';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  grants: GrantNotice[];
  triggerDays: number;
  errorIssueCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onResetData: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  grants,
  triggerDays,
  errorIssueCount,
  mobileOpen,
  onCloseMobile,
  onResetData,
}: SidebarProps) {
  const activeCount = grants.filter((g) => g.status !== '보류' && g.status !== '제출완료').length;
  const d3AlertCount = grants.filter((g) => {
    if (g.status === '보류' || g.status === '제출완료') return false;
    const d = getDaysRemaining(g.deadlineDate);
    return d >= 0 && d <= triggerDays;
  }).length;
  const topRecommendedCount = grants.filter(
    (g) => g.diagnostic.scoreOutOf5 >= 4.2 && g.status !== '보류' && g.status !== '제출완료'
  ).length;
  const confirmedCount = grants.filter((g) => g.status === '응모확정').length;

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: typeof Radar;
    count?: number;
    accentText?: string;
  }> = [
    {
      id: 'dashboard',
      label: '종합 대시보드',
      icon: LayoutDashboard,
    },
    {
      id: 'radar',
      label: '공모 탐색',
      icon: Radar,
      count: activeCount,
    },
    {
      id: 'matching',
      label: '전략·자원 매칭',
      icon: SlidersHorizontal,
      count: topRecommendedCount,
    },
    {
      id: 'proposal',
      label: '계획서 AI 초안',
      icon: FileText,
    },
    {
      id: 'alerts',
      label: '마감·D-3 알림',
      icon: BellRing,
      count: d3AlertCount > 0 ? d3AlertCount : undefined,
      accentText: d3AlertCount > 0 ? 'text-red-600 font-semibold' : undefined,
    },
    {
      id: 'diagnose',
      label: '신규 공모 진단',
      icon: ClipboardCheck,
    },
    {
      id: 'errors',
      label: '오류 통계 보고서',
      icon: AlertTriangle,
      count: errorIssueCount > 0 ? errorIssueCount : undefined,
      accentText: errorIssueCount > 0 ? 'text-amber-700 font-semibold' : undefined,
    },
  ];

  const handleNavClick = (tab: ActiveTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      {/* Brand Header */}
      <div className="flex items-center justify-between h-14 px-5 border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => handleNavClick('dashboard')}
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded"
        >
          논산시 공모사업레이더
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="메뉴 닫기"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="주요 메뉴">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.count !== undefined && (
                <span
                  className={`text-xs font-mono tabular-nums shrink-0 ${
                    isActive
                      ? 'text-slate-300'
                      : item.accentText || 'text-slate-500'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Weekly Screening Digest */}
        <div className="pt-6 mt-6 border-t border-slate-200 px-2 space-y-3">
          <div className="text-xs font-semibold text-slate-500">이번 주 점검 요약</div>
          <dl className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">기준일</dt>
              <dd className="font-mono tabular-nums text-slate-900">2026.11.25</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">D-{triggerDays} 자동 알림 대상</dt>
              <dd className="font-mono tabular-nums font-semibold text-red-700">
                {d3AlertCount}건
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">적극 추천 (4.2점↑)</dt>
              <dd className="font-mono tabular-nums font-semibold text-emerald-700">
                {topRecommendedCount}건
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">응모 확정 사업</dt>
              <dd className="font-mono tabular-nums font-semibold text-slate-900">
                {confirmedCount}건
              </dd>
            </div>
          </dl>
        </div>
      </nav>

      {/* Footer Info & Reset */}
      <div className="px-4 py-3.5 border-t border-slate-200 text-xs text-slate-500 shrink-0">
        <div className="flex items-center justify-between">
          <span>논산시 기획감사실</span>
          <button
            type="button"
            onClick={onResetData}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap"
            title="초기 샘플 데이터로 복원"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>초기화</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-64 max-w-[80vw] h-full">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
