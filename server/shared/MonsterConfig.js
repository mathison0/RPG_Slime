/**
 * 몬스터 관련 모든 설정을 중앙에서 관리
 */

// 몬스터 종류 정의
const MONSTER_TYPES = {
  BASIC: 'basic',
  CHARGE: 'charge', 
  ELITE: 'elite'
};

// 맵 레벨 정의  
const MAP_LEVELS = {
  LEVEL_1_RED: 1, // 빨강팀 스폰 배리어 구역
  LEVEL_1_BLUE: 2, // 파랑팀 스폰 배리어 구역
  LEVEL_2: 3, // 스폰 배리어 구역 밖 ~ 레벨 3,4 맵 제외한 모든 곳
  LEVEL_3: 4, // 광장 외부 타일 (GameConfig.PLAZA_LEVEL3_EXTRA_TILES로 설정)
  LEVEL_4: 5  // 광장 내부
};

// 기본 몬스터 스탯 (배율 적용 전)
const BASE_MONSTER_STATS = {
  [MONSTER_TYPES.BASIC]: {
    hp: 150,
    attack: 50,
    speed: 110,
    size: 32,
    exp: 10,
    aggroRange: 200,      // 기본 인식 범위
    maxAggroRange: 400,   // 최대 인식 범위
    wanderSpeed: 50       // 배회 속도
  },
  [MONSTER_TYPES.CHARGE]: {
    hp: 70,
    attack: 100,
    speed: 160,
    size: 36,
    exp: 15,
    aggroRange: 350,      // 더 넓은 인식 범위 (공격적)
    maxAggroRange: 550,   // 더 넓은 최대 인식 범위
    wanderSpeed: 80       // 빠른 배회 속도
  },
  [MONSTER_TYPES.ELITE]: {
    hp: 800,
    attack: 150,
    speed: 120,
    size: 44,
    exp: 100,
    aggroRange: 100,      // 가장 넓은 인식 범위 (경계심 높음)
    maxAggroRange: 600,   // 가장 넓은 최대 인식 범위
    wanderSpeed: 60       // 적당한 배회 속도
  }
};

// 레벨별 몬스터 스폰 비율
const SPAWN_RATIOS = {
  [MAP_LEVELS.LEVEL_1_RED]: {
    [MONSTER_TYPES.BASIC]: 100,
    [MONSTER_TYPES.CHARGE]: 0,
    [MONSTER_TYPES.ELITE]: 0
  },
  [MAP_LEVELS.LEVEL_1_BLUE]: {
    [MONSTER_TYPES.BASIC]: 100,
    [MONSTER_TYPES.CHARGE]: 0,
    [MONSTER_TYPES.ELITE]: 0
  },
  [MAP_LEVELS.LEVEL_2]: {
    [MONSTER_TYPES.BASIC]: 70,
    [MONSTER_TYPES.CHARGE]: 30,
    [MONSTER_TYPES.ELITE]: 0
  },
  [MAP_LEVELS.LEVEL_3]: {
    [MONSTER_TYPES.BASIC]: 57,
    [MONSTER_TYPES.CHARGE]: 40,
    [MONSTER_TYPES.ELITE]: 3
  },
  [MAP_LEVELS.LEVEL_4]: {
    [MONSTER_TYPES.BASIC]: 30,
    [MONSTER_TYPES.CHARGE]: 60,
    [MONSTER_TYPES.ELITE]: 10
  }
};

// 레벨별 스탯 배율
const STAT_MULTIPLIERS = {
  [MAP_LEVELS.LEVEL_1_RED]: 0.5,
  [MAP_LEVELS.LEVEL_1_BLUE]: 0.5,
  [MAP_LEVELS.LEVEL_2]: 1.0,
  [MAP_LEVELS.LEVEL_3]: 2.0,
  [MAP_LEVELS.LEVEL_4]: 3.0
};

// 레벨별 경험치 배율
const EXP_MULTIPLIERS = {
  [MAP_LEVELS.LEVEL_1_RED]: 1.0,
  [MAP_LEVELS.LEVEL_1_BLUE]: 1.0,
  [MAP_LEVELS.LEVEL_2]: 2.5,
  [MAP_LEVELS.LEVEL_3]: 4.0,
  [MAP_LEVELS.LEVEL_4]: 10.0
};

// 레벨별 크기 배율
const SIZE_MULTIPLIERS = {
  [MAP_LEVELS.LEVEL_1_RED]: 0.7,
  [MAP_LEVELS.LEVEL_1_BLUE]: 0.7,
  [MAP_LEVELS.LEVEL_2]: 1.0,
  [MAP_LEVELS.LEVEL_3]: 1.5,
  [MAP_LEVELS.LEVEL_4]: 2.0
};

// 레벨별 최대 몬스터 수
const MAX_MONSTERS_PER_LEVEL = {
  [MAP_LEVELS.LEVEL_1_RED]: 30, // 빨강팀 구역
  [MAP_LEVELS.LEVEL_1_BLUE]: 30, // 파랑팀 구역
  [MAP_LEVELS.LEVEL_2]: 300,
  [MAP_LEVELS.LEVEL_3]: 60,
  [MAP_LEVELS.LEVEL_4]: 50
};

// 공통 설정
const COMMON_CONFIG = {
  ATTACK_RANGE: 10,
  ATTACK_COOLDOWN: 1500,
  SPAWN_AVOID_PLAYER_RANGE: 3, // 플레이어 주변 피할 타일 수
  SPAWN_AVOID_MONSTER_RANGE: 2 // 몬스터 밀집 피할 타일 수
};

/**
 * 맵 좌표에서 레벨 계산
 */
function getMapLevelFromPosition(x, y, gameConfig) {
  const {
    MAP_WIDTH_TILES, MAP_HEIGHT_TILES, TILE_SIZE,
    SPAWN_WIDTH_TILES, SPAWN_BARRIER_EXTRA_TILES,
    PLAZA_SIZE_TILES, PLAZA_LEVEL3_EXTRA_TILES
  } = gameConfig;
  
  // 픽셀 좌표를 타일 좌표로 변환
  const tileX = Math.floor(x / TILE_SIZE);
  const tileY = Math.floor(y / TILE_SIZE);
  
  // 스폰 구역 (좌우 끝)
  const leftSpawnEnd = SPAWN_WIDTH_TILES;
  const rightSpawnStart = MAP_WIDTH_TILES - SPAWN_WIDTH_TILES;
  
  // 스폰 배리어 구역
  const leftBarrierEnd = SPAWN_WIDTH_TILES + SPAWN_BARRIER_EXTRA_TILES;
  const rightBarrierStart = MAP_WIDTH_TILES - SPAWN_WIDTH_TILES - SPAWN_BARRIER_EXTRA_TILES;
  
  // 광장 위치
  const plazaCenterX = MAP_WIDTH_TILES / 2;
  const plazaCenterY = MAP_HEIGHT_TILES / 2;
  const plazaHalfSize = PLAZA_SIZE_TILES / 2;
  
  // 광장 내부 (레벨 4)
  if (tileX >= plazaCenterX - plazaHalfSize && tileX < plazaCenterX + plazaHalfSize &&
      tileY >= plazaCenterY - plazaHalfSize && tileY < plazaCenterY + plazaHalfSize) {
    return MAP_LEVELS.LEVEL_4;
  }
  
  // 광장 외부 타일 (레벨 3)
  if (tileX >= plazaCenterX - plazaHalfSize - PLAZA_LEVEL3_EXTRA_TILES && tileX < plazaCenterX + plazaHalfSize + PLAZA_LEVEL3_EXTRA_TILES &&
      tileY >= plazaCenterY - plazaHalfSize - PLAZA_LEVEL3_EXTRA_TILES && tileY < plazaCenterY + plazaHalfSize + PLAZA_LEVEL3_EXTRA_TILES) {
    return MAP_LEVELS.LEVEL_3;
  }
  
  // 스폰 구역 내부 (스폰 불가)
  if (tileX < leftSpawnEnd || tileX >= rightSpawnStart) {
    return null;
  }
  
  // 스폰 배리어 구역 - 빨강팀과 파랑팀 구분
  if (tileX < leftBarrierEnd) {
    return MAP_LEVELS.LEVEL_1_RED; // 왼쪽 = 빨강팀
  }
  if (tileX >= rightBarrierStart) {
    return MAP_LEVELS.LEVEL_1_BLUE; // 오른쪽 = 파랑팀
  }
  
  // 나머지 구역 (레벨 2)
  return MAP_LEVELS.LEVEL_2;
}

/**
 * 확률에 따른 몬스터 타입 선택
 */
function selectMonsterType(level) {
  const ratios = SPAWN_RATIOS[level];
  const random = Math.random() * 100;
  
  let cumulative = 0;
  for (const [type, ratio] of Object.entries(ratios)) {
    cumulative += ratio;
    if (random <= cumulative) {
      return type;
    }
  }
  
  return MONSTER_TYPES.BASIC; // 기본값
}

/**
 * 레벨과 타입에 따른 몬스터 스탯 계산
 */
function calculateMonsterStats(type, level) {
  const baseStats = BASE_MONSTER_STATS[type];
  const multiplier = STAT_MULTIPLIERS[level];
  const expMultiplier = EXP_MULTIPLIERS[level];
  const sizeMultiplier = SIZE_MULTIPLIERS[level];
  
  return {
    hp: Math.floor(baseStats.hp * multiplier),
    maxHp: Math.floor(baseStats.hp * multiplier),
    attack: Math.floor(baseStats.attack * multiplier),
    speed: baseStats.speed, // 속도는 배율 적용 안함
    size: Math.floor(baseStats.size * sizeMultiplier), // 레벨에 따른 크기 조정
    exp: Math.floor(baseStats.exp * expMultiplier)
  };
}

module.exports = {
  MONSTER_TYPES,
  MAP_LEVELS,
  BASE_MONSTER_STATS,
  SPAWN_RATIOS,
  STAT_MULTIPLIERS,
  EXP_MULTIPLIERS,
  SIZE_MULTIPLIERS,
  MAX_MONSTERS_PER_LEVEL,
  COMMON_CONFIG,
  getMapLevelFromPosition,
  selectMonsterType,
  calculateMonsterStats
}; 