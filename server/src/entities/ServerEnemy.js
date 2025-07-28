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
    
    // 공통 설정
    this.aggroRange = MonsterConfig.COMMON_CONFIG.AGGRO_RANGE;
    this.maxAggroRange = MonsterConfig.COMMON_CONFIG.MAX_AGGRO_RANGE;
    this.attackRange = MonsterConfig.COMMON_CONFIG.ATTACK_RANGE;
    this.attackCooldown = MonsterConfig.COMMON_CONFIG.ATTACK_COOLDOWN;
    this.wanderSpeed = MonsterConfig.COMMON_CONFIG.WANDER_SPEED;
    
    // 상태 관리
    this.target = null;
    this.lastAttack = 0;
    this.lastUpdate = Date.now();
    this.isAttacking = false;
    
    // 이동 관련
    this.vx = 0;
    this.vy = 0;
    this.wanderDirection = Math.random() * Math.PI * 2;
    this.wanderChangeTime = Date.now() + Math.random() * 3000 + 2000;
    
    // 스폰 구역 경계 계산 (구역 제한용)
    this.calculateSpawnBounds();
  }

  /**
   * 스폰 구역 경계 계산
   */
  calculateSpawnBounds() {
    const {
      MAP_WIDTH_TILES, MAP_HEIGHT_TILES, TILE_SIZE,
      SPAWN_WIDTH_TILES, SPAWN_BARRIER_EXTRA_TILES,
      PLAZA_SIZE_TILES
    } = gameConfig;
    
    // 현재 몬스터가 스폰된 구역의 경계를 계산
    switch (this.mapLevel) {
      case MonsterConfig.MAP_LEVELS.LEVEL_1_RED:
        // 빨강팀 스폰 배리어 구역 (왼쪽)
        this.bounds = {
          left: SPAWN_WIDTH_TILES * TILE_SIZE,
          right: (SPAWN_WIDTH_TILES + SPAWN_BARRIER_EXTRA_TILES) * TILE_SIZE,
          top: 0,
          bottom: MAP_HEIGHT_TILES * TILE_SIZE
        };
        break;
        
      case MonsterConfig.MAP_LEVELS.LEVEL_1_BLUE:
        // 파랑팀 스폰 배리어 구역 (오른쪽)
        this.bounds = {
          left: (MAP_WIDTH_TILES - SPAWN_WIDTH_TILES - SPAWN_BARRIER_EXTRA_TILES) * TILE_SIZE,
          right: (MAP_WIDTH_TILES - SPAWN_WIDTH_TILES) * TILE_SIZE,
          top: 0,
          bottom: MAP_HEIGHT_TILES * TILE_SIZE
        };
        break;
        
      case MonsterConfig.MAP_LEVELS.LEVEL_2:
        // 레벨 2 구역 (광장 제외)
        const plazaCenterX = (MAP_WIDTH_TILES / 2) * TILE_SIZE;
        const plazaCenterY = (MAP_HEIGHT_TILES / 2) * TILE_SIZE;
        const plazaHalfSize = (PLAZA_SIZE_TILES / 2) * TILE_SIZE;
        
        this.bounds = {
          left: (SPAWN_WIDTH_TILES + SPAWN_BARRIER_EXTRA_TILES) * TILE_SIZE,
          right: (MAP_WIDTH_TILES - SPAWN_WIDTH_TILES - SPAWN_BARRIER_EXTRA_TILES) * TILE_SIZE,
          top: 0,
          bottom: MAP_HEIGHT_TILES * TILE_SIZE,
          // 광장 제외 구역
          plazaLeft: plazaCenterX - plazaHalfSize - 4 * TILE_SIZE,
          plazaRight: plazaCenterX + plazaHalfSize + 4 * TILE_SIZE,
          plazaTop: plazaCenterY - plazaHalfSize - 4 * TILE_SIZE,
          plazaBottom: plazaCenterY + plazaHalfSize + 4 * TILE_SIZE
        };
        break;
        
      case MonsterConfig.MAP_LEVELS.LEVEL_3:
        // 광장 외부 4타일
        const plaza3CenterX = (MAP_WIDTH_TILES / 2) * TILE_SIZE;
        const plaza3CenterY = (MAP_HEIGHT_TILES / 2) * TILE_SIZE;
        const plaza3HalfSize = (PLAZA_SIZE_TILES / 2) * TILE_SIZE;
        
        this.bounds = {
          left: plaza3CenterX - plaza3HalfSize - 4 * TILE_SIZE,
          right: plaza3CenterX + plaza3HalfSize + 4 * TILE_SIZE,
          top: plaza3CenterY - plaza3HalfSize - 4 * TILE_SIZE,
          bottom: plaza3CenterY + plaza3HalfSize + 4 * TILE_SIZE,
          // 광장 내부 제외
          innerLeft: plaza3CenterX - plaza3HalfSize,
          innerRight: plaza3CenterX + plaza3HalfSize,
          innerTop: plaza3CenterY - plaza3HalfSize,
          innerBottom: plaza3CenterY + plaza3HalfSize
        };
        break;
        
      case MonsterConfig.MAP_LEVELS.LEVEL_4:
        // 광장 내부
        const plaza4CenterX = (MAP_WIDTH_TILES / 2) * TILE_SIZE;
        const plaza4CenterY = (MAP_HEIGHT_TILES / 2) * TILE_SIZE;
        const plaza4HalfSize = (PLAZA_SIZE_TILES / 2) * TILE_SIZE;
        
        this.bounds = {
          left: plaza4CenterX - plaza4HalfSize,
          right: plaza4CenterX + plaza4HalfSize,
          top: plaza4CenterY - plaza4HalfSize,
          bottom: plaza4CenterY + plaza4HalfSize
        };
        break;
    }
  }

  /**
   * 몬스터 AI 업데이트
   */
  update(players, walls, delta) {
    const now = Date.now();
    this.lastUpdate = now;
    
    this.findTarget(players);
    
    if (this.target) {
      this.chaseTarget(walls, delta);
      // 디버깅: 타겟 추적 상태
      if (!this.chaseLogged) {
        console.log(`몬스터 ${this.id} (${this.type}) 타겟 추적: ${this.target.id}`);
        this.chaseLogged = true;
        this.wanderLogged = false;
      }
    } else {
      this.wander(delta, now);
      // 디버깅: 배회 상태
      if (!this.wanderLogged) {
        console.log(`몬스터 ${this.id} (${this.type}) 배회 중: (${Math.round(this.x)}, ${Math.round(this.y)})`);
        this.wanderLogged = true;
        this.chaseLogged = false;
      }
    }
    
    this.move(delta, walls);
    this.checkBounds();
  }

  /**
   * 가장 가까운 타겟 찾기 (타겟이 없을 때만 새로 탐지)
   */
  findTarget(players) {
    // 기존 타겟이 있으면 유효성 체크
    if (this.target) {
      // 플레이어가 여전히 존재하고 활성 상태인지 확인
      const targetExists = [...players.values()].find(p => p.id === this.target.id);
      if (!targetExists || targetExists.isDead) {
        this.target = null; // 타겟이 없거나 죽었으면 해제
      } else {
        return; // 유효한 타겟이면 유지
      }
    }
    
    let closestPlayer = null;
    let closestDistance = this.aggroRange;
    
    for (const player of players.values()) {
      // 죽은 플레이어는 타겟에서 제외
      if (player.isDead || player.hp <= 0) continue;
      
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < closestDistance) {
        closestPlayer = player;
        closestDistance = distance;
      }
    }
    
    this.target = closestPlayer;
  }

  /**
   * 타겟 추적 (벽 고려)
   */
  chaseTarget(walls, delta) {
    if (!this.target) return;
    
    // 타겟이 여전히 유효한지 체크
    if (this.target.isDead || this.target.hp <= 0) {
      this.target = null;
      this.vx = 0;
      this.vy = 0;
      return;
    }
    
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 최대 어그로 범위를 벗어나면 타겟 해제
    if (distance > this.maxAggroRange) {
      this.target = null;
      this.vx = 0;
      this.vy = 0;
      return;
    }
    
    // 공격 범위 내에 있으면 공격 시도 (움직임 중단)
    if (distance <= this.attackRange) {
      this.vx = 0;
      this.vy = 0;
      this.tryAttack();
      return;
    }
    
    // 타겟 방향으로 이동
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // 벽 충돌을 고려한 경로 찾기
    const moveX = dirX * this.speed;
    const moveY = dirY * this.speed;
    
    // 간단한 벽 회피 로직
    const futureX = this.x + moveX * delta / 1000;
    const futureY = this.y + moveY * delta / 1000;
    
    if (this.canMoveTo(futureX, futureY, walls)) {
      this.vx = moveX;
      this.vy = moveY;
    } else {
      // 벽에 막혔을 때 우회 경로 시도
      this.findAlternativePath(dirX, dirY, walls);
    }
  }

  /**
   * 배회 행동
   */
  wander(delta, now) {
    if (now > this.wanderChangeTime) {
      this.wanderDirection = Math.random() * Math.PI * 2;
      this.wanderChangeTime = now + Math.random() * 3000 + 2000;
    }
    
    this.vx = Math.cos(this.wanderDirection) * this.wanderSpeed;
    this.vy = Math.sin(this.wanderDirection) * this.wanderSpeed;
  }

  /**
   * 이동 처리
   */
  move(delta, walls) {
    const deltaTime = delta / 1000;
    const nextX = this.x + this.vx * deltaTime;
    const nextY = this.y + this.vy * deltaTime;
    
    // 벽 충돌 체크 후 이동
    if (this.canMoveTo(nextX, nextY, walls)) {
      this.x = nextX;
      this.y = nextY;
    } else {
      // 벽에 막혔을 때는 속도를 0으로 설정하고 배회 방향 변경
      this.vx = 0;
      this.vy = 0;
      this.wanderDirection = Math.random() * Math.PI * 2;
      this.wanderChangeTime = Date.now() + 500; // 0.5초 후 새 방향
    }
  }

  /**
   * 이동 가능 여부 체크 (벽과 구역 경계)
   */
  canMoveTo(x, y, walls) {
    // 구역 경계 체크
    if (!this.isWithinBounds(x, y)) {
      return false;
    }
    
    // 벽 충돌 체크
    for (const wall of walls) {
      if (x < wall.x + wall.width &&
          x + this.size > wall.x &&
          y < wall.y + wall.height &&
          y + this.size > wall.y) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 구역 경계 내부인지 체크
   */
  isWithinBounds(x, y) {
    const bounds = this.bounds;
    
    // 기본 경계 체크
    if (x < bounds.left || 
        x + this.size > bounds.right || 
        y < bounds.top || 
        y + this.size > bounds.bottom) {
      return false;
    }
    
    // 레벨 2인 경우 광장 구역 제외
    if (this.mapLevel === MonsterConfig.MAP_LEVELS.LEVEL_2) {
      if (x + this.size > bounds.plazaLeft &&
          x < bounds.plazaRight &&
          y + this.size > bounds.plazaTop &&
          y < bounds.plazaBottom) {
        return false;
      }
    }
    
    // 레벨 3인 경우 광장 내부 제외
    if (this.mapLevel === MonsterConfig.MAP_LEVELS.LEVEL_3) {
      if (x + this.size > bounds.innerLeft &&
          x < bounds.innerRight &&
          y + this.size > bounds.innerTop &&
          y < bounds.innerBottom) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 대안 경로 찾기 (간단한 벽 회피)
   */
  findAlternativePath(targetDirX, targetDirY, walls) {
    // 여러 방향 시도
    const directions = [
      { x: -targetDirY, y: targetDirX }, // 90도 회전
      { x: targetDirY, y: -targetDirX }, // -90도 회전
      { x: -targetDirX, y: -targetDirY } // 180도 회전
    ];
    
    for (const dir of directions) {
      const moveX = dir.x * this.speed;
      const moveY = dir.y * this.speed;
      const futureX = this.x + moveX * 0.05; // 짧은 거리로 테스트
      const futureY = this.y + moveY * 0.05;
      
      if (this.canMoveTo(futureX, futureY, walls)) {
        this.vx = moveX;
        this.vy = moveY;
        return;
      }
    }
    
    // 모든 방향이 막혔으면 정지
    this.vx = 0;
    this.vy = 0;
  }

  /**
   * 구역 경계 체크 및 위치 조정
   */
  checkBounds() {
    if (!this.isWithinBounds(this.x, this.y)) {
      // 경계를 벗어났으면 이전 위치로 되돌리기 위해 속도 반전
      if (this.x < this.bounds.left) {
        this.x = this.bounds.left;
        this.vx = Math.abs(this.vx);
      }
      if (this.x + this.size > this.bounds.right) {
        this.x = this.bounds.right - this.size;
        this.vx = -Math.abs(this.vx);
      }
      if (this.y < this.bounds.top) {
        this.y = this.bounds.top;
        this.vy = Math.abs(this.vy);
      }
      if (this.y + this.size > this.bounds.bottom) {
        this.y = this.bounds.bottom - this.size;
        this.vy = -Math.abs(this.vy);
      }
      
      // 배회 방향도 변경
      this.wanderDirection = Math.random() * Math.PI * 2;
    }
  }

  /**
   * 벽 충돌 체크
   */
  checkWallCollision(walls) {
    for (const wall of walls) {
      if (this.x < wall.x + wall.width &&
          this.x + this.size > wall.x &&
          this.y < wall.y + wall.height &&
          this.y + this.size > wall.y) {
        
        // 벽에서 밀어내기
        const overlapX = Math.min(this.x + this.size - wall.x, wall.x + wall.width - this.x);
        const overlapY = Math.min(this.y + this.size - wall.y, wall.y + wall.height - this.y);
        
        if (overlapX < overlapY) {
          // 좌우로 밀어내기
          if (this.x < wall.x) {
            this.x = wall.x - this.size;
            this.vx = -Math.abs(this.vx);
          } else {
            this.x = wall.x + wall.width;
            this.vx = Math.abs(this.vx);
          }
        } else {
          // 상하로 밀어내기
          if (this.y < wall.y) {
            this.y = wall.y - this.size;
            this.vy = -Math.abs(this.vy);
          } else {
            this.y = wall.y + wall.height;
            this.vy = Math.abs(this.vy);
          }
        }
        
        this.wanderDirection = Math.random() * Math.PI * 2;
        break;
      }
    }
  }

  /**
   * 공격 시도
   */
  tryAttack() {
    const now = Date.now();
    if (now - this.lastAttack > this.attackCooldown && this.target) {
      console.log(`몬스터 ${this.id} 공격 시도: 타겟 ${this.target.id}`);
      // 타겟이 여전히 유효한지 체크
      if (this.target.isDead || this.target.hp <= 0) {
        this.target = null;
        return null;
      }
      
      // 공격 범위 내에 있는지 다시 체크
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= this.attackRange) {
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
          
          // ServerPlayer의 takeDamage 메서드 사용 (실제 적용된 데미지 반환)
          const actualDamage = player.takeDamage(this.attack);
          
          // 클라이언트에게 공격 결과 전송 (사망 판정은 서버 메인 루프에서 처리)
          this.io.emit('monster-attack', {
            monsterId: this.id,
            playerId: this.target.id,
            damage: actualDamage,
            newHp: player.hp
          });
        }
      }
    }
    return null;
  }

  /**
   * 콜라이더 크기 반환 (클라이언트와 동일한 로직)
   */
  getColliderSize() {
    return this.size * gameConfig.ENEMY.COLLIDER.SIZE_RATIO;
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
   * 데미지 처리
   */
  takeDamage(damage) {
    this.hp = Math.max(0, this.hp - damage);
    return this.hp <= 0; // 사망 여부 반환
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
      exp: this.exp
    };
    
    if (this.isAttacking) {
      state.isAttacking = true;
      this.isAttacking = false; // 한 번만 전송
    }
    
    return state;
  }
}

module.exports = ServerEnemy; 