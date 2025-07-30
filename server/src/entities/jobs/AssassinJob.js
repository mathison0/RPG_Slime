const BaseJob = require('./BaseJob');
const { getJobInfo } = require('../../../shared/JobClasses');

/**
 * 서버용 어쌔신 직업 클래스
 */
class AssassinJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('assassin');
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
            case 'stealth':
                return this.useStealth(options);
            default:
                console.log('AssassinJob: 알 수 없는 스킬 타입:', skillType);
                return { success: false, reason: 'Unknown skill type' };
        }
    }

    /**
     * 은신 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useStealth(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('stealth')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        // 이미 은신 중이면 사용 불가
        if (this.player.isStealth) {
            return { success: false, reason: 'already stealth' };
        }

        const skillInfo = this.getSkillInfo('stealth');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('stealth');

        // 은신 상태 활성화
        this.player.isStealth = true;
        this.player.stealthStartTime = Date.now();
        this.player.stealthDuration = skillInfo.duration;

        console.log(`어쌔신 은신 발동! 지속시간: ${skillInfo.duration}ms`);

        return {
            success: true,
            skillType: 'stealth',
            duration: skillInfo.duration,
            bonusDamage: skillInfo.damage,
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

        let damage = this.player.attack;
        let wasStealthAttack = false;
        
        // 은신 중이면 보너스 데미지 적용 후 은신 해제
        if (this.player.isStealth) {
            const skillInfo = this.getSkillInfo('stealth');
            if (skillInfo) {
                damage += skillInfo.damage;
            }
            // 공격 후 은신 해제
            this.player.isStealth = false;
            this.player.stealthStartTime = 0;
            this.player.stealthDuration = 0;
            wasStealthAttack = true;
        }

        console.log(`어쌔신 기본 공격 발동! 데미지: ${damage}, 은신 공격: ${wasStealthAttack}`);

        return {
            success: true,
            attackType: 'basic',
            damage: damage,
            wasStealthAttack: wasStealthAttack,
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }

    /**
     * 업데이트 (은신 상태 체크)
     * @param {number} delta - 델타 타임
     */
    update(delta) {
        super.update(delta);
        
        // 은신 지속시간 체크
        if (this.player.isStealth) {
            const now = Date.now();
            if (now - this.player.stealthStartTime >= this.player.stealthDuration) {
                this.player.isStealth = false;
                this.player.stealthStartTime = 0;
                this.player.stealthDuration = 0;
                console.log('어쌔신 은신 자동 해제');
            }
        }
    }
}

module.exports = AssassinJob; 