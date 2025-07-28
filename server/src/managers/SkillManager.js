const { getSkillInfo } = require('../../shared/JobClasses.js');
const gameConfig = require('../config/GameConfig');

/**
 * 스킬 관리 매니저
 * 모든 스킬의 데미지 계산과 효과를 중앙에서 관리
 */
class SkillManager {
  constructor(gameStateManager) {
    this.gameStateManager = gameStateManager;
  }

  /**
   * 스킬 사용 시도
   */
  useSkill(player, skillType, targetX = null, targetY = null) {
    // 죽은 플레이어는 스킬 사용 불가
    if (player.isDead) {
      return { success: false, error: 'Cannot use skills while dead' };
    }

    // 기본 공격 처리
    if (skillType === 'basic_attack') {
      return this.handleBasicAttack(player, targetX, targetY);
    }

    const skillInfo = getSkillInfo(player.jobClass, skillType);
    if (!skillInfo) {
      return { success: false, error: 'Invalid skill type' };
    }

    // 쿨타임 체크
    const now = Date.now();
    const lastUsed = player.skillCooldowns[skillType] || 0;
    if (now - lastUsed < skillInfo.cooldown) {
      return { success: false, error: 'Skill on cooldown' };
    }

    // 스킬별 특수 조건 체크
    if (player.isJumping && skillType !== 'stealth') {
      return { success: false, error: 'Cannot use skill while jumping' };
    }

    // 스킬 사용 처리
    player.skillCooldowns[skillType] = now;
    
    // 액션 상태 업데이트
    const duration = skillInfo.duration || 0;
    if (duration > 0) {
      player.currentActions.skills.set(skillType, {
        startTime: now,
        duration: duration,
        endTime: now + duration,
        skillInfo: {
          range: this.calculateSkillRange(player, skillType, skillInfo.range),
          damage: this.calculateSkillDamage(player, skillType, skillInfo.damage),
          duration: duration,
          heal: skillInfo.heal || 0
        }
      });
    }
    
    // 서버에서 모든 스킬 정보를 클라이언트에 전송 (확장성 고려)
    const completeSkillInfo = {
      // 기본 정보
      range: this.calculateSkillRange(player, skillType, skillInfo.range),
      damage: this.calculateSkillDamage(player, skillType, skillInfo.damage),
      duration: duration,
      heal: skillInfo.heal || 0,
      cooldown: skillInfo.cooldown || 0,
      
      // 확장 정보 (스킬별로 다를 수 있는 정보들)
      ...(skillInfo.angleOffset !== undefined && { angleOffset: skillInfo.angleOffset }),
      ...(skillInfo.delay !== undefined && { delay: skillInfo.delay }),
      ...(skillInfo.stunDuration !== undefined && { stunDuration: skillInfo.stunDuration }),
      ...(skillInfo.width !== undefined && { width: skillInfo.width }),
      ...(skillInfo.radius !== undefined && { radius: skillInfo.radius }),
      ...(skillInfo.speed !== undefined && { speed: skillInfo.speed }),
      ...(skillInfo.projectileCount !== undefined && { projectileCount: skillInfo.projectileCount }),
      ...(skillInfo.spreadAngle !== undefined && { spreadAngle: skillInfo.spreadAngle }),
      ...(skillInfo.piercing !== undefined && { piercing: skillInfo.piercing }),
      ...(skillInfo.bounces !== undefined && { bounces: skillInfo.bounces }),
      ...(skillInfo.chargeTime !== undefined && { chargeTime: skillInfo.chargeTime }),
      ...(skillInfo.chargeDistance !== undefined && { chargeDistance: skillInfo.chargeDistance }),
      
      // 원본 스킬 정보도 포함 (추가 확장을 위해)
      originalSkillInfo: skillInfo
    };

    return {
      success: true,
      skillType,
      timestamp: now,
      playerId: player.id,
      x: player.x,
      y: player.y,
      targetX,
      targetY,
      skillInfo: completeSkillInfo
    };
  }

  /**
   * 점프 시작 처리
   */
  startJump(player, duration = gameConfig.PLAYER.SKILLS.JUMP_DURATION) {
    if (player.isJumping) {
      return false;
    }
    
    const now = Date.now();
    player.isJumping = true;
    player.currentActions.jump = {
      startTime: now,
      duration: duration,
      endTime: now + duration
    };
    
    return true;
  }

  /**
   * 점프 종료 처리
   */
  endJump(player) {
    player.isJumping = false;
    player.currentActions.jump = null;
  }

  /**
   * 액션 상태 정리 (만료된 액션들 제거)
   */
  cleanupExpiredActions(player) {
    const now = Date.now();
    
    // 점프 상태 확인
    if (player.currentActions.jump && now >= player.currentActions.jump.endTime) {
      this.endJump(player);
    }
    
    // 스킬 상태 확인
    for (const [skillType, skillAction] of player.currentActions.skills) {
      if (now >= skillAction.endTime) {
        player.currentActions.skills.delete(skillType);
      }
    }
  }

  /**
   * 스킬 범위 계산 (슬라임은 크기에 비례)
   */
  calculateSkillRange(player, skillType, baseRange) {
    if (player.jobClass === 'slime' && skillType === 'spread') {
      // 슬라임 퍼지기는 크기에 비례 (기본 크기는 Config에서 가져옴)
      return Math.round(baseRange * (player.size / gameConfig.PLAYER.SKILLS.BASE_RANGE_REFERENCE));
    }
    return baseRange;
  }

  /**
   * 스킬 데미지 계산
   */
  calculateSkillDamage(player, skillType, baseDamage) {
    if (typeof baseDamage === 'string') {
      // 문자열 수식 처리 (예: 'attack', 'attack * 1.5')
      if (baseDamage === 'attack') {
        baseDamage = player.attack;
      } else if (baseDamage.includes('attack')) {
        // 간단한 수식 계산 (attack * 1.5 등)
        baseDamage = this.parseFormula(baseDamage, player.attack);
      }
    }
    
    return Math.round(baseDamage);
  }

  /**
   * 안전한 수식 파싱 (eval 대신 사용)
   * 'attack * 1.5', 'attack + 10' 등의 간단한 수식을 파싱
   */
  parseFormula(formula, attackValue) {
    // 공백 제거
    const cleanFormula = formula.replace(/\s/g, '');
    
    // attack 값으로 치환
    const withValue = cleanFormula.replace(/attack/g, attackValue);
    
    // 간단한 수식 파싱 (*, +, -, / 지원)
    const match = withValue.match(/^(\d+(?:\.\d+)?)\s*([+\-*/])\s*(\d+(?:\.\d+)?)$/);
    if (match) {
      const [, left, operator, right] = match;
      const leftNum = parseFloat(left);
      const rightNum = parseFloat(right);
      
      switch (operator) {
        case '*': return Math.round(leftNum * rightNum);
        case '/': return Math.round(leftNum / rightNum);
        case '+': return Math.round(leftNum + rightNum);
        case '-': return Math.round(leftNum - rightNum);
        default: return attackValue;
      }
    }
    
    // 단순 숫자인 경우
    const numMatch = withValue.match(/^(\d+(?:\.\d+)?)$/);
    if (numMatch) {
      return Math.round(parseFloat(numMatch[1]));
    }
    
    return attackValue;
  }

  /**
   * 기본 공격 데미지 적용
   */
  applyBasicAttackDamage(player, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    const enemies = this.gameStateManager.enemies;
    const players = this.gameStateManager.players;
    let baseDamage = skillInfo.damage;

    // 어쌔신 은신 보너스 적용
    if (player.jobClass === 'assassin' && player.isStealth) {
      baseDamage = Math.floor(baseDamage * 2.5); // 은신 중 2.5배 데미지
    }

    // 직업별 기본 공격 처리
    switch (player.jobClass) {
      case 'slime':
      case 'ninja':
      case 'archer':
      case 'mage':
        // 원거리 투사체 공격
        return this.applyRangedBasicAttack(player, baseDamage, x, y, targetX, targetY);
        
      case 'assassin':
        // 어쌔신 근접 공격 (연속 공격)
        const result = this.applyAssassinBasicAttack(player, baseDamage, x, y, targetX, targetY);
        
        // 기본 공격 사용 시 은신 해제
        if (player.isStealth) {
          player.isStealth = false;
        }
        
        return result;
        
      case 'warrior':
      case 'supporter':
      case 'mechanic':
        // 근접 부채꼴 공격
        return this.applyMeleeBasicAttack(player, baseDamage, x, y, targetX, targetY);
        
      default:
        return damageResult;
    }
  }

  /**
   * 원거리 기본 공격 데미지 적용
   */
  applyRangedBasicAttack(player, baseDamage, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    const enemies = this.gameStateManager.enemies;
    const players = this.gameStateManager.players;

    // 투사체 경로 계산
    const angle = Math.atan2(targetY - y, targetX - x);
    const maxDistance = 300; // 투사체 최대 거리
    
    // 직업별 최대 사거리 설정
    let projectileMaxDistance;
    switch (player.jobClass) {
      case 'archer':
        projectileMaxDistance = 400;
        break;
      case 'mage':
        projectileMaxDistance = 350;
        break;
      case 'ninja':
        projectileMaxDistance = 300;
        break;
      case 'slime':
        projectileMaxDistance = 200;
        break;
      default:
        projectileMaxDistance = maxDistance;
    }

    // 투사체의 실제 최종 위치 계산
    const finalX = x + Math.cos(angle) * projectileMaxDistance;
    const finalY = y + Math.sin(angle) * projectileMaxDistance;

    // 투사체 경로상의 충돌 체크 (더 정확한 방법)
    const checkCollision = (targetX, targetY, targetSize) => {
      // 투사체 경로를 여러 점으로 나누어 체크
      const steps = 50;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const projectileX = x + (finalX - x) * t;
        const projectileY = y + (finalY - y) * t;
        
        // 사각형 충돌 감지
        const halfSize = targetSize / 2;
        if (projectileX >= targetX - halfSize && projectileX <= targetX + halfSize &&
            projectileY >= targetY - halfSize && projectileY <= targetY + halfSize) {
          return true;
        }
      }
      return false;
    };

    // 적과의 충돌 체크
    enemies.forEach(enemy => {
      if (enemy.isDead) return;
      
      // 적의 실제 콜라이더 크기 사용 (클라이언트와 동일)
      const enemyColliderSize = enemy.getColliderSize();
      
      if (checkCollision(enemy.x, enemy.y, enemyColliderSize)) {
        const damage = baseDamage;
        enemy.takeDamage(damage);
        damageResult.affectedEnemies.push({
          id: enemy.id,
          damage: damage,
          actualDamage: damage,
          newHp: enemy.hp,
          x: enemy.x,
          y: enemy.y
        });
        damageResult.totalDamage += damage;
      }
    });

    // 다른 플레이어와의 충돌 체크 (적팀인 경우)
    players.forEach(targetPlayer => {
      if (targetPlayer.id === player.id || targetPlayer.team === player.team) return;
      
      // 플레이어의 실제 콜라이더 크기 사용 (클라이언트와 동일)
      const playerColliderSize = targetPlayer.getColliderSize();
      
      if (checkCollision(targetPlayer.x, targetPlayer.y, playerColliderSize)) {
        const damage = baseDamage;
        targetPlayer.takeDamage(damage);
        damageResult.affectedPlayers.push({
          id: targetPlayer.id,
          damage: damage,
          actualDamage: damage,
          newHp: targetPlayer.hp,
          x: targetPlayer.x,
          y: targetPlayer.y
        });
        damageResult.totalDamage += damage;
      }
    });

    // 마법사의 경우 충돌 시 또는 최대 사거리에 도달했을 때 범위 공격 추가
    if (player.jobClass === 'mage') {
      // 충돌이 있었거나 최대 사거리에 도달했을 때 범위 공격 실행
      const hasCollision = damageResult.affectedEnemies.length > 0 || damageResult.affectedPlayers.length > 0;
      const explosionRadius = 60;
      let explosionX, explosionY;
      
      if (hasCollision) {
        // 충돌이 있었으면 충돌 지점에서 범위 공격
        // 충돌한 첫 번째 대상을 기준으로 함
        const firstEnemy = damageResult.affectedEnemies[0];
        const firstPlayer = damageResult.affectedPlayers[0];
        
        if (firstEnemy) {
          explosionX = firstEnemy.x;
          explosionY = firstEnemy.y;
        } else if (firstPlayer) {
          explosionX = firstPlayer.x;
          explosionY = firstPlayer.y;
        } else {
          explosionX = finalX;
          explosionY = finalY;
        }
      } else {
        // 충돌이 없었으면 최대 사거리에서 범위 공격
        explosionX = finalX;
        explosionY = finalY;
      }
      
      // 범위 내 적들에게 데미지 적용 (이미 충돌한 대상 제외)
      enemies.forEach(enemy => {
        if (enemy.isDead) return;
        
        const distance = Math.sqrt((enemy.x - explosionX) ** 2 + (enemy.y - explosionY) ** 2);
        if (distance <= explosionRadius) {
          // 이미 충돌한 대상인지 확인
          const alreadyHit = damageResult.affectedEnemies.some(hit => hit.id === enemy.id);
          if (!alreadyHit) {
            const damage = baseDamage;
            enemy.takeDamage(damage);
            damageResult.affectedEnemies.push({
              id: enemy.id,
              damage: damage,
              actualDamage: damage,
              newHp: enemy.hp,
              x: enemy.x,
              y: enemy.y
            });
            damageResult.totalDamage += damage;
          }
        }
      });
      
      // 범위 내 다른 플레이어들에게 데미지 적용 (적팀만, 이미 충돌한 대상 제외)
      players.forEach(targetPlayer => {
        if (targetPlayer.id === player.id || targetPlayer.team === player.team) return;
        
        const distance = Math.sqrt((targetPlayer.x - explosionX) ** 2 + (targetPlayer.y - explosionY) ** 2);
        if (distance <= explosionRadius) {
          // 이미 충돌한 대상인지 확인
          const alreadyHit = damageResult.affectedPlayers.some(hit => hit.id === targetPlayer.id);
          if (!alreadyHit) {
            const damage = baseDamage;
            targetPlayer.takeDamage(damage);
            damageResult.affectedPlayers.push({
              id: targetPlayer.id,
              damage: damage,
              actualDamage: damage,
              newHp: targetPlayer.hp,
              x: targetPlayer.x,
              y: targetPlayer.y
            });
            damageResult.totalDamage += damage;
          }
        }
      });
    }

    return damageResult;
  }

  /**
   * 어쌔신 기본 공격 데미지 적용 (연속 공격)
   */
  applyAssassinBasicAttack(player, baseDamage, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    const enemies = this.gameStateManager.enemies;
    const players = this.gameStateManager.players;
    const attackRange = 40;
    const angleOffset = Math.PI / 6; // 30도

    // 첫 번째 공격
    const firstAttackResult = this.applyMeleeSweepDamage(player, baseDamage * 0.5, x, y, targetX, targetY, attackRange, angleOffset);
    damageResult.affectedEnemies.push(...firstAttackResult.affectedEnemies);
    damageResult.affectedPlayers.push(...firstAttackResult.affectedPlayers);
    damageResult.totalDamage += firstAttackResult.totalDamage;

    // 두 번째 공격 (즉시 실행)
    const secondAttackResult = this.applyMeleeSweepDamage(player, baseDamage * 0.5, x, y, targetX, targetY, attackRange, angleOffset);
    damageResult.affectedEnemies.push(...secondAttackResult.affectedEnemies);
    damageResult.affectedPlayers.push(...secondAttackResult.affectedPlayers);
    damageResult.totalDamage += secondAttackResult.totalDamage;

    return damageResult;
  }

  /**
   * 근접 기본 공격 데미지 적용
   */
  applyMeleeBasicAttack(player, baseDamage, x, y, targetX, targetY) {
    const attackRanges = {
      'warrior': 60,
      'supporter': 55,
      'mechanic': 50
    };
    
    const attackRange = attackRanges[player.jobClass] || 50;
    const angleOffset = Math.PI / 6; // 30도

    return this.applyMeleeSweepDamage(player, baseDamage, x, y, targetX, targetY, attackRange, angleOffset);
  }

  /**
   * 근접 부채꼴 공격 데미지 적용 (공통 메서드)
   */
  applyMeleeSweepDamage(player, baseDamage, x, y, targetX, targetY, range, angleOffset) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    const enemies = this.gameStateManager.enemies;
    const players = this.gameStateManager.players;

    // 부채꼴 각도 계산
    const angleToTarget = Math.atan2(targetY - y, targetX - x);
    const startAngle = angleToTarget - angleOffset;
    const endAngle = angleToTarget + angleOffset;

    // 적과의 충돌 체크
    enemies.forEach(enemy => {
      if (enemy.isDead) return;
      
      // 적의 콜라이더 크기를 고려한 거리 계산
      const enemyColliderSize = enemy.getColliderSize();
      const distance = Math.sqrt((enemy.x - x) ** 2 + (enemy.y - y) ** 2);
      if (distance <= range + enemyColliderSize / 2) {
        const enemyAngle = Math.atan2(enemy.y - y, enemy.x - x);
        if (this.isAngleInSweepRange(x, y, enemy.x, enemy.y, targetX, targetY, range)) {
          enemy.takeDamage(baseDamage);
          damageResult.affectedEnemies.push({
            id: enemy.id,
            damage: baseDamage,
            actualDamage: baseDamage,
            newHp: enemy.hp
          });
          damageResult.totalDamage += baseDamage;
        }
      }
    });

    // 다른 플레이어와의 충돌 체크 (적팀인 경우)
    players.forEach(targetPlayer => {
      if (targetPlayer.id === player.id || targetPlayer.team === player.team) return;
      
      // 플레이어의 콜라이더 크기를 고려한 거리 계산
      const playerColliderSize = targetPlayer.getColliderSize();
      const distance = Math.sqrt((targetPlayer.x - x) ** 2 + (targetPlayer.y - y) ** 2);
      if (distance <= range + playerColliderSize / 2) {
        if (this.isAngleInSweepRange(x, y, targetPlayer.x, targetPlayer.y, targetX, targetY, range)) {
          targetPlayer.takeDamage(baseDamage);
          damageResult.affectedPlayers.push({
            id: targetPlayer.id,
            damage: baseDamage,
            actualDamage: baseDamage,
            newHp: targetPlayer.hp
          });
          damageResult.totalDamage += baseDamage;
        }
      }
    });

    return damageResult;
  }

  /**
   * 기본 공격 처리
   */
  handleBasicAttack(player, targetX, targetY) {
    // 죽은 플레이어는 기본 공격 불가
    if (player.isDead) {
      return { success: false, error: 'Cannot attack while dead' };
    }

    const now = Date.now();
    
    // 기절 상태에서는 기본 공격 사용 불가
    if (player.isStunned) {
      return { success: false, error: 'Cannot use basic attack while stunned' };
    }
    
    // 기본 공격 쿨다운 체크 (직업별로 다름)
    const cooldowns = {
      'slime': 600,
      'ninja': 500,
      'archer': 500,
      'mage': 800,
      'assassin': 300,
      'warrior': 800,
      'supporter': 700,
      'mechanic': 750
    };
    
    const cooldown = cooldowns[player.jobClass] || 600;
    const lastUsed = player.skillCooldowns['basic_attack'] || 0;
    
    if (now - lastUsed < cooldown) {
      return { success: false, error: 'Basic attack on cooldown' };
    }

    // 기본 공격 쿨다운 설정
    player.skillCooldowns['basic_attack'] = now;
    
    return {
      success: true,
      skillType: 'basic_attack',
      timestamp: now,
      playerId: player.id,
      x: player.x,
      y: player.y,
      targetX,
      targetY,
      skillInfo: {
        range: 0, // 기본 공격은 범위가 없음
        damage: player.attack,
        duration: 0,
        heal: 0
      }
    };
  }

  /**
   * 스킬 데미지 계산 및 적용
   */
  applySkillDamage(player, skillType, skillInfo, x, y, targetX = null, targetY = null) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    // 기본 공격 처리
    if (skillType === 'basic_attack') {
      return this.applyBasicAttackDamage(player, skillInfo, x, y, targetX, targetY);
    }

    // 직업별 스킬 처리
    switch (player.jobClass) {
      case 'warrior':
        return this.applyWarriorSkill(player, skillType, skillInfo, x, y, targetX, targetY);
      case 'slime':
        return this.applySlimeSkill(player, skillType, skillInfo, x, y);
      case 'assassin':
        return this.applyAssassinSkill(player, skillType, skillInfo, x, y, targetX, targetY);
      case 'ninja':
        return this.applyNinjaSkill(player, skillType, skillInfo, x, y, targetX, targetY);
      case 'mage':
        return this.applyMageSkill(player, skillType, skillInfo, x, y, targetX, targetY);
      case 'archer':
        return this.applyArcherSkill(player, skillType, skillInfo, x, y, targetX, targetY);
      case 'supporter':
        return this.applySupporterSkill(player, skillType, skillInfo, x, y, targetX, targetY);
      case 'mechanic':
        return this.applyMechanicSkill(player, skillType, skillInfo, x, y, targetX, targetY);
      default:
        console.log(`Unknown job class for skill: ${player.jobClass}`);
        return damageResult;
    }
  }

  /**
   * 전사 스킬 처리
   */
  applyWarriorSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    const enemies = this.gameStateManager.enemies;
    const players = this.gameStateManager.players;
    const range = skillInfo.range;
    const damage = skillInfo.damage;

    switch (skillType) {
      case 'roar':
        // 울부짖기는 데미지 없음, 버프 효과만
        break;

      case 'sweep':
        // 휩쓸기는 지연 데미지 처리
        const sweepDelay = skillInfo.delay || 1000; // 기본값 1초
        
        console.log(`휩쓸기 스킬 사용! 플레이어: ${player.id}, 지연시간: ${sweepDelay}ms`);
        
        // 지연 시간 후 데미지 적용
        setTimeout(() => {
          console.log(`휩쓸기 지연 데미지 적용! 플레이어: ${player.id}`);
          this.applySweepDamage(player, enemies, players, x, y, targetX, targetY, range, damage, damageResult);
        }, sweepDelay);
        break;

      case 'thrust':
        // 찌르기는 지연 데미지 처리
        const delay = skillInfo.delay || 1500; // 기본값 1.5초
        
        // 지연 시간 후 데미지 적용
        setTimeout(() => {
          console.log(`찌르기 지연 데미지 적용! 플레이어: ${player.id}`);
          this.applyThrustDamage(player, enemies, players, x, y, targetX, targetY, range, damage, damageResult);
        }, delay);
        break;
    }

    return damageResult;
  }

  /**
   * 슬라임 스킬 처리
   */
  applySlimeSkill(player, skillType, skillInfo, x, y) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    if (skillType === 'spread') {
      this.applySpreadDamage(player, x, y, skillInfo.range, skillInfo.damage, damageResult);
    }

    return damageResult;
  }

  /**
   * 어쌔신 스킬 처리
   */
  applyAssassinSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    switch (skillType) {
      case 'stealth':
        // 은신 상태 설정
        player.isStealth = true;
        player.stealthStartTime = Date.now();
        player.stealthDuration = skillInfo.duration || 5000;
        
        // 은신 지속시간 후 자동 해제
        setTimeout(() => {
          if (player.isStealth) {
            player.isStealth = false;
          }
        }, player.stealthDuration);
        break;
      case 'backstab':
        this.applyBackstabDamage(player, x, y, targetX, targetY, skillInfo.damage, damageResult);
        break;
      case 'blade_dance':
        this.applyBladeDanceDamage(player, x, y, skillInfo.range, skillInfo.damage, damageResult);
        break;
    }

    return damageResult;
  }

  /**
   * 닌자 스킬 처리
   */
  applyNinjaSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    switch (skillType) {
      case 'stealth':
        // 은신은 데미지 없음, 상태 효과만
        break;
      case 'triple_throw':
        this.applyTripleThrowDamage(player, x, y, targetX, targetY, skillInfo.damage, damageResult);
        break;
      case 'blink':
        // 점멸은 데미지 없음, 이동 효과만
        break;
    }

    return damageResult;
  }

  /**
   * 마법사 스킬 처리
   */
  applyMageSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    switch (skillType) {
      case 'ice_field':
        this.applyIceFieldDamage(player, x, y, skillInfo.range, skillInfo.damage, damageResult);
        break;
      case 'magic_missile':
        this.applyMagicMissileDamage(player, x, y, targetX, targetY, skillInfo.damage, damageResult);
        break;
      case 'shield':
        // 보호막은 데미지 없음, 방어 효과만
        break;
    }

    return damageResult;
  }

  /**
   * 궁수 스킬 처리
   */
  applyArcherSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    switch (skillType) {
      case 'roll':
        // 구르기는 데미지 없음, 이동 효과만
        break;
      case 'focus':
        // 집중은 데미지 없음, 버프 효과만
        break;
    }

    return damageResult;
  }

  /**
   * 서포터 스킬 처리
   */
  applySupporterSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    switch (skillType) {
      case 'ward':
        // 와드는 데미지 없음, 시야 효과만
        break;
      case 'buff_field':
        // 버프 장판은 데미지 없음, 버프 효과만
        break;
      case 'heal_field':
        // 힐 장판은 데미지 없음, 힐 효과만
        break;
    }

    return damageResult;
  }

  /**
   * 메카닉 스킬 처리
   */
  applyMechanicSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
      affectedEnemies: [],
      affectedPlayers: [],
      totalDamage: 0
    };

    switch (skillType) {
      case 'grab':
        this.applyGrabDamage(player, x, y, targetX, targetY, skillInfo.damage, damageResult);
        break;
      case 'mine':
        // 지뢰는 설치만, 폭발은 별도 처리
        break;
      case 'flask':
        this.applyFlaskDamage(player, x, y, targetX, targetY, skillInfo.damage, damageResult);
        break;
    }

    return damageResult;
  }

  // 공통 데미지 적용 메서드들
  applySweepDamage(player, enemies, players, x, y, targetX, targetY, range, damage, damageResult) {
    console.log(`applySweepDamage 호출됨! 플레이어: ${player.id}, 범위: ${range}, 데미지: ${damage}`);
    
    // JobClasses에서 휩쓸기 스킬의 stunDuration 값 가져오기
    const { getJobInfo } = require('../../shared/JobClasses.js');
    const warriorJobInfo = getJobInfo('warrior');
    const sweepSkill = warriorJobInfo.skills.find(skill => skill.type === 'sweep');
    const stunDuration = sweepSkill ? sweepSkill.stunDuration : 2000; // 기본값 2초
    
    console.log(`기절 지속시간: ${stunDuration}ms`);
    
    // 적들 대상
    enemies.forEach(enemy => {
      if (enemy.isDead) return;
      if (this.isInSweepRange(x, y, enemy.x, enemy.y, targetX, targetY, range)) {
        const actualDamage = damage;
        enemy.takeDamage(actualDamage);
        damageResult.affectedEnemies.push({
          id: enemy.id,
          damage: damage,
          actualDamage: actualDamage,
          x: enemy.x,
          y: enemy.y
        });
        damageResult.totalDamage += actualDamage;
      }
    });

    // 다른 팀 플레이어들 대상
    players.forEach(targetPlayer => {
      if (targetPlayer.id === player.id || targetPlayer.team === player.team || targetPlayer.hp <= 0) return;
      if (this.isInSweepRange(x, y, targetPlayer.x, targetPlayer.y, targetX, targetY, range)) {
        const actualDamage = damage;
        targetPlayer.takeDamage(actualDamage);
        
        // 기절 효과 적용
        console.log(`플레이어 ${targetPlayer.id}에게 기절 효과 적용! 지속시간: ${stunDuration}ms`);
        targetPlayer.startStun(stunDuration);
        
        damageResult.affectedPlayers.push({
          id: targetPlayer.id,
          damage: damage,
          actualDamage: actualDamage,
          x: targetPlayer.x,
          y: targetPlayer.y,
          team: targetPlayer.team,
          isStunned: true,
          stunDuration: stunDuration
        });
        damageResult.totalDamage += actualDamage;
      }
    });
  }

  applyThrustDamage(player, enemies, players, x, y, targetX, targetY, range, damage, damageResult) {
    // 적들 대상
    enemies.forEach(enemy => {
      if (enemy.isDead) return;
      if (this.isInThrustRange(x, y, enemy.x, enemy.y, targetX, targetY, range)) {
        const actualDamage = damage;
        enemy.takeDamage(actualDamage);
        damageResult.affectedEnemies.push({
          id: enemy.id,
          damage: damage,
          actualDamage: actualDamage,
          x: enemy.x,
          y: enemy.y
        });
        damageResult.totalDamage += actualDamage;
      }
    });

    // 다른 팀 플레이어들 대상
    players.forEach(targetPlayer => {
      if (targetPlayer.id === player.id || targetPlayer.team === player.team || targetPlayer.hp <= 0) return;
      if (this.isInThrustRange(x, y, targetPlayer.x, targetPlayer.y, targetX, targetY, range)) {
        const actualDamage = damage;
        targetPlayer.takeDamage(actualDamage);
        damageResult.affectedPlayers.push({
          id: targetPlayer.id,
          damage: damage,
          actualDamage: actualDamage,
          x: targetPlayer.x,
          y: targetPlayer.y,
          team: targetPlayer.team
        });
        damageResult.totalDamage += actualDamage;
      }
    });
  }

  applySpreadDamage(player, x, y, range, damage, damageResult) {
    const enemies = this.gameStateManager.enemies;
    const players = this.gameStateManager.players;

    // 적들 대상
    enemies.forEach(enemy => {
      if (enemy.isDead) return;
      // 적의 콜라이더 크기를 고려한 거리 계산
      const enemyColliderSize = enemy.getColliderSize();
      const distance = Math.sqrt((enemy.x - x) ** 2 + (enemy.y - y) ** 2);
      if (distance <= range + enemyColliderSize / 2) {
        const actualDamage = damage;
        enemy.takeDamage(actualDamage);
        damageResult.affectedEnemies.push({
          id: enemy.id,
          damage: damage,
          actualDamage: actualDamage,
          x: enemy.x,
          y: enemy.y
        });
        damageResult.totalDamage += actualDamage;
      }
    });

    // 다른 팀 플레이어들 대상
    players.forEach(targetPlayer => {
      if (targetPlayer.id === player.id || targetPlayer.team === player.team || targetPlayer.hp <= 0) return;
      // 플레이어의 콜라이더 크기를 고려한 거리 계산
      const playerColliderSize = targetPlayer.getColliderSize();
      const distance = Math.sqrt((targetPlayer.x - x) ** 2 + (targetPlayer.y - y) ** 2);
      if (distance <= range + playerColliderSize / 2) {
        const actualDamage = damage;
        targetPlayer.takeDamage(actualDamage);
        damageResult.affectedPlayers.push({
          id: targetPlayer.id,
          damage: damage,
          actualDamage: actualDamage,
          x: targetPlayer.x,
          y: targetPlayer.y,
          team: targetPlayer.team
        });
        damageResult.totalDamage += actualDamage;
      }
    });
  }

  // 범위 계산 헬퍼 메서드들
  isInSweepRange(centerX, centerY, targetX, targetY, mouseX, mouseY, range) {
    const distance = Math.sqrt((targetX - centerX) ** 2 + (targetY - centerY) ** 2);
    if (distance > range) return false;

    const angleToMouse = Math.atan2(mouseY - centerY, mouseX - centerX);
    const angleToTarget = Math.atan2(targetY - centerY, targetX - centerX);
    
    let angleDiff = Math.abs(angleToMouse - angleToTarget);
    if (angleDiff > Math.PI) {
      angleDiff = 2 * Math.PI - angleDiff;
    }
    
    // JobClasses에서 휩쓸기 스킬의 angleOffset 값 가져오기
    const { getJobInfo } = require('../../shared/JobClasses.js');
    const warriorJobInfo = getJobInfo('warrior');
    const sweepSkill = warriorJobInfo.skills.find(skill => skill.type === 'sweep');
    const angleOffset = sweepSkill ? sweepSkill.angleOffset : Math.PI / 3; // 기본값 60도
    
    return angleDiff <= angleOffset;
  }

  isAngleInSweepRange(centerX, centerY, targetX, targetY, mouseX, mouseY, range) {
    const distance = Math.sqrt((targetX - centerX) ** 2 + (targetY - centerY) ** 2);
    if (distance > range) return false;

    const angleToMouse = Math.atan2(mouseY - centerY, mouseX - centerX);
    const angleToTarget = Math.atan2(targetY - centerY, targetX - centerX);
    
    let angleDiff = Math.abs(angleToMouse - angleToTarget);
    if (angleDiff > Math.PI) {
      angleDiff = 2 * Math.PI - angleDiff;
    }
    
    const angleOffset = Math.PI / 6; // 30도 (부채꼴 각도)
    return angleDiff <= angleOffset;
  }

  isInThrustRange(centerX, centerY, targetX, targetY, mouseX, mouseY, range) {
    const distance = Math.sqrt((targetX - centerX) ** 2 + (targetY - centerY) ** 2);
    if (distance > range) return false;

    const angleToMouse = Math.atan2(mouseY - centerY, mouseX - centerX);
    const angleToTarget = Math.atan2(targetY - centerY, targetX - centerX);
    
    let angleDiff = Math.abs(angleToMouse - angleToTarget);
    if (angleDiff > Math.PI) {
      angleDiff = 2 * Math.PI - angleDiff;
    }
    
    const angleTolerance = Math.PI / 6; // 30도
    return angleDiff <= angleTolerance;
  }

  // 기타 스킬 메서드들 (필요시 구현)
  applyBackstabDamage(player, x, y, targetX, targetY, damage, damageResult) {
    // 백스탭 데미지 로직
  }

  applyBladeDanceDamage(player, x, y, range, damage, damageResult) {
    // 칼춤 데미지 로직
  }

  applyTripleThrowDamage(player, x, y, targetX, targetY, damage, damageResult) {
    // 트리플 스로우 데미지 로직
  }

  applyIceFieldDamage(player, x, y, range, damage, damageResult) {
    // 얼음 장판 데미지 로직
  }

  applyMagicMissileDamage(player, x, y, targetX, targetY, damage, damageResult) {
    // 마법 투사체 데미지 로직
  }

  applyGrabDamage(player, x, y, targetX, targetY, damage, damageResult) {
    // 그랩 데미지 로직
  }

  applyFlaskDamage(player, x, y, targetX, targetY, damage, damageResult) {
    // 플라스크 데미지 로직
  }
}

module.exports = SkillManager; 