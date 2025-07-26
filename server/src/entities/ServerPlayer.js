const gameConfig = require('../config/GameConfig');

/**
 * 서버측 플레이어 클래스
 */
class ServerPlayer {
  constructor(id, x, y, team) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.team = team;
    this.level = 1;
    this.exp = 0;
    this.expToNext = 100;
    this.maxHp = gameConfig.PLAYER.DEFAULT_HP;
    this.hp = this.maxHp;
    this.speed = gameConfig.PLAYER.DEFAULT_SPEED;
    this.attack = gameConfig.PLAYER.DEFAULT_ATTACK;
    this.defense = gameConfig.PLAYER.DEFAULT_DEFENSE;
    this.jobClass = 'slime';
    this.direction = 'front';
    this.isJumping = false;
    this.size = gameConfig.PLAYER.DEFAULT_SIZE;
    this.visionRange = gameConfig.PLAYER.VISION_RANGE;
    this.lastUpdate = Date.now();
    this.nickname = 'Player';
  }

  /**
   * 플레이어 상태 업데이트
   */
  update(data) {
    this.x = data.x;
    this.y = data.y;
    this.direction = data.direction;
    this.isJumping = data.isJumping;
    this.lastUpdate = Date.now();
  }

  /**
   * 플레이어 상태 정보 반환
   */
  getState() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      team: this.team,
      level: this.level,
      hp: this.hp,
      maxHp: this.maxHp,
      jobClass: this.jobClass,
      direction: this.direction,
      isJumping: this.isJumping,
      size: this.size,
      attack: this.attack,
      defense: this.defense,
      speed: this.speed,
      nickname: this.nickname
    };
  }

  /**
   * 플레이어가 연결 해제되었는지 확인
   */
  isDisconnected() {
    const now = Date.now();
    return now - this.lastUpdate > gameConfig.PLAYER.DISCONNECT_TIMEOUT;
  }

  /**
   * 플레이어 레벨업
   */
  levelUp() {
    this.level++;
    this.exp = 0;
    this.expToNext = this.level * 100;
    
    // 스탯 증가
    this.maxHp += 20;
    this.hp = this.maxHp; // 풀피로 회복
    this.attack += 5;
    this.defense += 2;
    
    console.log(`플레이어 ${this.id} 레벨업! 레벨: ${this.level}`);
  }

  /**
   * 경험치 획득
   */
  gainExp(amount) {
    this.exp += amount;
    if (this.exp >= this.expToNext) {
      this.levelUp();
      return true; // 레벨업 발생
    }
    return false;
  }

  /**
   * 데미지 처리
   */
  takeDamage(damage) {
    const actualDamage = Math.max(1, damage - this.defense);
    this.hp = Math.max(0, this.hp - actualDamage);
    return this.hp <= 0; // 사망 여부 반환
  }

  /**
   * 체력 회복
   */
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * 직업 변경
   */
  changeJob(newJobClass) {
    this.jobClass = newJobClass;
    console.log(`플레이어 ${this.id} 직업 변경: ${newJobClass}`);
  }
}

module.exports = ServerPlayer; 