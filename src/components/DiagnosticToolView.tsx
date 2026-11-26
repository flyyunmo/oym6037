import { CheckCircle2, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  DIAGNOSTIC_PRESETS,
  MINISTRIES,
  STRATEGIC_DOMAINS,
} from '../data/initialGrants';
import {
  DiagnosticFormInput,
  GrantNotice,
  Ministry,
  NonsanProfile,
  StrategicDomain,
} from '../types/grant';
import {
  buildDefaultChecklist,
  evaluateNonsanFit,
  formatDDay,
  getDaysRemaining,
  REFERENCE_DATE_STR,
} from '../utils/diagnostics';

interface DiagnosticToolViewProps {
  profile: NonsanProfile;
  onRegisterGrant: (grant: GrantNotice) => void;
}

const DEFAULT_FORM: DiagnosticFormInput = {
  title: '',
  ministry: '농림축산식품부',
  domain: '스마트농업',
  summary: '',
  eligibilityText: '기초지자체 (인구감소지역 가점)',
  deadlineDate: '2026-12-26',
  nationalBudget: 40,
  nationalRatio: 70,
  populationDeclineBonus: true,
  urbanRuralFit: true,
  requiresSiteSecured: false,
  requiresFeasibilityStudy: false,
  linksExistingAsset: true,
  existingAssetNote: '',
};

export function DiagnosticToolView({ profile, onRegisterGrant }: DiagnosticToolViewProps) {
  const [form, setForm] = useState<DiagnosticFormInput>(DEFAULT_FORM);
  const [errorMsg, setErrorMsg] = useState('');
  const [registeredNoticeTitle, setRegisteredNoticeTitle] = useState('');

  const diagnostic = useMemo(() => evaluateNonsanFit(form, profile), [form, profile]);
  const daysRemaining = getDaysRemaining(form.deadlineDate);
  const totalProjectBudget =
    Math.round((form.nationalBudget / (Math.max(10, form.nationalRatio) / 100)) * 10) / 10;

  const applyPreset = (presetData: DiagnosticFormInput) => {
    setForm(presetData);
    setErrorMsg('');
    setRegisteredNoticeTitle('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setErrorMsg('공모사업명을 입력해 주세요.');
      return;
    }
    if (!form.deadlineDate) {
      setErrorMsg('마감일을 선택해 주세요.');
      return;
    }

    const id = `ns-custom-${Date.now()}`;
    const shortMinistry = form.ministry.slice(0, 3);
    const noticeCode = `${shortMinistry}-2026-${String(Math.floor(100 + Math.random() * 899))}`;
    const checklist = buildDefaultChecklist({
      requiresSiteSecured: form.requiresSiteSecured,
      requiresFeasibilityStudy: form.requiresFeasibilityStudy,
      nationalRatio: form.nationalRatio,
    }).map((item) => ({ ...item, id: `${id}-${item.id}` }));

    const newGrant: GrantNotice = {
      id,
      noticeCode,
      title: form.title.trim(),
      ministry: form.ministry,
      domain: form.domain,
      summary:
        form.summary.trim() ||
        `${form.ministry} 주관 ${form.domain} 분야 중앙부처 공모사업 (적합성 진단 등록).`,
      eligibilityText: form.eligibilityText.trim() || '기초지자체 대상',
      announcedDate: REFERENCE_DATE_STR,
      deadlineDate: form.deadlineDate,
      nationalBudget: Number(form.nationalBudget) || 0,
      nationalRatio: Number(form.nationalRatio) || 50,
      totalProjectBudget,
      status: diagnostic.grade === 'A' || diagnostic.grade === 'B' ? '검토중' : '미검토',
      assignedDept:
        diagnostic.grade === 'A' || diagnostic.grade === 'B'
          ? diagnostic.recommendedDept
          : '',
      assignedOfficer: '',
      factors: {
        populationDeclineBonus: form.populationDeclineBonus,
        urbanRuralFit: form.urbanRuralFit,
        requiresSiteSecured: form.requiresSiteSecured,
        requiresFeasibilityStudy: form.requiresFeasibilityStudy,
        linksExistingAsset: form.linksExistingAsset,
        existingAssetNote: form.existingAssetNote.trim(),
      },
      diagnostic,
      checklist,
      notes: '',
      sourceUrlLabel: `${form.ministry} 직접 등록 공고`,
      isNewThisWeek: true,
    };

    onRegisterGrant(newGrant);
    setRegisteredNoticeTitle(newGrant.title);
    setErrorMsg('');
  };

  const gradeColor =
    diagnostic.grade === 'A'
      ? 'text-emerald-700'
      : diagnostic.grade === 'B'
        ? 'text-blue-800'
        : diagnostic.grade === 'C'
          ? 'text-amber-700'
          : 'text-slate-600';

  return (
    <div className="space-y-6">
      {/* Intro & Sample Presets */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            신규 중앙부처 공모 적합성 진단
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            공문이나 부처 보도자료로 입수한 공모 조건을 입력하면 논산시 5대 기준에 따라 적합도와 예상 시비 매칭을 즉시 산출합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500">예시 불러오기:</span>
          {DIAGNOSTIC_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset.data)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 transition-colors whitespace-nowrap"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {registeredNoticeTitle && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-3 text-sm text-emerald-900">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="truncate">
              <strong>{registeredNoticeTitle}</strong> 공고가 공모 레이더 및 마감 일정에 등록되었습니다.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setForm(DEFAULT_FORM);
              setRegisteredNoticeTitle('');
            }}
            className="text-xs font-semibold text-emerald-800 hover:underline whitespace-nowrap shrink-0"
          >
            새 공고 입력
          </button>
        </div>
      )}

      {/* Two-Column Split: Form Left / Live Diagnostic Result Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Input Form */}
        <form
          onSubmit={handleSubmit}
          className="xl:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-5"
        >
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-700">공모사업명 *</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="예: 2027년 농촌공간정비 및 정주여건 개선 공모사업"
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">주관 중앙부처</span>
                <select
                  value={form.ministry}
                  onChange={(e) => setForm({ ...form, ministry: e.target.value as Ministry })}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
                >
                  {MINISTRIES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">논산 전략분야</span>
                <select
                  value={form.domain}
                  onChange={(e) =>
                    setForm({ ...form, domain: e.target.value as StrategicDomain })
                  }
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
                >
                  {STRATEGIC_DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">국비 규모 (억 원)</span>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  step={1}
                  value={form.nationalBudget}
                  onChange={(e) =>
                    setForm({ ...form, nationalBudget: Math.max(0, Number(e.target.value)) })
                  }
                  className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">국비 보조율 (%)</span>
                <input
                  type="number"
                  min={20}
                  max={100}
                  step={5}
                  value={form.nationalRatio}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nationalRatio: Math.min(100, Math.max(10, Number(e.target.value))),
                    })
                  }
                  className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">접수 마감일 *</span>
                <input
                  type="date"
                  value={form.deadlineDate}
                  onChange={(e) => setForm({ ...form, deadlineDate: e.target.value })}
                  className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-700">주요 사업 내용 요약</span>
              <textarea
                rows={2}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="핵심 지원내용과 기대효과를 1~2문장으로 입력하세요."
                className="w-full p-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-700">신청자격·우대조건</span>
              <input
                type="text"
                value={form.eligibilityText}
                onChange={(e) => setForm({ ...form, eligibilityText: e.target.value })}
                placeholder="예: 비수도권 기초지자체, 인구감소지역 가점 3점"
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
              />
            </label>
          </div>

          <hr className="border-slate-200" />

          {/* Diagnostic Condition Checkboxes */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-700">논산시 적합성 평가 요건 체크</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
              <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.populationDeclineBonus}
                  onChange={(e) =>
                    setForm({ ...form, populationDeclineBonus: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 accent-slate-900"
                />
                <span className="text-xs text-slate-800 leading-snug">
                  <strong>인구감소지역 가점·전용</strong>
                  <span className="block text-slate-500 mt-0.5">
                    논산시 인구감소지역 지정 혜택 적용
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.urbanRuralFit}
                  onChange={(e) => setForm({ ...form, urbanRuralFit: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-slate-900"
                />
                <span className="text-xs text-slate-800 leading-snug">
                  <strong>도농복합시 요건 부합</strong>
                  <span className="block text-slate-500 mt-0.5">
                    시·군 농촌·원도심 동시 대상 가능
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.linksExistingAsset}
                  onChange={(e) => setForm({ ...form, linksExistingAsset: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-slate-900"
                />
                <span className="text-xs text-slate-800 leading-snug">
                  <strong>논산 기존 거점 연계 가능</strong>
                  <span className="block text-slate-500 mt-0.5">
                    국방산단·딸기클러스터·탑정호·강경 등
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requiresSiteSecured}
                  onChange={(e) =>
                    setForm({ ...form, requiresSiteSecured: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 accent-slate-900"
                />
                <span className="text-xs text-slate-800 leading-snug">
                  <strong>사전 부지 확보·동의 필수</strong>
                  <span className="block text-slate-500 mt-0.5">
                    마감 전 부지 증빙 준비 부담 반영
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.requiresFeasibilityStudy}
                  onChange={(e) =>
                    setForm({ ...form, requiresFeasibilityStudy: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 accent-slate-900"
                />
                <span className="text-xs text-slate-800 leading-snug">
                  <strong>사전 타당성 용역 또는 기초 수요조사 첨부 필수</strong>
                  <span className="block text-slate-500 mt-0.5">
                    마감 잔여일이 짧을 경우 실행 여유도 감점 및 사전 자문 체크리스트 자동 생성
                  </span>
                </span>
              </label>
            </div>

            {form.linksExistingAsset && (
              <label className="block space-y-1.5 pt-1">
                <span className="text-xs font-medium text-slate-600">
                  연계 가능한 논산시 거점·선행사업 메모
                </span>
                <input
                  type="text"
                  value={form.existingAssetNote}
                  onChange={(e) => setForm({ ...form, existingAssetNote: e.target.value })}
                  placeholder="예: 연무읍 국방국가산단 부지 및 건양대 국방트랙 연계"
                  className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
                />
              </label>
            )}
          </div>

          {errorMsg && <p className="text-xs font-medium text-red-700">{errorMsg}</p>}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setForm(DEFAULT_FORM);
                setErrorMsg('');
              }}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              입력 초기화
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>공모 레이더에 등록</span>
            </button>
          </div>
        </form>

        {/* Right: Live Diagnostic Output Panel */}
        <aside className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-5 xl:sticky xl:top-20">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs font-medium text-slate-500">실시간 논산시 적합성 진단</div>
              <div className={`mt-1 text-2xl font-bold tracking-tight ${gradeColor}`}>
                {diagnostic.grade}등급 · {diagnostic.gradeLabel}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                추천 주관부서: <strong className="text-slate-900">{diagnostic.recommendedDept}</strong>
                {' · '}협업: {diagnostic.collaboratingDepts.join(', ')}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-3xl font-bold font-mono tabular-nums ${gradeColor}`}>
                {diagnostic.scoreOutOf5.toFixed(1)}
              </div>
              <div className="text-xs text-slate-400 font-mono">/ 5.0점</div>
            </div>
          </div>

          {/* Budget & Deadline Summary */}
          <dl className="grid grid-cols-3 gap-3 text-xs pb-4 border-b border-slate-200">
            <div>
              <dt className="text-slate-500">추산 총사업비</dt>
              <dd className="mt-1 font-mono tabular-nums font-semibold text-slate-900">
                {totalProjectBudget.toLocaleString()}억 원
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">추산 시비 매칭</dt>
              <dd className="mt-1 font-mono tabular-nums font-semibold text-slate-900">
                약 {diagnostic.estimatedLocalMatch}억 원
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">마감 잔여일</dt>
              <dd
                className={`mt-1 font-mono tabular-nums font-semibold ${
                  daysRemaining <= 3 ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {formatDDay(daysRemaining)}
              </dd>
            </div>
          </dl>

          {/* 5-Axis Rubric Breakdown */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-800">
              논산 전략·자원 대조 5대 항목 (5.0점 만점)
            </div>
            {diagnostic.criteria.map((c) => {
              const pct = Math.round((c.scoreOutOf5 / 5) * 100);
              return (
                <div key={c.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {c.label} <span className="text-slate-400 font-mono">({c.weightPercent}%)</span>
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {c.scoreOutOf5.toFixed(1)} / 5.0
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
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

          <hr className="border-slate-200" />

          {/* Strengths & Cautions */}
          <div className="space-y-3 text-xs">
            <div>
              <div className="font-semibold text-emerald-800 mb-1.5">논산시 유리 요인</div>
              <ul className="space-y-1 text-slate-700">
                {diagnostic.strengths.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-700 font-bold shrink-0">+</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-semibold text-amber-800 mb-1.5">사전 점검·보완사항</div>
              <ul className="space-y-1 text-slate-700">
                {diagnostic.cautions.map((c, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-700 font-bold shrink-0">!</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
