import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import AssetLoader from '../utils/AssetLoader.js';

/**
 * 네트워크 이벤트 처리 매니저
 */
export default class NetworkEventManager {
    constructor(scene) {
        this.scene = scene;
        this.networkManager = scene.networkManager;
        
        // 게임 상태
        this.gameJoined = false;
        this.playerId = null;
        this.isFirstJoin = true;
        this.playerTeam = null;
    }

    /**
     * 네트워크 이벤트 리스너 설정
     */
    setupNetworkListeners() {
        // 기존 리스너들 정리 (중복 방지)
        this.networkManager.off('game-joined');
        this.networkManager.off('player-joined');
        this.networkManager.off('player-left');
        this.networkManager.off('player-moved');
        this.networkManager.off('player-skill-used');
        this.networkManager.off('skill-error');
        this.networkManager.off('enemies-update');
        this.networkManager.off('player-job-changed');
        
        // 게임 입장 완료
        this.networkManager.on('game-joined', (data) => {
            this.handleGameJoined(data);
        });

        // 다른 플레이어 입장
        this.networkManager.on('player-joined', (playerData) => {
            this.handlePlayerJoined(playerData);
        });

        // 플레이어 퇴장
        this.networkManager.on('player-left', (data) => {
            this.handlePlayerLeft(data);
        });

        // 플레이어 이동
        this.networkManager.on('player-moved', (data) => {
            this.handlePlayerMoved(data);
        });

        // 스킬 사용
        this.networkManager.on('player-skill-used', (data) => {
            this.handlePlayerSkillUsed(data);
        });

        // 스킬 에러
        this.networkManager.on('skill-error', (data) => {
            this.handleSkillError(data);
        });
        
        // 와드 파괴
        this.networkManager.on('ward-destroyed', (data) => {
            this.handleWardDestroyed(data);
        });

        // 플레이어 레벨업
        this.networkManager.on('player-level-up', (data) => {
            this.handlePlayerLevelUp(data);
        });

        // 적 관련 이벤트
        this.setupEnemyEvents();
        
        // 기타 이벤트
        this.setupMiscEvents();
    }

    /**
     * 적 관련 이벤트 설정
     */
    setupEnemyEvents() {
        this.networkManager.on('enemy-spawned', (enemyData) => {
            this.createNetworkEnemy(enemyData);
        });

        this.networkManager.on('enemy-destroyed', (data) => {
            this.handleEnemyDestroyed(data);
        });

        this.networkManager.on('enemy-damaged', (data) => {
            this.handleEnemyDamaged(data);
        });

        this.networkManager.on('enemies-update', (enemiesData) => {
            this.handleEnemiesUpdate(enemiesData);
        });
    }

    /**
     * 기타 이벤트 설정
     */
    setupMiscEvents() {
        this.networkManager.on('player-job-changed', (data) => {
            this.handlePlayerJobChanged(data);
        });

        this.networkManager.on('game-synced', (syncData) => {
            this.handleGameSynced(syncData);
        });
      
        this.networkManager.on('player-ping', (data) => {
            this.handlePlayerPing(data);
        });
    }

    /**
     * 게임 입장 처리
     */
    handleGameJoined(data) {
        console.log('game-joined 이벤트 수신:', data.playerId);
        
        // 중복 처리 방지
        if (this.gameJoined && this.playerId === data.playerId) {
            console.log('게임 입장 이미 완료됨, 중복 처리 무시');
            return;
        }
        
        if (this.scene.player && this.scene.player.networkId === data.playerId) {
            console.log('같은 플레이어 ID로 이미 플레이어가 존재함, 중복 처리 무시');
            return;
        }
        
        console.log('게임 입장 처리 시작:', data);
        this.gameJoined = true;
        this.playerId = data.playerId;
        this.playerTeam = data.playerData.team;
        
        // 서버 설정 업데이트 (GameConfig 동기화)
        if (data.serverConfig) {
            AssetLoader.updateServerConfig(data.serverConfig);
            console.log('서버 설정이 클라이언트에 동기화되었습니다:', data.serverConfig);
        }
        
        // 서버 맵 데이터로 맵 재생성
        if (data.mapData) {
            this.scene.mapManager.recreateMapFromServer(data.mapData);
        }
        
        // 기존 플레이어 제거
        if (this.scene.player) {
            this.scene.player.destroy();
            this.scene.player = null;
        }
        
        // 본인 플레이어 생성
        this.scene.player = new Player(this.scene, data.playerData.x, data.playerData.y, data.playerData.team);
        this.scene.player.setNetworkId(data.playerId);
        this.scene.player.setNetworkManager(this.networkManager);
        this.scene.player.setDepth(950);
        
        // 플레이어 이름표 생성
        this.scene.player.createNameText(this.scene.playerNickname, data.playerData.team, 960);
        
        // 물리 충돌 설정
        this.scene.mapManager.setupCollisions();
        
        // 카메라 설정
        this.scene.cameras.main.startFollow(this.scene.player);
        this.scene.cameras.main.setZoom(1);
        
        // 기존 플레이어들 생성
        data.players.forEach(playerData => {
            if (playerData.id !== data.playerId) {
                this.createOtherPlayer(playerData);
            }
        });
        
        // 기존 적들 생성
        data.enemies.forEach(enemyData => {
            this.createNetworkEnemy(enemyData);
        });
        
        this.isFirstJoin = false;
        console.log('플레이어 생성 완료:', this.scene.player);
    }

    /**
     * 다른 플레이어 입장 처리
     */
    handlePlayerJoined(playerData) {
        console.log('플레이어 입장:', playerData);
        this.createOtherPlayer(playerData);
    }

    /**
     * 플레이어 퇴장 처리
     */
    handlePlayerLeft(data) {
        console.log('플레이어 퇴장:', data);
        if (!this.scene.otherPlayers?.children) return;
        
        const otherPlayer = this.scene.otherPlayers.getChildren().find(p => p.networkId === data.playerId);
        if (otherPlayer) {
            otherPlayer.destroy();
        }
    }

    /**
     * 플레이어 이동 처리
     */
    handlePlayerMoved(data) {
        if (!this.scene.otherPlayers?.children) return;
        
        const otherPlayer = this.scene.otherPlayers.getChildren().find(p => p.networkId === data.id);
        if (otherPlayer && !otherPlayer.isJumping) {
            // 부드러운 이동
            this.scene.tweens.add({
                targets: otherPlayer,
                x: data.x,
                y: data.y,
                duration: 50,
                ease: 'Linear',
                onUpdate: () => {
                    otherPlayer.updateNameTextPosition();
                }
            });
            
            // 상태 업데이트
            otherPlayer.direction = data.direction;
            if (data.jobClass && data.jobClass !== otherPlayer.jobClass) {
                otherPlayer.jobClass = data.jobClass;
            }
            if (data.level && data.level !== otherPlayer.level) {
                otherPlayer.level = data.level;
                otherPlayer.updateCharacterSize();
            }
            if (data.size && data.size !== otherPlayer.size) {
                otherPlayer.size = data.size;
                otherPlayer.updateSize();
            }
            
            otherPlayer.updateJobSprite();
        }
    }

    /**
     * 스킬 사용 처리
     */
    handlePlayerSkillUsed(data) {
        const player = data.playerId === this.networkManager.playerId 
            ? this.scene.player 
            : this.scene.otherPlayers?.getChildren().find(p => p.networkId === data.playerId);
        
        if (player) {
            // 타임스탬프 기반 이펙트 동기화
            const currentTime = Date.now();
            const skillDelay = currentTime - data.timestamp;
            
            // 지연시간이 너무 크면 (1초 이상) 이펙트 스킵
            if (skillDelay > 1000) {
                console.log(`스킬 이펙트 스킵 - 지연시간: ${skillDelay}ms`);
                return;
            }
            
            // 지연시간만큼 조정해서 이펙트 재생
            const adjustedDelay = Math.max(0, -skillDelay);
            
            if (adjustedDelay > 0) {
                // 지연해서 재생
                this.scene.time.delayedCall(adjustedDelay, () => {
                    this.showSkillEffect(player, data.skillType, data);
                });
            } else {
                // 즉시 재생
                this.showSkillEffect(player, data.skillType, data);
            }
        }
    }

    /**
     * 스킬 에러 처리
     */
    handleSkillError(data) {
        console.log('스킬 사용 실패:', data.error, data.skillType);
        
        // 플레이어에게 에러 메시지 표시
        if (this.scene.player && this.scene.player.job) {
            this.scene.player.job.showCooldownMessage(data.error);
        }
    }

    /**
     * 와드 파괴 처리
     */
    handleWardDestroyed(data) {
        this.scene.children.list.forEach(child => {
            if (child.texture && child.texture.key === 'ward' && child.isOtherPlayerWard) {
                // 파괴 이펙트
                const explosion = this.scene.add.circle(child.x, child.y, 50, 0xff0000, 0.5);
                this.scene.tweens.add({
                    targets: explosion,
                    scaleX: 2,
                    scaleY: 2,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => explosion.destroy()
                });
                
                child.destroy();
            }
        });
    }

    /**
     * 플레이어 레벨업 처리
     */
    handlePlayerLevelUp(data) {
        const player = data.playerId === this.networkManager.playerId 
            ? this.scene.player 
            : this.scene.otherPlayers?.getChildren().find(p => p.networkId === data.playerId);
        
        if (player) {
            this.scene.effectManager.showLevelUpEffect(player.x, player.y);
        }
    }

    /**
     * 적 파괴 처리
     */
    handleEnemyDestroyed(data) {
        if (!this.scene.enemies?.children) return;
        
        const enemy = this.scene.enemies.getChildren().find(e => e.networkId === data.enemyId);
        if (enemy) {
            enemy.destroy();
        }
    }

    /**
     * 적 데미지 처리
     */
    handleEnemyDamaged(data) {
        if (!this.scene.enemies?.children) return;
        
        const enemy = this.scene.enemies.getChildren().find(e => e.networkId === data.enemyId);
        if (enemy) {
            enemy.hp = data.hp;
            enemy.maxHp = data.maxHp;
            
            this.scene.effectManager.showDamageText(enemy.x, enemy.y, `${enemy.hp}/${enemy.maxHp}`, '#ff0000');
        }
    }

    /**
     * 적 위치 업데이트 처리
     */
    handleEnemiesUpdate(enemiesData) {
        enemiesData.forEach(enemyData => {
            if (!this.scene.enemies?.children) return;
            
            const enemy = this.scene.enemies.getChildren().find(e => e.networkId === enemyData.id);
            if (enemy) {
                // 부드러운 이동
                this.scene.tweens.add({
                    targets: enemy,
                    x: enemyData.x,
                    y: enemyData.y,
                    duration: 50,
                    ease: 'Linear'
                });
                
                enemy.hp = enemyData.hp;
                enemy.maxHp = enemyData.maxHp;
                
                if (enemyData.isAttacking) {
                    this.showEnemyAttack(enemy);
                }
            }
        });
    }

    /**
     * 플레이어 직업 변경 처리
     */
    handlePlayerJobChanged(data) {
        if (!this.scene.otherPlayers?.children) return;
        
        const otherPlayer = this.scene.otherPlayers.getChildren().find(p => p.networkId === data.id);
        if (otherPlayer) {
            otherPlayer.jobClass = data.jobClass;
            otherPlayer.updateJobSprite();
        }
    }

    /**
     * 게임 상태 동기화 처리
     */
    handleGameSynced(syncData) {
        console.log('게임 상태 동기화 완료:', syncData);
        this.scene.restorePlayerStates(syncData);
    }

    /**
     * 핑 처리
     */
    handlePlayerPing(data) {
        if (data.team === this.scene.player.team && data.playerId !== this.networkManager.playerId) {
            this.scene.pingManager.createPing(data.x, data.y, data.playerId);
            this.scene.pingManager.showPingMessage('팀원이 핑을 찍었습니다!');
            
            const pingId = `${data.playerId}_${Date.now()}`;
            this.scene.pingManager.activePingPositions.set(pingId, { x: data.x, y: data.y });
            this.scene.pingManager.checkAndShowPingArrow(data.x, data.y, pingId);
        }
    }

    /**
     * 다른 플레이어 생성
     */
    createOtherPlayer(playerData) {
        const otherPlayer = new Player(this.scene, playerData.x, playerData.y, playerData.team);
        otherPlayer.setNetworkId(playerData.id);
        otherPlayer.setIsOtherPlayer(true);
        otherPlayer.level = playerData.level;
        otherPlayer.hp = playerData.hp;
        otherPlayer.maxHp = playerData.maxHp;
        otherPlayer.jobClass = playerData.jobClass;
        otherPlayer.direction = playerData.direction;
        otherPlayer.size = playerData.size || 64; // 기본값 설정
        otherPlayer.updateSize(); // 크기 업데이트 적용
        otherPlayer.updateJobSprite();
        
        this.scene.otherPlayers.add(otherPlayer);
        otherPlayer.setDepth(650);
        
        const displayName = playerData.nickname || `Player ${playerData.id.slice(0, 6)}`;
        otherPlayer.createNameText(displayName, playerData.team, 960);
        
        return otherPlayer;
    }

    /**
     * 네트워크 적 생성
     */
    createNetworkEnemy(enemyData) {
        const enemy = new Enemy(this.scene, enemyData.x, enemyData.y, enemyData.type);
        enemy.setNetworkId(enemyData.id);
        enemy.hp = enemyData.hp;
        enemy.maxHp = enemyData.maxHp;
        enemy.isServerControlled = true;
        enemy.setDepth(940);
        
        if (this.scene.enemies?.add) {
            this.scene.enemies.add(enemy);
        }
        return enemy;
    }

    /**
     * 적 공격 애니메이션 표시
     */
    showEnemyAttack(enemy) {
        enemy.setTint(0xff0000);
        this.scene.time.delayedCall(200, () => {
            enemy.clearTint();
        });
        
        const attackRange = this.scene.add.circle(enemy.x, enemy.y, 60, 0xff0000, 0.3);
        this.scene.time.delayedCall(300, () => {
            attackRange.destroy();
        });
    }

    /**
     * 스킬 이펙트 표시
     */
    showSkillEffect(player, skillType, data = null) {
        switch (skillType) {
            case 'stealth':
                this.showStealthEffect(player, data);
                break;
            case 'jump':
                this.showJumpEffect(player, data);
                break;
            case 'spread':
            case 'slime_spread':
                this.showSlimeSpreadEffect(player, data);
                break;
            case 'ward':
                this.showWardEffect(player, data);
                break;
            case 'ice_field':
                this.showIceFieldEffect(player, data);
                break;
            case 'magic_missile':
                this.showMagicMissileEffect(player, data);
                break;
            case 'charge':
                this.showChargeEffect(player, data);
                break;
        }
    }

    /**
     * 은신 이펙트
     */
    showStealthEffect(player, data = null) {
        player.setAlpha(0.3);
        player.setTint(0x888888);
        
        // 서버에서 받은 지속시간 사용 (기본값 5000ms)
        const duration = data?.skillInfo?.duration || 5000;
        
        // 은신 효과 메시지
        const stealthText = this.scene.add.text(
            player.x, 
            player.y - 60, 
            '은신!', 
            {
                fontSize: '16px',
                fill: '#800080'
            }
        ).setOrigin(0.5);
        
        this.scene.time.delayedCall(1000, () => {
            if (stealthText.active) {
                stealthText.destroy();
            }
        });
        
        this.scene.time.delayedCall(duration, () => {
            if (player.active) {
                player.setAlpha(1);
                player.clearTint();
            }
        });
    }

    /**
     * 점프 이펙트
     */
    showJumpEffect(player, data = null) {
        // 이미 점프 중이면 중복 실행 방지
        if (player.isJumping) return;
        
        const originalY = player.y;
        const originalNameY = player.nameText ? player.nameText.y : null;
        player.isJumping = true;
        
        const targets = [player];
        if (player.nameText) {
            targets.push(player.nameText);
        }
        
        // 서버에서 받은 지속시간 사용 (기본값 400ms)
        const duration = data?.skillInfo?.duration || 400;
        
        this.scene.tweens.add({
            targets: targets,
            y: '-=50',
            duration: Math.min(duration / 2, 200), // 올라가는 시간
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
                if (player.active) {
                    player.y = originalY;
                    if (player.nameText && originalNameY !== null) {
                        player.nameText.y = originalNameY;
                    }
                    player.isJumping = false;
                    player.updateNameTextPosition();
                }
            }
        });
    }

    /**
     * 슬라임 퍼지기 이펙트
     */
    showSlimeSpreadEffect(player, data = null) {
        // 본인도 이펙트를 볼 수 있도록 수정
        player.setTexture('slime_skill');
        
        // 서버에서 받은 범위 정보 사용 (기본값 50)
        const range = data?.skillInfo?.range || 50;
        
        const effect = this.scene.add.circle(player.x, player.y, range, 0x00ff00, 0.3);
        this.scene.time.delayedCall(300, () => {
            if (effect.active) {
                effect.destroy();
            }
        });
        
        this.scene.time.delayedCall(400, () => {
            if (player.active) {
                player.updateJobSprite();
            }
        });
    }

    /**
     * 와드 이펙트
     */
    showWardEffect(player, data) {
        if (!player.isOtherPlayer) return;
        
        const ward = this.scene.add.sprite(player.x, player.y, 'ward');
        ward.setScale(0.02);
        ward.isOtherPlayerWard = true;
        ward.wardOwnerId = data.playerId;
        
        this.scene.tweens.add({
            targets: ward,
            alpha: 0.8,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
    }

    /**
     * 얼음 장판 이펙트
     */
    showIceFieldEffect(player) {
        if (!player.isOtherPlayer) return;
        
        const iceField = this.scene.add.circle(player.x, player.y, 100, 0x87ceeb, 0.4);
        this.scene.tweens.add({
            targets: iceField,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 2000,
            yoyo: true,
            repeat: 2
        });
        this.scene.time.delayedCall(6000, () => {
            iceField.destroy();
        });
    }

    /**
     * 마법 투사체 이펙트
     */
    showMagicMissileEffect(player, data) {
        if (!player.isOtherPlayer || !data) return;
        
        let finalTargetX = data.targetX;
        let finalTargetY = data.targetY;
        const maxRange = data.maxRange || 400;
        
        const distance = Phaser.Math.Distance.Between(data.startX, data.startY, data.targetX, data.targetY);
        
        if (distance > maxRange) {
            const angle = Phaser.Math.Angle.Between(data.startX, data.startY, data.targetX, data.targetY);
            finalTargetX = data.startX + Math.cos(angle) * maxRange;
            finalTargetY = data.startY + Math.sin(angle) * maxRange;
        }
        
        const missile = this.scene.add.circle(data.startX, data.startY, 8, 0xff00ff, 0.3);
        missile.team = data.team;
        
        this.scene.physics.add.existing(missile);
        missile.body.setSize(8, 8);
        
        // 투사체 이펙트
        this.scene.tweens.add({
            targets: missile,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        // 투사체 이동
        const finalDistance = Phaser.Math.Distance.Between(data.startX, data.startY, finalTargetX, finalTargetY);
        const velocity = 400;
        const duration = (finalDistance / velocity) * 1000;
        
        this.scene.tweens.add({
            targets: missile,
            x: finalTargetX,
            y: finalTargetY,
            duration: duration,
            ease: 'Linear',
            onComplete: () => {
                this.scene.effectManager.showExplosion(finalTargetX, finalTargetY);
                missile.destroy();
            }
        });
        
        // 충돌 처리 설정
        this.setupMissileCollisions(missile);
        
        // 안전장치: 3초 후 제거
        this.scene.time.delayedCall(3000, () => {
            if (missile.active) {
                missile.destroy();
            }
        });
    }

    /**
     * 투사체 충돌 설정
     */
    setupMissileCollisions(missile) {
        // 상대팀 플레이어와 충돌
        const allPlayers = [this.scene.player, ...this.scene.otherPlayers.getChildren()];
        allPlayers.forEach(targetPlayer => {
            if (!targetPlayer || missile.team === targetPlayer.team) return;
            
            this.scene.physics.add.overlap(missile, targetPlayer, (missile, hitPlayer) => {
                const damage = 30;
                if (typeof hitPlayer.takeDamage === 'function') {
                    hitPlayer.takeDamage(damage);
                }
                this.scene.effectManager.showExplosion(missile.x, missile.y);
                missile.destroy();
            });
        });
        
        // 적과 충돌
        this.scene.physics.add.overlap(missile, this.scene.enemies, (missile, enemy) => {
            if (this.networkManager && enemy.networkId) {
                this.networkManager.hitEnemy(enemy.networkId);
            }
            this.scene.effectManager.showExplosion(missile.x, missile.y);
            missile.destroy();
        });
        
        // 벽과 충돌
        this.scene.physics.add.collider(missile, this.scene.walls, (missile, wall) => {
            this.scene.effectManager.showExplosion(missile.x, missile.y);
            missile.destroy();
        });
    }

    /**
     * 게임 상태 리셋
     */
    resetGameState() {
        this.gameJoined = false;
        this.playerId = null;
        this.isFirstJoin = true;
        this.playerTeam = null;
        
        if (this.networkManager) {
            this.networkManager.pendingJoinGameData = null;
        }
    }

    /**
     * 정리 작업
     */
    destroy() {
        if (this.networkManager) {
            this.networkManager.off('game-joined');
            this.networkManager.off('player-joined');
            this.networkManager.off('player-left');
            this.networkManager.off('player-moved');
            this.networkManager.off('player-skill-used');
            this.networkManager.off('enemies-update');
            this.networkManager.off('player-job-changed');
        }
    }
} 