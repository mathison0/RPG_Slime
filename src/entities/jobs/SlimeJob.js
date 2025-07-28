import BaseJob from './BaseJob.js';
// JobClasses functions available via window.JobClassesModule
const { getJobInfo } = window.JobClassesModule;

/**
 * 슬라임 직업 클래스
 */
export default class SlimeJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('slime');
    }

    useSkill(skillNumber, options = {}) {
        switch (skillNumber) {
            case 1:
                this.useSpreadSkill();
                break;
            default:
                console.log('SlimeJob: 알 수 없는 스킬 번호:', skillNumber);
        }
    }

    /**
     * 슬라임 퍼지기 스킬
     */
    useSpreadSkill() {
        const skillKey = 'spread';
        
        // 다른 플레이어면 실행하지 않음
        if (this.player.isOtherPlayer) {
            return;
        }

        // 점프 중이면 실행하지 않음
        if (this.player.isJumping) {
            return;
        }

        // 네트워크 매니저가 없으면 실행하지 않음
        if (!this.player.networkManager) {
            console.log('NetworkManager가 없어서 스킬을 사용할 수 없습니다.');
            return;
        }

        // 서버에 스킬 사용 요청
        this.player.networkManager.useSkill('spread');
        
        console.log('슬라임 퍼지기 서버 요청 전송');
    }

    /**
     * 쿨타임 정보 반환
     */
    getSkillCooldowns() {
        return {
            1: {
                remaining: this.getRemainingCooldown('spread'),
                max: this.jobInfo.skills[0].cooldown
            }
        };
    }
} 