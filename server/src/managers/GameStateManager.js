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
    this.jobOrbs = new Map(); // 직업 변경 오브 관리
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
        // 버프 정리도 함께 수행
        player.cleanupExpiredBuffs();
      }
    }
    return Array.from(this.players.values()).map(p => p.getState());
  }

  /**
   * 모든 플레이어의 와드 정보 수집
   */
  getAllWards() {
    const allWards = [];
    const now = Date.now();
    
    for (const player of this.players.values()) {
      if (player.wardList && player.wardList.length > 0) {
        // 만료되지 않은 와드만 필터링
        const activeWards = player.wardList.filter(ward => {
          const isExpired = ward.duration > 0 && (now - ward.createdAt) > ward.duration;
          return !isExpired;
        });
        
        // 만료된 와드들은 플레이어 리스트에서 제거
        if (activeWards.length !== player.wardList.length) {
          player.wardList = activeWards;
        }
        
        // 활성 와드들을 전체 리스트에 추가
        allWards.push(...activeWards.map(ward => ({
          ...ward,
          playerId: player.id,
          team: player.team
        })));
      }
    }
    
    return allWards;
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
    this.jobOrbs.clear(); // 게임 리셋 시 오브 정보도 초기화
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
      if (this.io) {
        // 공격자가 플레이어인 경우: 공격자에게 메시지 전송
        // 공격자가 몬스터인 경우: 피격자(플레이어)에게 메시지 전송
        const recipientId = attacker.team !== undefined ? attacker.id : target.id;
        
        this.io.to(recipientId).emit('attack-invalid', {
          x: target.x,
          y: target.y,
          message: '무적!'
        });
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
        return { success: false, actualDamage: 0, reason: 'different level' };
      }
    }

    // 실제 데미지 적용
    let actualDamage = damage;
    
    // 보호막 효과 체크 (마법사의 보호막)
    if (target.activeEffects && target.activeEffects.has('shield')) {
      actualDamage = 0;
      
      // 보호막 무효화 메시지 브로드캐스트
      if (this.io) {
        this.io.to(target.id).emit('attack-invalid', {
          x: target.x,
          y: target.y,
          message: '보호막!'
        });
      }
      
      return { success: true, actualDamage: 0, newHp: target.hp, reason: 'shield blocked' };
    }
    
    const oldHp = target.hp;
    target.hp = Math.max(0, target.hp - actualDamage);
    const targetDied = target.hp <= 0 && oldHp > 0;

    // 실제 데미지가 발생한 경우 체력 재생 타이머 리셋
    if (actualDamage > 0 && target.onDamageTaken) {
      target.onDamageTaken();
    }

    // 몬스터가 피격당한 경우 공격자를 타겟으로 설정
    if (target.mapLevel !== undefined && attacker.team !== undefined) {
      target.target = attacker;
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

    // 타겟이 죽었을 때 경험치 지급
    if (targetDied) {
      if (attacker.team !== undefined) { // 공격자가 플레이어인 경우
        if (target.mapLevel !== undefined) {
          // 플레이어가 몬스터를 죽임
          console.log(`🔥 몬스터 사망: ID=${target.id}, 타입=${target.type}, 레벨=${target.mapLevel}, 위치=(${target.x}, ${target.y})`);
          
          const expAmount = this.calculateMonsterKillExp(target);
          this.giveExperience(attacker, expAmount, 'monster');
          console.log(`플레이어 ${attacker.id}가 몬스터 ${target.id}를 죽여 ${expAmount} 경험치 획득`);
          
          // 직업 변경 오브 드롭 처리 (슬라임 제외)
          this.handleJobOrbDrop(target);
          
          // 몬스터 사망 이벤트 브로드캐스트
          if (this.io) {
            this.io.emit('enemy-destroyed', { enemyId: target.id });
          }
          
          // 적 제거
          this.removeEnemy(target.id);
        } else if (target.team !== undefined && target.team !== attacker.team) {
          // 플레이어가 상대팀 플레이어를 죽임 (PvP)
          const expAmount = this.calculatePvpKillExp(attacker, target);
          this.giveExperience(attacker, expAmount, 'pvp');
          console.log(`플레이어 ${attacker.id}가 플레이어 ${target.id}를 죽여 ${expAmount} 경험치 획득`);
          
          // 타겟 플레이어 사망 처리
          target.isDead = true;
        }
      }
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

  /**
   * PvP 킬 시 경험치 계산
   * @param {Object} killer - 킬러 플레이어
   * @param {Object} victim - 피해자 플레이어
   * @returns {number} - 지급할 경험치
   */
  calculatePvpKillExp(killer, victim) {
    // 죽은 플레이어 레벨 x 100
    return victim.level * 100;
  }

  /**
   * 몬스터 킬 시 경험치 계산
   * @param {Object} monster - 죽은 몬스터
   * @returns {number} - 지급할 경험치
   */
  calculateMonsterKillExp(monster) {
    // MonsterConfig에서 기본 경험치와 맵 레벨 배율 적용
    const baseExp = MonsterConfig.BASE_MONSTER_STATS[monster.type]?.exp || 0;
    const expMultiplier = MonsterConfig.EXP_MULTIPLIERS[monster.mapLevel] || 1.0;
    return Math.floor(baseExp * expMultiplier);
  }

  /**
   * 경험치 지급 및 레벨업 처리
   * @param {Object} player - 경험치를 받을 플레이어
   * @param {number} expAmount - 지급할 경험치
   * @param {string} source - 경험치 소스 (monster, pvp)
   */
  giveExperience(player, expAmount, source = 'unknown') {
    if (!player || expAmount <= 0) return;
    
    const oldExp = player.exp;
    const oldLevel = player.level;
    
    // 경험치 추가
    player.exp += expAmount;
    
    // 레벨업 체크
    let leveledUp = false;
    while (player.exp >= player.expToNext) {
      player.exp -= player.expToNext;
      player.levelUp();
      leveledUp = true;
      console.log(`플레이어 ${player.id} 레벨업! 새 레벨: ${player.level}`);
    }
    
    // 경험치 획득 이벤트 브로드캐스트
    if (this.io) {
      this.io.emit('player-exp-gained', {
        playerId: player.id,
        expGained: expAmount,
        totalExp: player.exp,
        expToNext: player.expToNext,
        source: source
      });
      
      // 레벨업 시 레벨업 이벤트 브로드캐스트
      if (leveledUp) {
        this.io.emit('player-level-up', {
          playerId: player.id,
          newLevel: player.level,
          oldLevel: oldLevel,
          stats: {
            hp: player.hp,
            maxHp: player.maxHp,
            attack: player.attack,
            speed: player.speed,
            size: player.size
          }
        });
      }
    }
  }

  /**
   * 모든 엔티티의 체력 재생 처리
   */
  processHealthRegeneration() {
    // 모든 플레이어의 체력 재생 처리
    for (const player of this.players.values()) {
      if (player.processHealthRegeneration) {
        player.processHealthRegeneration();
      }
    }
    
    // 모든 적의 체력 재생 처리
    for (const enemy of this.enemies.values()) {
      if (enemy.processHealthRegeneration) {
        enemy.processHealthRegeneration();
      }
    }
  }

  /**
   * 몬스터 사망 시 직업 변경 오브 드롭 처리
   * @param {Object} monster - 사망한 몬스터
   */
  handleJobOrbDrop(monster) {
    console.log('🎯 handleJobOrbDrop 호출됨:', {
      monsterId: monster?.id,
      monsterType: monster?.type,
      monsterMapLevel: monster?.mapLevel,
      monsterX: monster?.x,
      monsterY: monster?.y
    });

    if (!monster || !monster.type) {
      console.log('❌ 오브 드롭 실패: 몬스터 정보가 유효하지 않음');
      return;
    }

    // 엘리트 몬스터는 100%, 일반 몬스터는 5% 확률로 드롭
    const dropChance = monster.type === 'elite' ? 100 : 5;
    const random = Math.random() * 100;

    console.log(`🎲 드롭 확률 체크: 몬스터 타입=${monster.type}, 드롭 확률=${dropChance}%, 랜덤값=${random.toFixed(2)}%`);

    if (random < dropChance) {
      // 슬라임, 닌자, 메카닉을 제외한 랜덤 직업 선택
      const availableJobs = ['assassin', 'warrior', 'mage', 'archer', 'supporter'];
      const randomJob = availableJobs[Math.floor(Math.random() * availableJobs.length)];

      const jobOrb = {
        id: `job_orb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 고유 ID 생성
        type: 'job_orb',
        jobClass: randomJob, // 변경할 직업
        x: monster.x,
        y: monster.y,
        createdAt: Date.now(),
        duration: 30000, // 오브 지속 시간 (30초)
        isActive: true,
        isCollected: false
      };

      // 오브를 서버 상태에 저장
      if (!this.jobOrbs) {
        this.jobOrbs = new Map();
      }
      this.jobOrbs.set(jobOrb.id, jobOrb);

      // 직업 변경 오브 스폰 이벤트 브로드캐스트
      if (this.io) {
        console.log('📡 job-orb-spawned 이벤트 브로드캐스트:', jobOrb);
        this.io.emit('job-orb-spawned', {
          orbId: jobOrb.id,
          jobClass: jobOrb.jobClass,
          x: jobOrb.x,
          y: jobOrb.y
        });
      } else {
        console.log('❌ io 객체가 없어서 오브 스폰 이벤트를 브로드캐스트할 수 없음');
      }

      console.log(`✅ 직업 변경 오브 드롭 성공: ${randomJob} (${monster.x}, ${monster.y})`);

      // 30초 후 오브 자동 제거
      setTimeout(() => {
        this.removeJobOrb(jobOrb.id);
      }, jobOrb.duration);
    } else {
      console.log(`❌ 드롭 실패: 확률 ${dropChance}%에서 ${random.toFixed(2)}% 뽑음`);
    }
  }

  /**
   * 직업 변경 오브 제거
   * @param {string} orbId - 오브 ID
   */
  removeJobOrb(orbId) {
    if (this.jobOrbs && this.jobOrbs.has(orbId)) {
      this.jobOrbs.delete(orbId);
      
      if (this.io) {
        this.io.emit('job-orb-removed', { orbId });
      }
    }
  }

  /**
   * 플레이어와 직업 변경 오브 충돌 처리
   * @param {string} playerId - 플레이어 ID
   * @param {string} orbId - 오브 ID
   */
  handleJobOrbCollision(playerId, orbId) {
    if (!this.jobOrbs || !this.jobOrbs.has(orbId)) {
      return { 
        success: false, 
        orbId: orbId,
        message: '오브를 찾을 수 없습니다.' 
      };
    }

    const player = this.getPlayer(playerId);
    if (!player) {
      return { 
        success: false, 
        orbId: orbId,
        message: '플레이어를 찾을 수 없습니다.' 
      };
    }

    const jobOrb = this.jobOrbs.get(orbId);
    if (!jobOrb) {
      return { 
        success: false, 
        orbId: orbId,
        message: '오브를 찾을 수 없습니다.' 
      };
    }

    if (!jobOrb.isActive || jobOrb.isCollected) {
      return { 
        success: false, 
        orbId: orbId,
        message: '이미 수집된 오브입니다.' 
      };
    }

    // 오브를 수집 상태로 변경
    jobOrb.isCollected = true;
    jobOrb.isActive = false;

    if (this.io) {
      this.io.emit('job-orb-collected', {
        playerId,
        orbId,
        jobClass: jobOrb.jobClass
      });
    }

    console.log(`✅ 플레이어 ${playerId}가 ${jobOrb.jobClass} 오브를 수집했습니다.`);
    
    // 성공 응답
    const response = {
      success: true,
      jobClass: jobOrb.jobClass,
      orbId: orbId,
      message: `${jobOrb.jobClass} 직업 변경 오브를 획득했습니다!`
    };
    
    return response;
  }

  /**
   * 모든 직업 오브 상태 가져오기
   */
  getAllJobOrbs() {
    if (!this.jobOrbs) return [];
    
    return Array.from(this.jobOrbs.values()).filter(orb => orb.isActive && !orb.isCollected);
  }


}

module.exports = GameStateManager; 