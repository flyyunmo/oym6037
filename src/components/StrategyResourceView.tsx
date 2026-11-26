import { ArrowRight, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { STRATEGIC_DOMAINS } from '../data/initialGrants';
import {
  DepartmentResource,
  GrantNotice,
  NonsanDepartment,
  NonsanProfile,
  NonsanStrategicProject,
  StrategicDomain,
  StrategyPriority,
} from '../types/grant';
import { formatDDay, getDaysRemaining } from '../utils/diagnostics';

interface StrategyResourceViewProps {
  profile: NonsanProfile;
  grants: GrantNotice[];
  onChangeProfile: (next: NonsanProfile) => void;
  onResetProfile: () => void;
  onSelectGrant: (grant: GrantNotice) => void;
  onQuickAssignDept: (grantId: string, dept: NonsanDepartment) => void;
}

const PRIORITIES: StrategyPriority[] = ['핵심', '중점', '일반'];

export function StrategyResourceView({
  profile,
  grants,
  onChangeProfile,
  onResetProfile,
  onSelectGrant,
  onQuickAssignDept,
}: StrategyResourceViewProps) {
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState<StrategicDomain>('국방·산업');
  const [newPriority, setNewPriority] = useState<StrategyPriority>('핵심');
  const [newKeywords, setNewKeywords] = useState('');
  const [newAsset, setNewAsset] = useState('');

  const rankedGrants = useMemo(() => {
    return [...grants]
      .filter((g) => g.status !== '제출완료')
      .sort((a, b) => b.diagnostic.scoreOutOf5 - a.diagnostic.scoreOutOf5);
  }, [grants]);

  const handleAddStrategy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const keywords = newKeywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const added: NonsanStrategicProject = {
      id: `sp-${Date.now()}`,
      name: newName.trim(),
      domain: newDomain,
      priority: newPriority,
      keywords: keywords.length > 0 ? keywords : [newDomain.split('·')[0]],
      coreAsset: newAsset.trim() || '논산시 주요 전략 거점',
      active: true,
    };

    onChangeProfile({
      ...profile,
      strategicProjects: [added, ...profile.strategicProjects],
    });
    setNewName('');
    setNewKeywords('');
    setNewAsset('');
  };

  const handleToggleStrategy = (id: string) => {
    onChangeProfile({
      ...profile,
      strategicProjects: profile.strategicProjects.map((sp) =>
        sp.id === id ? { ...sp, active: !sp.active } : sp
      ),
    });
  };

  const handleChangePriority = (id: string, priority: StrategyPriority) => {
    onChangeProfile({
      ...profile,
      strategicProjects: profile.strategicProjects.map((sp) =>
        sp.id === id ? { ...sp, priority } : sp
      ),
    });
  };

  const handleRemoveStrategy = (id: string) => {
    onChangeProfile({
      ...profile,
      strategicProjects: profile.strategicProjects.filter((sp) => sp.id !== id),
    });
  };

  const handleUpdateDeptResource = (
    dept: NonsanDepartment,
    patch: Partial<DepartmentResource>
  ) => {
    onChangeProfile({
      ...profile,
      departmentResources: profile.departmentResources.map((r) =>
        r.dept === dept ? { ...r, ...patch } : r
      ),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            논산시 전략사업 · 부서 가용자원 기반 5점 자동 매칭
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            시 핵심 전략사업 우선순위와 부서별 가용 시비·인력·부지 보유 현황을 수정하면 모든 중앙부처 공모사업의 5점 적합도와 추천 부서가 즉시 재산출됩니다.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetProfile}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>전략·자원 기본값 복원</span>
        </button>
      </div>

      {/* Scoring Formula Transparency Strip */}
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-xs font-semibold text-slate-800 mb-2">
          5.0점 만점 가중 평가 산식 (중앙부처 공모 요건 ↔ 논산시 전략·자원 자동 대조)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200/80">
            <div className="font-semibold text-slate-900">1. 전략사업 정합성</div>
            <div className="mt-0.5 font-mono tabular-nums text-blue-800 font-semibold">가중치 30%</div>
            <div className="mt-0.5 text-slate-500">전략 우선순위·키워드 대조</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200/80">
            <div className="font-semibold text-slate-900">2. 부서 예산 매칭</div>
            <div className="mt-0.5 font-mono tabular-nums text-blue-800 font-semibold">가중치 25%</div>
            <div className="mt-0.5 text-slate-500">추산 시비 vs 부서 가용예산</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200/80">
            <div className="font-semibold text-slate-900">3. 인력·실행 역량</div>
            <div className="mt-0.5 font-mono tabular-nums text-blue-800 font-semibold">가중치 20%</div>
            <div className="mt-0.5 text-slate-500">전담인력·부지·타당성 역량</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200/80">
            <div className="font-semibold text-slate-900">4. 자격·지역 가점</div>
            <div className="mt-0.5 font-mono tabular-nums text-blue-800 font-semibold">가중치 15%</div>
            <div className="mt-0.5 text-slate-500">인구감소지역·도농복합시</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200/80">
            <div className="font-semibold text-slate-900">5. 기존 거점 연계</div>
            <div className="mt-0.5 font-mono tabular-nums text-blue-800 font-semibold">가중치 10%</div>
            <div className="mt-0.5 text-slate-500">선행 인프라·거점자산 결합</div>
          </div>
        </div>
      </section>

      {/* Input Section: Left Strategic Projects, Right Department Resources */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: 논산시 주요 전략 사업 입력·관리 */}
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">논산시 주요 전략 사업 입력</h2>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              활성 {profile.strategicProjects.filter((s) => s.active).length} /{' '}
              {profile.strategicProjects.length}
            </span>
          </div>

          <ul className="divide-y divide-slate-200">
            {profile.strategicProjects.map((sp) => (
              <li
                key={sp.id}
                className={`px-5 py-3.5 space-y-2 transition-colors ${
                  sp.active ? 'bg-white' : 'bg-slate-50/70 opacity-65'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <label className="flex items-start gap-2.5 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={sp.active}
                      onChange={() => handleToggleStrategy(sp.id)}
                      className="mt-0.5 h-4 w-4 accent-slate-900 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 leading-snug">
                        {sp.name}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {sp.domain} · 키워드: {sp.keywords.join(', ')}
                      </div>
                    </div>
                  </label>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      aria-label={`${sp.name} 우선순위`}
                      value={sp.priority}
                      onChange={(e) =>
                        handleChangePriority(sp.id, e.target.value as StrategyPriority)
                      }
                      className="h-7 px-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-blue-700"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveStrategy(sp.id)}
                      aria-label="전략사업 삭제"
                      className="p-1 text-slate-400 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Add New Strategic Initiative Form */}
          <form
            onSubmit={handleAddStrategy}
            className="p-4 bg-slate-50/80 border-t border-slate-200 space-y-2.5"
          >
            <div className="text-xs font-semibold text-slate-700">신규 시정 전략사업 추가</div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="전략사업명 (예: 논산 국방드론 실증특구 조성)"
              className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value as StrategicDomain)}
                className="h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800"
              >
                {STRATEGIC_DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as StrategyPriority)}
                className="h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    우선순위: {p}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={newKeywords}
              onChange={(e) => setNewKeywords(e.target.value)}
              placeholder="매칭 키워드 쉼표 구분 (예: 드론, 국방, 실증, 항공)"
              className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newAsset}
                onChange={(e) => setNewAsset(e.target.value)}
                placeholder="보유 거점·인프라 (선택)"
                className="flex-1 h-9 px-3 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 h-9 px-3.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>추가</span>
              </button>
            </div>
          </form>
        </section>

        {/* Right: 부서별 가용 자원 입력 테이블 */}
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">부서별 가용 자원 입력</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                가용 시비 예산·전담인력·부지·타당성 역량을 변경하면 하단 5점 추천 순위가 즉시 갱신됩니다.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">부서 · 주력분야</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap">가용 시비(억)</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap">전담인력(명)</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap">부지보유</th>
                  <th className="py-2.5 pl-2 pr-5 text-center whitespace-nowrap">타당성역량</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {profile.departmentResources.map((res) => (
                  <tr key={res.dept} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pl-5 pr-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{res.dept}</div>
                      <div className="text-slate-500">{res.domains.join(', ')}</div>
                    </td>
                    <td className="py-2.5 px-2 text-right whitespace-nowrap">
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={res.availableBudget}
                        aria-label={`${res.dept} 가용 시비 예산`}
                        onChange={(e) =>
                          handleUpdateDeptResource(res.dept, {
                            availableBudget: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-20 h-8 px-2 text-right font-mono tabular-nums bg-white border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-blue-700"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-right whitespace-nowrap">
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={res.availableStaff}
                        aria-label={`${res.dept} 전담 인력`}
                        onChange={(e) =>
                          handleUpdateDeptResource(res.dept, {
                            availableStaff: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-16 h-8 px-2 text-right font-mono tabular-nums bg-white border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-blue-700"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={res.hasReadySite}
                        aria-label={`${res.dept} 사전 부지 보유`}
                        onChange={(e) =>
                          handleUpdateDeptResource(res.dept, { hasReadySite: e.target.checked })
                        }
                        className="h-4 w-4 accent-slate-900"
                      />
                    </td>
                    <td className="py-2.5 pl-2 pr-5 text-center">
                      <input
                        type="checkbox"
                        checked={res.canRunFeasibility}
                        aria-label={`${res.dept} 타당성 대응 역량`}
                        onChange={(e) =>
                          handleUpdateDeptResource(res.dept, {
                            canRunFeasibility: e.target.checked,
                          })
                        }
                        className="h-4 w-4 accent-slate-900"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Live 5-Point Automated Recommendation & Requirement Matching Matrix */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              실시간 5.0점 만점 자동 평가 · 추천 순위표
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              상단 전략사업·부서 가용자원 입력값과 중앙부처 공모 요건을 대조해 자동 산출한 추천 순위입니다.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-600">
            평가 대상 {rankedGrants.length}건
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="py-2.5 pl-5 pr-2 whitespace-nowrap">순위</th>
                <th className="py-2.5 px-3 min-w-[260px]">공모사업명 · 연계 전략사업</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">종합 적합도</th>
                <th className="py-2.5 px-3 whitespace-nowrap">요건 대조 (전략 / 예산 / 인력)</th>
                <th className="py-2.5 px-3 whitespace-nowrap">최적 추천 부서</th>
                <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">조치</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {rankedGrants.map((grant, idx) => {
                const cStrat = grant.diagnostic.criteria.find((c) => c.key === 'strategy');
                const cFiscal = grant.diagnostic.criteria.find((c) => c.key === 'fiscal');
                const cCap = grant.diagnostic.criteria.find((c) => c.key === 'capacity');
                const score5 = grant.diagnostic.scoreOutOf5;
                const scoreColor =
                  score5 >= 4.2
                    ? 'text-emerald-700'
                    : score5 >= 3.5
                      ? 'text-blue-800'
                      : score5 >= 2.8
                        ? 'text-amber-700'
                        : 'text-red-700';

                return (
                  <tr key={grant.id} className="hover:bg-slate-50 transition-colors align-top">
                    <td className="py-3.5 pl-5 pr-2 font-mono tabular-nums font-bold text-slate-500">
                      {String(idx + 1).padStart(2, '0')}
                    </td>

                    <td
                      onClick={() => onSelectGrant(grant)}
                      className="py-3.5 px-3 cursor-pointer"
                    >
                      <div className="font-semibold text-sm text-slate-900 hover:text-blue-800 leading-snug">
                        {grant.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {grant.ministry} · {formatDDay(getDaysRemaining(grant.deadlineDate))} ·{' '}
                        {grant.diagnostic.matchedStrategies[0] ? (
                          <span className="text-slate-700">
                            연계: {grant.diagnostic.matchedStrategies[0]}
                          </span>
                        ) : (
                          <span>직접 연계 전략 없음</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className={`text-sm font-mono tabular-nums font-bold ${scoreColor}`}>
                        {score5.toFixed(1)} / 5.0
                      </div>
                      <div className="text-slate-500 mt-0.5">{grant.diagnostic.gradeLabel}</div>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap font-mono tabular-nums">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700">
                          전략 {cStrat?.scoreOutOf5.toFixed(1)}
                        </span>
                        <span className="text-slate-300">/</span>
                        <span
                          className={
                            (cFiscal?.scoreOutOf5 ?? 0) < 3.0
                              ? 'text-red-700 font-semibold'
                              : 'text-slate-700'
                          }
                        >
                          예산 {cFiscal?.scoreOutOf5.toFixed(1)}
                        </span>
                        <span className="text-slate-300">/</span>
                        <span
                          className={
                            (cCap?.scoreOutOf5 ?? 0) < 3.0
                              ? 'text-amber-700 font-semibold'
                              : 'text-slate-700'
                          }
                        >
                          역량 {cCap?.scoreOutOf5.toFixed(1)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-slate-500 font-sans">
                        시비 {grant.diagnostic.estimatedLocalMatch}억 · 예산충족{' '}
                        {Math.min(100, grant.diagnostic.deptBudgetCoveragePct)}%
                      </div>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">
                        {grant.assignedDept || grant.diagnostic.recommendedDept}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {grant.assignedDept ? `배정완료 (${grant.status})` : '자동 추천 (미배정)'}
                      </div>
                    </td>

                    <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                      {!grant.assignedDept ? (
                        <button
                          type="button"
                          onClick={() =>
                            onQuickAssignDept(grant.id, grant.diagnostic.recommendedDept)
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors"
                        >
                          <span>추천 배정</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectGrant(grant)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                        >
                          상세 검토
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
