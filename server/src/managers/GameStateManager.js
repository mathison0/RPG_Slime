const ServerPlayer = require('../entities/ServerPlayer');
const ServerEnemy = require('../entities/ServerEnemy');
const gameConfig = require('../config/GameConfig');

/**
 * 게임 상태 관리 매니저
 */
class GameStateManager {
  constructor(io = null) {
    this.players = new Map();
    this.enemies = new Map();
    this.rooms = new Map();
    this.mapData = null;
    this.io = io;
  }

  /**
   * 플레이어 추가
   */
  addPlayer(id, x, y, team, nickname) {
    if (this.players.has(id)) {
      console.log(`플레이어 ${id} 이미 존재함, 기존 플레이어 반환`);
      return this.players.get(id);
    }

    const player = new ServerPlayer(id, x, y, team);
    player.nickname = nickname || `Player${Math.floor(Math.random() * 1000)}`;
    this.players.set(id, player);
    
    console.log(`플레이어 추가: ${id} (${nickname}), 팀: ${team}`);
    return player;
  }

  /**
   * 플레이어 제거
   */
  removePlayer(id) {
    const removed = this.players.delete(id);
    if (removed) {
      console.log(`플레이어 제거: ${id}`);
    }
    return removed;
  }

  /**
   * 플레이어 조회
   */
  getPlayer(id) {
    return this.players.get(id);
  }

  /**
   * 모든 플레이어 조회
   */
  getAllPlayers() {
    return Array.from(this.players.values());
  }

  /**
   * 플레이어 상태 배열 조회
   */
  getPlayersState() {
    // 만료된 액션들 정리
    for (const player of this.players.values()) {
      player.cleanupExpiredActions();
    }
    return Array.from(this.players.values()).map(p => p.getState());
  }

  /**
   * 몬스터 추가
   */
  addEnemy(id, x, y, type, mapLevel) {
    const enemy = new ServerEnemy(id, x, y, type, mapLevel, this, this.io);
    this.enemies.set(id, enemy);
    return enemy;
  }

  /**
   * 적 제거
   */
  removeEnemy(id) {
    return this.enemies.delete(id);
  }

  /**
   * 적 조회
   */
  getEnemy(id) {
    return this.enemies.get(id);
  }

  /**
   * 모든 적 조회
   */
  getAllEnemies() {
    return Array.from(this.enemies.values());
  }

  /**
   * 적 상태 배열 조회
   */
  getEnemiesState() {
    return Array.from(this.enemies.values()).map(e => {
      const state = e.getState();
      // 적에게도 액션 상태 정보 추가 (필요시)
      state.activeActions = {
        jump: null,
        skills: []
      };
      return state;
    });
  }

  /**
   * 연결 해제된 플레이어들 정리
   */
  cleanupDisconnectedPlayers() {
    const disconnectedPlayers = [];
    
    for (const [id, player] of this.players) {
      if (player.isDisconnected()) {
        disconnectedPlayers.push(id);
      }
    }
    
    disconnectedPlayers.forEach(id => {
      this.removePlayer(id);
    });
    
    return disconnectedPlayers;
  }

  /**
   * 팀별 플레이어 수 계산
   */
  getTeamCounts() {
    const counts = { red: 0, blue: 0 };
    
    for (const player of this.players.values()) {
      if (player.team === 'red') counts.red++;
      else if (player.team === 'blue') counts.blue++;
    }
    
    return counts;
  }

  /**
   * 균형 잡힌 팀 반환 (새 플레이어용)
   */
  getBalancedTeam() {
    const counts = this.getTeamCounts();
    return counts.red <= counts.blue ? 'red' : 'blue';
  }

  /**
   * 맵 데이터 설정
   */
  setMapData(mapData) {
    this.mapData = mapData;
    console.log('게임 맵 데이터 설정 완료');
  }

  /**
   * 전체 게임 상태 조회
   */
  getFullGameState() {
    return {
      players: this.getPlayersState(),
      enemies: this.getEnemiesState(),
      mapData: this.mapData,
      timestamp: Date.now()
    };
  }

  /**
   * 통계 정보 조회
   */
  getStats() {
    const teamCounts = this.getTeamCounts();
    return {
      totalPlayers: this.players.size,
      totalEnemies: this.enemies.size,
      redTeam: teamCounts.red,
      blueTeam: teamCounts.blue,
      timestamp: Date.now()
    };
  }

  /**
   * 스폰 배리어 구역에 있는 플레이어들 체크 및 데미지 적용
   */
  checkSpawnBarrierDamage() {
    if (!this.mapData) return [];
    
    const damagedPlayers = [];
    const now = Date.now();
    
    for (const player of this.players.values()) {
      // 죽은 플레이어는 데미지 체크에서 제외
      if (player.isDead) {
        continue;
      }
      
      if (!player.lastSpawnBarrierCheck) {
        player.lastSpawnBarrierCheck = now;
        continue;
      }
      
      // 스폰 배리어 데미지 간격 체크 (1초)
      if (now - player.lastSpawnBarrierCheck < gameConfig.SPAWN_BARRIER.DAMAGE_INTERVAL) {
        continue;
      }
      
      // 상대팀 스폰 배리어 구역에 있는지 체크
      const inEnemyBarrierZone = this.isInEnemySpawnBarrierZone(player);
      
      if (inEnemyBarrierZone) {
        // 무적 상태 체크
        if (player.isInvincible) {
          console.log(`플레이어 ${player.id} 무적 상태로 스폰 배리어 데미지 무시`);
          player.lastSpawnBarrierCheck = now;
          continue;
        }
        
        // 체력 감소
        const damage = Math.ceil(player.maxHp * gameConfig.SPAWN_BARRIER.DAMAGE_PERCENT);
        player.hp = Math.max(0, player.hp - damage);
        
        // 데미지 소스 추적 (사망 원인 판단용)
        player.lastDamageSource = {
          type: 'spawn-barrier',
          timestamp: Date.now()
        };
        
        damagedPlayers.push({
          playerId: player.id,
          damage: damage,
          currentHp: player.hp,
          maxHp: player.maxHp
        });
        
        console.log(`플레이어 ${player.id} 스폰 배리어 데미지: -${damage} HP (${player.hp}/${player.maxHp})`);
        
        player.lastSpawnBarrierCheck = now;
      } else {
        // 스폰 배리어 구역에 없으면 타이머 리셋
        player.lastSpawnBarrierCheck = now;
      }
    }
    
    return damagedPlayers;
  }
  
  /**
   * 플레이어가 상대팀 스폰 배리어 구역에 있는지 체크
   */
  isInEnemySpawnBarrierZone(player) {
    if (!this.mapData) return false;
    
    const extraWidth = gameConfig.SPAWN_BARRIER_EXTRA_TILES * gameConfig.TILE_SIZE;
    const extraHeight = extraWidth; // 상하좌우 동일하게 확장
    
    if (player.team === 'red') {
      // 빨간팀 플레이어가 파란팀 스폰 배리어 구역에 있는지 체크
      const blueBarrierZone = {
        x: this.mapData.blueSpawnRect.x - extraWidth,
        y: this.mapData.blueSpawnRect.y - extraHeight,
        right: this.mapData.blueSpawnRect.x + this.mapData.blueSpawnRect.width + extraWidth,
        bottom: this.mapData.blueSpawnRect.y + this.mapData.blueSpawnRect.height + extraHeight
      };
      
      return player.x >= blueBarrierZone.x && 
             player.x <= blueBarrierZone.right &&
             player.y >= blueBarrierZone.y && 
             player.y <= blueBarrierZone.bottom;
             
    } else if (player.team === 'blue') {
      // 파란팀 플레이어가 빨간팀 스폰 배리어 구역에 있는지 체크
      const redBarrierZone = {
        x: this.mapData.redSpawnRect.x - extraWidth,
        y: this.mapData.redSpawnRect.y - extraHeight,
        right: this.mapData.redSpawnRect.x + this.mapData.redSpawnRect.width + extraWidth,
        bottom: this.mapData.redSpawnRect.y + this.mapData.redSpawnRect.height + extraHeight
      };
      
      return player.x >= redBarrierZone.x && 
             player.x <= redBarrierZone.right &&
             player.y >= redBarrierZone.y && 
             player.y <= redBarrierZone.bottom;
    }
    
    return false;
  }

  /**
   * 게임 상태 리셋
   */
  reset() {
    this.players.clear();
    this.enemies.clear();
    this.rooms.clear();
    console.log('게임 상태 리셋 완료');
  }
}

module.exports = GameStateManager; 