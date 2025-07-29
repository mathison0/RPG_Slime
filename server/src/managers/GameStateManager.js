const ServerPlayer = require('../entities/ServerPlayer');
const ServerEnemy = require('../entities/ServerEnemy');
const gameConfig = require('../config/GameConfig');
const MonsterConfig = require('../../shared/MonsterConfig');

/**
 * 게임 상태 관리 매니저
 */
class GameStateManager {
  constructor(io = null, skillManager = null) {
    this.players = new Map();
    this.enemies = new Map();
    this.rooms = new Map();
    this.mapData = null;
    this.io = io;
    this.skillManager = skillManager;
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
    if (this.skillManager) {
      for (const player of this.players.values()) {
        this.skillManager.cleanupExpiredActions(player);
      }
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
   * 벽 정보 조회
   */
  getWalls() {
    if (!this.mapData || !this.mapData.walls) {
      return [];
    }
    return this.mapData.walls;
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

  /**
   * 통합 데미지 처리 함수
   * @param {Object} attacker - 공격자 (플레이어 또는 몬스터)
   * @param {Object} target - 피격자 (플레이어 또는 몬스터)
   * @param {number} damage - 데미지 량
   * @returns {Object} - 처리 결과 { success: boolean, actualDamage: number, reason?: string }
   */
  takeDamage(attacker, target, damage) {
    console.log(`takeDamage 호출: ${attacker.id} → ${target.id}, 데미지: ${damage}`);
    
    // 기본 유효성 검사
    if (!attacker || !target || damage <= 0) {
      console.log(`takeDamage 실패: 유효하지 않은 파라미터`);
      return { success: false, actualDamage: 0, reason: 'invalid parameters' };
    }

    // 타겟이 이미 죽었는지 체크
    if (target.isDead || target.hp <= 0) {
      return { success: false, actualDamage: 0, reason: 'target already dead' };
    }

    // 무적 상태 체크 (플레이어만)
    if (target.isInvincible === true) {
      // 무적 상태일 때 attack-invalid 이벤트 브로드캐스트
      console.log(`무적 상태로 공격 무효: ${attacker.id} → ${target.id}`);
      if (this.io) {
        // 공격자가 플레이어인 경우: 공격자에게 메시지 전송
        // 공격자가 몬스터인 경우: 피격자(플레이어)에게 메시지 전송
        const recipientId = attacker.team !== undefined ? attacker.id : target.id;
        
        this.io.to(recipientId).emit('attack-invalid', {
          x: target.x,
          y: target.y,
          message: '무적!'
        });
        
        console.log(`무적 메시지 전송: ${recipientId}에게 (공격자: ${attacker.id}, 피격자: ${target.id})`);
      }
      return { success: false, actualDamage: 0, reason: 'invincible' };
    }

    // 맵 레벨 체크 (플레이어가 몬스터를 공격하는 경우)
    if (attacker.team !== undefined && target.mapLevel !== undefined) {
      const attackerLevel = MonsterConfig.getMapLevelFromPosition(attacker.x, attacker.y, gameConfig);
      const targetLevel = target.mapLevel;
      
      if (attackerLevel !== targetLevel) {
        // 다른 레벨에서의 공격 무효
        if (this.io) {
          this.io.to(attacker.id).emit('attack-invalid', {
            x: target.x,
            y: target.y,
            message: '공격 무효!'
          });
        }
        console.log(`레벨 다름으로 공격 무효: 공격자 레벨 ${attackerLevel}, 타겟 레벨 ${targetLevel}`);
        return { success: false, actualDamage: 0, reason: 'different level' };
      }
    }

    // 실제 데미지 적용
    const actualDamage = damage;
    target.hp = Math.max(0, target.hp - actualDamage);

    // 몬스터가 피격당한 경우 공격자를 타겟으로 설정
    if (target.mapLevel !== undefined && attacker.team !== undefined) {
      target.target = attacker;
      console.log(`몬스터 ${target.id}가 ${attacker.id}에게 피격당해 타겟으로 설정`);
    }

    // 플레이어가 피격당한 경우 데미지 소스 추적
    if (target.team !== undefined && attacker.mapLevel !== undefined) {
      target.lastDamageSource = {
        type: 'monster',
        id: attacker.id,
        timestamp: Date.now()
      };
    } else if (target.team !== undefined && attacker.team !== undefined) {
      target.lastDamageSource = {
        type: 'player',
        id: attacker.id,
        timestamp: Date.now()
      };
    }

    // 이벤트 브로드캐스트
    if (this.io) {
      if (target.team !== undefined) {
        // 플레이어 피격 이벤트
        if (attacker.mapLevel !== undefined) {
          // 몬스터가 플레이어를 공격
          this.io.emit('monster-attack', {
            monsterId: attacker.id,
            playerId: target.id,
            damage: actualDamage,
            newHp: target.hp
          });
        } else {
          // 플레이어가 플레이어를 공격
          this.io.emit('player-damaged', {
            playerId: target.id,
            attackerId: attacker.id,
            damage: actualDamage,
            newHp: target.hp
          });
        }
      } else if (target.mapLevel !== undefined) {
        // 몬스터 피격 이벤트
        this.io.emit('enemy-damaged', {
          enemyId: target.id,
          hp: target.hp,
          maxHp: target.maxHp,
          damage: actualDamage
        });
      }
    }

    console.log(`데미지 처리: ${attacker.id} → ${target.id}, 데미지: ${actualDamage}, 남은 HP: ${target.hp}`);
    
    return { 
      success: true, 
      actualDamage: actualDamage,
      newHp: target.hp
    };
  }

  /**
   * 통합 힐 처리 함수
   * @param {Object} healer - 힐러 (플레이어)
   * @param {Object} target - 힐을 받을 대상 (플레이어)
   * @param {number} healAmount - 힐 량
   * @returns {Object} - 처리 결과 { success: boolean, actualHeal: number, reason?: string }
   */
  heal(healer, target, healAmount) {
    console.log(`heal 호출: ${healer.id} → ${target.id}, 힐량: ${healAmount}`);
    
    // 기본 유효성 검사
    if (!healer || !target || healAmount <= 0) {
      console.log(`heal 실패: 유효하지 않은 파라미터`);
      return { success: false, actualHeal: 0, reason: 'invalid parameters' };
    }

    // 타겟이 죽었는지 체크
    if (target.isDead || target.hp <= 0) {
      return { success: false, actualHeal: 0, reason: 'target dead' };
    }

    // 이미 체력이 가득찬지 체크
    if (target.hp >= target.maxHp) {
      return { success: false, actualHeal: 0, reason: 'already full health' };
    }

    // 실제 힐 적용
    const oldHp = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + healAmount);
    const actualHeal = target.hp - oldHp;

    // 이벤트 브로드캐스트
    if (this.io && actualHeal > 0) {
      this.io.emit('player-healed', {
        playerId: target.id,
        healerId: healer.id,
        healAmount: actualHeal,
        newHp: target.hp,
        maxHp: target.maxHp
      });
    }

    console.log(`힐 처리: ${healer.id} → ${target.id}, 힐량: ${actualHeal}, 새 HP: ${target.hp}`);
    
    return { 
      success: true, 
      actualHeal: actualHeal,
      newHp: target.hp
    };
  }
}

module.exports = GameStateManager; 