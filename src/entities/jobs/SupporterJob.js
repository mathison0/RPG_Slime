import BaseJob from './BaseJob.js';

/**
 * 서포터 직업 클래스
 */
export default class SupporterJob extends BaseJob {
    constructor(player) {
        super(player);
        this.lastBasicAttackTime = 0;
        this.basicAttackCooldown = 700; // 기본 공격 쿨다운 (밀리초)
    }

    useSkill(skillNumber, options = {}) {
        // 서포터의 스킬들을 여기에 추가
        console.log('SupporterJob: 스킬 사용 요청', skillNumber);
    }

    /**
     * 서포터 기본 공격 애니메이션 (근접 부채꼴)
     */
    showBasicAttackEffect(targetX, targetY) {
        // 부채꼴 공격 범위 설정
        const attackRange = 55;
        const angleOffset = Math.PI / 6; // 30도 (π/6)
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = this.player.x;
        const centerY = this.player.y;
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
        // 부채꼴의 시작과 끝 각도 계산
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        // 부채꼴 근접 공격 이펙트 (노란색 부채꼴)
        const graphics = this.player.scene.add.graphics();
        graphics.fillStyle(0xFFFF00, 0.6);
        graphics.lineStyle(2, 0xFFFF00, 1);
        
        // 부채꼴 그리기
        graphics.beginPath();
        graphics.moveTo(centerX, centerY);
        graphics.arc(centerX, centerY, attackRange, startAngle, endAngle);
        graphics.closePath();
        graphics.fill();
        graphics.stroke();
        
        // 이펙트 애니메이션
        this.player.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 350,
            onComplete: () => {
                graphics.destroy();
            }
        });
    }
} 