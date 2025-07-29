import BaseJob from './BaseJob.js';

/**
 * 닌자 직업 클래스
 */
export default class NinjaJob extends BaseJob {
    constructor(player) {
        super(player);
        this.lastBasicAttackTime = 0;
        this.basicAttackCooldown = 500; // 기본 공격 쿨다운 (밀리초)
    }

    useSkill(skillNumber, options = {}) {
        // 닌자의 스킬들을 여기에 추가
        console.log('NinjaJob: 스킬 사용 요청', skillNumber);
    }

    /**
     * 닌자 기본 공격 애니메이션 (서버에서 받은 이벤트 처리)
     */
    showBasicAttackEffect(targetX, targetY) {
        // 서버에서 투사체를 관리하므로 클라이언트에서는 이펙트만 처리
        console.log('닌자 기본 공격 이펙트 처리');
    }

    /**
     * 표창 폭발 이펙트 생성 (매우 작게)
     */
    createShurikenExplosion(x, y) {
        const explosion = this.player.scene.add.circle(x, y, 5, 0x800080, 0.6);
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