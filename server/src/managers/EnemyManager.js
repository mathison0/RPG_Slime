const { v4: uuidv4 } = require('uuid');
const gameConfig = require('../config/GameConfig');
const ServerUtils = require('../utils/ServerUtils');

/**
 * 적 관리 매니저
 */
class EnemyManager {
  constructor(io, gameStateManager) {
    this.io = io;
    this.gameStateManager = gameStateManager;
    this.spawnTimer = null;
  }

  /**
   * 적 초기화
   */
  initialize() {
    console.log('적 매니저 초기화 시작');
    this.spawnInitialEnemies();
    this.startSpawnTimer();
    console.log('적 매니저 초기화 완료');
  }

  /**
   * 초기 적들 스폰
   */
  spawnInitialEnemies() {
    for (let i = 0; i < gameConfig.ENEMY.MAX_COUNT; i++) {
      this.spawnEnemy();
    }
    console.log(`초기 적 ${gameConfig.ENEMY.MAX_COUNT}마리 스폰 완료`);
  }

  /**
   * 적 스폰
   */
  spawnEnemy() {
    // 최대 개체수 체크
    if (this.gameStateManager.enemies.size >= gameConfig.ENEMY.MAX_COUNT) {
      return;
    }

    const enemyId = uuidv4();
    const type = this.getRandomEnemyType();
    const spawnPoint = this.getEnemySpawnPoint();
    
    if (!spawnPoint) {
      console.log('적 스폰 지점을 찾을 수 없음');
      return;
    }

    const enemy = this.gameStateManager.addEnemy(enemyId, spawnPoint.x, spawnPoint.y, type);
    
    // 클라이언트에게 적 스폰 알림
    this.io.emit('enemy-spawned', enemy.getState());
    
    return enemy;
  }

  /**
   * 랜덤 적 타입 선택
   */
  getRandomEnemyType() {
    const types = gameConfig.ENEMY.TYPES;
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * 적 스폰 지점 계산
   */
  getEnemySpawnPoint() {
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      const x = Math.random() * (gameConfig.MAP_WIDTH - gameConfig.SPAWN_WIDTH * 2) + gameConfig.SPAWN_WIDTH;
      const y = Math.random() * gameConfig.MAP_HEIGHT;
      
      // 벽이 아닌 곳에 스폰
      if (!ServerUtils.isWallPosition(x, y, this.gameStateManager.mapData)) {
        return { x, y };
      }
      
      attempts++;
    }
    
    // 적절한 위치를 찾지 못한 경우 기본 위치 반환
    return {
      x: gameConfig.MAP_WIDTH / 2,
      y: gameConfig.MAP_HEIGHT / 2
    };
  }

  /**
   * 적 스폰 타이머 시작
   */
  startSpawnTimer() {
    this.spawnTimer = setInterval(() => {
      this.spawnEnemy();
    }, gameConfig.ENEMY.SPAWN_INTERVAL);
  }

  /**
   * 적 스폰 타이머 중지
   */
  stopSpawnTimer() {
    if (this.spawnTimer) {
      clearInterval(this.spawnTimer);
      this.spawnTimer = null;
    }
  }

  /**
   * 적 AI 업데이트
   */
  updateEnemies(deltaTime) {
    const enemyUpdates = [];
    
    for (const [id, enemy] of this.gameStateManager.enemies) {
      enemy.update(this.gameStateManager.players, deltaTime);
      enemyUpdates.push(enemy.getState());
    }
    
    // 클라이언트에게 적 상태 업데이트 전송
    if (enemyUpdates.length > 0) {
      this.io.emit('enemies-update', enemyUpdates);
    }
    
    return enemyUpdates.length;
  }

  /**
   * 모든 적 제거
   */
  clearAllEnemies() {
    const enemyIds = Array.from(this.gameStateManager.enemies.keys());
    
    enemyIds.forEach(id => {
      this.gameStateManager.removeEnemy(id);
      this.io.emit('enemy-destroyed', { enemyId: id });
    });
    
    console.log(`모든 적 제거 완료: ${enemyIds.length}마리`);
  }

  /**
   * 특정 타입 적 스폰
   */
  spawnEnemyOfType(type, x, y) {
    if (!gameConfig.ENEMY.TYPES.includes(type)) {
      console.log(`잘못된 적 타입: ${type}`);
      return null;
    }

    const enemyId = uuidv4();
    const enemy = this.gameStateManager.addEnemy(enemyId, x, y, type);
    
    this.io.emit('enemy-spawned', enemy.getState());
    
    return enemy;
  }

  /**
   * 적 통계 정보
   */
  getEnemyStats() {
    const enemies = this.gameStateManager.getAllEnemies();
    const stats = {
      total: enemies.length,
      byType: {},
      totalHealth: 0,
      averageHealth: 0
    };

    enemies.forEach(enemy => {
      // 타입별 개수
      if (!stats.byType[enemy.type]) {
        stats.byType[enemy.type] = 0;
      }
      stats.byType[enemy.type]++;
      
      // 체력 통계
      stats.totalHealth += enemy.hp;
    });

    if (enemies.length > 0) {
      stats.averageHealth = stats.totalHealth / enemies.length;
    }

    return stats;
  }

  /**
   * 정리 작업
   */
  destroy() {
    this.stopSpawnTimer();
    this.clearAllEnemies();
    console.log('적 매니저 정리 완료');
  }
}

module.exports = EnemyManager; 