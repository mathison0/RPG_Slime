import BaseJob from './BaseJob.js';
import { getJobInfo } from '../../../shared/JobClasses.js';

/**
 * 어쌔신/닌자 직업 클래스
 */
export default class AssassinJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo(player.jobClass);
        
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
        const skillKey = 'stealth';
        
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
     * 쿨타임 정보 반환
     */
    getSkillCooldowns() {
        return {
            1: {
                remaining: this.getRemainingCooldown('stealth'),
                max: this.jobInfo.skills[0].cooldown
            }
        };
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

    // 기본 공격 (마우스 좌클릭) - 닌자는 투사체, 어쌔신은 부채꼴 근접 공격
    useBasicAttack(targetX, targetY) {
        const currentTime = this.player.scene.time.now;
        if (currentTime - this.lastBasicAttackTime < this.basicAttackCooldown) {
            return false; // 쿨다운 중
        }

        // 은신 상태에서는 기본 공격 막기 (은신 해제 후 공격하므로)
        if (this.isStealth) {
            return false;
        }

        this.lastBasicAttackTime = currentTime;
        
        // 닌자는 투사체 공격, 어쌔신은 근접 공격
        if (this.player.jobClass === 'ninja') {
            return this.useRangedAttack(targetX, targetY);
        } else {
            return this.useMeleeAttack(targetX, targetY);
        }
    }

    // 닌자용 원거리 투사체 공격
    useRangedAttack(targetX, targetY) {
        this.createProjectile(targetX, targetY);
        this.setupProjectileCollisions();
        return true;
    }

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
        // 적과의 부채꼴 근접 공격
        if (this.player.scene.enemies) {
            this.player.scene.enemies.getChildren().forEach(enemy => {
                if (enemy && !enemy.isDead) {
                    const distance = Phaser.Math.Distance.Between(centerX, centerY, enemy.x, enemy.y);
                    if (distance <= radius) {
                        // 부채꼴 각도 내에 있는지 확인
                        const angleToEnemy = Phaser.Math.Angle.Between(centerX, centerY, enemy.x, enemy.y);
                        if (this.isAngleInRange(angleToEnemy, startAngle, endAngle)) {
                            // 데미지 계산 (은신 보너스 포함)
                            const baseDamage = this.getAttackDamage();
                            const damage = Math.floor(baseDamage * damageMultiplier);
                            enemy.takeDamage(damage);
                            
                            const jobName = this.player.jobClass === 'ninja' ? '닌자' : '어쌔신';
                            console.log(`${jobName} 부채꼴 근접 공격으로 ${damage} 데미지 (${damageMultiplier}배)`);
                        }
                    }
                }
            });
        }

        // 다른 플레이어와의 부채꼴 근접 공격 (적팀인 경우)
        if (this.player.scene.otherPlayers && Array.isArray(this.player.scene.otherPlayers)) {
            this.player.scene.otherPlayers.forEach(otherPlayer => {
                if (otherPlayer && otherPlayer.team !== this.player.team) {
                    const distance = Phaser.Math.Distance.Between(centerX, centerY, otherPlayer.x, otherPlayer.y);
                    if (distance <= radius) {
                        // 부채꼴 각도 내에 있는지 확인
                        const angleToPlayer = Phaser.Math.Angle.Between(centerX, centerY, otherPlayer.x, otherPlayer.y);
                        if (this.isAngleInRange(angleToPlayer, startAngle, endAngle)) {
                            // 데미지 계산 (은신 보너스 포함)
                            const baseDamage = this.getAttackDamage();
                            const damage = Math.floor(baseDamage * damageMultiplier);
                            otherPlayer.takeDamage(damage);
                            
                            const jobName = this.player.jobClass === 'ninja' ? '닌자' : '어쌔신';
                            console.log(`${jobName} 부채꼴 근접 공격으로 ${otherPlayer.nameText?.text || '적'}에게 ${damage} 데미지 (${damageMultiplier}배)`);
                        }
                    }
                }
            });
        }
    }

    // 닌자용 투사체 생성
    createProjectile(targetX, targetY) {
        // 투사체 생성 (보라색 빛나는 점)
        const projectile = this.player.scene.add.circle(this.player.x, this.player.y, 4, 0x800080, 1);
        this.player.scene.physics.add.existing(projectile);
        
        // 투사체 속도 설정
        const speed = 300;
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;
        
        projectile.body.setVelocity(velocityX, velocityY);
        
        // 빛나는 효과 추가
        this.player.scene.tweens.add({
            targets: projectile,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0.5,
            duration: 200,
            yoyo: true,
            repeat: -1
        });
        
        // 투사체 수명 설정 (3초 후 자동 제거)
        this.player.scene.time.delayedCall(3000, () => {
            if (projectile.active) {
                projectile.destroy();
            }
        });
        
        console.log('닌자 표창 투사체 생성');
    }

    // 투사체 충돌 설정
    setupProjectileCollisions() {
        // 벽과의 충돌 처리
        if (this.player.scene.walls) {
            this.player.scene.physics.add.collider(this.player.scene.walls, this.player.scene.physics.world.getChildren().filter(obj => obj.body && obj.body.gameObject && obj.body.gameObject.getData && obj.body.gameObject.getData('type') === 'projectile'), (projectile) => {
                if (projectile.active) {
                    projectile.destroy();
                }
            });
        }
        
        // 적과의 충돌 처리
        if (this.player.scene.enemies) {
            this.player.scene.enemies.getChildren().forEach(enemy => {
                if (enemy && !enemy.isDead) {
                    this.player.scene.physics.add.overlap(enemy, this.player.scene.physics.world.getChildren().filter(obj => obj.body && obj.body.gameObject && obj.body.gameObject.getData && obj.body.gameObject.getData('type') === 'projectile'), (enemy, projectile) => {
                        if (projectile.active) {
                            const damage = this.getAttackDamage();
                            enemy.takeDamage(damage);
                            projectile.destroy();
                            console.log(`닌자 표창으로 ${damage} 데미지`);
                        }
                    });
                }
            });
        }
        
        // 다른 플레이어와의 충돌 처리 (적팀인 경우)
        if (this.player.scene.otherPlayers && Array.isArray(this.player.scene.otherPlayers)) {
            this.player.scene.otherPlayers.forEach(otherPlayer => {
                if (otherPlayer && otherPlayer.team !== this.player.team) {
                    this.player.scene.physics.add.overlap(otherPlayer, this.player.scene.physics.world.getChildren().filter(obj => obj.body && obj.body.gameObject && obj.body.gameObject.getData && obj.body.gameObject.getData('type') === 'projectile'), (otherPlayer, projectile) => {
                        if (projectile.active) {
                            const damage = this.getAttackDamage();
                            otherPlayer.takeDamage(damage);
                            projectile.destroy();
                            console.log(`닌자 표창으로 ${otherPlayer.nameText?.text || '적'}에게 ${damage} 데미지`);
                        }
                    });
                }
            });
        }
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