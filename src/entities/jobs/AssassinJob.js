import BaseJob from './BaseJob.js';
import { getJobInfo } from '../../../shared/JobClasses.js';

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
        const skillKey = 'skill1'; // 통일된 스킬 키 사용
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
        // 다른 플레이어면 실행하지 않음
        if (this.player.isOtherPlayer) {
            return;
        }
        
        // 네트워크 매니저가 없으면 실행하지 않음
        if (!this.player.networkManager) {
            console.log('NetworkManager가 없어서 스킬을 사용할 수 없습니다.');
            return;
        }
        
        const skillInfo = this.jobInfo.skills[0]; // 은신 스킬
        
        // 쿨타임 설정
        this.setSkillCooldown(skillKey, skillInfo.cooldown);

        // 서버에 스킬 사용 요청
        this.player.networkManager.useSkill('stealth');
        
        console.log('은신 스킬 서버 요청 전송');
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
     * 정리 작업
     */
    destroy() {
        super.destroy();
        if (this.isStealth) {
            this.endStealth();
        }
    }
} 