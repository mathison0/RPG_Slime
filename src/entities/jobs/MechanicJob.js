import BaseJob from './BaseJob.js';
// JobClasses functions available via window.JobClassesModule
const { getJobInfo } = window.JobClassesModule;

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
     * 와드 스킬
     */
    useWard() {
        // 다른 플레이어면 실행하지 않음
        if (this.player.isOtherPlayer) {
            return;
        }
        
        // 네트워크 매니저가 없으면 실행하지 않음
        if (!this.player.networkManager) {
            console.log('NetworkManager가 없어서 스킬을 사용할 수 없습니다.');
            return;
        }

        // 서버에 스킬 사용 요청
        this.player.networkManager.useSkill('ward');
        
        console.log('와드 스킬 서버 요청 전송');
    }

    /**
     * 수리 스킬
     */
    useRepair() {
        // 다른 플레이어면 실행하지 않음
        if (this.player.isOtherPlayer) {
            return;
        }
        
        // 네트워크 매니저가 없으면 실행하지 않음
        if (!this.player.networkManager) {
            console.log('NetworkManager가 없어서 스킬을 사용할 수 없습니다.');
            return;
        }

        // 서버에 스킬 사용 요청
        this.player.networkManager.useSkill('repair');
        
        console.log('수리 스킬 서버 요청 전송');
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