import BaseJob from './BaseJob.js';

export default class NinjaJob extends BaseJob {
    constructor(player) {
        super(player);
        
        // 닌자 특성 설정
        this.basicAttackCooldown = 500; // 기본 공격 쿨다운 (0.5초)
        this.lastBasicAttackTime = 0;
        
        // 은신 관련
        this.isStealth = false;
        this.stealthStartTime = 0;
        this.stealthDuration = 8000; // 8초
        
        // 스킬 쿨다운 (Map 사용)
        this.skillCooldowns = new Map();
        this.skillCooldowns.set('stealth', 0);
        this.skillCooldowns.set('triple_throw', 0);
        this.skillCooldowns.set('blink', 0);
        
        console.log('닌자 직업 생성 완료');
    }

    update(delta) {
        // 은신 상태 업데이트
        if (this.isStealth) {
            const currentTime = this.player.scene.time.now;
            if (currentTime - this.stealthStartTime > this.stealthDuration) {
                this.endStealth();
            }
        }
    }

    useSkill(skillType) {
        const currentTime = this.player.scene.time.now;
        
        switch (skillType) {
            case 1: // Q - 은신
                if (this.isSkillAvailable('stealth')) {
                    this.useStealth();
                }
                break;
            case 2: // E - 트리플 스로우
                if (this.isSkillAvailable('triple_throw')) {
                    this.useTripleThrow();
                }
                break;
            case 3: // R - 점멸
                if (this.isSkillAvailable('blink')) {
                    this.useBlink();
                }
                break;
        }
    }

    useStealth() {
        if (this.isStealth) return;
        
        this.isStealth = true;
        this.stealthStartTime = this.player.scene.time.now;
        this.setSkillCooldown('stealth', 12000); // 12초 쿨다운
        
        // 시각적 효과
        this.player.setAlpha(0.3);
        
        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill(1);
        }
        
        console.log('닌자 은신 시작');
    }

    endStealth() {
        if (!this.isStealth) return;
        
        this.isStealth = false;
        this.player.setAlpha(1);
        
        console.log('닌자 은신 종료');
    }

    useTripleThrow() {
        // 스킬 쿨다운 시작
        this.setSkillCooldown('triple_throw', 8000);
        
        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill(2, this.player.x, this.player.y);
        }
    }

    useBlink() {
        // 스킬 쿨다운 시작
        this.setSkillCooldown('blink', 6000);
        
        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill(3, this.player.x, this.player.y);
        }
    }

    getAttackDamage() {
        let damage = this.player.attack;
        
        // 은신 중 공격력 증가
        if (this.isStealth) {
            damage = Math.floor(damage * 2.5);
        }
        
        return damage;
    }

    isStealthed() {
        return this.isStealth;
    }

    getSkillCooldowns() {
        return {
            1: {
                remaining: this.getRemainingCooldown('stealth'),
                max: 12000
            },
            2: {
                remaining: this.getRemainingCooldown('triple_throw'),
                max: 8000
            },
            3: {
                remaining: this.getRemainingCooldown('blink'),
                max: 6000
            }
        };
    }

    destroy() {
        if (this.isStealth) {
            this.endStealth();
        }
        super.destroy();
    }

    // 기본 공격 (마우스 좌클릭) - 원거리 투사체
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

    // 닌자용 투사체 생성
    createProjectile(targetX, targetY) {
        // 투사체 생성 (보라색 빛나는 점)
        const projectile = this.player.scene.add.circle(this.player.x, this.player.y, 4, 0x800080, 1);
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
        
        // 빛나는 효과 추가
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
        
        console.log('닌자 표창 투사체 생성');
        
        // 투사체와 적 충돌 체크
        this.player.scene.physics.add.overlap(projectile, this.player.scene.enemies, (projectile, enemy) => {
            console.log('닌자 기본 공격 투사체가 적과 충돌');
            if (projectile && projectile.active) {
                // 적 충돌 시 폭발 이펙트 생성
                this.createShurikenExplosion(projectile.x, projectile.y);
                projectile.destroyProjectile();
            }
        });
        
        // 투사체와 벽 충돌 체크
        this.player.scene.physics.add.collider(projectile, this.player.scene.walls, (projectile, wall) => {
            console.log('닌자 투사체가 벽과 충돌!');
            if (projectile && projectile.active) {
                // 벽 충돌 시 폭발 이펙트 생성
                this.createShurikenExplosion(projectile.x, projectile.y);
                projectile.destroyProjectile();
            }
        });
        
        // 다른 플레이어와의 충돌 (적팀만)
        this.player.scene.physics.add.overlap(projectile, this.player.scene.otherPlayers, (projectile, otherPlayer) => {
            if (otherPlayer && otherPlayer.team !== this.player.team) {
                console.log('닌자 투사체가 다른 팀 플레이어와 충돌!');
                if (projectile && projectile.active) {
                    // 다른 플레이어 충돌 시 폭발 이펙트 생성
                    this.createShurikenExplosion(projectile.x, projectile.y);
                    projectile.destroyProjectile();
                }
            }
        });
        
        return projectile;
    }

    /**
     * 표창 폭발 이펙트 생성
     */
    createShurikenExplosion(x, y) {
        const explosion = this.player.scene.add.circle(x, y, 20, 0x800080, 0.8);
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


} 