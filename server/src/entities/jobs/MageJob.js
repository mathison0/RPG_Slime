const BaseJob = require('./BaseJob');
const { getJobInfo } = require('../../../shared/JobClasses');

/**
 * 서버용 마법사 직업 클래스
 */
class MageJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('mage');
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
            case 'ice_field':
                return this.useIceField(options);
            case 'magic_missile':
                return this.useMagicMissile(options);
            case 'shield':
                return this.useShield(options);
            default:
                console.log('MageJob: 알 수 없는 스킬 타입:', skillType);
                return { success: false, reason: 'Unknown skill type' };
        }
    }

    /**
     * 얼음 장판 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useIceField(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('ice_field')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('ice_field');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정  
        this.setSkillCooldown('ice_field');

        // 목표 위치 계산 (마우스 위치 기준)
        const targetX = options.targetX || this.player.x;
        const targetY = options.targetY || this.player.y;
        
        console.log(`얼음 장판 목표 위치: targetX=${targetX}, targetY=${targetY}, playerX=${this.player.x}, playerY=${this.player.y}`);
        
        // 최대 시전 사거리 적용
        const maxCastRange = skillInfo.maxCastRange || 300;
        const distance = Math.sqrt(
            Math.pow(targetX - this.player.x, 2) + 
            Math.pow(targetY - this.player.y, 2)
        );
        
        let finalX = targetX;
        let finalY = targetY;
        
        if (distance > maxCastRange) {
            const angle = Math.atan2(targetY - this.player.y, targetX - this.player.x);
            finalX = this.player.x + Math.cos(angle) * maxCastRange;
            finalY = this.player.y + Math.sin(angle) * maxCastRange;
            console.log(`최대 사거리 제한 적용: 거리=${distance}, 최대=${maxCastRange}, 최종 위치=(${finalX}, ${finalY})`);
        }

        console.log(`얼음 장판 최종 시전 위치: finalX=${finalX}, finalY=${finalY}`);

        // 얼음 장판 범위 내 적들에게 속도 감소 효과 적용
        const range = skillInfo.range;
        const affectedTargets = [];
        const affectedEnemies = [];

        if (options.gameStateManager) {
            // 다른 팀 플레이어들에게 슬로우 효과 적용
            const otherPlayers = options.gameStateManager.getAllPlayers();
            
            otherPlayers.forEach(targetPlayer => {
                if (targetPlayer.id !== this.player.id && 
                    targetPlayer.team !== this.player.team && 
                    !targetPlayer.isDead) {
                    
                    const distance = this.calculateDistance(
                        finalX, finalY,  // 얼음 장판 위치 기준으로 거리 계산
                        targetPlayer.x, targetPlayer.y
                    );
                    
                    if (distance <= range) {
                        affectedTargets.push({
                            playerId: targetPlayer.id,
                            effect: 'slow'
                        });
                        
                        // 속도 감소 효과 적용
                        targetPlayer.activeEffects.add('slow');
                        
                        // 지속시간 후 효과 해제
                        setTimeout(() => {
                            targetPlayer.activeEffects.delete('slow');
                        }, skillInfo.duration);
                    }
                }
            });
            
            // 몬스터들에게도 슬로우 효과 적용
            if (options.gameStateManager.enemyManager && options.gameStateManager.enemyManager.enemies) {
                options.gameStateManager.enemyManager.enemies.forEach(enemy => {
                    if (enemy.isDead) return;
                    
                    const distance = this.calculateDistance(
                        finalX, finalY,  // 얼음 장판 위치 기준으로 거리 계산
                        enemy.x, enemy.y
                    );
                    
                    if (distance <= range) {
                        affectedEnemies.push({
                            enemyId: enemy.id,
                            effect: 'slow'
                        });
                        
                        // 몬스터에게 슬로우 효과 적용
                        if (!enemy.activeEffects) {
                            enemy.activeEffects = new Set();
                        }
                        enemy.activeEffects.add('slow');
                        enemy.slowStartTime = Date.now();
                        enemy.slowDuration = skillInfo.duration;
                        
                        console.log(`몬스터 ${enemy.id}에게 슬로우 효과 적용: 지속시간=${skillInfo.duration}ms`);
                        
                        // 지속시간 후 효과 해제
                        setTimeout(() => {
                            if (enemy.activeEffects) {
                                enemy.activeEffects.delete('slow');
                            }
                            enemy.slowStartTime = null;
                            enemy.slowDuration = null;
                            console.log(`몬스터 ${enemy.id} 슬로우 효과 해제됨`);
                        }, skillInfo.duration);
                    }
                });
            }
        }

        console.log(`마법사 얼음 장판 발동! 위치: (${finalX}, ${finalY}), 범위: ${range}, 지속시간: ${skillInfo.duration}ms, 플레이어 적중: ${affectedTargets.length}명, 몬스터 적중: ${affectedEnemies.length}마리`);

        // 슬로우 효과가 적용된 몬스터들을 클라이언트에게 알림
        if (affectedEnemies.length > 0 && options.gameStateManager && options.gameStateManager.io) {
            affectedEnemies.forEach(enemyData => {
                options.gameStateManager.io.emit('enemy-slowed', {
                    enemyId: enemyData.enemyId,
                    isSlowed: true,
                    duration: skillInfo.duration
                });
            });
            
            console.log(`몬스터 슬로우 상태 클라이언트에 브로드캐스트: ${affectedEnemies.length}마리`);
            
            // 지속시간 후 슬로우 해제 알림
            setTimeout(() => {
                affectedEnemies.forEach(enemyData => {
                    if (options.gameStateManager && options.gameStateManager.io) {
                        options.gameStateManager.io.emit('enemy-slowed', {
                            enemyId: enemyData.enemyId,
                            isSlowed: false,
                            duration: 0
                        });
                    }
                });
                console.log(`몬스터 슬로우 해제 상태 클라이언트에 브로드캐스트: ${affectedEnemies.length}마리`);
            }, skillInfo.duration);
        }

        return {
            success: true,
            skillType: 'ice_field',
            x: finalX,  // 실제 시전 위치
            y: finalY,  // 실제 시전 위치
            range: range,
            duration: skillInfo.duration,
            effect: skillInfo.effect,
            affectedTargets: affectedTargets,
            affectedEnemies: affectedEnemies,
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }

    /**
     * 마법 투사체 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션 (targetX, targetY 포함)
     * @returns {Object} - 스킬 사용 결과
     */
    useMagicMissile(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('magic_missile')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('magic_missile');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('magic_missile');

        // 투사체 정보 계산
        const targetX = options.targetX || this.player.x;
        const targetY = options.targetY || this.player.y - 100;
        const angle = Math.atan2(targetY - this.player.y, targetX - this.player.x);
        const maxDistance = skillInfo.range;
        const finalX = this.player.x + Math.cos(angle) * maxDistance;
        const finalY = this.player.y + Math.sin(angle) * maxDistance;
        
        const damage = this.calculateDamage(skillInfo.damage);

        console.log(`마법사 마법 투사체 발동! 데미지: ${damage}, 각도: ${angle}, 목표: (${targetX}, ${targetY})`);

        return {
            success: true,
            skillType: 'magic_missile',
            damage: damage,
            range: skillInfo.range,
            explosionRadius: skillInfo.explosionRadius,
            targetX: targetX,
            targetY: targetY,
            projectile: {
                startX: this.player.x,
                startY: this.player.y,
                endX: finalX,
                endY: finalY,
                angle: angle,
                speed: 300
            },
            caster: {
                id: this.player.id,
                x: this.player.x,
                y: this.player.y
            }
        };
    }

    /**
     * 보호막 스킬 (서버에서 처리)
     * @param {Object} options - 스킬 옵션
     * @returns {Object} - 스킬 사용 결과
     */
    useShield(options = {}) {
        // 쿨타임 체크
        if (!this.isSkillAvailable('shield')) {
            return { 
                success: false, 
                reason: 'cooldown'
            };
        }

        // 죽은 상태면 스킬 사용 불가
        if (this.player.isDead) {
            return { success: false, reason: 'dead' };
        }

        const skillInfo = this.getSkillInfo('shield');
        if (!skillInfo) {
            return { success: false, reason: 'skill not found' };
        }

        // 쿨타임 설정
        this.setSkillCooldown('shield');

        // 보호막 효과 적용
        if (!this.player.activeEffects) {
            this.player.activeEffects = new Set();
            console.log(`플레이어 ${this.player.id}: activeEffects 새로 생성`);
        }
        this.player.activeEffects.add('shield');
        this.player.shieldStartTime = Date.now();
        this.player.shieldDuration = skillInfo.duration;

        console.log(`플레이어 ${this.player.id} 보호막 설정 완료: activeEffects.has('shield')=${this.player.activeEffects.has('shield')}, 지속시간=${skillInfo.duration}ms`);

        // 지속시간 후 효과 해제
        setTimeout(() => {
            if (this.player.activeEffects) {
                this.player.activeEffects.delete('shield');
                console.log(`플레이어 ${this.player.id} 보호막 시간 만료로 제거됨`);
            }
            this.player.shieldStartTime = null;
            this.player.shieldDuration = null;
        }, skillInfo.duration);

        console.log(`마법사 보호막 발동! 지속시간: ${skillInfo.duration}ms`);

        return {
            success: true,
            skillType: 'shield',
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
        const maxDistance = 350; // 마법사의 사정거리
        const finalX = this.player.x + Math.cos(angle) * maxDistance;
        const finalY = this.player.y + Math.sin(angle) * maxDistance;
        
        const damage = this.player.attack;

        console.log(`마법사 기본 공격 발동! 데미지: ${damage}, 각도: ${angle}`);

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

module.exports = MageJob; 