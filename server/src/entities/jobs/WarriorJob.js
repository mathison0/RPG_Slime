const BaseJob = require('./BaseJob');
const { getJobInfo } = require('../../../shared/JobClasses');

/**
 * 서버용 전사 직업 클래스
 */
class WarriorJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('warrior');
        this.basicAttackCooldown = 800; // 기본 공격 쿨다운 (밀리초)
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
            case 'roar':
                return this.useRoar(options);
            case 'sweep':
                return this.useSweep(options);
            case 'thrust':
                return this.useThrust(options);
            default:
                console.log('WarriorJob: 알 수 없는 스킬 타입:', skillType);
                return { success: false, reason: 'Unknown skill type' };
        }
    }

    /**
     * 울부짖기 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useRoar(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('roar')) {
            return { 
                success: false, 
                reason: 'cooldown',
                remainingCooldown: this.getRemainingCooldown('roar')
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('roar');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('roar');

        // 울부짖기는 데미지 없이 범위 내 적들에게 위협 효과 (여기서는 로그만)
        const range = skillInfo.range;
        const affectedTargets = [];

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
                        affectedTargets.push({
                            playerId: targetPlayer.id,
                            effect: 'intimidate'
                        });
                    }
                }
            });
        }

        console.log(`전사 울부짖기 발동! 범위: ${range}, 적중: ${affectedTargets.length}명`);

        return {
            success: true,
            skillType: 'roar',
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
     * 휩쓸기 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useSweep(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('sweep')) {
            return { 
                success: false, 
                reason: 'cooldown',
                remainingCooldown: this.getRemainingCooldown('sweep')
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('sweep');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('sweep');

        // 부채꼴 범위 공격
        const damage = this.calculateDamage(skillInfo.damage);
        const range = skillInfo.range;
        const affectedTargets = [];

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
                        // 부채꼴 범위 내 체크 (간단화: 일단 원형으로 처리)
                        const actualDamage = Math.max(1, damage - (targetPlayer.defense || 0));
                        targetPlayer.hp = Math.max(0, targetPlayer.hp - actualDamage);
                        
                        affectedTargets.push({
                            playerId: targetPlayer.id,
                            damage: actualDamage,
                            newHp: targetPlayer.hp,
                            isDead: targetPlayer.hp <= 0,
                            effect: 'stun' // 기절 효과
                        });
                        
                        // 사망 처리
                        if (targetPlayer.hp <= 0) {
                            targetPlayer.isDead = true;
                            targetPlayer.lastDamageSource = this.player.id;
                        }
                    }
                }
            });
        }

        console.log(`전사 휩쓸기 발동! 데미지: ${damage}, 범위: ${range}, 적중: ${affectedTargets.length}명`);

        return {
            success: true,
            skillType: 'sweep',
            damage: damage,
            range: range,
            affectedTargets: affectedTargets,
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y,
                direction: this.player.direction
            }
        };
    }

    /**
     * 찌르기 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useThrust(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('thrust')) {
            return { 
                success: false, 
                reason: 'cooldown',
                remainingCooldown: this.getRemainingCooldown('thrust')
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('thrust');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('thrust');

        // 직사각형 범위 공격
        const damage = this.calculateDamage(skillInfo.damage);
        const range = skillInfo.range;
        const affectedTargets = [];

        if (options.gameStateManager) {
            const otherPlayers = options.gameStateManager.getAllPlayers();
            
            otherPlayers.forEach(targetPlayer => {
                if (targetPlayer.id !== this.player.id && 
                    targetPlayer.team !== this.player.team && 
                    !targetPlayer.isDead) {
                    
                    // 직사각형 범위 체크 (간단화: 플레이어 방향으로 직선 거리로 처리)
                    const distance = this.calculateDistance(
                        this.player.x, this.player.y,
                        targetPlayer.x, targetPlayer.y
                    );
                    
                    if (distance <= range) {
                        const actualDamage = Math.max(1, damage - (targetPlayer.defense || 0));
                        targetPlayer.hp = Math.max(0, targetPlayer.hp - actualDamage);
                        
                        affectedTargets.push({
                            playerId: targetPlayer.id,
                            damage: actualDamage,
                            newHp: targetPlayer.hp,
                            isDead: targetPlayer.hp <= 0
                        });
                        
                        // 사망 처리
                        if (targetPlayer.hp <= 0) {
                            targetPlayer.isDead = true;
                            targetPlayer.lastDamageSource = this.player.id;
                        }
                    }
                }
            });
        }

        console.log(`전사 찌르기 발동! 데미지: ${damage}, 범위: ${range}, 적중: ${affectedTargets.length}명`);

        return {
            success: true,
            skillType: 'thrust',
            damage: damage,
            range: range,
            affectedTargets: affectedTargets,
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y,
                direction: this.player.direction
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

        const damage = this.player.attack;
        const range = 80; // 전사의 근접 공격 범위

        console.log(`전사 기본 공격 발동! 데미지: ${damage}, 범위: ${range}`);

        return {
            success: true,
            attackType: 'basic',
            damage: damage,
            range: range,
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }
}

module.exports = WarriorJob; 