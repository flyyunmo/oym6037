import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

const SECTION_META: Record<
  string,
  { title: string; guide: string }
> = {
  background: {
    title: '1. 배경 및 필요성',
    guide:
      '중앙부처 정책 기조와 논산시 지역 현안(인구감소지역, 도농복합시, 국방·농업·관광 등 해당 분야 맥락), 기존 사업의 한계 및 국비 지원 시급성을 논리적으로 정리.',
  },
  overview: {
    title: '2. 사업개요',
    guide:
      '사업명, 추진부서, 주관부처, 사업기간, 대상지, 총사업비(국·도·시비 내역과 비율), 핵심 사업내용과 추진체계를 명료하게 구조화.',
  },
  plan: {
    title: '3. 세부추진계획',
    guide:
      '단계별·연차별 추진 로드맵(사전절차, 설계·기반구축, 시범운영·고도화), 핵심 세부과제 3~4개, 관계기관 협업 및 재원 집행계획을 구체화.',
  },
  effects: {
    title: '4. 기대효과',
    guide:
      '정량적 기대효과(근거 없는 모든 목표 수치는 반드시 [확인 필요]로 표기)와 정성적 기대효과(지역경제, 정주여건, 정책 확산성)를 구분해 작성.',
  },
  risks: {
    title: '5. 리스크 및 대응방안',
    guide:
      '부지확보·인허가 지연, 시비 매칭 예산 확보, 주민수용성, 사업 종료 후 운영비 자립 등 예상 리스크별 선제적 대응방안과 관리체계를 제시.',
  },
};

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildSystemInstruction(): string {
  return [
    '당신은 충청남도 논산시청 공모사업 총괄 기획팀의 베테랑 행정사무관이다.',
    '중앙부처 제출용 공모사업 계획서 초안을 대한민국 공문서 표준 작성법에 따라 작성한다.',
    '',
    '[필수 문체 및 형식 규칙]',
    '1. 반드시 공문서 개조식 기호 위계(□ 대항목 → ○ 중항목 → - 세부항목 → ※ 참고/근거)를 사용한다.',
    '2. 모든 문장은 반드시 간결한 명사형 종결어미(~함, ~임, ~됨, ~예정임, ~계획임, ~필요함, ~기대됨)로 끝맺는다. "~합니다", "~입니다", "~하겠습니다" 같은 경어체는 절대 사용하지 않는다.',
    '3. 마크다운 기호(**, ##, ###, *, ``` 등)는 절대 사용하지 말고 한글(HWP) 공문서에 바로 붙여넣을 수 있는 순수 텍스트로만 출력한다.',
    '4. [엄격한 수치 검증 규칙] 사용자가 입력한 사업비(국·도·시비 및 총사업비), 사업기간, 대상지 정보 외에 근거가 제공되지 않은 모든 수치(인구수, 면적, 예산 세부항목, 참여 기업·농가 수, 고용·매출 증가량, 비율, 연도별 통계 등)는 절대로 임의로 지어내지 말고 반드시 [확인 필요]로 표기한다. 예: "관내 참여 농가 [확인 필요]호", "사업부지 면적 [확인 필요]㎡", "연간 방문객 [확인 필요]명 증가 기대됨".',
    '5. 각 목차 분량은 실무 보고서에 즉시 활용할 수 있도록 10~18줄 내외로 밀도 있고 구체적으로 작성한다.',
  ].join('\n');
}

interface ProposalPayload {
  projectTitle: string;
  department: string;
  ministry: string;
  nationalBudget: number;
  provincialBudget: number;
  municipalBudget: number;
  period: string;
  location: string;
  extraContext?: string;
  sectionKey: 'all' | 'background' | 'overview' | 'plan' | 'effects' | 'risks';
}

function buildBaseContext(body: ProposalPayload): string {
  const total =
    Math.round(
      (Number(body.nationalBudget) +
        Number(body.provincialBudget) +
        Number(body.municipalBudget)) *
        10
    ) / 10;
  const pct = (v: number) => (total > 0 ? `${Math.round((v / total) * 1000) / 10}%` : '0%');

  return [
    '[논산시 공모사업 기본정보]',
    `- 사업명: ${body.projectTitle}`,
    `- 추진부서: 논산시 ${body.department}`,
    `- 주관 중앙부처: ${body.ministry}`,
    `- 총사업비: ${total}억 원 (국비 ${body.nationalBudget}억 원 [${pct(body.nationalBudget)}] / 도비 ${body.provincialBudget}억 원 [${pct(body.provincialBudget)}] / 시비 ${body.municipalBudget}억 원 [${pct(body.municipalBudget)}])`,
    `- 사업기간: ${body.period}`,
    `- 대상지: ${body.location}`,
    body.extraContext?.trim()
      ? `- 추가 실무 메모·핵심 요건: ${body.extraContext.trim()}`
      : '- 추가 실무 메모: 별도 입력 없음 (입력되지 않은 수치는 모두 [확인 필요] 표기)',
  ].join('\n');
}

async function callWithRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (retries > 0 && (status === 429 || (status !== undefined && status >= 500))) {
      await new Promise((r) => setTimeout(r, 900));
      return callWithRetry(fn, retries - 1);
    }
    throw err;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/proposal/generate', async (req, res) => {
    try {
      const body = req.body as ProposalPayload;
      if (
        !body ||
        typeof body.projectTitle !== 'string' ||
        !body.projectTitle.trim() ||
        typeof body.department !== 'string' ||
        typeof body.ministry !== 'string'
      ) {
        res.status(400).json({ error: '사업명, 부서, 주관부처 등 필수 기본정보를 입력해 주세요.' });
        return;
      }

      const sectionKey = body.sectionKey || 'all';
      if (sectionKey !== 'all' && !SECTION_META[sectionKey]) {
        res.status(400).json({ error: '유효하지 않은 목차 요청입니다.' });
        return;
      }

      const ai = getAiClient();
      const baseContext = buildBaseContext(body);
      const systemInstruction = buildSystemInstruction();

      if (sectionKey === 'all') {
        const prompt = [
          baseContext,
          '',
          '위 기본정보를 바탕으로 중앙부처 제출용 공모사업 계획서의 5개 목차 초안을 JSON 객체로 생성하라.',
          '각 키별 작성 지침:',
          `- background (${SECTION_META.background.title}): ${SECTION_META.background.guide}`,
          `- overview (${SECTION_META.overview.title}): ${SECTION_META.overview.guide}`,
          `- plan (${SECTION_META.plan.title}): ${SECTION_META.plan.guide}`,
          `- effects (${SECTION_META.effects.title}): ${SECTION_META.effects.guide}`,
          `- risks (${SECTION_META.risks.title}): ${SECTION_META.risks.guide}`,
          '',
          '각 문자열 값에는 목차 번호 제목을 중복 넣지 말고 바로 "□ ..." 공문서 개조식 본문으로 시작하라.',
        ].join('\n');

        const response = await callWithRetry(() =>
          ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  background: { type: Type.STRING, description: '배경 및 필요성 개조식 초안' },
                  overview: { type: Type.STRING, description: '사업개요 개조식 초안' },
                  plan: { type: Type.STRING, description: '세부추진계획 개조식 초안' },
                  effects: { type: Type.STRING, description: '기대효과 개조식 초안' },
                  risks: { type: Type.STRING, description: '리스크 및 대응방안 개조식 초안' },
                },
                required: ['background', 'overview', 'plan', 'effects', 'risks'],
              },
            },
          })
        );

        const rawText = (response.text ?? '').trim();
        const parsed = JSON.parse(rawText) as Record<string, string>;
        res.json({ sections: parsed });
        return;
      }

      const meta = SECTION_META[sectionKey];
      const prompt = [
        baseContext,
        '',
        `작성 대상 목차: ${meta.title}`,
        `작성 지침: ${meta.guide}`,
        '',
        '목차 번호 제목은 생략하고 바로 "□ ..." 공문서 개조식 본문으로 시작하여 작성하라.',
      ].join('\n');

      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction,
          },
        })
      );

      const content = (response.text ?? '').trim();
      if (!content) {
        res.status(502).json({ error: 'AI 초안 응답이 비어 있습니다. 다시 시도해 주세요.' });
        return;
      }

      res.json({ sectionKey, content });
    } catch (err: unknown) {
      const errorObj = err as { message?: string; status?: number };
      if (errorObj?.message === 'GEMINI_API_KEY_MISSING') {
        res.status(500).json({
          error:
            '서버에 GEMINI_API_KEY가 설정되어 있지 않습니다. Settings > Secrets 패널에서 API 키 설정을 확인해 주세요.',
        });
        return;
      }
      if (errorObj?.status === 403 || errorObj?.status === 400) {
        res.status(errorObj.status).json({
          error:
            'Gemini API 인증 또는 요청 처리에 실패했습니다. Settings > Secrets 패널의 API 키를 확인해 주세요.',
        });
        return;
      }
      if (errorObj?.status === 429) {
        res.status(429).json({
          error:
            '요청 한도(할당량)를 초과했습니다. 잠시 후 다시 시도하거나 Settings > Secrets에서 API 키 등급을 확인해 주세요.',
        });
        return;
      }
      console.error('Proposal generation error:', err);
      res.status(500).json({
        error: 'AI 초안 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nonsan Grant Radar server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
