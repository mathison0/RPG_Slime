/**
 * 게임 전역 설정
 * 모든 게임 관련 상수값들을 중앙에서 관리
 */
const gameConfig = {
  MAP_WIDTH: 6000,
  MAP_HEIGHT: 6000,
  TILE_SIZE: 50,
  SPAWN_WIDTH: 300,
  PLAZA_SIZE: 1500,
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
    DEFAULT_SIZE: 64,
    DISCONNECT_TIMEOUT: 300000 // 5분
  },
  
  // 서버 관련 설정
  SERVER: {
    GAME_LOOP_INTERVAL: 50, // 50ms
    DEFAULT_PORT: 3000
  }
};

module.exports = gameConfig; 