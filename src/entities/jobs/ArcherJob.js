import BaseJob from './BaseJob.js';

/**
 * 궁수 직업 클래스
 */
export default class ArcherJob extends BaseJob {
    constructor(player) {
        super(player);
        this.lastBasicAttackTime = 0;
        this.basicAttackCooldown = 500; // 기본 공격 쿨다운 (밀리초)
    }

    useSkill(skillNumber, options = {}) {
        // 궁수는 스킬이 없거나 특별한 스킬이 있으면 여기에 추가
        console.log('ArcherJob: 스킬 사용 요청', skillNumber);
    }

    /**
     * 궁수 기본 공격 애니메이션 (서버에서 받은 이벤트 처리)
     */
    showBasicAttackEffect(targetX, targetY) {
        // 서버에서 투사체를 관리하므로 클라이언트에서는 이펙트만 처리
        console.log('궁수 기본 공격 이펙트 처리');
    }

    /**
     * 화살 폭발 이펙트 생성 (매우 작게)
     */
    createArrowExplosion(x, y) {
        const explosion = this.player.scene.add.circle(x, y, 5, 0xFF8C00, 0.6);
        this.player.scene.tweens.add({
            targets: explosion,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                explosion.destroy();
            }
        });
    }
} 