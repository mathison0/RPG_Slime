const BaseJob = require('./BaseJob');
const { getJobInfo } = require('../../../shared/JobClasses');

/**
 * 서버용 궁수 직업 클래스
 */
class ArcherJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('archer');
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
            case 'roll':
                return this.useRoll(options);
            case 'focus':
                return this.useFocus(options);
            default:
                console.log('ArcherJob: 알 수 없는 스킬 타입:', skillType);
                return { success: false, reason: 'Unknown skill type' };
        }
    }

    /**
     * 구르기 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useRoll(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('roll')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('roll');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('roll');

        // 구르기 거리 및 방향 계산
        const rollDistance = skillInfo.range || 100;
        const direction = this.player.direction || 'front';
        
        let targetX = this.player.x;
        let targetY = this.player.y;
        
        switch (direction) {
            case 'front':
                targetY += rollDistance;
                break;
            case 'back':
                targetY -= rollDistance;
                break;
            case 'left':
                targetX -= rollDistance;
                break;
            case 'right':
                targetX += rollDistance;
                break;
        }

        // 플레이어 위치 업데이트
        this.player.x = targetX;
        this.player.y = targetY;

        console.log(`궁수 구르기 발동! 이동: (${this.player.x}, ${this.player.y}) -> (${targetX}, ${targetY})`);

        return {
            success: true,
            skillType: 'roll',
            startX: this.player.x,
            startY: this.player.y,
            endX: targetX,
            endY: targetY,
            direction: direction,
            caster: {
                id: this.player.id,
                x: targetX,
                y: targetY
            }
        };
    }

    /**
     * 궁사의 집중 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useFocus(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('focus')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('focus');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('focus');

        // 공격 속도 버프 적용 (서버에서 관리)
        this.player.activeEffects.add('attack_speed_boost');
        
        // 지속시간 후 효과 해제 예약
        setTimeout(() => {
            this.player.activeEffects.delete('attack_speed_boost');
            console.log('궁사의 집중 효과 종료');
        }, skillInfo.duration);

        console.log(`궁사의 집중 발동! 지속시간: ${skillInfo.duration}ms`);

        return {
            success: true,
            skillType: 'focus',
            duration: skillInfo.duration,
            effect: skillInfo.effect,
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
        let cooldown = this.basicAttackCooldown;
        
        // 궁사의 집중 효과 중이면 공격 속도 증가
        if (this.player.activeEffects.has('attack_speed_boost')) {
            cooldown = cooldown * 0.6; // 40% 빨라짐
        }
        
        return now - this.lastBasicAttackTime >= cooldown;
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
        const maxDistance = 300; // 궁수의 사정거리
        const finalX = this.player.x + Math.cos(angle) * maxDistance;
        const finalY = this.player.y + Math.sin(angle) * maxDistance;
        
        const damage = this.player.attack;

        console.log(`궁수 기본 공격 발동! 데미지: ${damage}, 각도: ${angle}`);

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
                speed: 400
            },
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }
}

module.exports = ArcherJob; 