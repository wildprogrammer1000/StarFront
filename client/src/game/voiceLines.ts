import type { RaceId } from "../protocol";

/**
 * 종족·유닛 대사.
 * 지금은 text 를 브라우저 speechSynthesis 로 읽는다.
 * 나중에 같은 id 의 파일로 바꾼다. 예: human/rifleman/select/1 → /voice/human/rifleman/select/1.ogg
 *
 * pitch·rate 는 SpeechSynthesisUtterance 값(대략 0.1~2)이다.
 */

export type UnitVoiceCue = "select" | "move" | "attack" | "annoyed" | "produce";
export type AdvisorCue = "minerals" | "ether" | "supply";

export interface VoiceLine {
  id: string;
  text: string;
}

export interface VoiceSpeaker {
  pitch: number;
  rate: number;
}

export interface UnitVoice extends VoiceSpeaker {
  typeId: string;
  race: RaceId;
  lines: {
    select: readonly VoiceLine[];
    move: readonly VoiceLine[];
    annoyed: readonly VoiceLine[];
    produce: readonly VoiceLine[];
    attack?: readonly VoiceLine[];
  };
}

export interface RaceVoice extends VoiceSpeaker {
  race: RaceId;
  /** SpeechSynthesisVoice.name. 이 종족의 유닛·부관이 같이 쓴다. */
  voiceName: string;
  advisor: Record<AdvisorCue, readonly VoiceLine[]>;
}

const ko = "ko-KR";

export const VOICE_LANG = ko;

function line(id: string, text: string): VoiceLine {
  return { id, text };
}

export const RACE_VOICES: Record<RaceId, RaceVoice> = {
  human: {
    race: "human",
    voiceName: "Reed",
    pitch: 1.02,
    rate: 1.12,
    advisor: {
      minerals: [line("human/advisor/minerals/1", "미네랄이 부족합니다.")],
      ether: [line("human/advisor/ether/1", "에테르가 부족합니다.")],
      supply: [line("human/advisor/supply/2", "보급고가 더 필요합니다.")],
    },
  },
  monster: {
    race: "monster",
    voiceName: "Rocko",
    pitch: 0.45,
    rate: 0.98,
    advisor: {
      minerals: [line("monster/advisor/minerals/1", "미네랄이 없다.")],
      ether: [line("monster/advisor/ether/1", "에테르가 없다.")],
      supply: [line("monster/advisor/supply/2", "대군주가 더 필요하다.")],
    },
  },
  alien: {
    race: "alien",
    voiceName: "Sandy",
    pitch: 1.18,
    rate: 1.06,
    advisor: {
      minerals: [line("alien/advisor/minerals/1", "미네랄이 부족하다.")],
      ether: [line("alien/advisor/ether/1", "에테르가 부족하다.")],
      supply: [line("alien/advisor/supply/3", "더 이상 소환할 수 없다.")],
    },
  },
};

export const UNIT_VOICES: readonly UnitVoice[] = [
  {
    typeId: "human_worker",
    race: "human",
    pitch: 1.16,
    rate: 1.16,
    lines: {
      select: [
        line("human/worker/select/1", "건설로봇, 대기 중입니다."),
        line("human/worker/select/2", "작업 준비됐습니다."),
        line("human/worker/select/3", "명령을 기다립니다."),
      ],
      move: [
        line("human/worker/move/1", "이동하겠습니다."),
        line("human/worker/move/2", "그 위치로 갑니다."),
        line("human/worker/move/3", "알겠습니다."),
      ],
      attack: [
        line("human/worker/attack/1", "경계를 시작합니다."),
        line("human/worker/attack/2", "대상을 제거합니다."),
        line("human/worker/attack/3", "교전에 들어갑니다."),
      ],
      annoyed: [
        line("human/worker/annoyed/1", "같은 명령을 반복 중입니다."),
        line("human/worker/annoyed/2", "이미 대기하고 있습니다."),
        line("human/worker/annoyed/3", "수신은 끝났습니다."),
      ],
      produce: [
        line("human/worker/produce/1", "건설로봇, 배치 완료."),
        line("human/worker/produce/2", "작업에 투입할 수 있습니다."),
        line("human/worker/produce/3", "생산이 끝났습니다."),
      ],
    },
  },
  {
    typeId: "human_rifleman",
    race: "human",
    pitch: 0.94,
    rate: 1.2,
    lines: {
      select: [
        line("human/rifleman/select/1", "해병, 대기."),
        line("human/rifleman/select/2", "사격 준비 완료."),
        line("human/rifleman/select/3", "전열에 섭니다."),
      ],
      move: [
        line("human/rifleman/move/1", "이동합니다."),
        line("human/rifleman/move/2", "그쪽으로 전진합니다."),
        line("human/rifleman/move/3", "위치 이동합니다."),
      ],
      attack: [
        line("human/rifleman/attack/1", "사격 개시."),
        line("human/rifleman/attack/2", "목표 확인. 발사."),
        line("human/rifleman/attack/3", "적에게 집중합니다."),
      ],
      annoyed: [
        line("human/rifleman/annoyed/1", "대기 중입니다."),
        line("human/rifleman/annoyed/2", "방아쇠 위에 손이 있습니다."),
        line("human/rifleman/annoyed/3", "같은 호출입니다."),
      ],
      produce: [
        line("human/rifleman/produce/1", "해병, 전열 합류."),
        line("human/rifleman/produce/2", "전투 준비됐습니다."),
        line("human/rifleman/produce/3", "배치 완료."),
      ],
    },
  },
  {
    typeId: "human_firebat",
    race: "human",
    pitch: 0.78,
    rate: 1.08,
    lines: {
      select: [
        line("human/firebat/select/1", "화염방사병, 준비."),
        line("human/firebat/select/2", "연료 충전 완료."),
        line("human/firebat/select/3", "가까이 붙을 수 있습니다."),
      ],
      move: [
        line("human/firebat/move/1", "접근합니다."),
        line("human/firebat/move/2", "그 지점까지 갑니다."),
        line("human/firebat/move/3", "이동합니다."),
      ],
      attack: [
        line("human/firebat/attack/1", "불태웁니다."),
        line("human/firebat/attack/2", "화염 방사."),
        line("human/firebat/attack/3", "거리를 좁힙니다."),
      ],
      annoyed: [
        line("human/firebat/annoyed/1", "연료가 식기 전에 명령을."),
        line("human/firebat/annoyed/2", "이미 밸브는 열려 있습니다."),
        line("human/firebat/annoyed/3", "버튼을 그만 눌러 주십시오."),
      ],
      produce: [
        line("human/firebat/produce/1", "화염방사병, 출격 준비."),
        line("human/firebat/produce/2", "연료 확인. 대기합니다."),
        line("human/firebat/produce/3", "전열에 합류합니다."),
      ],
    },
  },
  {
    typeId: "human_medic",
    race: "human",
    pitch: 1.32,
    rate: 1.12,
    lines: {
      select: [
        line("human/medic/select/1", "의무관입니다."),
        line("human/medic/select/2", "치료 준비됐습니다."),
        line("human/medic/select/3", "부상자를 기다립니다."),
      ],
      move: [
        line("human/medic/move/1", "따라갑니다."),
        line("human/medic/move/2", "그 위치로 이동합니다."),
        line("human/medic/move/3", "현장으로 갑니다."),
      ],
      annoyed: [
        line("human/medic/annoyed/1", "환자 상태는 확인했습니다."),
        line("human/medic/annoyed/2", "같은 호출이 반복됩니다."),
        line("human/medic/annoyed/3", "키트는 이미 열렸습니다."),
      ],
      produce: [
        line("human/medic/produce/1", "의무관, 배치됐습니다."),
        line("human/medic/produce/2", "치료 가능합니다."),
        line("human/medic/produce/3", "현장 투입 준비."),
      ],
    },
  },
  {
    typeId: "monster_worker",
    race: "monster",
    pitch: 0.62,
    rate: 1.14,
    lines: {
      select: [
        line("monster/worker/select/1", "일한다."),
        line("monster/worker/select/2", "땅을 판다."),
        line("monster/worker/select/3", "점액을 묻힌다."),
      ],
      move: [
        line("monster/worker/move/1", "기어간다."),
        line("monster/worker/move/2", "그쪽으로 간다."),
        line("monster/worker/move/3", "땅을 따라간다."),
      ],
      attack: [
        line("monster/worker/attack/1", "물어뜯는다."),
        line("monster/worker/attack/2", "붙잡는다."),
        line("monster/worker/attack/3", "방해를 치운다."),
      ],
      annoyed: [
        line("monster/worker/annoyed/1", "바쁘다."),
        line("monster/worker/annoyed/2", "이미 파고 있다."),
        line("monster/worker/annoyed/3", "또 찍지 마라."),
      ],
      produce: [
        line("monster/worker/produce/1", "일꾼이 태어났다."),
        line("monster/worker/produce/2", "땅을 팔 준비가 됐다."),
        line("monster/worker/produce/3", "부화했다."),
      ],
    },
  },
  {
    typeId: "monster_blade",
    race: "monster",
    pitch: 0.84,
    rate: 1.34,
    lines: {
      select: [
        line("monster/blade/select/1", "굶었다."),
        line("monster/blade/select/2", "사냥감이 필요하다."),
        line("monster/blade/select/3", "이빨을 세운다."),
      ],
      move: [
        line("monster/blade/move/1", "달려간다."),
        line("monster/blade/move/2", "빠르게 간다."),
        line("monster/blade/move/3", "그 냄새를 따라간다."),
      ],
      attack: [
        line("monster/blade/attack/1", "찢는다."),
        line("monster/blade/attack/2", "덮친다."),
        line("monster/blade/attack/3", "사냥을 시작한다."),
      ],
      annoyed: [
        line("monster/blade/annoyed/1", "빨리 풀어 줘."),
        line("monster/blade/annoyed/2", "이미 뛰고 싶다."),
        line("monster/blade/annoyed/3", "기다리기 싫다."),
      ],
      produce: [
        line("monster/blade/produce/1", "사냥이 깨어났다."),
        line("monster/blade/produce/2", "이빨이 나왔다."),
        line("monster/blade/produce/3", "굶주림이 태어났다."),
      ],
    },
  },
  {
    typeId: "monster_hydra",
    race: "monster",
    pitch: 0.48,
    rate: 1.02,
    lines: {
      select: [
        line("monster/hydra/select/1", "가시가 찼다."),
        line("monster/hydra/select/2", "독을 준비한다."),
        line("monster/hydra/select/3", "히드라, 대기."),
      ],
      move: [
        line("monster/hydra/move/1", "기어간다."),
        line("monster/hydra/move/2", "진지로 이동한다."),
        line("monster/hydra/move/3", "몸을 끌며 간다."),
      ],
      attack: [
        line("monster/hydra/attack/1", "가시를 쏜다."),
        line("monster/hydra/attack/2", "관통시킨다."),
        line("monster/hydra/attack/3", "독을 묻힌다."),
      ],
      annoyed: [
        line("monster/hydra/annoyed/1", "가시가 근질거린다."),
        line("monster/hydra/annoyed/2", "이미 조준했다."),
        line("monster/hydra/annoyed/3", "쏘기 전에 그만."),
      ],
      produce: [
        line("monster/hydra/produce/1", "가시가 부화했다."),
        line("monster/hydra/produce/2", "독이 깨어났다."),
        line("monster/hydra/produce/3", "히드라가 나왔다."),
      ],
    },
  },
  {
    typeId: "monster_sac",
    race: "monster",
    pitch: 0.36,
    rate: 0.9,
    lines: {
      select: [
        line("monster/sac/select/1", "하늘을 연다."),
        line("monster/sac/select/2", "떠 있다."),
        line("monster/sac/select/3", "아래를 본다."),
      ],
      move: [
        line("monster/sac/move/1", "떠서 이동한다."),
        line("monster/sac/move/2", "그 상공으로 간다."),
        line("monster/sac/move/3", "천천히 흘러간다."),
      ],
      annoyed: [
        line("monster/sac/annoyed/1", "이미 떠 있다."),
        line("monster/sac/annoyed/2", "바람이 귀찮다."),
        line("monster/sac/annoyed/3", "또 부르지 마라."),
      ],
      produce: [
        line("monster/sac/produce/1", "하늘이 열렸다."),
        line("monster/sac/produce/2", "부유낭이 떠올랐다."),
        line("monster/sac/produce/3", "위에서 태어났다."),
      ],
    },
  },
  {
    typeId: "alien_worker",
    race: "alien",
    pitch: 1.38,
    rate: 1.16,
    lines: {
      select: [
        line("alien/worker/select/1", "탐사 준비 완료."),
        line("alien/worker/select/2", "경로를 계산했다."),
        line("alien/worker/select/3", "대기 좌표에 있다."),
      ],
      move: [
        line("alien/worker/move/1", "이동한다."),
        line("alien/worker/move/2", "좌표를 확인했다."),
        line("alien/worker/move/3", "그 지점으로 간다."),
      ],
      attack: [
        line("alien/worker/attack/1", "최소 출력으로 대응한다."),
        line("alien/worker/attack/2", "방해물을 제거한다."),
        line("alien/worker/attack/3", "짧은 교전을 시작한다."),
      ],
      annoyed: [
        line("alien/worker/annoyed/1", "같은 좌표다."),
        line("alien/worker/annoyed/2", "계산은 이미 끝났다."),
        line("alien/worker/annoyed/3", "입력이 반복된다."),
      ],
      produce: [
        line("alien/worker/produce/1", "탐사정, 소환 완료."),
        line("alien/worker/produce/2", "배치 좌표에 도착했다."),
        line("alien/worker/produce/3", "작업 준비가 끝났다."),
      ],
    },
  },
  {
    typeId: "alien_guardian",
    race: "alien",
    pitch: 0.96,
    rate: 1.02,
    lines: {
      select: [
        line("alien/guardian/select/1", "검이 준비됐다."),
        line("alien/guardian/select/2", "전사가 대기한다."),
        line("alien/guardian/select/3", "명예를 지킨다."),
      ],
      move: [
        line("alien/guardian/move/1", "진군한다."),
        line("alien/guardian/move/2", "그 땅으로 걷는다."),
        line("alien/guardian/move/3", "발걸음을 옮긴다."),
      ],
      attack: [
        line("alien/guardian/attack/1", "벤다."),
        line("alien/guardian/attack/2", "전장으로 들어간다."),
        line("alien/guardian/attack/3", "적을 맞이한다."),
      ],
      annoyed: [
        line("alien/guardian/annoyed/1", "인내는 충분하다."),
        line("alien/guardian/annoyed/2", "검자루를 이미 잡았다."),
        line("alien/guardian/annoyed/3", "같은 말을 반복하지 마라."),
      ],
      produce: [
        line("alien/guardian/produce/1", "전사가 소환됐다."),
        line("alien/guardian/produce/2", "검이 전열에 섰다."),
        line("alien/guardian/produce/3", "강림이 끝났다."),
      ],
    },
  },
  {
    typeId: "alien_dragoon",
    race: "alien",
    pitch: 0.72,
    rate: 1.04,
    lines: {
      select: [
        line("alien/dragoon/select/1", "용기병, 기동 대기."),
        line("alien/dragoon/select/2", "포신을 정렬했다."),
        line("alien/dragoon/select/3", "파일럿이 연결됐다."),
      ],
      move: [
        line("alien/dragoon/move/1", "추진한다."),
        line("alien/dragoon/move/2", "그 좌표로 기동한다."),
        line("alien/dragoon/move/3", "다리를 움직인다."),
      ],
      attack: [
        line("alien/dragoon/attack/1", "위상포를 쏜다."),
        line("alien/dragoon/attack/2", "목표를 고정했다."),
        line("alien/dragoon/attack/3", "사격한다."),
      ],
      annoyed: [
        line("alien/dragoon/annoyed/1", "조준이 흔들린다."),
        line("alien/dragoon/annoyed/2", "명령이 겹친다."),
        line("alien/dragoon/annoyed/3", "파일럿은 듣고 있다."),
      ],
      produce: [
        line("alien/dragoon/produce/1", "용기병, 소환 완료."),
        line("alien/dragoon/produce/2", "기체가 전개됐다."),
        line("alien/dragoon/produce/3", "파일럿이 탑승했다."),
      ],
    },
  },
];

const unitVoiceByType = new Map<string, UnitVoice>(
  UNIT_VOICES.map((v) => [v.typeId, v]),
);

export function unitVoice(typeId: string): UnitVoice | null {
  return unitVoiceByType.get(typeId) ?? null;
}

export function unitVoiceLines(
  typeId: string,
  cue: UnitVoiceCue,
): readonly VoiceLine[] {
  const voice = unitVoice(typeId);
  if (!voice) return [];
  return voice.lines[cue] ?? [];
}

export function advisorVoiceLines(
  race: RaceId,
  cue: AdvisorCue,
): readonly VoiceLine[] {
  return RACE_VOICES[race].advisor[cue];
}
