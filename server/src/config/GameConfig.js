/**
 * 게임 전역 설정
 * 모든 게임 관련 상수값들을 중앙에서 관리
 */
const { MAX_MONSTERS_PER_LEVEL } = require('../../shared/MonsterConfig');

const gameConfig = {
  // 타일 기반 맵 크기 (타일 개수)
  MAP_WIDTH_TILES: 90,
  MAP_HEIGHT_TILES: 90,
  TILE_SIZE: 100,
  SPAWN_WIDTH_TILES: 6,
  SPAWN_BARRIER_EXTRA_TILES: 4, // 스폰 구역보다 추가로 확장할 타일 수
  PLAZA_SIZE_TILES: 30,
  PLAZA_LEVEL3_EXTRA_TILES: 6, // 광장 주변 레벨 3 구역 확장 타일 수
  
  // 계산된 픽셀 크기 (하위 호환성을 위해 유지)
  get MAP_WIDTH() { 
    return this.MAP_WIDTH_TILES * this.TILE_SIZE;
  },
  get MAP_HEIGHT() { 
    return this.MAP_HEIGHT_TILES * this.TILE_SIZE;
  },
  get SPAWN_WIDTH() { 
    return this.SPAWN_WIDTH_TILES * this.TILE_SIZE;
  },
  get PLAZA_SIZE() { 
    return this.PLAZA_SIZE_TILES * this.TILE_SIZE;
  },
  get PLAZA_X() { 
    return (this.MAP_WIDTH - this.PLAZA_SIZE) / 2;
  },
  get PLAZA_Y() { 
    return (this.MAP_HEIGHT - this.PLAZA_SIZE) / 2;
  },
  WALL_REMOVAL_RATIO: 0.5,
  
  // 체력 재생 시스템
  HEALTH_REGENERATION: {
    DELAY_AFTER_DAMAGE: 10000, // 10초 (데미지 받은 후 재생까지의 지연시간)
    REGENERATION_RATE: 0.02,   // 2% (1초당 최대 체력 대비 재생 비율)
    TICK_INTERVAL: 1000        // 1초 (재생 틱 간격)
  },
  
  // 플레이어 관련 설정
  PLAYER: {
    DEFAULT_HP: 100,
    DEFAULT_ATTACK: 20,
    DEFAULT_SPEED: 200,
    VISION_RANGE: 300,
    DEFAULT_SIZE: 32, // AssetConfig의 MIN_SIZE와 맞춤 (레벨 1 기본 크기)
    DISCONNECT_TIMEOUT: 300000, // 5분
    // 플레이어 크기 관련 설정
    SIZE: {
      BASE_SIZE: 32,      // 레벨 1 기본 크기 (MIN_SIZE)
      GROWTH_RATE: 2,     // 레벨당 증가 픽셀
      MAX_SIZE: 64,       // 최대 크기
      MIN_SIZE: 32        // 최소 크기
    },
    // 경험치 관련 설정
    EXP: {
      1: 25, 2: 30, 3: 35, 4: 40, 5: 100, 6: 150, 7: 200, 8: 300, 9: 350, 10: 1000,
      11: 1200, 12: 1400, 13: 1600, 14: 1800, 15: 2000, 16: 2200, 17: 2400, 18: 2600, 19: 2800, 20: 100000000,
    },
    // 기본 스킬 설정
    SKILLS: {
      JUMP_DURATION: 400,     // 점프 지속시간 (ms)
      BASE_RANGE_REFERENCE: 64  // 슬라임 스킬 범위 계산 기준 크기
    }
  },

  // 적(몬스터) 관련 설정
  ENEMY: {
    get MAX_COUNT() {
      // 모든 레벨의 최대 몬스터 수를 합계
      return Object.values(MAX_MONSTERS_PER_LEVEL).reduce((sum, count) => sum + count, 0);
    },
  },
  
  // 스폰 배리어 관련 설정
  SPAWN_BARRIER: {
    DAMAGE_INTERVAL: 1000, // 1초마다 데미지
    DAMAGE_PERCENT: 0.1, // 최대 체력의 10%
    WARNING_ENABLED: true
  },
  
  // 서버 관련 설정
  SERVER: {
    GAME_LOOP_INTERVAL: 50,
    DEFAULT_PORT: 80
  }
};

module.exports = gameConfig;