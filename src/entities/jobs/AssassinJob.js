import BaseJob from './BaseJob.js';
// JobClasses는 서버에서 관리하므로 import 제거

/**
 * 어쌔신/닌자 직업 클래스
 */
export default class AssassinJob extends BaseJob {
    constructor(player) {
        super(player);
        // 직업 정보는 서버에서 받아옴
        
        // 은신 관련 상태
        this.isStealth = false;
        this.stealthDuration = 0;
        this.stealthBonusDamage = 0;
        
        // 기본 공격 관련
        this.lastBasicAttackTime = 0;
        this.basicAttackCooldown = 300; // 기본 공격 쿨다운 (밀리초) - 어쌔신은 빠른 연속 공격
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
        
        // 스킬 정보는 서버에서 처리됨
        
        // 쿨타임은 서버에서 관리됨

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
     * 어쌔신 기본 공격 이펙트 (근접 부채꼴)
     */
    showBasicAttackEffect(targetX, targetY) {
        // 부채꼴 공격 범위 설정
        const attackRange = 40;
        const angleOffset = Math.PI / 6; // 30도 (π/6)
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = this.player.x;
        const centerY = this.player.y;
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
        // 부채꼴의 시작과 끝 각도 계산
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        // 부채꼴 근접 공격 이펙트 (검은색 부채꼴)
        const graphics = this.player.scene.add.graphics();
        graphics.fillStyle(0x000000, 0.7);
        graphics.lineStyle(2, 0x000000, 1);
        
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
            duration: 300,
            onComplete: () => {
                graphics.destroy();
            }
        });
        
        // 두 번째 공격 (150ms 후)
        this.player.scene.time.delayedCall(150, () => {
            const graphics2 = this.player.scene.add.graphics();
            graphics2.fillStyle(0x000000, 0.7);
            graphics2.lineStyle(2, 0x000000, 1);
            
            graphics2.beginPath();
            graphics2.moveTo(centerX, centerY);
            graphics2.arc(centerX, centerY, attackRange, startAngle, endAngle);
            graphics2.closePath();
            graphics2.fill();
            graphics2.stroke();
            
            this.player.scene.tweens.add({
                targets: graphics2,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    graphics2.destroy();
                }
            });
        });
    }

    /**
     * 은신 이펙트
     */
    showStealthEffect(data = null) {
        this.player.setAlpha(0.3);
        this.player.setTint(0x888888);
        
        // 서버에서 받은 지속시간 사용 (기본값 5000ms)
        const skillInfo = data?.skillInfo || {};
        const duration = skillInfo.duration || 5000;
        
        console.log(`은신 스킬 정보 (서버에서 받음): duration=${duration}ms`);
        
        // 은신 효과 메시지
        const stealthText = this.player.scene.add.text(
            this.player.x, 
            this.player.y - 60, 
            '은신!', 
            {
                fontSize: '16px',
                fill: '#800080'
            }
        ).setOrigin(0.5);
        
        this.player.scene.time.delayedCall(1000, () => {
            if (stealthText.active) {
                stealthText.destroy();
            }
        });
        
        this.player.scene.time.delayedCall(duration, () => {
            if (this.player.active) {
                this.player.setAlpha(1);
                this.player.clearTint();
            }
        });
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

    // 기본 공격은 서버에서 처리됩니다. 클라이언트는 이벤트 응답으로만 애니메이션 실행



    // 어쌔신용 근접 공격 (연속 공격)
    useMeleeAttack(targetX, targetY) {
        // 부채꼴 공격 범위 설정
        const attackRange = 40;
        const angleOffset = Math.PI / 6; // 30도 (π/6)
        
        // 마우스 커서 위치 기준으로 부채꼴 공격
        const centerX = this.player.x;
        const centerY = this.player.y;
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
        // 부채꼴의 시작과 끝 각도 계산
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        // 첫 번째 공격
        this.createMeleeAttackEffect(centerX, centerY, startAngle, endAngle, attackRange);
        this.performMeleeAttack(centerX, centerY, startAngle, endAngle, attackRange, 0.5);
        
        // 두 번째 공격 (150ms 후)
        this.player.scene.time.delayedCall(150, () => {
            this.createMeleeAttackEffect(centerX, centerY, startAngle, endAngle, attackRange);
            this.performMeleeAttack(centerX, centerY, startAngle, endAngle, attackRange, 0.5);
        });
        
        return true;
    }

    createMeleeAttackEffect(centerX, centerY, startAngle, endAngle, radius) {
        // 부채꼴 근접 공격 이펙트 (검은색 부채꼴)
        const graphics = this.player.scene.add.graphics();
        graphics.fillStyle(0x000000, 0.7);
        graphics.lineStyle(2, 0x000000, 1);
        
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
            duration: 300,
            onComplete: () => {
                graphics.destroy();
            }
        });
    }

    performMeleeAttack(centerX, centerY, startAngle, endAngle, radius, damageMultiplier = 1.0) {
        // 시각적 효과만 (데미지는 서버에서 처리)
        console.log('어쌔신 부채꼴 근접 공격 이펙트 (데미지는 서버에서 처리)');
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