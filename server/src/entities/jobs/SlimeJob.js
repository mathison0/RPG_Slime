const BaseJob = require('./BaseJob');
const { getJobInfo } = require('../../../shared/JobClasses');

/**
 * 서버용 슬라임 직업 클래스
 */
class SlimeJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('slime');
        this.basicAttackCooldown = this.jobInfo.basicAttackCooldown;
        this.lastBasicAttackTime = 0;
    }

    /**
     * 스킬 사용 (서버에서 처리)
     * @param {string} skillType - 스킬 타입
     * @param {Object} options - 추가 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useSkill(skillType, options = {}) {
        switch (skillType) {
            case 'spread':
                return this.useSpreadSkill(options);
            default:
                console.log('SlimeJob: 알 수 없는 스킬 타입:', skillType);
                return { success: false, reason: 'Unknown skill type' };
        }
    }

    /**
     * 슬라임 퍼지기 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useSpreadSkill(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('spread')) {
            return { 
                success: false, 
                reason: 'cooldown',
                remainingCooldown: this.getRemainingCooldown('spread')
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('spread');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('spread');

        // 범위 내 적들에게 데미지 적용
        const damage = this.calculateDamage(skillInfo.damage);
        const range = skillInfo.range;
        
        const affectedTargets = [];
        
        // 게임 매니저를 통해 다른 플레이어들 확인 (여기서는 옵션으로 전달받는다고 가정)
        if (options.gameStateManager) {
            const otherPlayers = options.gameStateManager.getAllPlayers();
            
            otherPlayers.forEach(targetPlayer => {
                if (targetPlayer.id !== this.player.id && 
                    targetPlayer.team !== this.player.team && 
                    !targetPlayer.isDead) {
                    
                    const distance = this.calculateDistance(
                        this.player.x, this.player.y,
                        targetPlayer.x, targetPlayer.y
                    );
                    
                    if (distance <= range) {
                        // 데미지 적용
                        const actualDamage = Math.max(1, damage);
                        const result = options.gameStateManager.takeDamage(this.player, targetPlayer, actualDamage);
                        
                        if (result.success) {
                            affectedTargets.push({
                                playerId: targetPlayer.id,
                                damage: result.actualDamage,
                                newHp: result.newHp,
                                isDead: result.newHp <= 0
                            });
                        }
                    }
                }
            });
        }

        console.log(`슬라임 퍼지기 발동! 데미지: ${damage}, 범위: ${range}, 적중: ${affectedTargets.length}명`);

        return {
            success: true,
            skillType: 'spread',
            damage: damage,
            range: range,
            duration: skillInfo.duration,
            affectedTargets: affectedTargets,
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }

    /**
     * 기본 공격 사용 가능 여부 확인
     * @returns {boolean} - 사용 가능 여부
     */
    canUseBasicAttack() {
        const now = Date.now();
        return now - this.lastBasicAttackTime >= this.basicAttackCooldown;
    }

    /**
     * 기본 공격 (서버에서 처리)
     * @param {number} targetX - 목표 X 좌표
     * @param {number} targetY - 목표 Y 좌표
     * @param {Object} options - 추가 옵션
     * @returns {Object} - 공격 결과
     */
    useBasicAttack(targetX, targetY, options = {}) {
        if (!this.canUseBasicAttack()) {
            return { 
                success: false, 
                reason: 'cooldown',
                remainingCooldown: this.basicAttackCooldown - (Date.now() - this.lastBasicAttackTime)
            };
        }

        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        this.lastBasicAttackTime = Date.now();

        // 투사체 정보 계산
        const angle = Math.atan2(targetY - this.player.y, targetX - this.player.x);
        const maxDistance = 250; // 최대 사정거리
        const finalX = this.player.x + Math.cos(angle) * maxDistance;
        const finalY = this.player.y + Math.sin(angle) * maxDistance;
        
        const damage = this.player.attack;

        console.log(`슬라임 기본 공격 발동! 데미지: ${damage}, 각도: ${angle}`);

        return {
            success: true,
            attackType: 'basic',
            damage: damage,
            projectile: {
                startX: this.player.x,
                startY: this.player.y,
                endX: finalX,
                endY: finalY,
                angle: angle,
                speed: 250
            },
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }
}

module.exports = SlimeJob; 