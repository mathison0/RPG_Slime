import BaseJob from './BaseJob.js';

export default class ArcherJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobClass = 'archer';
        this.lastBasicAttackTime = 0;
        this.basicAttackCooldown = 500; // 기본 공격 쿨다운 (밀리초)
    }

    update(delta) {
        super.update(delta);
    }

    useJump() {
        // 궁수는 기본 점프 사용
        super.useJump();
    }

    useSkill(skillType) {
        switch (skillType) {
            case 1:
                this.useRoll();
                break;
            case 2:
                this.useFocus();
                break;
            default:
                console.warn('알 수 없는 스킬 타입:', skillType);
        }
    }

    useRoll() {
        if (this.isSkillAvailable('skill1')) {
            this.showCooldownMessage('구르기');
            return;
        }

        console.log('궁수 구르기 사용');
        
        // 구르기 방향 계산 (현재 이동 방향)
        const direction = this.player.direction;
        let rollDistance = 100;
        
        let targetX = this.player.x;
        let targetY = this.player.y;
        
        switch (direction) {
            case 'front':
                targetY += rollDistance;
                break;
            case 'back':
                targetY -= rollDistance;
                break;
            case 'left':
                targetX -= rollDistance;
                break;
            case 'right':
                targetX += rollDistance;
                break;
        }

        // 구르기 애니메이션
        this.player.scene.tweens.add({
            targets: this.player,
            x: targetX,
            y: targetY,
            duration: 300,
            ease: 'Power2.easeOut',
            onComplete: () => {
                console.log('구르기 완료');
            }
        });

        // 스킬 쿨다운 시작
        this.startSkillCooldown('roll', 2000);
        
        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill(1, this.player.x, this.player.y, targetX, targetY);
        }
    }

    useFocus() {
        if (this.isSkillAvailable('skill2')) {
            this.showCooldownMessage('궁사의 집중');
            return;
        }

        console.log('궁사의 집중 사용');
        
        // 공격 속도 증가 효과
        this.player.activateSpeedBoost(1.5); // 1.5배 속도 증가
        
        // 5초 후 효과 해제
        this.player.scene.time.delayedCall(5000, () => {
            this.player.deactivateSpeedBoost();
            console.log('궁사의 집중 효과 종료');
        });

        // 스킬 쿨다운 시작
        this.startSkillCooldown('focus', 8000);
        
        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill(2, this.player.x, this.player.y);
        }
    }

    // 기본 공격 (마우스 좌클릭)
    useBasicAttack(targetX, targetY) {
        const currentTime = this.player.scene.time.now;
        if (currentTime - this.lastBasicAttackTime < this.basicAttackCooldown) {
            return false; // 쿨다운 중
        }

        this.lastBasicAttackTime = currentTime;
        
        // 투사체 생성
        this.createProjectile(targetX, targetY);
        
        return true;
    }

    createProjectile(targetX, targetY) {
        // 투사체 생성 (빛나는 점)
        const projectile = this.player.scene.add.circle(this.player.x, this.player.y, 4, 0xFF8C00, 1);
        this.player.scene.physics.add.existing(projectile);
        
        // 투사체 콜라이더 설정
        projectile.body.setCircle(4); // 원형 콜라이더 설정
        projectile.body.setCollideWorldBounds(false); // 월드 경계 충돌 비활성화
        projectile.body.setBounce(0, 0); // 튕김 없음
        projectile.body.setDrag(0, 0); // 저항 없음
        
        // 투사체 이동 (Tween 사용 + 물리 바디 위치 업데이트)
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY);
        const duration = (distance / 300) * 1000; // 300은 투사체 속도
        
        const moveTween = this.player.scene.tweens.add({
            targets: projectile,
            x: targetX,
            y: targetY,
            duration: duration,
            ease: 'Linear',
            onUpdate: () => {
                // 물리 바디 위치를 스프라이트 위치와 동기화
                if (projectile.body) {
                    projectile.body.reset(projectile.x, projectile.y);
                }
            },
            onComplete: () => {
                if (projectile.active) {
                    projectile.destroy();
                }
            }
        });
        
        // 투사체 이펙트 (빛나는 효과)
        const effectTween = this.player.scene.tweens.add({
            targets: projectile,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0.5,
            duration: 200,
            yoyo: true,
            repeat: -1
        });
        
        // 투사체 파괴 함수
        const destroyProjectile = () => {
            if (projectile.active) {
                // 모든 Tween 애니메이션 중지
                moveTween.stop();
                effectTween.stop();
                projectile.destroy();
            }
        };
        
        // 투사체에 파괴 함수 저장
        projectile.destroyProjectile = destroyProjectile;
        
        // 투사체와 적 충돌 체크
        this.player.scene.physics.add.overlap(projectile, this.player.scene.enemies, (projectile, enemy) => {
            console.log('궁수 기본 공격 투사체가 적과 충돌');
            if (projectile && projectile.active) {
                // 적 충돌 시 폭발 이펙트 생성
                this.createArrowExplosion(projectile.x, projectile.y);
                projectile.destroyProjectile();
            }
        });
        
        // 투사체와 벽 충돌 체크
        this.player.scene.physics.add.collider(projectile, this.player.scene.walls, (projectile, wall) => {
            console.log('궁수 투사체가 벽과 충돌!');
            if (projectile && projectile.active) {
                // 벽 충돌 시 폭발 이펙트 생성
                this.createArrowExplosion(projectile.x, projectile.y);
                projectile.destroyProjectile();
            }
        });
        
        // 다른 플레이어와의 충돌 (적팀만)
        this.player.scene.physics.add.overlap(projectile, this.player.scene.otherPlayers, (projectile, otherPlayer) => {
            if (otherPlayer && otherPlayer.team !== this.player.team) {
                console.log('궁수 투사체가 다른 팀 플레이어와 충돌!');
                if (projectile && projectile.active) {
                    // 다른 플레이어 충돌 시 폭발 이펙트 생성
                    this.createArrowExplosion(projectile.x, projectile.y);
                    projectile.destroyProjectile();
                }
            }
        });
    }

    /**
     * 화살 폭발 이펙트 생성
     */
    createArrowExplosion(x, y) {
        const explosion = this.player.scene.add.circle(x, y, 20, 0xFF8C00, 0.8);
        this.player.scene.tweens.add({
            targets: explosion,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                explosion.destroy();
            }
        });
    }



    /**
     * 쿨타임 정보 반환
     */
    getSkillCooldowns() {
        return {
            1: {
                remaining: this.getRemainingCooldown('roll'),
                max: 2000
            },
            2: {
                remaining: this.getRemainingCooldown('focus'),
                max: 8000
            }
        };
    }
} 