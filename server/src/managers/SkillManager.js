const { getSkillInfo } = require('../../../shared/JobClasses.js');

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
          range: player.calculateSkillRange(skillType, skillInfo.range),
          damage: player.calculateSkillDamage(skillType, skillInfo.damage),
          duration: duration,
          heal: skillInfo.heal || 0
        }
      });
    }
    
    return {
      success: true,
      skillType,
      timestamp: now,
      playerId: player.id,
      x: player.x,
      y: player.y,
      targetX,
      targetY,
      skillInfo: {
        range: player.calculateSkillRange(skillType, skillInfo.range),
        damage: player.calculateSkillDamage(skillType, skillInfo.damage),
        duration: duration,
        heal: skillInfo.heal || 0
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
        this.applySweepDamage(player, enemies, players, x, y, targetX, targetY, range, damage, damageResult);
        break;

      case 'thrust':
        this.applyThrustDamage(player, enemies, players, x, y, targetX, targetY, range, damage, damageResult);
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
        // 은신은 데미지 없음, 상태 효과만
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
    // 적들 대상
    enemies.forEach(enemy => {
      if (enemy.isDead) return;
      if (this.isInSweepRange(x, y, enemy.x, enemy.y, targetX, targetY, range)) {
        const actualDamage = Math.max(1, damage - enemy.defense);
        enemy.takeDamage(damage);
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
        const actualDamage = Math.max(1, damage - targetPlayer.defense);
        targetPlayer.takeDamage(damage);
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

  applyThrustDamage(player, enemies, players, x, y, targetX, targetY, range, damage, damageResult) {
    // 적들 대상
    enemies.forEach(enemy => {
      if (enemy.isDead) return;
      if (this.isInThrustRange(x, y, enemy.x, enemy.y, targetX, targetY, range)) {
        const actualDamage = Math.max(1, damage - enemy.defense);
        enemy.takeDamage(damage);
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
        const actualDamage = Math.max(1, damage - targetPlayer.defense);
        targetPlayer.takeDamage(damage);
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
      const distance = Math.sqrt((enemy.x - x) ** 2 + (enemy.y - y) ** 2);
      if (distance <= range) {
        const actualDamage = Math.max(1, damage - enemy.defense);
        enemy.takeDamage(damage);
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
      const distance = Math.sqrt((targetPlayer.x - x) ** 2 + (targetPlayer.y - y) ** 2);
      if (distance <= range) {
        const actualDamage = Math.max(1, damage - targetPlayer.defense);
        targetPlayer.takeDamage(damage);
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
    
    const angleOffset = Math.PI / 3; // 60도
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