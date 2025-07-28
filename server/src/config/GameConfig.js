/**
 * 게임 전역 설정
 * 모든 게임 관련 상수값들을 중앙에서 관리
 */
const gameConfig = {
  // 타일 기반 맵 크기 (타일 개수)
  MAP_WIDTH_TILES: 120,
  MAP_HEIGHT_TILES: 120,
  TILE_SIZE: 100,
  SPAWN_WIDTH_TILES: 6,
  SPAWN_BARRIER_EXTRA_TILES: 4, // 스폰 구역보다 추가로 확장할 타일 수
  PLAZA_SIZE_TILES: 30,
  
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
  
  // 적 관련 설정
  ENEMY: {
    MAX_COUNT: 10,
    SPAWN_INTERVAL: 10000, // 10초
    TYPES: ['basic', 'fast', 'tank', 'ranged'],
    AGGRO_RANGE: 200,
    ATTACK_RANGE: 60,
    ATTACK_COOLDOWN: 1500
  },
  
  // 플레이어 관련 설정
  PLAYER: {
    DEFAULT_HP: 100,
    DEFAULT_ATTACK: 20,
    DEFAULT_DEFENSE: 10,
    DEFAULT_SPEED: 200,
    VISION_RANGE: 300,
    DEFAULT_SIZE: 38, // AssetConfig의 MIN_SIZE와 맞춤 (레벨 1 기본 크기)
    DISCONNECT_TIMEOUT: 300000 // 5분
  },
  
  // 스폰 배리어 관련 설정
  SPAWN_BARRIER: {
    DAMAGE_INTERVAL: 1000, // 1초마다 데미지
    DAMAGE_PERCENT: 0.1, // 최대 체력의 10%
    WARNING_ENABLED: true
  },
  
  // 서버 관련 설정
  SERVER: {
    GAME_LOOP_INTERVAL: 50, // 50ms
    DEFAULT_PORT: 3000
  }
};

module.exports = gameConfig; 