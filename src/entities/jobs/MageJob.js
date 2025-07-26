import BaseJob from './BaseJob.js';
import { getJobInfo } from '../../../shared/JobClasses.js';

/**
 * 마법사 직업 클래스
 */
export default class MageJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobInfo = getJobInfo('mage');
    }

    useSkill(skillNumber, options = {}) {
        switch (skillNumber) {
            case 1:
                this.useWard();
                break;
            case 2:
                this.useIceField();
                break;
            case 3:
                this.useMagicMissile(options);
                break;
            default:
                console.log('MageJob: 알 수 없는 스킬 번호:', skillNumber);
        }
    }

    /**
     * 와드 스킬
     */
    useWard() {
        const skillKey = 'ward';
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
        // 이미 와드가 설치되어 있으면 중복 설치 방지
        if (this.scene.activeWard) {
            this.showCooldownMessage();
            return;
        }
        
        const skillInfo = this.jobInfo.skills[0]; // 와드 스킬
        
        // 쿨타임 설정
        this.setSkillCooldown(skillKey, skillInfo.cooldown);
        
        // 와드 생성
        const ward = this.scene.add.sprite(this.player.x, this.player.y, 'ward');
        ward.setScale(0.02);
        
        // 와드에 물리 바디 추가
        this.scene.physics.add.existing(ward);
        ward.body.setImmovable(true);
        ward.body.setSize(50, 50);
        
        // 와드 체력 시스템
        ward.hp = 40;
        ward.maxHp = 40;
        
        // 와드 정보 저장
        this.scene.activeWard = { 
            x: this.player.x, 
            y: this.player.y, 
            radius: skillInfo.range,
            sprite: ward,
            hp: ward.hp,
            maxHp: ward.maxHp
        };
        
        // 와드 이펙트
        this.scene.tweens.add({
            targets: ward,
            alpha: 0.8,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
        
        // 와드 범위 내 적 탐지
        const wardDetection = this.scene.time.addEvent({
            delay: 1000,
            callback: () => {
                if (!ward.active || ward.hp <= 0) {
                    wardDetection.destroy();
                    return;
                }
                
                try {
                    this.scene.enemies.getChildren().forEach(enemy => {
                        if (enemy && !enemy.isDead) {
                            const distance = Phaser.Math.Distance.Between(ward.x, ward.y, enemy.x, enemy.y);
                            if (distance <= skillInfo.range) {
                                if (!enemy.wardDetected) {
                                    enemy.wardDetected = true;
                                    enemy.setTint(0xff0000);
                                    enemy.setAlpha(0.8);
                                    this.showEnemyOnMinimap(enemy);
                                }
                            } else {
                                if (enemy.wardDetected) {
                                    enemy.clearTint();
                                    enemy.wardDetected = false;
                                    enemy.setAlpha(1.0);
                                    this.hideEnemyFromMinimap(enemy);
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.error('와드 탐지 중 오류:', error);
                    wardDetection.destroy();
                }
            },
            loop: true
        });
        
        // 와드 파괴 함수
        const destroyWard = () => {
            if (ward.active) {
                ward.destroy();
            }
            
            if (wardDetection) {
                wardDetection.destroy();
            }
            
            try {
                this.scene.enemies.getChildren().forEach(enemy => {
                    if (enemy && enemy.wardDetected) {
                        enemy.clearTint();
                        enemy.wardDetected = false;
                        enemy.setAlpha(1.0);
                        this.hideEnemyFromMinimap(enemy);
                    }
                });
            } catch (error) {
                console.error('와드 정리 중 오류:', error);
            }
            
            this.scene.activeWard = null;
        };
        
        ward.destroyWard = destroyWard;
        
        // 와드 설치 후 충돌 설정 업데이트
        this.scene.setupCollisions();

        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('ward');
        }

        console.log('와드 설치 완료!');
    }

    /**
     * 얼음 장판 스킬
     */
    useIceField() {
        const skillKey = 'ice_field';
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
        const skillInfo = this.jobInfo.skills[1]; // 얼음 장판 스킬
        
        // 쿨타임 설정
        this.setSkillCooldown(skillKey, skillInfo.cooldown);
        
        // 얼음 장판 생성
        const iceField = this.scene.add.circle(this.player.x, this.player.y, skillInfo.range, 0x87ceeb, 0.4);
        this.scene.physics.add.existing(iceField);
        iceField.body.setImmovable(true);
        
        // 얼음 장판 이펙트
        this.scene.tweens.add({
            targets: iceField,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 2000,
            yoyo: true,
            repeat: 2
        });
        
        // 범위 내 적들에게 슬로우 효과 적용
        this.scene.enemies.getChildren().forEach(enemy => {
            if (!enemy.isDead) {
                const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                if (distance <= skillInfo.range) {
                    const originalSpeed = enemy.speed || 100;
                    enemy.speed = originalSpeed * 0.5;
                    
                    // 3초 후 속도 복원
                    this.scene.time.delayedCall(3000, () => {
                        if (enemy && !enemy.isDead) {
                            enemy.speed = originalSpeed;
                        }
                    });
                    
                    // 슬로우 시각적 효과
                    enemy.setTint(0x87ceeb);
                    this.scene.time.delayedCall(3000, () => {
                        if (enemy && !enemy.isDead) {
                            enemy.clearTint();
                        }
                    });
                }
            }
        });
        
        // 6초 후 얼음 장판 제거
        this.scene.time.delayedCall(skillInfo.duration, () => {
            iceField.destroy();
        });

        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('ice_field');
        }

        console.log('얼음 장판 생성!');
    }

    /**
     * 마법 투사체 스킬
     */
    useMagicMissile(options = {}) {
        const skillKey = 'magic_missile';
        
        // 쿨타임 체크
        if (!this.isSkillAvailable(skillKey)) {
            this.showCooldownMessage();
            return;
        }
        
        const skillInfo = this.jobInfo.skills[2]; // 마법 투사체 스킬
        
        // 쿨타임 설정
        this.setSkillCooldown(skillKey, skillInfo.cooldown);
        
        // 마우스 커서의 월드 좌표 가져오기
        const pointer = this.scene.input.activePointer;
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        
        // 사거리 제한
        const initialDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
        if (initialDistance > skillInfo.range) {
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
            worldPoint.x = this.player.x + Math.cos(angle) * skillInfo.range;
            worldPoint.y = this.player.y + Math.sin(angle) * skillInfo.range;
        }
        
        // 마법 투사체 생성
        const missile = this.scene.add.circle(this.player.x, this.player.y, 8, 0xff00ff, 1);
        this.scene.physics.add.existing(missile);
        missile.team = this.player.team;
        
        // 투사체 이동
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
        const duration = (distance / 400) * 1000; // 400은 투사체 속도
        
        this.scene.tweens.add({
            targets: missile,
            x: worldPoint.x,
            y: worldPoint.y,
            duration: duration,
            ease: 'Linear',
            onComplete: () => {
                this.createMagicExplosion(worldPoint.x, worldPoint.y);
                missile.destroy();
            }
        });
        
        // 투사체 이펙트
        this.scene.tweens.add({
            targets: missile,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        // 투사체와 적 충돌 체크
        this.scene.physics.add.overlap(missile, this.scene.enemies, (missile, enemy) => {
            if (this.player.networkManager && enemy.networkId) {
                this.player.networkManager.hitEnemy(enemy.networkId);
            }
            
            this.createMagicExplosion(missile.x, missile.y);
            missile.destroy();
        });
        
        // 투사체와 벽 충돌 체크
        this.scene.physics.add.collider(missile, this.scene.walls, (missile, wall) => {
            this.createMagicExplosion(missile.x, missile.y);
            missile.destroy();
        });

        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('magic_missile', {
                startX: this.player.x,
                startY: this.player.y,
                targetX: worldPoint.x,
                targetY: worldPoint.y,
                maxRange: skillInfo.range
            });
        }

        console.log('마법 투사체 발사!');
    }

    /**
     * 마법 폭발 이펙트 생성
     */
    createMagicExplosion(x, y) {
        const explosion = this.scene.add.circle(x, y, 20, 0xff00ff, 0.8);
        this.scene.tweens.add({
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
     * 미니맵에 적 표시
     */
    showEnemyOnMinimap(enemy) {
        if (enemy.minimapIndicator || !this.scene.minimap) return;
        
        const scale = this.scene.minimapScale;
        const offsetX = this.player.x - (this.scene.minimapSize / 2) / scale;
        const offsetY = this.player.y - (this.scene.minimapSize / 2) / scale;
        
        const minimapX = (enemy.x - offsetX) * scale;
        const minimapY = (enemy.y - offsetY) * scale;
        
        const clampedX = Math.max(0, Math.min(this.scene.minimapSize, minimapX));
        const clampedY = Math.max(0, Math.min(this.scene.minimapSize, minimapY));
        
        const minimapEnemy = this.scene.add.circle(
            this.scene.minimap.x + clampedX,
            this.scene.minimap.y + clampedY,
            3,
            0xff0000, 
            1.0
        );
        minimapEnemy.setScrollFactor(0);
        minimapEnemy.setDepth(1004);
        
        enemy.minimapIndicator = minimapEnemy;
        
        this.scene.tweens.add({
            targets: minimapEnemy,
            alpha: 0.3,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }

    /**
     * 미니맵에서 적 표시 제거
     */
    hideEnemyFromMinimap(enemy) {
        if (enemy.minimapIndicator) {
            enemy.minimapIndicator.destroy();
            enemy.minimapIndicator = null;
        }
    }

    /**
     * 쿨타임 정보 반환
     */
    getSkillCooldowns() {
        return {
            1: {
                remaining: this.getRemainingCooldown('ward'),
                max: this.jobInfo.skills[0].cooldown
            },
            2: {
                remaining: this.getRemainingCooldown('ice_field'),
                max: this.jobInfo.skills[1].cooldown
            },
            3: {
                remaining: this.getRemainingCooldown('magic_missile'),
                max: this.jobInfo.skills[2].cooldown
            }
        };
    }
} 