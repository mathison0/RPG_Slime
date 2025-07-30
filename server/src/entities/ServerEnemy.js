const gameConfig = require('../config/GameConfig');
const MonsterConfig = require('../../shared/MonsterConfig');
const GameStateManager = require('../managers/GameStateManager');

/**
 * 서버측 몬스터 클래스 - 완전히 새로운 시스템
 */
class ServerEnemy {
  constructor(id, x, y, type, mapLevel, gameStateManager, io) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.type = type; // 'basic', 'charge', 'elite'
    this.mapLevel = mapLevel; // 1, 2, 3, 4
    this.spawnX = x; // 스폰 위치 기억 (구역 제한용)
    this.spawnY = y;
    this.gameStateManager = gameStateManager;
    this.io = io;
    
    // 몬스터 스탯 설정 (MonsterConfig에서 계산)
    const stats = MonsterConfig.calculateMonsterStats(type, mapLevel);
    this.hp = stats.hp;
    this.maxHp = stats.maxHp;
    this.attack = stats.attack;
    this.speed = stats.speed;
    this.size = stats.size;
    this.color = stats.color;
    this.exp = stats.exp;
    
    // 타입별 설정 (BASE_MONSTER_STATS에서 가져옴)
    const baseStats = MonsterConfig.BASE_MONSTER_STATS[type];
    this.aggroRange = baseStats.aggroRange;
    this.maxAggroRange = baseStats.maxAggroRange;
    this.wanderSpeed = baseStats.wanderSpeed;
    
    // 공통 설정
    this.attackRange = MonsterConfig.COMMON_CONFIG.ATTACK_RANGE;
    this.attackCooldown = MonsterConfig.COMMON_CONFIG.ATTACK_COOLDOWN;
    
    // 상태 관리
    this.target = null;
    this.lastAttack = 0;
    this.lastUpdate = Date.now();
    this.isAttacking = false;
    
    // 기절 상태 관리
    this.isStunned = false;
    this.stunStartTime = 0;
    this.stunDuration = 0;
    
    // 효과 상태 관리 (슬로우 등)
    this.activeEffects = new Set();
    
    // 이동 관련
    this.vx = 0;
    this.vy = 0;
    this.wanderDirection = Math.random() * Math.PI * 2;
    this.wanderChangeTime = Date.now() + Math.random() * 3000 + 2000;
    
    // 구역 제한용 - MonsterConfig.getMapLevelFromPosition 사용
  }



  /**
   * 두 엔티티 간의 모서리 간 최단 거리 계산
   * @param {Object} entity1 - 첫 번째 엔티티 (x, y, size)
   * @param {Object} entity2 - 두 번째 엔티티 (x, y, size)
   * @returns {number} 두 엔티티의 가장 가까운 모서리 간의 거리
   */
  calculateEdgeDistance(entity1, entity2) {
    // 각 엔티티를 사각형으로 간주하여 경계 계산
    const halfSize1 = entity1.size / 2;
    const halfSize2 = entity2.size / 2;
    
    // 엔티티1의 경계
    const left1 = entity1.x - halfSize1;
    const right1 = entity1.x + halfSize1;
    const top1 = entity1.y - halfSize1;
    const bottom1 = entity1.y + halfSize1;
    
    // 엔티티2의 경계
    const left2 = entity2.x - halfSize2;
    const right2 = entity2.x + halfSize2;
    const top2 = entity2.y - halfSize2;
    const bottom2 = entity2.y + halfSize2;
    
    // 두 사각형 간의 거리 계산
    let dx = 0;
    let dy = 0;
    
    // X축 방향 거리
    if (right1 < left2) {
      dx = left2 - right1;
    } else if (right2 < left1) {
      dx = left1 - right2;
    }
    // 겹치는 경우 dx = 0
    
    // Y축 방향 거리
    if (bottom1 < top2) {
      dy = top2 - bottom1;
    } else if (bottom2 < top1) {
      dy = top1 - bottom2;
    }
    // 겹치는 경우 dy = 0
    
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 효과가 적용된 실제 속도 계산
   * @param {number} baseSpeed - 기본 속도
   * @returns {number} - 효과가 적용된 속도
   */
  getEffectiveSpeed(baseSpeed) {
    let effectiveSpeed = baseSpeed;
    
    // 슬로우 효과 적용
    if (this.isSlowed && this.slowAmount) {
      effectiveSpeed *= this.slowAmount;
    } else if (this.activeEffects.has('slow')) {
      // 구버전 호환성
      effectiveSpeed *= 0.5;
    }
    
    return effectiveSpeed;
  }

  /**
   * 몬스터 업데이트
   */
  update(players, walls, delta) {
    const now = Date.now();
    this.lastUpdate = now;
    
    // 슬로우 효과 만료 체크
    if (this.isSlowed && this.slowedUntil && now > this.slowedUntil) {
      this.isSlowed = false;
      this.slowedUntil = null;
      this.slowAmount = 1;
      console.log(`몬스터 ${this.id} 슬로우 효과 해제`);
    }
    
    // 기절 상태에서는 행동 제한
    if (this.isStunned) {
      return;
    }
    
    this.findTarget(players);
    
    if (this.target) {
      this.chaseTarget(walls, delta);
    } else {
      this.wander(delta, now);
    }
    
    this.move(delta, walls);
  }

  /**
   * 가장 가까운 타겟 찾기 (매 프레임마다 더 가까운 타겟으로 어그로 변경)
   */
  findTarget(players) {
    let closestPlayer = null;
    let closestDistance = this.aggroRange;
    let currentTargetDistance = Infinity;
    
    // 현재 타겟이 있으면 그 거리를 계산
    if (this.target) {
      const targetExists = [...players.values()].find(p => p.id === this.target.id);
      if (!targetExists || targetExists.isDead) {
        // 타겟이 없거나 죽었으면 해제
        this.target = null;
      } else {
        // 현재 타겟과의 거리 계산
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        currentTargetDistance = Math.sqrt(dx * dx + dy * dy);
        
        // 현재 타겟이 최대 어그로 범위를 벗어났으면 타겟 해제
        if (currentTargetDistance > this.maxAggroRange) {
          this.target = null;
          currentTargetDistance = Infinity;
        }
      }
    }
    
    // 모든 플레이어를 확인하여 가장 가까운 플레이어 찾기
    for (const player of players.values()) {
      // 죽은 플레이어는 타겟에서 제외
      if (player.isDead || player.hp <= 0) continue;
      
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 어그로 범위 내에 있고, 현재 가장 가까운 거리보다 더 가까우면 업데이트
      if (distance < closestDistance) {
        closestPlayer = player;
        closestDistance = distance;
      }
    }
    
    // 새로 찾은 가장 가까운 플레이어로 타겟 업데이트
    // (현재 타겟이 없거나, 더 가까운 플레이어가 있을 때)
    if (closestPlayer && (!this.target || closestDistance < currentTargetDistance)) {
      const previousTarget = this.target ? this.target.id : 'none';
      this.target = closestPlayer;
      
      // 타겟이 변경되었을 때만 로그 출력
      if (previousTarget !== this.target.id) {
        console.log(`몬스터 ${this.id} 타겟 변경: ${previousTarget} -> ${this.target.id} (거리: ${Math.round(closestDistance)})`);
      }
    }
  }

  /**
   * 타겟 추적 (벽 고려 제거)
   */
  chaseTarget(walls, delta) {
    if (!this.target) return;
    
    // 타겟이 여전히 유효한지 체크 (findTarget에서 이미 체크하지만 안전장치)
    if (this.target.isDead || this.target.hp <= 0) {
      this.target = null;
      this.vx = 0;
      this.vy = 0;
      return;
    }
    
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const edgeDistance = this.calculateEdgeDistance(this, this.target);
    
    // 공격 범위 내에 있으면 공격 시도 (움직임 중단)
    if (edgeDistance <= this.attackRange) {
      this.vx = 0;
      this.vy = 0;
      this.tryAttack();
      return;
    }
    
    // 타겟 방향으로 직진 이동
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    const effectiveSpeed = this.getEffectiveSpeed(this.speed);
    this.vx = dirX * effectiveSpeed;
    this.vy = dirY * effectiveSpeed;
  }

  /**
   * 배회 행동
   */
  wander(delta, now) {
    if (now > this.wanderChangeTime) {
      this.wanderDirection = Math.random() * Math.PI * 2;
      this.wanderChangeTime = now + Math.random() * 3000 + 2000;
    }
    
    const effectiveWanderSpeed = this.getEffectiveSpeed(this.wanderSpeed);
    this.vx = Math.cos(this.wanderDirection) * effectiveWanderSpeed;
    this.vy = Math.sin(this.wanderDirection) * effectiveWanderSpeed;
  }

  /**
   * 이동 처리 (구역 경계 체크 포함)
   */
  move(delta, walls) {
    const deltaTime = delta / 1000;
    const nextX = this.x + this.vx * deltaTime;
    const nextY = this.y + this.vy * deltaTime;
    
    // 구역 경계 체크 - 이동 가능한 경우만 이동
    if (this.canMoveTo(nextX, nextY, walls)) {
      this.x = nextX;
      this.y = nextY;
    } else {
      // 축별로 개별 체크하여 막힌 축의 속도만 0으로 설정
      const canMoveX = this.canMoveTo(nextX, this.y, walls);
      const canMoveY = this.canMoveTo(this.x, nextY, walls);
      
      if (canMoveX) {
        this.x = nextX; // X축 이동 가능
      } else {
        this.vx = 0; // X축 막힘
      }
      
      if (canMoveY) {
        this.y = nextY; // Y축 이동 가능  
      } else {
        this.vy = 0; // Y축 막힘
      }
      
      // 배회 상태일 때만 방향 전환 (타겟 추적 중이 아닐 때)
      if (!this.target) {
        this.wanderDirection = Math.random() * Math.PI * 2;
      }
    }
  }

  /**
   * 이동 가능 여부 체크 (구역 경계만 체크, 벽 충돌 제거)
   */
  canMoveTo(x, y, walls) {
    // 구역 경계 체크만 수행
    return this.isWithinBounds(x, y);
  }

  /**
   * 구역 경계 내부인지 체크 - MonsterConfig.getMapLevelFromPosition 사용
   */
  isWithinBounds(x, y) {
    // 해당 위치의 맵 레벨을 확인
    const positionLevel = MonsterConfig.getMapLevelFromPosition(x, y, gameConfig);
    
    // 스폰 불가 구역이면 false
    if (positionLevel === null) {
      return false;
    }
    
    // 몬스터의 레벨과 일치하는지 확인
    return positionLevel === this.mapLevel;
  }



  /**
   * 공격 시도
   */
  tryAttack() {
    const now = Date.now();
    if (now - this.lastAttack > this.attackCooldown && this.target) {
      // 타겟이 여전히 유효한지 체크
      if (this.target.isDead || this.target.hp <= 0) {
        this.target = null;
        return null;
      }
      
        this.lastAttack = now;
        this.isAttacking = true;
        
        const player = this.gameStateManager.players.get(this.target.id);
        if (player && !player.isDead) {
          // 데미지 소스 추적 (사망 원인 판단용)
          player.lastDamageSource = {
            type: 'monster',
            id: this.id,
            timestamp: Date.now()
          };
          
          // 통합 takeDamage 메서드 사용
          const result = this.gameStateManager.takeDamage(this, player, this.attack);
          
          // 공격 결과는 통합 함수에서 이미 이벤트를 브로드캐스트하므로 
          // 여기서는 추가 처리 불필요
        }
    }
    return null;
  }

  /**
   * 플레이어와 충돌 체크
   */
  isCollidingWithPlayer(player) {
    const dx = Math.abs(this.x - player.x);
    const dy = Math.abs(this.y - player.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < (this.size + player.size) / 2;
  }

  /**
   * 몬스터 상태 정보 반환 (클라이언트로 전송용)
   */
  getState() {
    const state = {
      id: this.id,
      x: this.x,
      y: this.y,
      type: this.type,
      mapLevel: this.mapLevel,
      hp: this.hp,
      maxHp: this.maxHp,
      size: this.size,
      color: this.color,
      vx: this.vx,
      vy: this.vy,
      exp: this.exp,
      isStunned: this.isStunned,
      stunDuration: this.stunDuration,
      // 어그로 대상 정보 추가
      targetId: this.target ? this.target.id : null
    };
    
    if (this.isAttacking) {
      state.isAttacking = true;
      this.isAttacking = false; // 한 번만 전송
    }
    
    return state;
  }

  /**
   * 기절 상태 시작
   */
  startStun(duration) {
    this.isStunned = true;
    this.stunStartTime = Date.now();
    this.stunDuration = duration;
    
    // 기절 지속시간 후 자동 해제
    setTimeout(() => {
      if (this.isStunned) {
        this.endStun();
      }
    }, duration);
    
    // 기절 상태 변경을 모든 클라이언트에게 즉시 알림
    if (this.io) {
      this.io.emit('enemy-stunned', {
        enemyId: this.id,
        isStunned: true,
        duration: duration
      });
    }
  }

  /**
   * 기절 상태 종료
   */
  endStun() {
    this.isStunned = false;
    this.stunStartTime = 0;
    this.stunDuration = 0;
    
    // 기절 상태 해제를 모든 클라이언트에게 즉시 알림
    if (this.io) {
      this.io.emit('enemy-stunned', {
        enemyId: this.id,
        isStunned: false,
        duration: 0
      });
    }
  }
}

module.exports = ServerEnemy; 