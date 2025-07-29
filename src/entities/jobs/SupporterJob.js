import BaseJob from './BaseJob.js';

/**
 * 지원자 직업 클래스
 */
export default class SupporterJob extends BaseJob {
    constructor(player) {
        super(player);
    }

    /**
     * 지원자 기본 공격 이펙트 (녹색 부채꼴)
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
        
        // 지원자 근접 공격 이펙트 (녹색 부채꼴)
        const graphics = this.player.scene.add.graphics();
        graphics.fillStyle(0x00ff00, 0.8); // 녹색
        graphics.lineStyle(3, 0x00ff00, 1);
        
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
            duration: 400,
            onComplete: () => {
                graphics.destroy();
            }
        });
    }

    /**
     * 지원자 스킬 사용
     */
    useSkill(skillNumber, options = {}) {
        if (this.player.isOtherPlayer || !this.player.networkManager) {
            return;
        }
        switch (skillNumber) {
            case 1: // Q키
                this.player.networkManager.useSkill('heal');
                break;
            case 2: // E키
                this.player.networkManager.useSkill('shield', {
                    targetX: this.scene.input.mousePointer.worldX,
                    targetY: this.scene.input.mousePointer.worldY
                });
                break;
            case 3: // R키
                this.player.networkManager.useSkill('blessing', {
                    targetX: this.scene.input.mousePointer.worldX,
                    targetY: this.scene.input.mousePointer.worldY
                });
                break;
            default:
                console.log('SupporterJob: 알 수 없는 스킬 번호:', skillNumber);
        }
    }
}
