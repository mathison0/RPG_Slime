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
        
        // 플레이어 데미지
        this.networkManager.on('player-damaged', (data) => {
            this.handlePlayerDamaged(data);
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
        
        // 플레이어 상태 업데이트
        this.networkManager.on('players-state-update', (data) => {
            this.handlePlayersStateUpdate(data);
        });
        
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
        
        this.networkManager.on('spawn-barrier-damage', (data) => {
            console.log('spawn-barrier-damage 이벤트 수신:', data);
            this.handleSpawnBarrierDamage(data);
        });
        
        this.networkManager.on('player-died', (data) => {
            console.log('player-died 이벤트 수신:', data);
            this.handlePlayerDied(data);
        });
        
        this.networkManager.on('player-respawned', (data) => {
            console.log('player-respawned 이벤트 수신:', data);
            this.handlePlayerRespawned(data);
        });
        
        this.networkManager.on('player-state-sync', (data) => {
            console.log('player-state-sync 이벤트 수신:', data);
            this.handlePlayerStateSync(data);
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
        
        // 서버의 사망 상태 동기화
        this.scene.player.isDead = data.playerData.isDead || false;
        if (this.scene.player.isDead) {
            this.scene.player.setVisible(false);
            this.scene.player.setActive(false);
            if (this.scene.player.body) {
                this.scene.player.body.setEnable(false);
            }
            console.log('게임 입장 시 사망 상태로 설정됨');
        }
        
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
        if (otherPlayer) {
            // 사망 상태 업데이트
            if (data.isDead !== undefined && data.isDead !== otherPlayer.isDead) {
                otherPlayer.isDead = data.isDead;
                
                if (data.isDead) {
                    // 다른 플레이어가 죽었을 때 숨김
                    otherPlayer.setVisible(false);
                    console.log(`다른 플레이어 ${data.id} 사망으로 숨김`);
                } else {
                    // 다른 플레이어가 리스폰했을 때 표시
                    otherPlayer.setVisible(true);
                    console.log(`다른 플레이어 ${data.id} 리스폰으로 표시`);
                }
            }
            
            // 죽은 플레이어는 움직임 처리 안함
            if (otherPlayer.isDead) {
                return;
            }
            
            if (!otherPlayer.isJumping) {
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
            // HP 정보 업데이트
            if (data.hp !== undefined && data.hp !== otherPlayer.hp) {
                otherPlayer.hp = data.hp;
            }
            if (data.maxHp !== undefined && data.maxHp !== otherPlayer.maxHp) {
                otherPlayer.maxHp = data.maxHp;
            }
            
            // 스프라이트 업데이트
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
        
        // 디버깅 로그 추가
        const isOwnPlayer = data.playerId === this.networkManager.playerId;
        console.log(`${isOwnPlayer ? '본인' : '다른 플레이어'} 스킬 사용: ${data.skillType} (플레이어 ID: ${data.playerId})`);
        
        if (player) {
            // 본인 플레이어의 스킬 사용 성공 시 쿨타임 설정 (울부짖기는 이미 설정됨)
            if (isOwnPlayer && player.job && data.skillType !== 'roar') {
                this.setSkillCooldown(player, data.skillType);
            }
            
            // 타임스탬프 기반 이펙트 동기화
            const currentTime = Date.now();
            const skillDelay = currentTime - data.timestamp;
            
            console.log(`스킬 지연시간: ${skillDelay}ms`);
            
            // 지연시간이 너무 크면 (1초 이상) 이펙트 스킵
            if (skillDelay > 1000) {
                console.log(`스킬 이펙트 스킵 - 지연시간: ${skillDelay}ms`);
                return;
            }
            
            // 지연시간만큼 조정해서 이펙트 재생
            const adjustedDelay = Math.max(0, -skillDelay);
            
            if (adjustedDelay > 0) {
                // 지연해서 재생
                console.log(`스킬 이펙트 지연 실행: ${adjustedDelay}ms 후`);
                this.scene.time.delayedCall(adjustedDelay, () => {
                    this.showSkillEffect(player, data.skillType, data);
                });
            } else {
                // 즉시 재생
                console.log('스킬 이펙트 즉시 실행');
                this.showSkillEffect(player, data.skillType, data);
            }
        } else {
            console.warn(`플레이어를 찾을 수 없음: ${data.playerId}`);
        }
    }

    /**
     * 스킬 쿨타임 설정
     */
    setSkillCooldown(player, skillType) {
        if (!player.job) return;
        
        // 직업별 스킬 정보 가져오기
        const jobInfo = player.job.jobInfo;
        if (!jobInfo || !jobInfo.skills) return;
        
        // 스킬 정보 찾기
        const skillInfo = jobInfo.skills.find(skill => skill.type === skillType);
        if (!skillInfo) return;
        
        // 쿨타임 설정
        player.job.setSkillCooldown(skillType, skillInfo.cooldown);
        console.log(`${skillType} 스킬 쿨타임 설정: ${skillInfo.cooldown}ms`);
    }

    /**
     * 플레이어 ID로 플레이어 찾기
     */
    findPlayerById(playerId) {
        // 본인 플레이어인지 확인
        if (this.scene.player && this.scene.player.networkId === playerId) {
            return this.scene.player;
        }
        
        // 다른 플레이어들 중에서 찾기
        if (this.scene.otherPlayers) {
            return this.scene.otherPlayers.getChildren().find(p => p.networkId === playerId);
        }
        
        return null;
    }

    /**
     * 서버에서 받은 스킬 데미지 결과 처리
     */
    handleSkillDamageResult(damageResult) {
        let totalAffected = 0;
        
        // 적들에게 데미지 적용된 경우
        if (damageResult.affectedEnemies && damageResult.affectedEnemies.length > 0) {
            totalAffected += damageResult.affectedEnemies.length;
            
            // 각 피해받은 적에 대해 데미지 효과 표시
            damageResult.affectedEnemies.forEach(enemyData => {
                const enemy = this.scene.enemies?.getChildren().find(e => e.networkId === enemyData.id);
                if (enemy) {
                    // 실제 적용된 데미지 텍스트 표시
                    const damageToShow = enemyData.actualDamage || enemyData.damage;
                    this.scene.effectManager.showDamageText(enemy.x, enemy.y, damageToShow);
                    
                    // 적 체력 업데이트 (서버에서 이미 처리됨)
                    // 실제 HP는 서버에서 관리되므로 클라이언트에서는 시각적 효과만
                    if (enemy.updateHealthFromServer) {
                        enemy.updateHealthFromServer();
                    }
                }
            });
        }

        // 다른 팀 플레이어들에게 데미지 적용된 경우
        if (damageResult.affectedPlayers && damageResult.affectedPlayers.length > 0) {
            totalAffected += damageResult.affectedPlayers.length;
            
            // 각 피해받은 플레이어에 대해 데미지 효과 표시
            damageResult.affectedPlayers.forEach(playerData => {
                const targetPlayer = this.scene.otherPlayers?.getChildren().find(p => p.networkId === playerData.id);
                if (targetPlayer) {
                    // 실제 적용된 데미지 텍스트 표시
                    const damageToShow = playerData.actualDamage || playerData.damage;
                    this.scene.effectManager.showDamageText(targetPlayer.x, targetPlayer.y, damageToShow);
                    
                    // 플레이어 체력 업데이트 (서버에서 이미 처리됨)
                    // 실제 HP는 서버에서 관리되므로 클라이언트에서는 시각적 효과만
                    if (targetPlayer.updateHealthFromServer) {
                        targetPlayer.updateHealthFromServer();
                    }
                }
            });
        }

        if (totalAffected > 0) {
            console.log(`서버 데미지 결과: ${damageResult.totalDamage} 데미지, ${totalAffected}개 대상에게 적용`);
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
     * 플레이어 상태 업데이트 처리
     */
    handlePlayersStateUpdate(playerStates) {
        // 본인 플레이어 상태 업데이트
        const myPlayerState = playerStates.find(p => p.id === this.networkManager.playerId);
        if (myPlayerState && this.scene.player) {
            this.scene.player.hp = myPlayerState.hp;
            this.scene.player.maxHp = myPlayerState.maxHp;
            this.scene.player.updateUI();
        }
        
        // 다른 플레이어들 상태 업데이트
        if (this.scene.otherPlayers?.children) {
            playerStates.forEach(playerState => {
                if (playerState.id === this.networkManager.playerId) return; // 본인 제외
                
                const otherPlayer = this.scene.otherPlayers.getChildren().find(p => p.networkId === playerState.id);
                if (otherPlayer) {
                    otherPlayer.hp = playerState.hp;
                    otherPlayer.maxHp = playerState.maxHp;
                    otherPlayer.level = playerState.level;
                    otherPlayer.jobClass = playerState.jobClass;
                    otherPlayer.updateJobSprite();
                }
            });
        }
    }

    /**
     * 플레이어 데미지 처리
     */
    handlePlayerDamaged(data) {
        // 본인 플레이어가 데미지를 받은 경우
        if (this.scene.player && this.scene.player.networkId === this.networkManager.playerId) {
            // 서버에서 받은 체력 정보로 업데이트
            this.scene.player.setHealthFromServer(data.currentHp, data.maxHp);
            
            // 실제 적용된 데미지 텍스트 표시
            const damageToShow = data.actualDamage || data.damage;
            this.scene.effectManager.showDamageText(this.scene.player.x, this.scene.player.y, damageToShow);
            
            // UI 업데이트
            this.scene.player.updateUI();
            
            // 체력이 0 이하면 사망 처리
            if (data.currentHp <= 0) {
                this.scene.player.die();
            }
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
     * 적 상태 업데이트 처리
     */
    handleEnemiesUpdate(enemiesData) {
        if (!this.scene.enemies) return;

        // 서버에서 받은 적 데이터로 클라이언트 적들 업데이트
        enemiesData.forEach(enemyData => {
            let enemy = this.scene.enemies.getChildren().find(e => e.networkId === enemyData.id);
            
            if (!enemy) {
                // 새로운 적 생성
                enemy = this.createNetworkEnemy(enemyData);
            } else {
                // 기존 적 상태 업데이트
                enemy.x = enemyData.x;
                enemy.y = enemyData.y;
                enemy.hp = enemyData.hp;
                enemy.maxHp = enemyData.maxHp;
                enemy.vx = enemyData.vx || 0;
                enemy.vy = enemyData.vy || 0;
                
                // 서버에서 관리되는 적으로 설정
                enemy.isServerControlled = true;
                
                // 공격 상태 처리
                if (enemyData.isAttacking) {
                    this.showEnemyAttack(enemy);
                }
            }
        });

        // 서버에 없는 적들 제거 (클라이언트에서만 존재하는 적들)
        const serverEnemyIds = new Set(enemiesData.map(e => e.id));
        this.scene.enemies.getChildren().forEach(enemy => {
            if (enemy.networkId && !serverEnemyIds.has(enemy.networkId)) {
                enemy.destroy();
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
     * 스폰 배리어 데미지 처리
     */
    handleSpawnBarrierDamage(data) {
        if (data.playerId === this.networkManager.playerId) {
            // 본인이 데미지를 받은 경우
            if (this.scene.player) {
                this.scene.player.hp = data.currentHp;
                this.scene.player.updateUI();
                
                // 데미지 이펙트
                this.scene.effectManager.showDamageText(
                    this.scene.player.x, 
                    this.scene.player.y - 60, 
                    `-${data.damage} (스폰 배리어)`, 
                    '#ff0000'
                );
                
                // 플레이어 빨간색 깜빡임
                this.scene.player.setTint(0xff0000);
                this.scene.time.delayedCall(200, () => {
                    if (this.scene.player && this.scene.player.active && !this.scene.player.isDead) {
                        this.scene.player.clearTint();
                    }
                });
                
                console.log(`스폰 배리어 데미지 받음: -${data.damage} HP (${data.currentHp}/${data.maxHp})`);
            }
        } else {
            // 다른 플레이어가 데미지를 받은 경우
            const otherPlayer = this.scene.otherPlayers?.getChildren().find(p => p.networkId === data.playerId);
            if (otherPlayer) {
                otherPlayer.hp = data.currentHp;
                
                // 다른 플레이어에게도 데미지 이펙트 표시
                this.scene.effectManager.showDamageText(
                    otherPlayer.x, 
                    otherPlayer.y - 60, 
                    `-${data.damage}`, 
                    '#ff0000'
                );
                
                otherPlayer.setTint(0xff0000);
                this.scene.time.delayedCall(200, () => {
                    if (otherPlayer && otherPlayer.active && !otherPlayer.isDead) {
                        otherPlayer.clearTint();
                    }
                });
            }
        }
    }
    
    /**
     * 플레이어 사망 처리
     */
    handlePlayerDied(data) {
        if (data.playerId === this.networkManager.playerId) {
            // 본인이 사망한 경우 - 새로운 사망 처리 로직 사용
            console.log('본인 사망 이벤트 수신:', data.cause);
            this.scene.handlePlayerDeath(data.cause);
        } else {
            // 다른 플레이어가 사망한 경우
            const otherPlayer = this.scene.otherPlayers?.getChildren().find(p => p.networkId === data.playerId);
            if (otherPlayer) {
                this.scene.effectManager.showMessage(
                    otherPlayer.x, 
                    otherPlayer.y, 
                    '사망!', 
                    { fill: '#ff0000', fontSize: '20px' }
                );
                
                // 사망 이펙트
                this.scene.effectManager.showExplosion(otherPlayer.x, otherPlayer.y, 0xff0000, 100);
                
                // 다른 플레이어도 사망 상태로 설정
                otherPlayer.isDead = true;
                otherPlayer.setVisible(false);
                
                // 색상 초기화 (데미지로 인한 빨간색 제거)
                otherPlayer.clearTint();
                
                // 이름표도 숨기기
                if (otherPlayer.nameText) {
                    otherPlayer.nameText.setVisible(false);
                }
            }
        }
    }

    /**
     * 플레이어 리스폰 처리
     */
    handlePlayerRespawned(data) {
        // 다른 플레이어의 리스폰만 처리 (본인 리스폰은 GameScene에서 직접 처리)
        if (data.playerId !== this.networkManager.playerId) {
            const otherPlayer = this.scene.otherPlayers?.getChildren().find(p => p.networkId === data.playerId);
            if (otherPlayer) {
                // 플레이어 상태 복원
                otherPlayer.isDead = false;
                otherPlayer.x = data.x;
                otherPlayer.y = data.y;
                otherPlayer.hp = data.hp;
                otherPlayer.maxHp = data.maxHp;
                otherPlayer.setVisible(true);
                
                // 색상 초기화 (데미지로 인한 빨간색 제거)
                otherPlayer.clearTint();
                
                // 이름표 다시 표시 및 위치 업데이트
                if (otherPlayer.nameText) {
                    otherPlayer.nameText.setVisible(true);
                    otherPlayer.updateNameTextPosition();
                }
                
                // 리스폰 이펙트
                this.scene.effectManager.showExplosion(data.x, data.y, 0x00ff00, 50);
                this.scene.effectManager.showMessage(
                    data.x, 
                    data.y - 50, 
                    '리스폰!', 
                    { fill: '#00ff00', fontSize: '20px' }
                );
                
                console.log(`다른 플레이어 ${data.playerId} 리스폰 처리 완료`);
            }
        }
    }

    /**
     * 플레이어 상태 동기화 처리
     */
    handlePlayerStateSync(data) {
        if (data.playerId === this.networkManager.playerId && this.scene.player) {
            const player = this.scene.player;
            const playerData = data.playerData;
            
            console.log('본인 플레이어 상태 동기화:', playerData);
            
            // 위치 동기화
            player.x = playerData.x;
            player.y = playerData.y;
            if (player.body) {
                player.body.reset(playerData.x, playerData.y);
            }
            
            // 상태 동기화
            player.isDead = playerData.isDead;
            player.hp = playerData.hp;
            player.maxHp = playerData.maxHp;
            player.level = playerData.level;
            player.size = playerData.size || 64;
            
            // UI 및 스프라이트 업데이트
            player.updateCharacterSize();
            player.updateSize();
            player.updateJobSprite();
            player.updateNameTextPosition();
            player.updateUI();
            
            console.log(`플레이어 상태 동기화 완료: 위치(${player.x}, ${player.y}), HP: ${player.hp}/${player.maxHp}, 사망: ${player.isDead}`);
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
        
        // 사망 상태 설정
        otherPlayer.isDead = playerData.isDead || false;
        if (otherPlayer.isDead) {
            otherPlayer.setVisible(false);
            console.log(`다른 플레이어 ${playerData.id} 생성 시 사망 상태로 숨김`);
        }
        
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
            case 'roar':
                this.showRoarEffect(player, data);
                break;
            case 'sweep':
                this.showSweepEffect(player, data);
                break;
            case 'thrust':
                this.showThrustEffect(player, data);
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
     * 울부짖기 이펙트
     */
    showRoarEffect(player, data = null) {
        // 기존 울부짖기 이펙트가 있다면 제거
        if (player.roarEffectTimer) {
            this.scene.time.removeEvent(player.roarEffectTimer);
            player.roarEffectTimer = null;
        }
        
        // 울부짖기 스킬 상태 설정
        player.isUsingRoarSkill = true;
        
        // 울부짖기 스프라이트로 변경
        player.setTexture('warrior_skill');
        
        // 서버에서 받은 지속시간 사용 (기본값 1000ms)
        const effectDuration = data?.skillInfo?.duration || 1000;
        
        console.log(`울부짖기 지속시간: ${effectDuration}ms`);
        
        // 울부짖기 효과 메시지 (1초 후 제거)
        const roarText = this.scene.add.text(
            player.x, 
            player.y - 80, 
            '울부짖기!', 
            {
                fontSize: '18px',
                fill: '#ff0000',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        // 텍스트는 1초 후 제거
        this.scene.time.delayedCall(1000, () => {
            if (roarText.active) {
                roarText.destroy();
            }
        });
        
        // 스프라이트는 지속시간 후 복원 (정확한 타이밍)
        player.roarEffectTimer = this.scene.time.delayedCall(effectDuration, () => {
            // 울부짖기 스킬 상태 해제
            player.isUsingRoarSkill = false;
            
            // WarriorJob의 isRoaring 상태도 해제
            if (player.job && player.job.isRoaring) {
                player.job.isRoaring = false;
                console.log('울부짖기 상태 해제 완료');
            }
            
            if (player.active) {
                // 원래 직업 스프라이트로 복원
                player.updateJobSprite();
                console.log(`울부짖기 스프라이트 복원 완료 (지속시간: ${effectDuration}ms)`);
            }
            player.roarEffectTimer = null;
        });
        
        console.log('울부짖기 스프라이트 변경 완료');
    }

    /**
     * 휩쓸기 이펙트
     */
    showSweepEffect(player, data = null) {
        // 휩쓸기 시각적 효과
        player.setTint(0xff0000);
        
        // 마우스 커서 위치 가져오기 (서버 데이터에서)
        const mouseX = data?.targetX || player.x;
        const mouseY = data?.targetY || player.y;
        
        // 부채꼴 모양의 휩쓸기 그래픽 생성
        const sweepGraphics = this.scene.add.graphics();
        sweepGraphics.fillStyle(0xff0000, 0.3);
        sweepGraphics.lineStyle(2, 0xff0000, 1);
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = player.x;
        const centerY = player.y;
        const radius = 80; // 휩쓸기 범위
        const angleOffset = Math.PI / 3; // 60도
        
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, mouseX, mouseY);
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        sweepGraphics.beginPath();
        sweepGraphics.moveTo(centerX, centerY);
        sweepGraphics.arc(centerX, centerY, radius, startAngle, endAngle);
        sweepGraphics.closePath();
        sweepGraphics.fill();
        sweepGraphics.stroke();
        
        // 휩쓸기 애니메이션
        this.scene.tweens.add({
            targets: sweepGraphics,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                sweepGraphics.destroy();
                if (player.active) {
                    player.clearTint();
                }
            }
        });
        
        // 휩쓸기 효과 메시지
        const sweepText = this.scene.add.text(
            player.x, 
            player.y - 60, 
            '휩쓸기!', 
            {
                fontSize: '16px',
                fill: '#ff0000'
            }
        ).setOrigin(0.5);
        
        this.scene.time.delayedCall(1000, () => {
            if (sweepText.active) {
                sweepText.destroy();
            }
        });
    }

    /**
     * 찌르기 이펙트
     */
    showThrustEffect(player, data = null) {
        // 찌르기 시각적 효과
        player.setTint(0xff0000);
        
        // 마우스 커서 위치 가져오기 (서버 데이터에서)
        const mouseX = data?.targetX || player.x;
        const mouseY = data?.targetY || player.y;
        
        // 직사각형 모양의 찌르기 그래픽 생성
        const thrustGraphics = this.scene.add.graphics();
        thrustGraphics.fillStyle(0xff0000, 0.3);
        thrustGraphics.lineStyle(2, 0xff0000, 1);
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = player.x;
        const centerY = player.y;
        const width = 40;
        const height = 120; // 찌르기 범위
        
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, mouseX, mouseY);
        
        // 직사각형의 시작점 (플레이어 위치에서 아래변 중심)
        const startX = centerX;
        const startY = centerY;
        
        // 직사각형의 끝점 (마우스 방향으로 height만큼 이동한 윗변 중심)
        const endX = centerX + Math.cos(angleToMouse) * height;
        const endY = centerY + Math.sin(angleToMouse) * height;
        
        // 직사각형의 네 꼭지점 계산
        const halfWidth = width / 2;
        
        // width 방향의 수직 벡터 계산 (마우스 방향에 수직)
        const perpendicularAngle = angleToMouse + Math.PI / 2;
        const widthVectorX = Math.cos(perpendicularAngle) * halfWidth;
        const widthVectorY = Math.sin(perpendicularAngle) * halfWidth;
        
        // 아래변의 두 꼭지점 (플레이어 위치에서)
        const bottomLeftX = startX - widthVectorX;
        const bottomLeftY = startY - widthVectorY;
        const bottomRightX = startX + widthVectorX;
        const bottomRightY = startY + widthVectorY;
        
        // 윗변의 두 꼭지점 (마우스 방향으로)
        const topLeftX = endX - widthVectorX;
        const topLeftY = endY - widthVectorY;
        const topRightX = endX + widthVectorX;
        const topRightY = endY + widthVectorY;
        
        // 직사각형 그리기 (플레이어에서 마우스 방향으로)
        thrustGraphics.beginPath();
        thrustGraphics.moveTo(bottomLeftX, bottomLeftY);
        thrustGraphics.lineTo(topLeftX, topLeftY);
        thrustGraphics.lineTo(topRightX, topRightY);
        thrustGraphics.lineTo(bottomRightX, bottomRightY);
        thrustGraphics.closePath();
        thrustGraphics.fill();
        thrustGraphics.stroke();
        
        // 찌르기 애니메이션
        this.scene.tweens.add({
            targets: thrustGraphics,
            alpha: 0,
            duration: 800,
            onComplete: () => {
                thrustGraphics.destroy();
                if (player.active) {
                    player.clearTint();
                }
            }
        });
        
        // 찌르기 효과 메시지
        const thrustText = this.scene.add.text(
            player.x, 
            player.y - 60, 
            '찌르기!', 
            {
                fontSize: '16px',
                fill: '#ff0000'
            }
        ).setOrigin(0.5);
        
        this.scene.time.delayedCall(1000, () => {
            if (thrustText.active) {
                thrustText.destroy();
            }
        });
    }

    /**
     * 슬라임 퍼지기 이펙트
     */
    showSlimeSpreadEffect(player, data = null) {
        // 본인도 이펙트를 볼 수 있도록 수정
        const isOwnPlayer = player === this.scene.player;
        const startTime = Date.now();
        console.log(`슬라임 퍼지기 이펙트 시작 (본인: ${isOwnPlayer}, 시작시간: ${startTime})`);
        
        // 기존 슬라임 스킬 이펙트가 있다면 제거
        if (player.slimeSkillEffect) {
            player.slimeSkillEffect.destroy();
            player.slimeSkillEffect = null;
        }
        
        // 기존 슬라임 스킬 타이머가 있다면 제거
        if (player.slimeSkillTimer) {
            this.scene.time.removeEvent(player.slimeSkillTimer);
            player.slimeSkillTimer = null;
        }
        
        // 슬라임 스킬 상태 설정
        player.isUsingSlimeSkill = true;
        
        // 슬라임 스킬 스프라이트로 변경
        player.setTexture('slime_skill');
        
        // 퍼지기 스킬 메시지 표시
        const skillText = this.scene.add.text(
            player.x, 
            player.y - 60, 
            '퍼지기!', 
            {
                fontSize: '16px',
                fill: '#00ff00',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        
        // 메시지 애니메이션 (위로 올라가면서 사라짐)
        this.scene.tweens.add({
            targets: skillText,
            y: skillText.y - 30,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => {
                if (skillText.active) {
                    skillText.destroy();
                }
            }
        });
        
        // 서버에서 받은 범위 정보 사용 (기본값 50)
        const range = data?.skillInfo?.range || 50;
        
        // 초록색 범위 효과 생성
        const effect = this.scene.add.circle(player.x, player.y, range, 0x00ff00, 0.3);
        player.slimeSkillEffect = effect; // 플레이어에 이펙트 참조 저장
        
        // 서버에서 받은 지속시간 사용 (기본값 1000ms)
        const effectDuration = data?.skillInfo?.duration || 1000;
        
        console.log(`슬라임 퍼지기 지속시간: ${effectDuration}ms`);
        
        // 스프라이트 복원 타이머 설정 (지속시간과 정확히 동일하게)
        player.slimeSkillTimer = this.scene.time.delayedCall(effectDuration, () => {
            const endTime = Date.now();
            const actualDuration = endTime - startTime;
            
            // 범위 효과 제거
            if (effect.active) {
                effect.destroy();
                console.log(`슬라임 퍼지기 범위 효과 제거 (실제 지속시간: ${actualDuration}ms)`);
            }
            
            // 플레이어 참조 정리
            if (player.slimeSkillEffect === effect) {
                player.slimeSkillEffect = null;
            }
            
            // 슬라임 스킬 상태 해제
            player.isUsingSlimeSkill = false;
            
            // 스프라이트 복원
            if (player.active) {
                player.updateJobSprite();
                console.log(`슬라임 퍼지기 스프라이트 복원 완료 (실제 지속시간: ${actualDuration}ms)`);
            }
            
            // 타이머 참조 정리
            player.slimeSkillTimer = null;
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
        const maxRange = data.skillInfo?.range || 400;
        
        const distance = Phaser.Math.Distance.Between(data.x, data.y, data.targetX, data.targetY);
        
        if (distance > maxRange) {
            const angle = Phaser.Math.Angle.Between(data.x, data.y, data.targetX, data.targetY);
            finalTargetX = data.x + Math.cos(angle) * maxRange;
            finalTargetY = data.y + Math.sin(angle) * maxRange;
        }
        
        const missile = this.scene.add.circle(data.x, data.y, 8, 0xff00ff, 0.3);
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
        const finalDistance = Phaser.Math.Distance.Between(data.x, data.y, finalTargetX, finalTargetY);
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
     * 돌진 이펙트
     */
    showChargeEffect(player, data = null) {
        // 플레이어에게 빨간색 틴트 적용
        player.setTint(0xff6666);
        
        // 돌진 효과 메시지
        const chargeText = this.scene.add.text(
            player.x, 
            player.y - 60, 
            '돌진!', 
            {
                fontSize: '16px',
                fill: '#ff0000',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        
        // 돌진 궤적 이펙트 생성
        const trail = this.scene.add.graphics();
        trail.lineStyle(3, 0xff0000, 0.7);
        trail.beginPath();
        trail.moveTo(player.x, player.y);
        
        // 서버에서 받은 지속시간 사용 (기본값 500ms)
        const duration = data?.skillInfo?.duration || 500;
        
        // 텍스트 제거
        this.scene.time.delayedCall(1000, () => {
            if (chargeText.active) {
                chargeText.destroy();
            }
        });
        
        // 돌진 완료 후 틴트 제거 및 궤적 정리
        this.scene.time.delayedCall(duration, () => {
            if (player.active) {
                player.clearTint();
            }
            if (trail.active) {
                trail.destroy();
            }
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
            this.networkManager.off('spawn-barrier-damage');
            this.networkManager.off('player-died');
            this.networkManager.off('player-state-sync');
        }
    }
} 