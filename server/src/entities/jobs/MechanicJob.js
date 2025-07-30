const BaseJob = require('./BaseJob');
const { getJobInfo } = require('../../../shared/JobClasses');

/**
 * 서버용 메카닉 직업 클래스
 */
class MechanicJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('mechanic');
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
            case 'repair':
                return this.useRepair(options);
            default:
                console.log('MechanicJob: 알 수 없는 스킬 타입:', skillType);
                return { success: false, reason: 'Unknown skill type' };
        }
    }

    /**
     * 기계 수리 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useRepair(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('repair')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        // 체력이 풀이면 사용 불가
        if (this.player.hp >= this.player.maxHp) {
            return { success: false, reason: 'full health' };
        }

        const skillInfo = this.getSkillInfo('repair');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('repair');

        // 체력 회복
        const healAmount = skillInfo.heal || 50;
        
        // gameStateManager를 반드시 사용
        if (!options.gameStateManager) {
            console.error('MechanicJob: gameStateManager가 필요합니다');
            return { success: false, reason: 'gameStateManager required' };
        }

        const healResult = options.gameStateManager.heal(this.player, this.player, healAmount);
        if (!healResult.success) {
            return { success: false, reason: healResult.reason };
        }

        const oldHp = healResult.newHp - healResult.actualHeal;
        const actualHeal = healResult.actualHeal;
        const newHp = healResult.newHp;

        console.log(`메카닉 기계 수리 발동! 회복량: ${actualHeal} (${oldHp} -> ${newHp})`);

        return {
            success: true,
            skillType: 'repair',
            healAmount: actualHeal,
            oldHp: oldHp,
            newHp: newHp,
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
                reason: 'cooldown'
            };
        }

        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        this.lastBasicAttackTime = Date.now();

        // 투사체 정보 계산
        const angle = Math.atan2(targetY - this.player.y, targetX - this.player.x);
        const maxDistance = 280; // 메카닉의 사정거리
        const finalX = this.player.x + Math.cos(angle) * maxDistance;
        const finalY = this.player.y + Math.sin(angle) * maxDistance;
        
        const damage = this.player.attack;

        console.log(`메카닉 기본 공격 발동! 데미지: ${damage}, 각도: ${angle}`);

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
                speed: 200
            },
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }
}

module.exports = MechanicJob; 