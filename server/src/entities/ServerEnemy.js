const gameConfig = require('../config/GameConfig');

// 서버용 AssetConfig 상수 (클라이언트와 동일한 값)
const AssetConfig = {
  SPRITE_SIZES: {
    PLAYER: {
      COLLIDER_SIZE: 32
    },
    ENEMY: {
      RADIUS: 10  // 클라이언트의 body.setSize(20, 20)와 일치
    }
  }
};

/**
 * 서버측 적 클래스
 */
class ServerEnemy {
  constructor(id, x, y, type) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.type = type;
    this.hp = 50;
    this.maxHp = 50;
    this.attack = 15;
    this.defense = 0; // 방어력 추가
    this.speed = 50;
    this.lastUpdate = Date.now();
    
    // AI 관련
    this.target = null;
    this.aggroRange = gameConfig.ENEMY.AGGRO_RANGE;
    this.attackRange = gameConfig.ENEMY.ATTACK_RANGE;
    this.lastAttack = 0;
    this.attackCooldown = gameConfig.ENEMY.ATTACK_COOLDOWN;
    
    // 이동 관련
    this.vx = 0;
    this.vy = 0;
    this.wanderDirection = Math.random() * Math.PI * 2;
    this.wanderChangeTime = Date.now() + Math.random() * 3000 + 2000;
    
    // 타입별 스탯 설정
    this.setupTypeStats();
  }

  /**
   * 타입별 스탯 설정
   */
  setupTypeStats() {
    switch (this.type) {
      case 'fast':
        this.speed = 80;
        this.hp = 30;
        this.maxHp = 30;
        this.attack = 12;
        this.defense = 0;
        break;
      case 'tank':
        this.speed = 30;
        this.hp = 100;
        this.maxHp = 100;
        this.attack = 25;
        this.defense = 0;
        break;
      case 'ranged':
        this.speed = 40;
        this.hp = 40;
        this.maxHp = 40;
        this.attack = 18;
        this.defense = 0;
        this.aggroRange = 300;
        this.attackRange = 150;
        break;
      default: // basic
        this.defense = 0;
        break;
    }
  }
  
  /**
   * 적 AI 업데이트
   */
  update(players, delta) {
    const now = Date.now();
    this.lastUpdate = now;
    
    this.findTarget(players);
    
    if (this.target) {
      this.chaseTarget(delta);
    } else {
      this.wander(delta, now);
    }
    
    this.move(delta);
    this.checkBounds();
  }
  
  /**
   * 가장 가까운 타겟 찾기
   */
  findTarget(players) {
    let closestPlayer = null;
    let closestDistance = this.aggroRange;
    
    for (const player of players.values()) {
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
   * 타겟 추적
   */
  chaseTarget(delta) {
    if (!this.target) return;
    
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 어그로 범위를 벗어나면 타겟 해제
    if (distance > this.aggroRange) {
      this.target = null;
      this.vx = 0;
      this.vy = 0;
      return;
    }
    
    // 공격 범위 내에 있으면 공격, 아니면 이동
    if (distance > this.attackRange) {
      this.vx = (dx / distance) * this.speed;
      this.vy = (dy / distance) * this.speed;
    } else {
      this.vx = 0;
      this.vy = 0;
      this.tryAttack();
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
    
    const wanderSpeed = this.speed * 0.3;
    this.vx = Math.cos(this.wanderDirection) * wanderSpeed;
    this.vy = Math.sin(this.wanderDirection) * wanderSpeed;
  }

  /**
   * 이동 처리
   */
  move(delta) {
    this.x += this.vx * delta / 1000;
    this.y += this.vy * delta / 1000;
  }
  
  /**
   * 공격 시도
   */
  tryAttack() {
    const now = Date.now();
    if (now - this.lastAttack > this.attackCooldown && this.target) {
      this.lastAttack = now;
      this.isAttacking = true;
      return true;
    }
    return false;
  }
  
  /**
   * 맵 경계 체크
   */
  checkBounds() {
    const margin = 50;
    
    if (this.x < margin) {
      this.x = margin;
      this.vx = Math.abs(this.vx);
    }
    if (this.x > gameConfig.MAP_WIDTH - margin) {
      this.x = gameConfig.MAP_WIDTH - margin;
      this.vx = -Math.abs(this.vx);
    }
    if (this.y < margin) {
      this.y = margin;
      this.vy = Math.abs(this.vy);
    }
    if (this.y > gameConfig.MAP_HEIGHT - margin) {
      this.y = gameConfig.MAP_HEIGHT - margin;
      this.vy = -Math.abs(this.vy);
    }
  }

  /**
   * 데미지 처리
   */
  takeDamage(damage) {
    this.hp = Math.max(0, this.hp - damage);
    return this.hp <= 0; // 사망 여부 반환
  }

  /**
   * 적 상태 정보 반환
   */
  getState() {
    const state = {
      id: this.id,
      x: this.x,
      y: this.y,
      type: this.type,
      hp: this.hp,
      maxHp: this.maxHp,
      vx: this.vx,
      vy: this.vy
    };
    
    if (this.isAttacking) {
      state.isAttacking = true;
      this.isAttacking = false; // 한 번만 전송
    }
    
    return state;
  }

  /**
   * 콜라이더 크기 계산 (클라이언트와 동일한 방식)
   */
  getColliderSize() {
    // 클라이언트와 동일한 방식으로 콜라이더 크기 계산
    // AssetConfig.ENEMY.RADIUS를 기준으로 함
    const baseColliderSize = AssetConfig.SPRITE_SIZES.ENEMY.RADIUS * 2; // 32
    return baseColliderSize;
  }

  /**
   * 콜라이더 반지름 계산 (충돌 감지용)
   */
  getColliderRadius() {
    return this.getColliderSize() / 2; // 16
  }
}

module.exports = ServerEnemy; 