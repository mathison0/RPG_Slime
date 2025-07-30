const { v4: uuidv4 } = require('uuid');
const gameConfig = require('../config/GameConfig');
const MonsterConfig = require('../../shared/MonsterConfig');
const ServerUtils = require('../utils/ServerUtils');

class EnemyManager {
  constructor(io, gameStateManager, socketEventManager = null) {
    this.io = io;
    this.gameStateManager = gameStateManager;
    this.socketEventManager = socketEventManager;
    this.levelMonsterCounts = {}; // 레벨별 몬스터 개수 추적
    
    // 레벨별 몬스터 개수 초기화
    Object.values(MonsterConfig.MAP_LEVELS).forEach(level => {
      this.levelMonsterCounts[level] = 0;
    });
  }

  /**
   * 몬스터 매니저 초기화
   */
  initialize() {
    console.log('몬스터 매니저 초기화 시작');
    this.spawnInitialMonsters();
    console.log('몬스터 매니저 초기화 완료');
  }

  /**
   * 초기 몬스터들 스폰 (레벨별로)
   */
  spawnInitialMonsters() {
    Object.values(MonsterConfig.MAP_LEVELS).forEach(level => {
      const maxCount = MonsterConfig.MAX_MONSTERS_PER_LEVEL[level];
      for (let i = 0; i < maxCount; i++) {
        this.spawnMonsterInLevel(level);
      }
    });
    
    const totalSpawned = Object.values(this.levelMonsterCounts).reduce((a, b) => a + b, 0);
    console.log(`초기 몬스터 스폰 완료: 총 ${totalSpawned}마리`);
  }

  /**
   * 특정 레벨에 몬스터 스폰
   */
  spawnMonsterInLevel(level) {
    // 최대 개체수 체크
    if (this.levelMonsterCounts[level] >= MonsterConfig.MAX_MONSTERS_PER_LEVEL[level]) {
      return null;
    }

    const monsterId = uuidv4();
    const type = MonsterConfig.selectMonsterType(level);
    
    // 몬스터 타입에 따른 실제 크기 계산
    const stats = MonsterConfig.calculateMonsterStats(type, level);
    const monsterSize = stats.size;
    
    const spawnPoint = this.getMonsterSpawnPoint(level, monsterSize);
    
    if (!spawnPoint) {
      console.log(`레벨 ${level} 몬스터 스폰 지점을 찾을 수 없음`);
      return null;
    }

    const monster = this.gameStateManager.addEnemy(monsterId, spawnPoint.x, spawnPoint.y, type, level);
    this.levelMonsterCounts[level]++;
    
    // 클라이언트에게 몬스터 스폰 알림
    this.io.emit('monster-spawned', monster.getState());
    return monster;
  }

  /**
   * 레벨별 몬스터 스폰 지점 계산
   */
  getMonsterSpawnPoint(level, monsterSize = 32) {
    let attempts = 0;
    const maxAttempts = 30;
    
    // 안전 여유 공간 (몬스터 크기의 절반)
    const safetyMargin = Math.ceil(monsterSize / 2);
    
    while (attempts < maxAttempts) {
      let x, y;
      
      // 레벨별 스폰 구역 설정
      switch (level) {
        case MonsterConfig.MAP_LEVELS.LEVEL_1_RED:
          // 빨강팀 스폰 배리어 구역 (왼쪽) - 몬스터 크기 고려
          x = this.getRandomInRange(
            gameConfig.SPAWN_WIDTH_TILES * gameConfig.TILE_SIZE + safetyMargin,
            (gameConfig.SPAWN_WIDTH_TILES + gameConfig.SPAWN_BARRIER_EXTRA_TILES) * gameConfig.TILE_SIZE - safetyMargin
          );
          y = this.getRandomInRange(safetyMargin, gameConfig.MAP_HEIGHT_TILES * gameConfig.TILE_SIZE - safetyMargin);
          break;
          
        case MonsterConfig.MAP_LEVELS.LEVEL_1_BLUE:
          // 파랑팀 스폰 배리어 구역 (오른쪽) - 몬스터 크기 고려
          x = this.getRandomInRange(
            (gameConfig.MAP_WIDTH_TILES - gameConfig.SPAWN_WIDTH_TILES - gameConfig.SPAWN_BARRIER_EXTRA_TILES) * gameConfig.TILE_SIZE + safetyMargin,
            (gameConfig.MAP_WIDTH_TILES - gameConfig.SPAWN_WIDTH_TILES) * gameConfig.TILE_SIZE - safetyMargin
          );
          y = this.getRandomInRange(safetyMargin, gameConfig.MAP_HEIGHT_TILES * gameConfig.TILE_SIZE - safetyMargin);
          break;
          
        case MonsterConfig.MAP_LEVELS.LEVEL_2:
          // 레벨 2 구역 (광장 외부 타일 제외) - 몬스터 크기 고려
          x = this.getRandomInRange(
            (gameConfig.SPAWN_WIDTH_TILES + gameConfig.SPAWN_BARRIER_EXTRA_TILES) * gameConfig.TILE_SIZE + safetyMargin,
            (gameConfig.MAP_WIDTH_TILES - gameConfig.SPAWN_WIDTH_TILES - gameConfig.SPAWN_BARRIER_EXTRA_TILES) * gameConfig.TILE_SIZE - safetyMargin
          );
          y = this.getRandomInRange(safetyMargin, gameConfig.MAP_HEIGHT_TILES * gameConfig.TILE_SIZE - safetyMargin);
          
          // 레벨 3 구역(광장 외부 타일) 완전히 피하기 - 몬스터 크기 고려
          const plazaCenterX = (gameConfig.MAP_WIDTH_TILES / 2) * gameConfig.TILE_SIZE;
          const plazaCenterY = (gameConfig.MAP_HEIGHT_TILES / 2) * gameConfig.TILE_SIZE;
          const plazaHalfSize = (gameConfig.PLAZA_SIZE_TILES / 2) * gameConfig.TILE_SIZE;
          
          // 몬스터가 레벨 3 구역과 겹치지 않도록 체크 (몬스터 전체 크기 고려)
          const level3Left = plazaCenterX - plazaHalfSize - gameConfig.PLAZA_LEVEL3_EXTRA_TILES * gameConfig.TILE_SIZE;
          const level3Right = plazaCenterX + plazaHalfSize + gameConfig.PLAZA_LEVEL3_EXTRA_TILES * gameConfig.TILE_SIZE;
          const level3Top = plazaCenterY - plazaHalfSize - gameConfig.PLAZA_LEVEL3_EXTRA_TILES * gameConfig.TILE_SIZE;
          const level3Bottom = plazaCenterY + plazaHalfSize + gameConfig.PLAZA_LEVEL3_EXTRA_TILES * gameConfig.TILE_SIZE;
          
          // 몬스터의 바운딩 박스가 레벨 3 구역과 겹치는지 체크
          if (!(x + monsterSize <= level3Left || x >= level3Right || 
                y + monsterSize <= level3Top || y >= level3Bottom)) {
            attempts++;
            continue;
          }
          break;

        case MonsterConfig.MAP_LEVELS.LEVEL_3:
          // 광장 외부 타일 - 몬스터 크기 고려
          const plaza3CenterX = (gameConfig.MAP_WIDTH_TILES / 2) * gameConfig.TILE_SIZE;
          const plaza3CenterY = (gameConfig.MAP_HEIGHT_TILES / 2) * gameConfig.TILE_SIZE;
          const plaza3HalfSize = (gameConfig.PLAZA_SIZE_TILES / 2) * gameConfig.TILE_SIZE;
          
          x = this.getRandomInRange(
            plaza3CenterX - plaza3HalfSize - gameConfig.PLAZA_LEVEL3_EXTRA_TILES * gameConfig.TILE_SIZE + safetyMargin,
            plaza3CenterX + plaza3HalfSize + gameConfig.PLAZA_LEVEL3_EXTRA_TILES * gameConfig.TILE_SIZE - safetyMargin
          );
          y = this.getRandomInRange(
            plaza3CenterY - plaza3HalfSize - gameConfig.PLAZA_LEVEL3_EXTRA_TILES * gameConfig.TILE_SIZE + safetyMargin,
            plaza3CenterY + plaza3HalfSize + gameConfig.PLAZA_LEVEL3_EXTRA_TILES * gameConfig.TILE_SIZE - safetyMargin
          );
          
          // 광장 내부(레벨 4) 완전히 피하기 - 몬스터 크기 고려
          const level4Left = plaza3CenterX - plaza3HalfSize;
          const level4Right = plaza3CenterX + plaza3HalfSize;
          const level4Top = plaza3CenterY - plaza3HalfSize;
          const level4Bottom = plaza3CenterY + plaza3HalfSize;
          
          // 몬스터의 바운딩 박스가 레벨 4 구역과 겹치는지 체크
          if (!(x + monsterSize <= level4Left || x >= level4Right || 
                y + monsterSize <= level4Top || y >= level4Bottom)) {
            attempts++;
            continue;
          }
          break;
          
        case MonsterConfig.MAP_LEVELS.LEVEL_4:
          // 광장 내부 - 몬스터 크기 고려
          const plaza4CenterX = (gameConfig.MAP_WIDTH_TILES / 2) * gameConfig.TILE_SIZE;
          const plaza4CenterY = (gameConfig.MAP_HEIGHT_TILES / 2) * gameConfig.TILE_SIZE;
          const plaza4HalfSize = (gameConfig.PLAZA_SIZE_TILES / 2) * gameConfig.TILE_SIZE;
          
          x = this.getRandomInRange(
            plaza4CenterX - plaza4HalfSize + safetyMargin,
            plaza4CenterX + plaza4HalfSize - safetyMargin
          );
          y = this.getRandomInRange(
            plaza4CenterY - plaza4HalfSize + safetyMargin,
            plaza4CenterY + plaza4HalfSize - safetyMargin
          );
          break;
      }
      
      // 스폰 위치 검증: 벽이 아니고, 플레이어 주변이 아니고, 몬스터가 밀집하지 않은 곳
      if (!ServerUtils.isWallPosition(x, y, this.gameStateManager.mapData) &&
          !this.isNearPlayer(x, y) &&
          !this.isMonsterCrowded(x, y)) {
        
        // 추가 검증: 실제 몬스터 크기를 고려한 경계 체크
        if (this.isValidSpawnPosition(x, y, monsterSize, level)) {
          return { x, y };
        }
      }
      
      attempts++;
    }
    
    console.warn(`레벨 ${level} 몬스터 스폰 지점을 ${maxAttempts}번 시도 후에도 찾지 못함`);
    return null;
  }
  
  /**
   * 스폰 위치가 유효한지 검증 (몬스터 크기 고려)
   */
  isValidSpawnPosition(x, y, monsterSize, expectedLevel) {
    // 몬스터의 네 모서리가 모두 올바른 레벨에 속하는지 확인
    const corners = [
      { x: x, y: y }, // 좌상단
      { x: x + monsterSize, y: y }, // 우상단
      { x: x, y: y + monsterSize }, // 좌하단
      { x: x + monsterSize, y: y + monsterSize } // 우하단
    ];
    
    for (const corner of corners) {
      const cornerLevel = MonsterConfig.getMapLevelFromPosition(corner.x, corner.y, gameConfig);
      if (cornerLevel !== expectedLevel) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 범위 내 랜덤 값 생성
   */
  getRandomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  /**
   * 플레이어 주변 3타일 내에 있는지 체크
   */
  isNearPlayer(x, y) {
    const avoidRange = MonsterConfig.COMMON_CONFIG.SPAWN_AVOID_PLAYER_RANGE * gameConfig.TILE_SIZE;
    
    for (const player of this.gameStateManager.players.values()) {
      const dx = Math.abs(player.x - x);
      const dy = Math.abs(player.y - y);
      
      if (dx <= avoidRange && dy <= avoidRange) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 몬스터 밀집 지역인지 체크
   */
  isMonsterCrowded(x, y) {
    const avoidRange = MonsterConfig.COMMON_CONFIG.SPAWN_AVOID_MONSTER_RANGE * gameConfig.TILE_SIZE;
    let nearbyMonsters = 0;
    
    for (const monster of this.gameStateManager.enemies.values()) {
      const dx = Math.abs(monster.x - x);
      const dy = Math.abs(monster.y - y);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= avoidRange) {
        nearbyMonsters++;
        // 2마리 이상 가까이 있으면 밀집으로 판단
        if (nearbyMonsters >= 2) {
          return true;
        }
      }
    }
    
    return false;
  }



  /**
   * 몬스터 상태 업데이트 및 클라이언트 동기화
   */
  updateMonsters(deltaTime) {
    const monsters = this.gameStateManager.enemies;
    const players = this.gameStateManager.players;
    const walls = this.gameStateManager.mapData?.walls || [];
    
    // 첫 번째 업데이트에서만 디버깅 정보 출력
    if (!this.debugLogged) {
      console.log(`몬스터 AI 업데이트 시작: 몬스터 ${monsters.size}마리, 플레이어 ${players.size}명, 벽 ${walls.length}개`);
      this.debugLogged = true;
    }
    
    // 각 몬스터 업데이트
    for (const monster of monsters.values()) {
      monster.update(players, walls, deltaTime);
      
      // 사망한 몬스터 처리
      if (monster.hp <= 0) {
        this.handleMonsterDeath(monster);
      }
    }
    
    // 클라이언트에게 몬스터 상태 전송
    this.broadcastMonsterStates();
  }

  /**
   * 몬스터 사망 처리
   */
  handleMonsterDeath(monster) {
    const deadLevel = monster.mapLevel;
    
    // 레벨별 개수 감소
    this.levelMonsterCounts[deadLevel]--;
    
    // 클라이언트에게 몬스터 사망 알림
    this.io.emit('monster-destroyed', {
      monsterId: monster.id,
      x: monster.x,
      y: monster.y,
      exp: monster.exp,
      mapLevel: deadLevel
    });
    
    // 서버에서 몬스터 제거
    this.gameStateManager.removeEnemy(monster.id);
    
    console.log(`레벨 ${deadLevel} ${monster.type} 몬스터 사망, 경험치: ${monster.exp}`);
    
    // 즉시 같은 레벨에 새로운 몬스터 스폰 (약간의 지연 후)
    setTimeout(() => {
      this.spawnMonsterInLevel(deadLevel);
    }, 1000); // 1초 후 스폰
  }

  /**
   * 클라이언트에게 몬스터 상태 브로드캐스트
   */
  broadcastMonsterStates() {
    const monstersState = [];
    
    for (const monster of this.gameStateManager.enemies.values()) {
      monstersState.push(monster.getState());
    }
    
    // 첫 번째 브로드캐스트에서만 디버깅 정보 출력
    if (!this.broadcastLogged) {
      console.log(`enemies-update 브로드캐스트: ${monstersState.length}마리 몬스터 데이터 전송`);
      this.broadcastLogged = true;
    }
    
    // 모든 클라이언트에게 몬스터 상태 전송
    this.io.emit('enemies-update', monstersState);
  }

  /**
   * 모든 몬스터 제거
   */
  clearAllMonsters() {
    const monsterIds = Array.from(this.gameStateManager.enemies.keys());
    
    monsterIds.forEach(id => {
      const monster = this.gameStateManager.enemies.get(id);
      if (monster) {
        this.levelMonsterCounts[monster.mapLevel]--;
      }
      this.gameStateManager.removeEnemy(id);
      this.io.emit('monster-destroyed', { monsterId: id });
    });
    
    console.log(`모든 몬스터 제거 완료: ${monsterIds.length}마리`);
  }

  /**
   * 특정 위치에 특정 타입 몬스터 스폰 (디버그용)
   */
  spawnMonsterAt(type, x, y) {
    const level = MonsterConfig.getMapLevelFromPosition(x, y, gameConfig);
    if (!level) {
      console.log('스폰 불가능한 위치입니다.');
      return null;
    }

    if (!Object.values(MonsterConfig.MONSTER_TYPES).includes(type)) {
      console.log(`잘못된 몬스터 타입: ${type}`);
      return null;
    }

    const monsterId = uuidv4();
    const monster = this.gameStateManager.addEnemy(monsterId, x, y, type, level);
    this.levelMonsterCounts[level]++;
    
    this.io.emit('monster-spawned', monster.getState());
    
    return monster;
  }

  /**
   * 몬스터 통계 정보
   */
  getMonsterStats() {
    const monsters = this.gameStateManager.getAllEnemies();
    const stats = {
      total: monsters.length,
      byLevel: {},
      byType: {},
      totalHealth: 0,
      averageHealth: 0,
      levelCounts: { ...this.levelMonsterCounts }
    };

    monsters.forEach(monster => {
      // 레벨별 개수
      if (!stats.byLevel[monster.mapLevel]) {
        stats.byLevel[monster.mapLevel] = 0;
      }
      stats.byLevel[monster.mapLevel]++;
      
      // 타입별 개수
      if (!stats.byType[monster.type]) {
        stats.byType[monster.type] = 0;
      }
      stats.byType[monster.type]++;
      
      // 체력 통계
      stats.totalHealth += monster.hp;
    });

    if (monsters.length > 0) {
      stats.averageHealth = stats.totalHealth / monsters.length;
    }

    return stats;
  }

  /**
   * 정리 작업
   */
  destroy() {
    this.clearAllMonsters();
    console.log('몬스터 매니저 정리 완료');
  }
}

module.exports = EnemyManager; 