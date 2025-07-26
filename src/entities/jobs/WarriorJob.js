import BaseJob from './BaseJob.js';
import { getJobInfo } from '../../data/JobClasses.js';

/**
 * 전사 직업 클래스
 */
export default class WarriorJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('warrior');
        
        // 돌진 관련 상태
        this.isCharging = false;
    }

    useSkill(skillNumber, options = {}) {
        switch (skillNumber) {
            case 1:
                this.useCharge();
                break;
            default:
                console.log('WarriorJob: 알 수 없는 스킬 번호:', skillNumber);
        }
    }

    /**
     * 돌진 스킬
     */
    useCharge() {
        const skillKey = 'charge';
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
        // 이미 돌진 중이거나 다른 플레이어면 실행하지 않음
        if (this.isCharging || this.player.isOtherPlayer || this.player.isJumping) {
            return;
        }
        
        const skillInfo = this.jobInfo.skills[0]; // 돌진 스킬
        
        // 쿨타임 설정
        this.setSkillCooldown(skillKey, skillInfo.cooldown);
        
        // 돌진 방향 설정 (현재 바라보는 방향)
        let chargeX = 0;
        let chargeY = 0;
        
        switch (this.player.direction) {
            case 'front':
                chargeY = skillInfo.range;
                break;
            case 'back':
                chargeY = -skillInfo.range;
                break;
            case 'left':
                chargeX = -skillInfo.range;
                break;
            case 'right':
                chargeX = skillInfo.range;
                break;
        }
        
        const targetX = this.player.x + chargeX;
        const targetY = this.player.y + chargeY;
        
        // 돌진 상태 활성화
        this.isCharging = true;
        this.player.setVelocity(0);
        
        // 돌진 시각적 효과
        this.player.setTint(0xff0000);
        
        // 돌진 애니메이션
        this.scene.tweens.add({
            targets: this.player,
            x: targetX,
            y: targetY,
            duration: 300,
            ease: 'Power2',
            onUpdate: () => {
                // 돌진 중 적과의 충돌 체크
                this.checkChargeCollision();
            },
            onComplete: () => {
                this.endCharge();
            }
        });
        
        // 돌진 효과 메시지
        const chargeText = this.scene.add.text(
            this.player.x, 
            this.player.y - 60, 
            '돌진!', 
            {
                fontSize: '16px',
                fill: '#ff0000'
            }
        ).setOrigin(0.5);
        
        this.scene.time.delayedCall(1000, () => {
            if (chargeText.active) {
                chargeText.destroy();
            }
        });

        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('charge', {
                direction: this.player.direction,
                targetX: targetX,
                targetY: targetY
            });
        }

        console.log(`돌진 발동! 방향: ${this.player.direction}, 목표: (${targetX}, ${targetY})`);
    }

    /**
     * 돌진 중 적과의 충돌 체크
     */
    checkChargeCollision() {
        if (!this.isCharging) return;
        
        const skillInfo = this.jobInfo.skills[0];
        const damage = this.calculateDamage(skillInfo.damage);
        
        // 근처 적들과의 충돌 체크
        this.scene.enemies.getChildren().forEach(enemy => {
            if (!enemy.isDead) {
                const distance = Phaser.Math.Distance.Between(
                    this.player.x, this.player.y, 
                    enemy.x, enemy.y
                );
                
                // 돌진 범위 내에 있으면 데미지 적용
                if (distance <= 30) { // 돌진 충돌 범위
                    enemy.takeDamage(damage);
                    
                    // 적을 밀어내는 효과
                    const angle = Phaser.Math.Angle.Between(
                        this.player.x, this.player.y, 
                        enemy.x, enemy.y
                    );
                    const knockbackDistance = 50;
                    
                    this.scene.tweens.add({
                        targets: enemy,
                        x: enemy.x + Math.cos(angle) * knockbackDistance,
                        y: enemy.y + Math.sin(angle) * knockbackDistance,
                        duration: 200,
                        ease: 'Power2'
                    });
                    
                    console.log(`돌진으로 적에게 ${damage} 데미지!`);
                }
            }
        });
    }

    /**
     * 돌진 종료
     */
    endCharge() {
        this.isCharging = false;
        this.player.clearTint();
        this.player.updateJobSprite(); // 원래 색상으로 복원
        
        console.log('돌진 종료');
    }

    /**
     * 업데이트
     */
    update(delta) {
        super.update(delta);
        // 돌진 관련 추가 로직이 필요하면 여기에
    }

    /**
     * 돌진 상태 확인
     */
    isChargingState() {
        return this.isCharging;
    }

    /**
     * 쿨타임 정보 반환
     */
    getSkillCooldowns() {
        return {
            1: {
                remaining: this.getRemainingCooldown('charge'),
                max: this.jobInfo.skills[0].cooldown
            }
        };
    }

    /**
     * 정리 작업
     */
    destroy() {
        super.destroy();
        if (this.isCharging) {
            this.endCharge();
        }
    }
} 