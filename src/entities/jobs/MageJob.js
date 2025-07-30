import BaseJob from './BaseJob.js';

/**
 * 마법사 직업 클래스
 */
export default class MageJob extends BaseJob {
    constructor(player) {
        super(player);
        this.lastBasicAttackTime = 0;
        // 쿨타임은 서버에서 관리됨
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
        const skillKey = 'skill1'; // 통일된 스킬 키 사용

        // 다른 플레이어면 실행하지 않음
        if (this.player.isOtherPlayer) {
            return;
        }
        
        // 네트워크 매니저가 없으면 실행하지 않음
        if (!this.player.networkManager) {
            console.log('NetworkManager가 없어서 스킬을 사용할 수 없습니다.');
            return;
        }

        // 마우스 커서의 월드 좌표 가져오기
        const pointer = this.player.scene.input.activePointer;
        const worldPoint = this.player.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

        // 네트워크 동기화 (서버에 와드 설치 요청만 전송)
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('ward', worldPoint.x, worldPoint.y);
        }

        console.log('와드 설치 요청 전송!');
    }

    /**
     * 얼음 장판 스킬
     */
    useIceField() {
        const skillKey = 'skill2'; // 통일된 스킬 키 사용
        
        // 다른 플레이어면 실행하지 않음
        if (this.player.isOtherPlayer) {
            return;
        }
        
        // 네트워크 매니저가 없으면 실행하지 않음
        if (!this.player.networkManager) {
            console.log('NetworkManager가 없어서 스킬을 사용할 수 없습니다.');
            return;
        }

        // 네트워크 동기화 (서버에 얼음 장판 요청만 전송)
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('ice_field');
        }

        console.log('얼음 장판 요청 전송!');
    }

    /**
     * 마법 투사체 스킬
     */
    useMagicMissile(options = {}) {
        const skillKey = 'skill3'; // 통일된 스킬 키 사용
        
        // 다른 플레이어면 실행하지 않음
        if (this.player.isOtherPlayer) {
            return;
        }
        
        // 네트워크 매니저가 없으면 실행하지 않음
        if (!this.player.networkManager) {
            console.log('NetworkManager가 없어서 스킬을 사용할 수 없습니다.');
            return;
        }
        
        // 마우스 커서의 월드 좌표 가져오기
        const pointer = this.scene.input.activePointer;
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

        // 네트워크 동기화 (서버에 마법 투사체 요청만 전송)
        if (this.player.networkManager && !this.player.isOtherPlayer) {
            this.player.networkManager.useSkill('magic_missile', {
                targetX: worldPoint.x,
                targetY: worldPoint.y
            });
        }

        console.log('마법 투사체 요청 전송!');
    }

    /**
     * 마법사 기본 공격 이펙트 (서버에서 받은 이벤트 처리)
     */
    showBasicAttackEffect(targetX, targetY) {
        // 서버에서 투사체를 관리하므로 클라이언트에서는 이펙트만 처리
        console.log('마법사 기본 공격 이펙트 처리');
    }

    /**
     * 와드 이펙트 (서버에서 스킬 승인 시 호출)
     */
    showWardEffect(data = null) {
        // 서버에서 받은 위치 정보 사용 (기본값: 플레이어 위치)
        const wardX = data?.x || this.player.x;
        const wardY = data?.y || this.player.y;
        
        // 와드 관리 배열 초기화 (없으면 생성)
        if (!this.player.scene.wardList) {
            this.player.scene.wardList = [];
        }
        
        // 다른 플레이어의 와드인지 확인 
        const isOtherPlayer = data?.playerId && data.playerId !== this.player.networkManager?.playerId;
        
        // 내 와드이고 최대 개수(2개)에 도달했다면 가장 오래된 와드 제거
        if (!isOtherPlayer && this.player.scene.wardList.length >= 2) {
            const oldestWard = this.player.scene.wardList.shift(); // 첫 번째 와드 제거
            if (oldestWard && oldestWard.sprite && oldestWard.sprite.active) {
                oldestWard.sprite.destroyWard();
            }
        }
        
        // 와드 생성
        const ward = this.player.scene.add.sprite(wardX, wardY, 'ward');
        
        // 서버에서 받은 크기 정보 사용 (기본값: 0.2)
        const wardScale = data?.wardScale || 0.2;
        const wardBodySize = data?.wardBodySize || 125;
        
        ward.setScale(wardScale);
        
        if (isOtherPlayer) {
            ward.isOtherPlayerWard = true;
            ward.wardOwnerId = data.playerId;
            ward.wardOwnerTeam = data.playerTeam; // 와드 소유자 팀 정보 저장
        }
        
        // 모든 와드는 같은 depth로 설정
        ward.setDepth(1001);
        
        // 와드에 물리 바디 추가
        this.player.scene.physics.add.existing(ward);
        ward.body.setImmovable(true);
        ward.body.setSize(wardBodySize, wardBodySize);
        
        // 와드 체력 시스템
        ward.hp = 40;
        ward.maxHp = 40;
        
        // 서버에서 받은 스킬 정보 사용
        const skillInfo = data?.skillInfo || {};
        const range = skillInfo.range || 120; // 서버에서 받은 범위
        
        console.log(`와드 스킬 정보 (서버에서 받음): range=${range}`);
        
        // 와드 정보 저장
        const wardInfo = { 
            id: data?.wardId || Date.now(),
            x: wardX, 
            y: wardY, 
            radius: range,
            sprite: ward,
            hp: ward.hp,
            maxHp: ward.maxHp,
            ownerId: data?.playerId || this.player.networkId
        };
        
        // 내 와드인 경우에만 리스트에 추가
        if (!isOtherPlayer) {
            this.player.scene.wardList.push(wardInfo);
            // activeWard는 가장 최근 와드로 설정
            this.player.scene.activeWard = wardInfo;
        }
        
        // 와드 범위 표시 (하얀색 반투명 원형, 거의 투명)
        const rangeIndicator = this.player.scene.add.circle(ward.x, ward.y, range, 0xffffff, 0.1);
        rangeIndicator.setDepth(1000);
        
        // 와드와 함께 파괴되도록 설정
        ward.rangeIndicator = rangeIndicator;
        
        // 와드 소유자 정보 설정 (서버에서 받은 설치자 ID 사용)
        ward.ownerId = data?.playerId || this.player.networkId;
        
        // 와드 파괴 함수
        const destroyWard = () => {
            if (ward.active) {
                // 범위 표시도 함께 제거
                if (ward.rangeIndicator) {
                    ward.rangeIndicator.destroy();
                }
                ward.destroy();
            }
            
            // 내 와드인 경우 리스트에서도 제거
            if (!isOtherPlayer && this.player.scene.wardList) {
                const index = this.player.scene.wardList.findIndex(w => w.id === wardInfo.id);
                if (index > -1) {
                    this.player.scene.wardList.splice(index, 1);
                }
                
                // activeWard 업데이트 (가장 최근 와드로)
                if (this.player.scene.wardList.length > 0) {
                    this.player.scene.activeWard = this.player.scene.wardList[this.player.scene.wardList.length - 1];
                } else {
                    this.player.scene.activeWard = null;
                }
            }
        };
        
        ward.destroyWard = destroyWard;
        
        this.player.scene.mapManager.setupCollisions();

        console.log(`와드 설치 완료! (현재 와드 개수: ${this.player.scene.wardList ? this.player.scene.wardList.length : 0})`);
    }

    /**
     * 얼음 장판 이펙트 (서버에서 스킬 승인 시 호출)
     */
    showIceFieldEffect(data = null) {
        // 서버에서 받은 스킬 정보 사용
        const skillInfo = data?.skillInfo || {};
        const range = skillInfo.range || 100; // 서버에서 받은 범위
        const duration = skillInfo.duration || 6000; // 서버에서 받은 지속시간
        
        console.log(`얼음 장판 스킬 정보 (서버에서 받음): range=${range}, duration=${duration}ms`);
        
        // 얼음 장판 생성
        const iceField = this.player.scene.add.circle(this.player.x, this.player.y, range, 0x87ceeb, 0.4);
        this.player.scene.physics.add.existing(iceField);
        iceField.body.setImmovable(true);
        
        // 얼음 장판 이펙트
        this.player.scene.tweens.add({
            targets: iceField,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 2000,
            yoyo: true,
            repeat: 2
        });
        
        // 지속시간 후 얼음 장판 제거
        this.player.scene.time.delayedCall(duration, () => {
            iceField.destroy();
        });

        console.log('얼음 장판 생성 완료!');
    }

    /**
     * 마법 투사체 이펙트 (서버에서 스킬 승인 시 호출)
     */
    showMagicMissileEffect(data = null) {
        if (!data) return;
        
        // 마우스 커서 위치 가져오기 (서버 데이터에서)
        const targetX = data?.targetX || this.player.x;
        const targetY = data?.targetY || this.player.y;
        
        // 서버에서 받은 스킬 정보 사용
        const skillInfo = data?.skillInfo || {};
        const maxRange = skillInfo.range || 400; // 서버에서 받은 사거리
        const velocity = skillInfo.velocity || 400; // 서버에서 받은 속도
        
        console.log(`마법 투사체 스킬 정보 (서버에서 받음): maxRange=${maxRange}, velocity=${velocity}`);
        
        let finalTargetX = targetX;
        let finalTargetY = targetY;
        
        // 사거리 제한
        const initialDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY);
        if (initialDistance > maxRange) {
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
            finalTargetX = this.player.x + Math.cos(angle) * maxRange;
            finalTargetY = this.player.y + Math.sin(angle) * maxRange;
        }
        
        // 마법 투사체 생성
        const missile = this.player.scene.add.circle(this.player.x, this.player.y, 8, 0xff00ff, 1);
        this.player.scene.physics.add.existing(missile);
        missile.team = this.player.team;
        
        // 투사체 이펙트
        this.player.scene.tweens.add({
            targets: missile,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        // 투사체 이동 (물리 바디 위치 업데이트 포함)
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, finalTargetX, finalTargetY);
        const duration = (distance / velocity) * 1000;
        
        this.player.scene.tweens.add({
            targets: missile,
            x: finalTargetX,
            y: finalTargetY,
            duration: duration,
            ease: 'Linear',
            onUpdate: () => {
                // 물리 바디 위치를 스프라이트 위치와 동기화
                if (missile.body) {
                    missile.body.reset(missile.x, missile.y);
                }
            },
            onComplete: () => {
                this.createMagicExplosion(missile.x, missile.y);
                missile.destroy();
            }
        });
        
        // 투사체와 적 충돌 체크
        this.player.scene.physics.add.overlap(missile, this.player.scene.enemies, (missile, enemy) => {
            if (this.player.networkManager && enemy.networkId) {
                this.player.networkManager.hitEnemy(enemy.networkId);
            }
            
            this.createMagicExplosion(missile.x, missile.y);
            missile.destroy();
        });
        
        // 투사체와 벽 충돌 체크
        this.player.scene.physics.add.collider(missile, this.player.scene.walls, (missile, wall) => {
            this.createMagicExplosion(missile.x, missile.y);
            missile.destroy();
        });

        console.log('마법 투사체 발사 완료!');
    }

    /**
     * 투사체 충돌 설정
     */
    setupMissileCollisions(missile) {
        // 상대팀 플레이어와 충돌
        const allPlayers = [this.player.scene.player, ...this.player.scene.otherPlayers.getChildren()];
        allPlayers.forEach(targetPlayer => {
            if (!targetPlayer || missile.team === targetPlayer.team) return;
            
            this.player.scene.physics.add.overlap(missile, targetPlayer, (missile, hitPlayer) => {
                const damage = 30;
                if (typeof hitPlayer.takeDamage === 'function') {
                    hitPlayer.takeDamage(damage);
                }
                this.player.scene.effectManager.showExplosion(missile.x, missile.y);
                missile.destroy();
            });
        });
        
        // 적과 충돌
        this.player.scene.physics.add.overlap(missile, this.player.scene.enemies, (missile, enemy) => {
            if (this.player.networkManager && enemy.networkId) {
                this.player.networkManager.hitEnemy(enemy.networkId);
            }
            this.player.scene.effectManager.showExplosion(missile.x, missile.y);
            missile.destroy();
        });
        
        // 벽과 충돌
        this.player.scene.physics.add.collider(missile, this.player.scene.walls, (missile, wall) => {
            this.player.scene.effectManager.showExplosion(missile.x, missile.y);
            missile.destroy();
        });
    }

    /**
     * 마법 폭발 이펙트 생성
     */
    createMagicExplosion(x, y) {
        // 범위 공격 반지름
        const explosionRadius = 60;
        
        // 폭발 이펙트 생성 (시각적 효과만)
        const explosion = this.scene.add.circle(x, y, explosionRadius, 0xff00ff, 0.3);
        this.scene.tweens.add({
            targets: explosion,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 400,
            onComplete: () => {
                explosion.destroy();
            }
        });
        
        // 서버에서 데미지 처리를 담당하므로 클라이언트에서는 시각적 효과만 처리
        // 데미지 처리 로직 제거됨
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
        // 서버에서 받은 쿨타임 정보를 사용
        if (this.player.serverSkillCooldowns) {
            return this.player.serverSkillCooldowns;
        }
        return {};
    }

    // 기본 공격은 서버에서 처리됩니다. 클라이언트는 이벤트 응답으로만 애니메이션 실행

    createProjectile(targetX, targetY) {
        // 투사체 생성 (빛나는 점)
        const projectile = this.player.scene.add.circle(this.player.x, this.player.y, 4, 0x0000ff, 1);
        this.player.scene.physics.add.existing(projectile);
        
        // 투사체 콜라이더 설정
        projectile.body.setCircle(4); // 원형 콜라이더 설정
        projectile.body.setCollideWorldBounds(false); // 월드 경계 충돌 비활성화
        projectile.body.setBounce(0, 0); // 튕김 없음
        projectile.body.setDrag(0, 0); // 저항 없음
        
        // 커서 방향으로 특정 거리까지 날아가도록 계산
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
        const maxDistance = 350; // 최대 사정거리
        const finalX = this.player.x + Math.cos(angle) * maxDistance;
        const finalY = this.player.y + Math.sin(angle) * maxDistance;
        
        // 투사체 이동 (Tween 사용 + 물리 바디 위치 업데이트)
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, finalX, finalY);
        const duration = (distance / 280) * 1000; // 280은 투사체 속도
        
        const moveTween = this.player.scene.tweens.add({
            targets: projectile,
            x: finalX,
            y: finalY,
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
                    // 최대 사거리에 도달했을 때 범위 공격 실행
                    this.createMagicExplosion(projectile.x, projectile.y);
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
        
        // 투사체와 벽 충돌 체크 (시각적 효과만)
        this.player.scene.physics.add.collider(projectile, this.player.scene.walls, (projectile, wall) => {
            console.log('마법사 투사체가 벽과 충돌!');
            if (projectile && projectile.active) {
                // 벽 충돌 시 폭발 이펙트 생성
                this.createMagicExplosion(projectile.x, projectile.y);
                
                // 서버에 벽 충돌 이벤트 전송 (마법사 범위 공격용)
                if (this.player.networkManager) {
                    this.player.networkManager.socket.emit('projectile-wall-collision', {
                        playerId: this.player.networkId,
                        x: projectile.x,
                        y: projectile.y,
                        jobClass: this.player.jobClass
                    });
                }
                
                projectile.destroyProjectile();
            }
        });
        
        // 다른 플레이어와의 충돌 (시각적 효과만, 데미지는 서버에서 처리)
        this.player.scene.physics.add.overlap(projectile, this.player.scene.otherPlayers, (projectile, otherPlayer) => {
            if (otherPlayer && otherPlayer.team !== this.player.team) {
                console.log('마법사 투사체가 다른 팀 플레이어와 충돌!');
                if (projectile && projectile.active) {
                    // 다른 플레이어 충돌 시 폭발 이펙트 생성
                    this.createMagicExplosion(projectile.x, projectile.y);
                    projectile.destroyProjectile();
                }
            }
        });
    }

    /**
     * 정리 작업
     */
    destroy() {
        super.destroy();
    }
} 