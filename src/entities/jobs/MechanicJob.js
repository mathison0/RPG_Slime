import BaseJob from './BaseJob.js';
import { getJobInfo } from '../../data/JobClasses.js';

/**
 * 메카닉 직업 클래스
 */
export default class MechanicJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('mechanic');
    }

    useSkill(skillNumber, options = {}) {
        switch (skillNumber) {
            case 1:
                this.useRepair();
                break;
            default:
                console.log('MechanicJob: 알 수 없는 스킬 번호:', skillNumber);
        }
    }

    /**
     * 기계 수리 스킬 (체력 회복)
     */
    useRepair() {
        const skillKey = 'repair';
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
        // 체력이 이미 최대치인지 확인
        if (this.player.hp >= this.player.maxHp) {
            const fullHpText = this.scene.add.text(
                this.player.x, 
                this.player.y - 60, 
                '체력이 가득참!', 
                {
                    fontSize: '16px',
                    fill: '#ffff00'
                }
            ).setOrigin(0.5);
            
            this.scene.time.delayedCall(1000, () => {
                if (fullHpText.active) {
                    fullHpText.destroy();
                }
            });
            return;
        }
        
        const skillInfo = this.jobInfo.skills[0]; // 기계 수리 스킬
        
        // 쿨타임 설정
        this.setSkillCooldown(skillKey, skillInfo.cooldown);
        
        // 체력 회복
        const healAmount = skillInfo.heal;
        const oldHp = this.player.hp;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
        const actualHeal = this.player.hp - oldHp;
        
        // 시각적 효과
        this.player.setTint(0x00ff00); // 초록색 틴트
        
        // 회복 이펙트
        const healEffect = this.scene.add.circle(this.player.x, this.player.y, 30, 0x00ff00, 0.3);
        this.scene.tweens.add({
            targets: healEffect,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                healEffect.destroy();
            }
        });
        
        // 회복량 표시
        const healText = this.scene.add.text(
            this.player.x, 
            this.player.y - 40, 
            `+${actualHeal}`, 
            {
                fontSize: '16px',
                fill: '#00ff00'
            }
        ).setOrigin(0.5);
        
        // 회복 텍스트 애니메이션
        this.scene.tweens.add({
            targets: healText,
            y: healText.y - 30,
            alpha: 0,
            duration: 1000,
            onComplete: () => {
                healText.destroy();
            }
        });
        
        // 스킬 사용 메시지
        const repairText = this.scene.add.text(
            this.player.x, 
            this.player.y - 60, 
            '기계 수리!', 
            {
                fontSize: '16px',
                fill: '#ff6600'
            }
        ).setOrigin(0.5);
        
        this.scene.time.delayedCall(1000, () => {
            if (repairText.active) {
                repairText.destroy();
            }
        });
        
        // 1초 후 틴트 제거
        this.scene.time.delayedCall(1000, () => {
            this.player.clearTint();
            this.player.updateJobSprite();
        });
        
        // UI 업데이트
        this.player.updateUI();

        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('mechanic_repair', {
                healAmount: actualHeal
            });
        }

        console.log(`기계 수리 사용! 회복량: ${actualHeal} (${oldHp} -> ${this.player.hp})`);
    }

    /**
     * 쿨타임 정보 반환
     */
    getSkillCooldowns() {
        return {
            1: {
                remaining: this.getRemainingCooldown('repair'),
                max: this.jobInfo.skills[0].cooldown
            }
        };
    }
} 