import BaseJob from './BaseJob.js';

export default class SupporterJob extends BaseJob {
    constructor(player) {
        super(player);
        this.jobClass = 'supporter';
        this.lastBasicAttackTime = 0;
        this.basicAttackCooldown = 700; // 기본 공격 쿨다운 (밀리초)
        
        // 장판 관련
        this.activeFields = [];
    }

    update(delta) {
        super.update(delta);
        
        // 활성 장판들 업데이트
        this.updateActiveFields(delta);
    }

    useJump() {
        // 힐러는 기본 점프 사용
        super.useJump();
    }

    useSkill(skillType) {
        switch (skillType) {
            case 1:
                this.useWard();
                break;
            case 2:
                this.useBuffField();
                break;
            case 3:
                this.useHealField();
                break;
            default:
                console.warn('알 수 없는 스킬 타입:', skillType);
        }
    }

    useWard() {
        if (this.isSkillOnCooldown('ward')) {
            this.showCooldownMessage('와드 설치');
            return;
        }

        console.log('힐러 와드 설치');
        
        // 와드 생성
        const ward = this.player.scene.add.sprite(this.player.x, this.player.y, 'ward');
        ward.setScale(0.02);
        
        // 와드에 물리 바디 추가
        this.player.scene.physics.add.existing(ward);
        ward.body.setImmovable(true);
        ward.body.setSize(50, 50);
        
        // 와드 정보 저장
        const wardData = {
            x: this.player.x,
            y: this.player.y,
            radius: 150,
            sprite: ward,
            duration: 20000,
            remainingTime: 20000,
            type: 'ward'
        };
        
        this.activeFields.push(wardData);
        
        // 와드 이펙트
        this.player.scene.tweens.add({
            targets: ward,
            alpha: 0.8,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
        
        // 스킬 쿨다운 시작
        this.startSkillCooldown('ward', 10000);
        
        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill(1, this.player.x, this.player.y);
        }
    }

    useBuffField() {
        if (this.isSkillOnCooldown('buff_field')) {
            this.showCooldownMessage('버프 장판');
            return;
        }

        console.log('힐러 버프 장판 설치');
        
        // 버프 장판 생성 (노란색 원)
        const buffField = this.player.scene.add.circle(this.player.x, this.player.y, 80, 0xFFFF00, 0.3);
        this.player.scene.physics.add.existing(buffField);
        
        // 장판 정보 저장
        const fieldData = {
            x: this.player.x,
            y: this.player.y,
            radius: 80,
            sprite: buffField,
            duration: 4000,
            remainingTime: 4000,
            type: 'buff_field'
        };
        
        this.activeFields.push(fieldData);
        
        // 장판 이펙트
        this.player.scene.tweens.add({
            targets: buffField,
            alpha: 0.1,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        // 스킬 쿨다운 시작
        this.startSkillCooldown('buff_field', 6000);
        
        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill(2, this.player.x, this.player.y);
        }
    }

    useHealField() {
        if (this.isSkillOnCooldown('heal_field')) {
            this.showCooldownMessage('힐 장판');
            return;
        }

        console.log('힐러 힐 장판 설치');
        
        // 힐 장판 생성 (하늘색 원)
        const healField = this.player.scene.add.circle(this.player.x, this.player.y, 100, 0x87CEEB, 0.4);
        this.player.scene.physics.add.existing(healField);
        
        // 장판 정보 저장
        const fieldData = {
            x: this.player.x,
            y: this.player.y,
            radius: 100,
            sprite: healField,
            duration: 8000,
            remainingTime: 8000,
            type: 'heal_field',
            healAmount: 20
        };
        
        this.activeFields.push(fieldData);
        
        // 장판 이펙트
        this.player.scene.tweens.add({
            targets: healField,
            alpha: 0.2,
            duration: 800,
            yoyo: true,
            repeat: -1
        });
        
        // 스킬 쿨다운 시작
        this.startSkillCooldown('heal_field', 15000);
        
        // 네트워크 동기화
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill(3, this.player.x, this.player.y);
        }
    }

    updateActiveFields(delta) {
        for (let i = this.activeFields.length - 1; i >= 0; i--) {
            const field = this.activeFields[i];
            field.remainingTime -= delta;
            
            if (field.remainingTime <= 0) {
                // 장판 제거
                if (field.sprite && field.sprite.active) {
                    field.sprite.destroy();
                }
                
                // 버프 장판이 사라질 때 버프 효과 정리
                if (field.type === 'buff_field') {
                    const allPlayers = [this.player];
                    if (this.player.scene.otherPlayers && Array.isArray(this.player.scene.otherPlayers)) {
                        this.player.scene.otherPlayers.forEach(otherPlayer => {
                            if (otherPlayer && otherPlayer.team === this.player.team) {
                                allPlayers.push(otherPlayer);
                            }
                        });
                    }
                    
                    allPlayers.forEach(player => {
                        if (player && player.buffFieldActive) {
                            player.buffFieldActive = false;
                            player.deactivateSpeedBoost();
                        }
                    });
                }
                
                this.activeFields.splice(i, 1);
                continue;
            }
            
            // 장판 효과 적용
            this.applyFieldEffects(field);
        }
    }

    applyFieldEffects(field) {
        const playersInRange = [];
        
        // 같은 팀 플레이어들 찾기
        if (this.player.scene.otherPlayers && Array.isArray(this.player.scene.otherPlayers)) {
            this.player.scene.otherPlayers.forEach(otherPlayer => {
                if (otherPlayer && otherPlayer.team === this.player.team) {
                    const distance = Phaser.Math.Distance.Between(field.x, field.y, otherPlayer.x, otherPlayer.y);
                    if (distance <= field.radius) {
                        playersInRange.push(otherPlayer);
                    }
                }
            });
        }
        
        // 본인도 포함
        const distanceToSelf = Phaser.Math.Distance.Between(field.x, field.y, this.player.x, this.player.y);
        if (distanceToSelf <= field.radius) {
            playersInRange.push(this.player);
        }
        
        // 장판 타입별 효과 적용
        switch (field.type) {
            case 'buff_field':
                // 모든 플레이어의 버프 상태 초기화
                const allPlayers = [this.player];
                if (this.player.scene.otherPlayers && Array.isArray(this.player.scene.otherPlayers)) {
                    this.player.scene.otherPlayers.forEach(otherPlayer => {
                        if (otherPlayer && otherPlayer.team === this.player.team) {
                            allPlayers.push(otherPlayer);
                        }
                    });
                }
                
                allPlayers.forEach(player => {
                    const distance = Phaser.Math.Distance.Between(field.x, field.y, player.x, player.y);
                    if (distance <= field.radius) {
                        // 장판 안에 있으면 버프 적용
                        if (!player.buffFieldActive) {
                            player.buffFieldActive = true;
                            player.activateSpeedBoost(1.3); // 1.3배 속도 증가
                        }
                    } else {
                        // 장판 밖에 있으면 버프 해제
                        if (player.buffFieldActive) {
                            player.buffFieldActive = false;
                            player.deactivateSpeedBoost();
                        }
                    }
                });
                break;
                
            case 'heal_field':
                // 1초마다 힐링 (delta가 밀리초 단위이므로 1000으로 나눔)
                if (field.remainingTime % 1000 < 16) { // 약 1초마다
                    playersInRange.forEach(player => {
                        if (player.hp < player.maxHp) {
                            player.hp = Math.min(player.maxHp, player.hp + field.healAmount);
                            player.updateUI();
                            
                            // 힐링 이펙트
                            this.player.scene.effectManager.showMessage(player.x, player.y - 30, `+${field.healAmount}`, { fill: '#00ff00' });
                        }
                    });
                }
                break;
        }
    }

    // 기본 공격 (마우스 좌클릭) - 부채꼴 근접 공격
    useBasicAttack(targetX, targetY) {
        const currentTime = this.player.scene.time.now;
        if (currentTime - this.lastBasicAttackTime < this.basicAttackCooldown) {
            return false; // 쿨다운 중
        }

        // 점프 중에는 기본 공격 막기
        if (this.isJumping) {
            return false;
        }

        this.lastBasicAttackTime = currentTime;
        
        // 부채꼴 공격 범위 설정
        const attackRange = 35;
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
        // 부채꼴 근접 공격 이펙트 (노란색 부채꼴)
        const graphics = this.player.scene.add.graphics();
        graphics.fillStyle(0xFFFF00, 0.6);
        graphics.lineStyle(2, 0xFFFF00, 1);
        
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
            duration: 350,
            onComplete: () => {
                graphics.destroy();
            }
        });
    }

    performMeleeAttack(centerX, centerY, startAngle, endAngle, radius) {
        // 적과의 부채꼴 근접 공격
        if (this.player.scene.enemies) {
            this.player.scene.enemies.getChildren().forEach(enemy => {
                if (enemy && !enemy.isDead) {
                    const distance = Phaser.Math.Distance.Between(centerX, centerY, enemy.x, enemy.y);
                    if (distance <= radius) {
                        // 부채꼴 각도 내에 있는지 확인
                        const angleToEnemy = Phaser.Math.Angle.Between(centerX, centerY, enemy.x, enemy.y);
                        if (this.isAngleInRange(angleToEnemy, startAngle, endAngle)) {
                            // 데미지 계산
                            const damage = this.player.getAttackDamage();
                            enemy.takeDamage(damage);
                            
                            console.log(`힐러 부채꼴 근접 공격으로 ${damage} 데미지`);
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
                            // 데미지 계산
                            const damage = this.player.getAttackDamage();
                            otherPlayer.takeDamage(damage);
                            
                            console.log(`힐러 부채꼴 근접 공격으로 ${otherPlayer.nameText?.text || '적'}에게 ${damage} 데미지`);
                        }
                    }
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

    destroy() {
        super.destroy();
        
        // 활성 장판들 정리
        this.activeFields.forEach(field => {
            if (field.sprite && field.sprite.active) {
                field.sprite.destroy();
            }
        });
        this.activeFields = [];
        
        // 버프 효과 정리
        if (this.player.buffFieldActive) {
            this.player.buffFieldActive = false;
            this.player.deactivateSpeedBoost();
        }
    }

    /**
     * 쿨타임 정보 반환
     */
    getSkillCooldowns() {
        return {
            1: {
                remaining: this.getRemainingCooldown('ward'),
                max: 10000
            },
            2: {
                remaining: this.getRemainingCooldown('buff_field'),
                max: 6000
            },
            3: {
                remaining: this.getRemainingCooldown('heal_field'),
                max: 15000
            }
        };
    }
} 