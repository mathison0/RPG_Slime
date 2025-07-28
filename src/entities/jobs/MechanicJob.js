import BaseJob from './BaseJob.js';
import { getJobInfo } from '../../shared/JobClasses.js';

/**
 * 메카닉 직업 클래스
 */
export default class MechanicJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('mechanic');
        this.lastBasicAttackTime = 0;
        this.basicAttackCooldown = 750; // 기본 공격 쿨다운 (밀리초)
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
     * 수리 스킬
     */
    useRepair() {
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
        
        const skillInfo = this.jobInfo.skills[0]; // 수리 스킬
        
        // 쿨타임 설정
        this.setSkillCooldown(skillKey, skillInfo.cooldown);

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

    // 기본 공격 (마우스 좌클릭) - 부채꼴 근접 공격
    useBasicAttack(targetX, targetY) {
        const currentTime = this.player.scene.time.now;
        if (currentTime - this.lastBasicAttackTime < this.basicAttackCooldown) {
            return false; // 쿨다운 중
        }

        this.lastBasicAttackTime = currentTime;
        
        // 부채꼴 공격 범위 설정
        const attackRange = 50;
        const angleOffset = Math.PI / 6; // 30도 (π/6)
        
        // 마우스 커서 위치 기준으로 부채꼴 공격
        const centerX = this.player.x;
        const centerY = this.player.y;
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
        // 부채꼴의 시작과 끝 각도 계산
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        this.createMeleeAttackEffect(centerX, centerY, startAngle, endAngle, attackRange);
        this.performMeleeAttack(centerX, centerY, startAngle, endAngle, attackRange);
        
        return true;
    }

    createMeleeAttackEffect(centerX, centerY, startAngle, endAngle, radius) {
        // 부채꼴 근접 공격 이펙트 (카키색 부채꼴)
        const graphics = this.player.scene.add.graphics();
        graphics.fillStyle(0x556B2F, 0.7);
        graphics.lineStyle(2, 0x556B2F, 1);
        
        // 부채꼴 그리기
        graphics.beginPath();
        graphics.moveTo(centerX, centerY);
        graphics.arc(centerX, centerY, radius, startAngle, endAngle);
        graphics.closePath();
        graphics.fill();
        graphics.stroke();
        
        // 이펙트 애니메이션
        this.player.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 380,
            onComplete: () => {
                graphics.destroy();
            }
        });
    }

    performMeleeAttack(centerX, centerY, startAngle, endAngle, radius) {
        // 시각적 효과만 (데미지는 서버에서 처리)
        console.log('메카닉 부채꼴 근접 공격 이펙트 (데미지는 서버에서 처리)');
    }

    // 각도가 부채꼴 범위 내에 있는지 확인하는 헬퍼 메서드
    isAngleInRange(angle, startAngle, endAngle) {
        // 각도를 0~2π 범위로 정규화
        angle = Phaser.Math.Angle.Normalize(angle);
        startAngle = Phaser.Math.Angle.Normalize(startAngle);
        endAngle = Phaser.Math.Angle.Normalize(endAngle);
        
        // 부채꼴이 0도를 걸치는 경우 처리
        if (startAngle > endAngle) {
            return angle >= startAngle || angle <= endAngle;
        } else {
            return angle >= startAngle && angle <= endAngle;
        }
    }
} 