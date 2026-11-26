import {
  AlertCircle,
  Check,
  CheckSquare,
  Copy,
  Download,
  Eye,
  FileText,
  Loader2,
  PencilLine,
  RefreshCw,
  Square,
  Wand2,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { MINISTRIES, NONSAN_DEPARTMENTS } from '../data/initialGrants';
import { GrantNotice, Ministry, NonsanDepartment } from '../types/grant';

export type ProposalSectionKey =
  | 'background'
  | 'overview'
  | 'plan'
  | 'effects'
  | 'risks';

interface ProposalFormState {
  projectTitle: string;
  department: NonsanDepartment;
  ministry: Ministry;
  nationalBudget: number;
  provincialBudget: number;
  municipalBudget: number;
  period: string;
  location: string;
  extraContext: string;
}

interface ProposalSectionDef {
  key: ProposalSectionKey;
  index: string;
  title: string;
  hint: string;
}

interface EvalCriterionItem {
  id: string;
  category: string;
  label: string;
  points: number;
  checked: boolean;
}

const PROPOSAL_SECTIONS: ProposalSectionDef[] = [
  {
    key: 'background',
    index: '1',
    title: '배경·필요성',
    hint: '중앙부처 정책 부합성, 논산시 지역 현안, 국비 지원 시급성',
  },
  {
    key: 'overview',
    index: '2',
    title: '사업개요',
    hint: '사업명·기간·대상지·총사업비(국·도·시비) 및 핵심 추진체계',
  },
  {
    key: 'plan',
    index: '3',
    title: '세부추진계획',
    hint: '단계별 로드맵, 세부과제, 관계기관 협업 및 집행계획',
  },
  {
    key: 'effects',
    index: '4',
    title: '기대효과',
    hint: '정량(미확인 수치는 [확인 필요])·정성 효과 및 지역 파급성',
  },
  {
    key: 'risks',
    index: '5',
    title: '리스크·대응',
    hint: '부지·예산·인허가·주민수용성·사후운영 리스크 및 대응방안',
  },
];

const INITIAL_EVAL_CHECKLIST: EvalCriterionItem[] = [
  {
    id: 'eval-1',
    category: '정책 부합성',
    label: '중앙부처 공모 목적 및 논산시 핵심 전략사업과의 연계성 명시',
    points: 20,
    checked: false,
  },
  {
    id: 'eval-2',
    category: '지역 시급성',
    label: '인구감소지역·지역 현안 등 논산시 고유 필요성과 차별화 논리 제시',
    points: 15,
    checked: false,
  },
  {
    id: 'eval-3',
    category: '계획 구체성',
    label: '연차별 로드맵·세부과제·관계기관 역할 분담의 실행 가능성 확보',
    points: 20,
    checked: false,
  },
  {
    id: 'eval-4',
    category: '재원·부지 타당성',
    label: '국·도·시비 매칭 비율 적정성 및 대상지 확보·인허가 검토 반영',
    points: 15,
    checked: false,
  },
  {
    id: 'eval-5',
    category: '수치·근거 검증',
    label: '초안 내 모든 [확인 필요] 항목을 공식 통계·내부 산출근거로 대체 완료',
    points: 15,
    checked: false,
  },
  {
    id: 'eval-6',
    category: '리스크·자립성',
    label: '민원·예산 지연 대응책 및 국비 종료 후 사후 운영·자립 방안 포함',
    points: 15,
    checked: false,
  },
];

const STORAGE_KEY_PROPOSAL = 'nonsan_grant_radar_proposal_draft_v1';

interface ProposalDraftViewProps {
  grants: GrantNotice[];
  prefillGrant: GrantNotice | null;
  onClearPrefill: () => void;
  onNotify: (msg: string) => void;
  onRecordRuntimeError?: (source: string, code: string, message: string) => void;
}

function buildFormFromGrant(grant: GrantNotice): ProposalFormState {
  const total = grant.totalProjectBudget;
  const localTotal = Math.max(0, Math.round((total - grant.nationalBudget) * 10) / 10);
  const provincialBudget = Math.round(localTotal * 0.3 * 10) / 10;
  const municipalBudget = Math.max(0, Math.round((localTotal - provincialBudget) * 10) / 10);

  return {
    projectTitle: grant.title,
    department: (grant.assignedDept || grant.diagnostic.recommendedDept) as NonsanDepartment,
    ministry: grant.ministry,
    nationalBudget: grant.nationalBudget,
    provincialBudget,
    municipalBudget,
    period: '2027.01. ~ 2029.12. (3년간)',
    location: grant.factors.existingAssetNote
      ? `충청남도 논산시 일원 (${grant.factors.existingAssetNote})`
      : '충청남도 논산시 일원 ([확인 필요] 세부 지번)',
    extraContext: `${grant.summary} / 신청자격: ${grant.eligibilityText}`,
  };
}

const DEFAULT_FORM: ProposalFormState = {
  projectTitle: '2027년 국방혁신클러스터 산학연 실증기반 구축 공모',
  department: '국방산업과',
  ministry: '방위사업청',
  nationalBudget: 120,
  provincialBudget: 15.4,
  municipalBudget: 36,
  period: '2027.01. ~ 2029.12. (3년간)',
  location: '충청남도 논산시 연무읍 일원 (논산 국방국가산업단지 연계 부지)',
  extraContext:
    '비무기체계·전력지원체계 중소방산기업 시험평가 실증 테스트베드 구축, 인구감소지역 가점 및 육군훈련소·국방대 인프라 연계.',
};

function countNeedsCheck(text: string): number {
  const matches = text.match(/\[확인 필요\]/g);
  return matches ? matches.length : 0;
}

function renderHighlightedText(text: string) {
  const parts = text.split(/(\[확인 필요\])/g);
  return parts.map((part, i) =>
    part === '[확인 필요]' ? (
      <mark
        key={i}
        className="bg-amber-100 text-amber-900 font-semibold px-1 rounded-xs"
      >
        [확인 필요]
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

export function ProposalDraftView({
  grants,
  prefillGrant,
  onClearPrefill,
  onNotify,
  onRecordRuntimeError,
}: ProposalDraftViewProps) {
  const [form, setForm] = useState<ProposalFormState>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_PROPOSAL);
      if (saved) {
        const parsed = JSON.parse(saved) as { form?: ProposalFormState };
        if (parsed.form) return parsed.form;
      }
    } catch {
      // ignore
    }
    return DEFAULT_FORM;
  });

  const [drafts, setDrafts] = useState<Record<ProposalSectionKey, string>>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_PROPOSAL);
      if (saved) {
        const parsed = JSON.parse(saved) as { drafts?: Record<ProposalSectionKey, string> };
        if (parsed.drafts) return parsed.drafts;
      }
    } catch {
      // ignore
    }
    return {
      background: '',
      overview: '',
      plan: '',
      effects: '',
      risks: '',
    };
  });

  const [evalChecklist, setEvalChecklist] = useState<EvalCriterionItem[]>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_PROPOSAL);
      if (saved) {
        const parsed = JSON.parse(saved) as { evalChecklist?: EvalCriterionItem[] };
        if (parsed.evalChecklist && parsed.evalChecklist.length > 0) return parsed.evalChecklist;
      }
    } catch {
      // ignore
    }
    return INITIAL_EVAL_CHECKLIST;
  });

  const [loadingSection, setLoadingSection] = useState<ProposalSectionKey | 'all' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');
  const [copiedDone, setCopiedDone] = useState(false);

  // When routed from GrantDetailDrawer ("사업계획서 초안 작성"), auto-populate form
  useEffect(() => {
    if (prefillGrant) {
      setForm(buildFormFromGrant(prefillGrant));
      setDrafts({
        background: '',
        overview: '',
        plan: '',
        effects: '',
        risks: '',
      });
      setErrorMsg(null);
      onClearPrefill();
    }
  }, [prefillGrant, onClearPrefill]);

  // Persist draft state
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY_PROPOSAL,
        JSON.stringify({ form, drafts, evalChecklist })
      );
    } catch {
      // ignore
    }
  }, [form, drafts, evalChecklist]);

  const totalBudget = useMemo(
    () =>
      Math.round(
        (Number(form.nationalBudget || 0) +
          Number(form.provincialBudget || 0) +
          Number(form.municipalBudget || 0)) *
          10
      ) / 10,
    [form.nationalBudget, form.provincialBudget, form.municipalBudget]
  );

  const budgetRatio = (val: number) =>
    totalBudget > 0 ? Math.round((val / totalBudget) * 1000) / 10 : 0;

  const filledSectionsCount = useMemo(
    () => PROPOSAL_SECTIONS.filter((s) => drafts[s.key].trim().length > 0).length,
    [drafts]
  );

  const totalNeedsCheckCount = useMemo(
    () =>
      PROPOSAL_SECTIONS.reduce((sum, s) => sum + countNeedsCheck(drafts[s.key]), 0),
    [drafts]
  );

  const evalScore = useMemo(
    () => evalChecklist.filter((item) => item.checked).reduce((s, item) => s + item.points, 0),
    [evalChecklist]
  );

  const handleImportGrant = (grantId: string) => {
    const found = grants.find((g) => g.id === grantId);
    if (!found) return;
    setForm(buildFormFromGrant(found));
    setErrorMsg(null);
    onNotify(`'${found.title}' 기본정보를 불러왔습니다.`);
  };

  const generateDraft = async (sectionKey: ProposalSectionKey | 'all') => {
    if (!form.projectTitle.trim()) {
      setErrorMsg('사업명을 입력해 주세요.');
      return;
    }
    setErrorMsg(null);
    setLoadingSection(sectionKey);

    try {
      const response = await fetch('/api/proposal/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sectionKey,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        sections?: Record<ProposalSectionKey, string>;
        content?: string;
      };

      if (!response.ok) {
        const message = data.error || 'AI 초안 생성 중 오류가 발생했습니다.';
        setErrorMsg(message);
        onRecordRuntimeError?.('계획서 AI 초안 생성', `HTTP ${response.status}`, message);
        return;
      }

      if (sectionKey === 'all' && data.sections) {
        setDrafts({
          background: data.sections.background || '',
          overview: data.sections.overview || '',
          plan: data.sections.plan || '',
          effects: data.sections.effects || '',
          risks: data.sections.risks || '',
        });
        onNotify('5개 목차 공문서 개조식 AI 초안을 생성했습니다.');
      } else if (sectionKey !== 'all' && typeof data.content === 'string') {
        setDrafts((prev) => ({ ...prev, [sectionKey]: data.content || '' }));
        const label = PROPOSAL_SECTIONS.find((s) => s.key === sectionKey)?.title ?? '';
        onNotify(`'${label}' AI 초안을 생성했습니다.`);
      }
    } catch {
      const msg = '서버 연결에 실패했습니다. 네트워크 상태 또는 서버 실행 여부를 확인해 주세요.';
      setErrorMsg(msg);
      onRecordRuntimeError?.('계획서 AI 초안 생성', 'NETWORK_ERR', msg);
    } finally {
      setLoadingSection(null);
    }
  };

  const buildFinalDocument = () => {
    const headerLines = [
      `[중앙부처 공모사업 계획서 초안]`,
      `□ 사 업 명: ${form.projectTitle}`,
      `□ 추진부서: 논산시 ${form.department} (주관부처: ${form.ministry})`,
      `□ 사 업 비: 총 ${totalBudget.toLocaleString()}억 원 (국비 ${form.nationalBudget}억[${budgetRatio(form.nationalBudget)}%] / 도비 ${form.provincialBudget}억[${budgetRatio(form.provincialBudget)}%] / 시비 ${form.municipalBudget}억[${budgetRatio(form.municipalBudget)}%])`,
      `□ 사업기간: ${form.period}`,
      `□ 대 상 지: ${form.location}`,
      '',
    ];

    const bodyLines = PROPOSAL_SECTIONS.map((sec) => {
      const content = drafts[sec.key].trim() || '□ (초안 미작성 — AI 초안 생성 또는 직접 입력 필요)';
      return `==================================================\n${sec.index}. ${sec.title}\n==================================================\n${content}`;
    });

    return [...headerLines, ...bodyLines].join('\n\n');
  };

  const handleCopyFinal = async () => {
    const doc = buildFinalDocument();
    try {
      await navigator.clipboard.writeText(doc);
      setCopiedDone(true);
      onNotify('공문서 최종본을 클립보드에 복사했습니다. 한글(HWP)에 바로 붙여넣으세요.');
      window.setTimeout(() => setCopiedDone(false), 2000);
    } catch {
      onNotify('클립보드 복사가 제한되어 텍스트 다운로드 버튼을 이용해 주세요.');
    }
  };

  const handleDownloadTxt = () => {
    const doc = buildFinalDocument();
    const blob = new Blob([doc], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `논산시_공모계획서_${form.projectTitle.slice(0, 20).replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify('공모사업 계획서 텍스트(.txt) 파일을 내려받았습니다.');
  };

  const toggleEvalItem = (id: string) => {
    setEvalChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            공모사업 계획서 AI 초안 작성기
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            공문서 개조식(□ ○ - ※)과 명사형 종결(~함, ~임)로 목차별 초안을 생성하며, 근거 없는 수치는 자동으로 [확인 필요]로 표기합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            aria-label="등록 공고 불러오기"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) handleImportGrant(e.target.value);
              e.target.value = '';
            }}
            className="h-9 px-3 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700 focus:outline-none focus:border-blue-700 max-w-[240px]"
          >
            <option value="">레이더 공고에서 기본정보 불러오기...</option>
            {grants.map((g) => (
              <option key={g.id} value={g.id}>
                [{g.ministry.slice(0, 3)}] {g.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={loadingSection !== null}
            onClick={() => generateDraft('all')}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:bg-slate-400 transition-colors whitespace-nowrap"
          >
            {loadingSection === 'all' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>5개 목차 일괄 생성 중...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                <span>5개 목차 전체 AI 생성</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 1. 기본정보 입력폼 */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">01. 기본정보 입력</h2>
          <div className="text-xs font-mono tabular-nums text-slate-600">
            총사업비{' '}
            <strong className="text-slate-900 text-sm">
              {totalBudget.toLocaleString()}억 원
            </strong>
            {' · '}국비 {budgetRatio(form.nationalBudget)}% / 도비{' '}
            {budgetRatio(form.provincialBudget)}% / 시비 {budgetRatio(form.municipalBudget)}%
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <label className="md:col-span-6 block space-y-1">
            <span className="text-xs font-semibold text-slate-700">사업명 *</span>
            <input
              type="text"
              value={form.projectTitle}
              onChange={(e) => setForm({ ...form, projectTitle: e.target.value })}
              placeholder="중앙부처 공모사업명 입력"
              className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
            />
          </label>

          <label className="md:col-span-3 block space-y-1">
            <span className="text-xs font-semibold text-slate-700">추진 부서</span>
            <select
              value={form.department}
              onChange={(e) =>
                setForm({ ...form, department: e.target.value as NonsanDepartment })
              }
              className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
            >
              {NONSAN_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-3 block space-y-1">
            <span className="text-xs font-semibold text-slate-700">주관 중앙부처</span>
            <select
              value={form.ministry}
              onChange={(e) => setForm({ ...form, ministry: e.target.value as Ministry })}
              className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
            >
              {MINISTRIES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          {/* 사업비 국/도/시비 */}
          <label className="md:col-span-2 block space-y-1">
            <span className="text-xs font-semibold text-slate-700">국비 (억 원)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={form.nationalBudget}
              onChange={(e) =>
                setForm({ ...form, nationalBudget: Math.max(0, Number(e.target.value)) })
              }
              className="w-full h-9 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
            />
          </label>

          <label className="md:col-span-2 block space-y-1">
            <span className="text-xs font-semibold text-slate-700">도비 (억 원)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={form.provincialBudget}
              onChange={(e) =>
                setForm({ ...form, provincialBudget: Math.max(0, Number(e.target.value)) })
              }
              className="w-full h-9 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
            />
          </label>

          <label className="md:col-span-2 block space-y-1">
            <span className="text-xs font-semibold text-slate-700">시비 (억 원)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={form.municipalBudget}
              onChange={(e) =>
                setForm({ ...form, municipalBudget: Math.max(0, Number(e.target.value)) })
              }
              className="w-full h-9 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
            />
          </label>

          <label className="md:col-span-3 block space-y-1">
            <span className="text-xs font-semibold text-slate-700">사업기간</span>
            <input
              type="text"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
              placeholder="예: 2027.01. ~ 2029.12. (3년)"
              className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
            />
          </label>

          <label className="md:col-span-3 block space-y-1">
            <span className="text-xs font-semibold text-slate-700">대상지</span>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="예: 충남 논산시 연무읍 일원"
              className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
            />
          </label>

          <label className="md:col-span-12 block space-y-1">
            <span className="text-xs font-medium text-slate-600">
              추가 반영사항 · 핵심 근거 메모 (선택 — 입력하지 않은 수치는 모두 [확인 필요]로 표시됨)
            </span>
            <input
              type="text"
              value={form.extraContext}
              onChange={(e) => setForm({ ...form, extraContext: e.target.value })}
              placeholder="예: 기존 선행사업, 보유 부지 현황, 협업 대학·기관, 공고문 강조 배점 요소 등"
              className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-700"
            />
          </label>
        </div>
      </section>

      {errorMsg && (
        <div
          role="alert"
          className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800"
        >
          <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Split: Left 5-Section Draft Workspace / Right Evaluation Checklist & Copy Final */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: 5-Section AI Draft Editor & Preview */}
        <div className="xl:col-span-8 space-y-4">
          {/* Toolbar */}
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span>
                작성 목차{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {filledSectionsCount} / 5
                </strong>
              </span>
              <span className="text-slate-300">·</span>
              <span>
                미확인 수치{' '}
                <strong
                  className={`font-mono tabular-nums ${
                    totalNeedsCheckCount > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  [확인 필요] {totalNeedsCheckCount}건
                </strong>
              </span>
              <span className="text-slate-300 hidden sm:inline">·</span>
              <span className="hidden sm:inline text-slate-500">
                문체: 개조식(□ ○ - ※) · 명사형 종결(~함, ~임)
              </span>
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  viewMode === 'preview'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>검토 보기</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  viewMode === 'edit'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PencilLine className="w-3.5 h-3.5" />
                <span>직접 수정</span>
              </button>
            </div>
          </div>

          {/* 5 Sections */}
          {PROPOSAL_SECTIONS.map((sec) => {
            const content = drafts[sec.key];
            const needsCheck = countNeedsCheck(content);
            const isLoading = loadingSection === sec.key || loadingSection === 'all';

            return (
              <section
                key={sec.key}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        {sec.index}. {sec.title}
                      </h3>
                      {needsCheck > 0 && (
                        <span className="text-xs font-mono tabular-nums font-medium text-amber-800">
                          [확인 필요] {needsCheck}건
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{sec.hint}</p>
                  </div>

                  <button
                    type="button"
                    disabled={loadingSection !== null}
                    onClick={() => generateDraft(sec.key)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>생성 중...</span>
                      </>
                    ) : content ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>다시 생성</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>AI 초안 생성</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-5">
                  {isLoading ? (
                    <div className="space-y-2.5 py-2" aria-busy="true">
                      <div className="h-3.5 bg-slate-100 rounded w-3/4 animate-pulse" />
                      <div className="h-3.5 bg-slate-100 rounded w-full animate-pulse" />
                      <div className="h-3.5 bg-slate-100 rounded w-5/6 animate-pulse" />
                      <div className="h-3.5 bg-slate-100 rounded w-2/3 animate-pulse" />
                    </div>
                  ) : viewMode === 'edit' || !content ? (
                    <textarea
                      rows={content ? 9 : 4}
                      value={content}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [sec.key]: e.target.value }))
                      }
                      placeholder={`우측 상단 'AI 초안 생성'을 누르거나 공문서 개조식(□ ○ - ※)으로 직접 입력하세요.`}
                      className="w-full p-3 text-sm bg-slate-50/70 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 leading-relaxed focus:bg-white focus:outline-none focus:border-blue-700"
                    />
                  ) : (
                    <div
                      onClick={() => setViewMode('edit')}
                      title="클릭하여 직접 수정 모드로 전환"
                      className="text-sm text-slate-800 whitespace-pre-wrap leading-7 cursor-text"
                    >
                      {renderHighlightedText(content)}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* Right Sticky Panel: 평가지표 체크리스트 & 최종본 복사 */}
        <aside className="xl:col-span-4 space-y-5 xl:sticky xl:top-20">
          {/* Copy / Export Final Document Card */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">최종본 내보내기</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  기본정보 헤더와 5개 목차 초안을 공문서 양식으로 통합합니다.
                </p>
              </div>
              <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs py-3 border-y border-slate-200">
              <div>
                <dt className="text-slate-500">목차 완성도</dt>
                <dd className="mt-0.5 font-mono tabular-nums font-bold text-slate-900 text-sm">
                  {filledSectionsCount} / 5개 목차
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">남은 확인 항목</dt>
                <dd
                  className={`mt-0.5 font-mono tabular-nums font-bold text-sm ${
                    totalNeedsCheckCount > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {totalNeedsCheckCount}건
                </dd>
              </div>
            </dl>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleCopyFinal}
                className="w-full inline-flex items-center justify-center gap-1.5 h-10 px-4 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                {copiedDone ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>최종본 클립보드 복사 완료</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>공모 계획서 최종본 전체 복사</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadTxt}
                className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-4 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>텍스트 파일(.txt) 다운로드</span>
              </button>
            </div>
          </section>

          {/* 평가지표 체크리스트 */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">평가지표 자체 체크리스트</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  중앙부처 공모 심사 표준 배점 기준 (100점)
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-bold font-mono tabular-nums text-blue-800">
                  {evalScore}점
                </div>
                <div className="text-[11px] text-slate-400 font-mono">/ 100점</div>
              </div>
            </div>

            <div className="px-5 pt-3 pb-1">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    evalScore >= 85 ? 'bg-emerald-600' : 'bg-blue-700'
                  }`}
                  style={{ width: `${evalScore}%` }}
                />
              </div>
            </div>

            <ul className="divide-y divide-slate-100 mt-2">
              {evalChecklist.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggleEvalItem(item.id)}
                    className="w-full px-5 py-3 flex items-start justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex items-start gap-2.5 min-w-0">
                      {item.checked ? (
                        <CheckSquare className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-800">
                          {item.category}
                        </span>
                        <span
                          className={`block text-xs mt-0.5 leading-snug ${
                            item.checked ? 'line-through text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          {item.label}
                        </span>
                      </span>
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                      {item.points}점
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
