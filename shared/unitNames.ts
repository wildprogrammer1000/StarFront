/**
 * 스타 1 명칭과 이 게임 표시 이름의 대조.
 * 구현·대사·UI를 고칠 때 이 파일을 본다. typeId 는 바꾸지 않는다.
 *
 * sc1 열은 원작을 찾을 때만 쓴다. 화면 문구로 복사하지 않는다.
 * current 는 지금 rosterData.name 과 같아야 한다.
 * recommended 는 아직 적용하지 않은 표시 이름이다.
 */
export interface UnitNameRow {
  typeId: string;
  kind: "unit" | "building";
  race: "human" | "monster" | "alien";
  /** 스타 1 한글 명칭. 영문은 코드 검색용. */
  sc1: string;
  /** 현재 화면 이름 */
  current: string;
  /** 바꿀 화면 이름. 미적용. */
  recommended: string;
}

export const UNIT_NAME_ROWS: UnitNameRow[] = [
  { typeId: "human_worker", kind: "unit", race: "human", sc1: "SCV(건설로봇)", current: "공병기", recommended: "공병기" },
  { typeId: "human_rifleman", kind: "unit", race: "human", sc1: "해병(Marine)", current: "소총병", recommended: "소총병" },
  { typeId: "human_firebat", kind: "unit", race: "human", sc1: "화염방사병(Firebat)", current: "화염병", recommended: "화염병" },
  { typeId: "human_medic", kind: "unit", race: "human", sc1: "의무관(Medic)", current: "구급병", recommended: "구급병" },
  { typeId: "human_hq", kind: "building", race: "human", sc1: "사령부(Command Center)", current: "지휘소", recommended: "지휘소" },
  { typeId: "human_depot", kind: "building", race: "human", sc1: "보급고(Supply Depot)", current: "보급창고", recommended: "보급창고" },
  { typeId: "human_barracks", kind: "building", race: "human", sc1: "병영(Barracks)", current: "훈련소", recommended: "훈련소" },
  { typeId: "human_refinery", kind: "building", race: "human", sc1: "정제소(Refinery)", current: "정제탑", recommended: "정제탑" },
  { typeId: "human_academy", kind: "building", race: "human", sc1: "사관학교(Academy)", current: "전술관", recommended: "전술관" },

  { typeId: "monster_worker", kind: "unit", race: "monster", sc1: "드론(일벌레)", current: "집게충", recommended: "집게충" },
  { typeId: "monster_sac", kind: "unit", race: "monster", sc1: "오버로드(대군주)", current: "관측체", recommended: "관측체" },
  { typeId: "monster_blade", kind: "unit", race: "monster", sc1: "저글링(Zergling)", current: "칼날충", recommended: "칼날충" },
  { typeId: "monster_hydra", kind: "unit", race: "monster", sc1: "히드라리스크(Hydralisk)", current: "독침충", recommended: "독침충" },
  { typeId: "monster_larva", kind: "unit", race: "monster", sc1: "라바(Larva)", current: "유충", recommended: "유충" },
  { typeId: "monster_egg", kind: "unit", race: "monster", sc1: "에그(Egg)", current: "알", recommended: "알" },
  { typeId: "monster_hatch", kind: "building", race: "monster", sc1: "해처리(Hatchery)", current: "산란소", recommended: "산란소" },
  { typeId: "monster_hatchery", kind: "building", race: "monster", sc1: "스포닝 풀(Spawning Pool)", current: "배양못", recommended: "배양못" },
  { typeId: "monster_extractor", kind: "building", race: "monster", sc1: "익스트랙터(Extractor)", current: "흡수관", recommended: "흡수관" },
  { typeId: "monster_hydra_den", kind: "building", race: "monster", sc1: "히드라리스크 덴(Hydralisk Den)", current: "독침굴", recommended: "독침굴" },

  { typeId: "alien_worker", kind: "unit", race: "alien", sc1: "프로브(탐사정)", current: "탐사기", recommended: "탐사기" },
  { typeId: "alien_guardian", kind: "unit", race: "alien", sc1: "질럿(광전사)", current: "돌격전사", recommended: "돌격전사" },
  { typeId: "alien_dragoon", kind: "unit", race: "alien", sc1: "드라군(용기병)", current: "기동포", recommended: "기동포" },
  { typeId: "alien_hq", kind: "building", race: "alien", sc1: "넥서스(연결체)", current: "결속소", recommended: "결속소" },
  { typeId: "alien_pylon", kind: "building", race: "alien", sc1: "파일런(수정탑)", current: "동력탑", recommended: "동력탑" },
  { typeId: "alien_gate", kind: "building", race: "alien", sc1: "게이트웨이(관문)", current: "소환문", recommended: "소환문" },
  { typeId: "alien_assimilator", kind: "building", race: "alien", sc1: "어시밀레이터(융합소)", current: "융합탑", recommended: "융합탑" },
  { typeId: "alien_cyber", kind: "building", race: "alien", sc1: "사이버네틱스 코어(Cybernetics Core)", current: "융합기", recommended: "융합기" },
];
