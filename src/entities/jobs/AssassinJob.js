import BaseJob from './BaseJob.js';
import { getJobInfo } from '../../data/JobClasses.js';

/**
 * 어쌔신/닌자 직업 클래스
 */
export default class AssassinJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo(player.jobClass);
        
        // 은신 관련 상태
        this.isStealth = false;
        this.stealthDuration = 0;
        this.stealthBonusDamage = 0;
    }

    useSkill(skillNumber, options = {}) {
        switch (skillNumber) {
            case 1:
                this.useStealth();
                break;
            default:
                console.log('AssassinJob: 알 수 없는 스킬 번호:', skillNumber);
        }
    }

    /**
     * 은신 스킬
     */
    useStealth() {
        const skillKey = 'stealth';
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
        const skillInfo = this.jobInfo.skills[0]; // 은신 스킬
        
        // 쿨타임 설정
        this.setSkillCooldown(skillKey, skillInfo.cooldown);
        
        // 은신 상태 활성화
        this.isStealth = true;
        this.stealthDuration = skillInfo.duration;
        this.stealthBonusDamage = skillInfo.damage;
        
        // 시각적 효과
        this.player.setAlpha(0.3);
        this.player.setTint(0x888888);
        
        // 은신 효과 메시지
        const stealthText = this.scene.add.text(
            this.player.x, 
            this.player.y - 60, 
            '은신!', 
            {
                fontSize: '16px',
                fill: '#800080'
            }
        ).setOrigin(0.5);
        
        this.scene.time.delayedCall(1000, () => {
            if (stealthText.active) {
                stealthText.destroy();
            }
        });

        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('stealth');
        }

        console.log(`은신 발동! 지속시간: ${skillInfo.duration}ms, 추가 데미지: ${skillInfo.damage}`);
    }

    /**
     * 은신 상태 업데이트
     */
    update(delta) {
        super.update(delta);
        
        if (this.isStealth) {
            this.stealthDuration -= delta;
            if (this.stealthDuration <= 0) {
                this.endStealth();
            }
        }
    }

    /**
     * 은신 종료
     */
    endStealth() {
        this.isStealth = false;
        this.stealthBonusDamage = 0;
        this.player.setAlpha(1);
        this.player.updateJobSprite(); // 원래 색상으로 복원
        
        console.log('은신 종료');
    }

    /**
     * 공격 데미지 계산 (은신 보너스 포함)
     */
    getAttackDamage() {
        let damage = this.player.attack;
        if (this.isStealth && this.stealthBonusDamage > 0) {
            damage += this.stealthBonusDamage;
            this.stealthBonusDamage = 0; // 한 번만 적용
            this.endStealth(); // 공격 후 은신 해제
        }
        return damage;
    }

    /**
     * 은신 상태 확인
     */
    isStealthed() {
        return this.isStealth;
    }

    /**
     * 쿨타임 정보 반환
     */
    getSkillCooldowns() {
        return {
            1: {
                remaining: this.getRemainingCooldown('stealth'),
                max: this.jobInfo.skills[0].cooldown
            }
        };
    }

    /**
     * 정리 작업
     */
    destroy() {
        super.destroy();
        if (this.isStealth) {
            this.endStealth();
        }
    }
} 