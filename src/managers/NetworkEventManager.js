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
        this.player = null;
        this.otherPlayers = null;
        this.enemies = null;
        this.cheatManager = null;
        this.effectManager = null;
        
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
        console.log('NetworkEventManager: 이벤트 리스너 설정 시작');
        
        // networkManager가 null인지 확인
        if (!this.networkManager) {
            console.error('NetworkEventManager: networkManager가 null입니다.');
            return;
        }
        
        // 먼저 기존 리스너들 제거 (중복 방지)
        this.networkManager.off('game-joined');
        this.networkManager.off('player-joined');
        this.networkManager.off('player-left');
        this.networkManager.off('player-moved');
        this.networkManager.off('player-skill-used');
        this.networkManager.off('skill-error');
        this.networkManager.off('player-update-error');
        this.networkManager.off('player-death');
        this.networkManager.off('suicide-error');
        this.networkManager.off('player-invincible-changed');
        this.networkManager.off('invincible-error');
        this.networkManager.off('disconnect');
        this.networkManager.off('connect_error');
        this.networkManager.off('player-stunned');
        this.networkManager.off('projectile-created');
        this.networkManager.off('projectiles-update');
        this.networkManager.off('attack-invalid');
        this.networkManager.off('enemy-stunned');
        
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

        // 레벨업 에러
        this.networkManager.on('level-up-error', (data) => {
            this.handleLevelUpError(data);
        });

        // 공격 무효 이벤트
        this.networkManager.on('attack-invalid', (data) => {
            this.handleAttackInvalid(data);
        });

        // 적 관련 이벤트
        this.networkManager.on('enemy-spawned', (enemyData) => {
            // 중복 생성 방지를 위해 createNetworkEnemy 사용 (내부에서 중복 체크)
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

        this.networkManager.on('monster-attack', (data) => {
            this.handleMonsterAttack(data);
        });

        // 몬스터 기절 상태
        this.networkManager.on('enemy-stunned', (data) => {
            this.handleEnemyStunned(data);
        });
        
        // 플레이어 상태 업데이트
        this.networkManager.on('players-state-update', (data) => {
            this.handlePlayersStateUpdate(data);
        });

        // 플레이어 기절 상태
        this.networkManager.on('player-stunned', (data) => {
            this.handlePlayerStunned(data);
        });

        // 투사체 생성
        this.networkManager.on('projectile-created', (data) => {
            this.handleProjectileCreated(data);
        });

        // 투사체 업데이트
        this.networkManager.on('projectiles-update', (data) => {
            this.handleProjectilesUpdate(data);
        });

        // 투사체 제거
        this.networkManager.on('projectile-removed', (data) => {
            this.handleProjectileRemoved(data);
        });
        
        // 기타 이벤트
        this.setupMiscEvents();

        // 연결 해제
        this.networkManager.on('disconnect', () => {
            this.handleNetworkDisconnect();
        });

        // 연결 오류
        this.networkManager.on('connect_error', (error) => {
            this.handleNetworkError(error);
        });

        // 플레이어 업데이트 에러 (이동 시 player not found)
        this.networkManager.on('player-update-error', (data) => {
            this.handlePlayerUpdateError(data);
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
            this.handleSpawnBarrierDamage(data);
        });
        
        this.networkManager.on('player-died', (data) => {
            this.handlePlayerDied(data);
        });
        
        this.networkManager.on('player-respawned', (data) => {
            this.handlePlayerRespawned(data);
        });
        
        this.networkManager.on('player-state-sync', (data) => {
            this.handlePlayerStateSync(data);
        });
        
        this.networkManager.on('suicide-error', (data) => {
            console.log('자살 치트 실패:', data.error);
            if (this.scene.effectManager) {
                this.scene.effectManager.showMessage(
                    this.scene.scale.width / 2, 
                    this.scene.scale.height / 2, 
                    `자살 치트 실패: ${data.error}`, 
                    { fill: '#ff0000', fontSize: '16px' }
                );
            }
        });
        
        this.networkManager.on('player-invincible-changed', (data) => {
            this.handlePlayerInvincibleChanged(data);
        });
        
        this.networkManager.on('invincible-error', (data) => {
            console.log('무적 상태 토글 실패:', data.error);
            if (this.scene.effectManager) {
                this.scene.effectManager.showMessage(
                    this.scene.scale.width / 2, 
                    this.scene.scale.height / 2, 
                    `무적 상태 토글 실패: ${data.error}`, 
                    { fill: '#ff0000', fontSize: '16px' }
                );
            }
        });
    }

    /**
     * 게임 입장 처리
     */
    handleGameJoined(data) {
        console.log('game-joined 이벤트 수신:', data.playerId);
        
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
        
        // 쿨타임 정보 저장
        if (data.jobCooldowns) {
            this.scene.jobCooldowns = data.jobCooldowns;
            console.log('직업별 쿨타임 정보가 서버에서 동기화되었습니다:', data.jobCooldowns);
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
        
        const mainPlayerDepth = 950;
        const nameTagDepth = mainPlayerDepth + 10; // VisionManager와 같은 로직 적용
        
        this.scene.player.setDepth(mainPlayerDepth);
        
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
        
        // 서버의 무적 상태 동기화
        this.scene.player.isInvincible = data.playerData.isInvincible || false;
        if (this.scene.player.isInvincible) {
            console.log('게임 입장 시 무적 상태로 설정됨');
        }
        
        // 플레이어 이름표 생성 (depth를 동적으로 계산)
        this.scene.player.createNameText(this.scene.playerNickname, data.playerData.team, nameTagDepth);
        
        // 체력바 depth도 이름표와 같게 설정
        if (this.scene.player.healthBar && this.scene.player.healthBar.container) {
            this.scene.player.healthBar.container.setDepth(nameTagDepth);
        }
        
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
        
        // 기존 적들 생성 (중복 생성 방지 포함)
        data.enemies.forEach(enemyData => {
            this.createNetworkEnemy(enemyData);
        });
        
        // 적 생성 후 중복 체크 (만약의 경우를 대비)
        this.cleanupDuplicateEnemies();
        
        this.isFirstJoin = false;
        
        // 초기 UI 업데이트
        this.scene.player.updateUI();
        
        console.log('플레이어 생성 완료:', this.scene.player);
    }

    /**
     * 다른 플레이어 입장 처리
     */
    handlePlayerJoined(playerData) {
        console.log('플레이어 입장:', playerData);
        
        // 본인 플레이어는 otherPlayers에 추가하지 않음
        if (playerData.id === this.playerId) {
            console.log('본인 플레이어 입장 - otherPlayers에 추가하지 않음');
            return;
        }
        
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
        // 본인 플레이어는 클라이언트에서 직접 처리하므로 업데이트하지 않음
        if (data.id === this.networkManager.playerId) {
            return;
        }
        
        // 다른 플레이어 업데이트
        if (!this.scene.otherPlayers?.children) return;
        
        const otherPlayer = this.scene.otherPlayers.getChildren().find(p => p.networkId === data.id);
        if (otherPlayer) {
            // 사망 상태 업데이트
            if (data.isDead !== undefined && data.isDead !== otherPlayer.isDead) {
                otherPlayer.isDead = data.isDead;
                
                if (data.isDead) {
                    // 다른 플레이어가 죽었을 때 숨김
                    otherPlayer.setVisible(false);
                } else {
                    // 다른 플레이어가 리스폰했을 때 표시
                    otherPlayer.setVisible(true);
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
                // size 업데이트는 handlePlayersStateUpdate에서 일괄 처리됨
                
                otherPlayer.updateJobSprite();
            }
            // HP 정보 업데이트
            if (data.hp !== undefined && data.hp !== otherPlayer.hp) {
                otherPlayer.hp = data.hp;
            }
            if (data.maxHp !== undefined && data.maxHp !== otherPlayer.maxHp) {
                otherPlayer.maxHp = data.maxHp;
            }
            
            // 기절 상태 업데이트
            if (data.isStunned !== undefined && data.isStunned !== otherPlayer.isStunned) {
                otherPlayer.isStunned = data.isStunned;
                // 기절 상태가 true로 변경되었을 때 시각적 효과 표시
                if (data.isStunned) {
                    this.showStunEffect(otherPlayer, 2000); // 2초 기절
                }
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
        
        const isOwnPlayer = data.playerId === this.networkManager.playerId;
        
        if (player) {
            // 타임스탬프 기반 이펙트 동기화 (모든 스킬 타입 통일 처리)
            const currentTime = Date.now();
            const skillDelay = currentTime - data.timestamp;
            
            // 지연시간이 너무 크면 (1초 이상) 이펙트 스킵
            if (skillDelay > 1000) {
                return;
            }
            
            // 지연시간만큼 조정해서 이펙트 재생
            const adjustedDelay = skillDelay;
            
            if (adjustedDelay > 0) {
                // 지연해서 재생
                const delayedTimer = this.scene.time.delayedCall(adjustedDelay, () => {
                    // 플레이어가 죽었는지 확인
                    if (player.isDead) {
                        console.log(`스킬 이펙트 취소: 플레이어가 사망함 (${data.skillType})`);
                        return;
                    }
                    this.showSkillEffect(player, data.skillType, data);
                    player.delayedSkillTimers.delete(delayedTimer);
                });
                
                // 타이머를 추적하여 사망 시 취소할 수 있도록 함
                if (player.delayedSkillTimers) {
                    player.delayedSkillTimers.add(delayedTimer);
                }
            } else {
                // 즉시 재생 (플레이어 상태 확인 후)
                if (!player.isDead) {
                    this.showSkillEffect(player, data.skillType, data);
                }
            }
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
                    // 실제 적용된 데미지 텍스트 표시 (서버에서 계산된 정확한 값)
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
                    // 실제 적용된 데미지 텍스트 표시 (서버에서 계산된 정확한 값)
                    const damageToShow = playerData.actualDamage || playerData.damage;
                    this.scene.effectManager.showDamageText(targetPlayer.x, targetPlayer.y, damageToShow);
                    
                    // 기절 효과 표시
                    if (playerData.isStunned) {
                        this.showStunEffect(targetPlayer, playerData.stunDuration);
                    }
                    
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
        
        // "Player not found" 에러 감지 시 즉시 게임 초기화
        if (data.error && (
            data.error.includes('Player not found') || 
            data.error.includes('player not found') ||
            data.error === 'Player not found'
        )) {
            console.warn('Player not found 에러 감지! 게임을 초기화하고 로그인 화면으로 돌아갑니다.');
            this.handlePlayerNotFoundError();
            return;
        }
        
        // 일반적인 스킬 에러 처리
        if (this.scene.player && this.scene.player.job) {
            this.scene.player.job.showCooldownMessage(data.error);
        }
    }

    /**
     * Player not found 에러 처리 - 게임 초기화 및 로그인 화면 복귀
     */
    handlePlayerNotFoundError() {
        console.log('NetworkEventManager: Player not found 에러 처리 시작...');
        
        try {
            console.log('NetworkEventManager: 에러 메시지 표시 중...');
            
            // 에러 메시지 표시
            if (this.scene.effectManager) {
                this.scene.effectManager.showMessage(
                    this.scene.scale.width / 2, 
                    this.scene.scale.height / 2, 
                    '연결이 끊어졌습니다. 로그인 화면으로 돌아갑니다.', 
                    { 
                        fill: '#ff0000', 
                        fontSize: '20px',
                        backgroundColor: '#000000',
                        padding: { x: 10, y: 5 }
                    }
                );
                console.log('NetworkEventManager: 에러 메시지 표시 완료');
            } else {
                console.warn('NetworkEventManager: effectManager가 없어서 메시지 표시 실패');
            }
            
            console.log('NetworkEventManager: 네트워크 연결 초기화 중...');
            
            // 네트워크 연결 초기화
            if (this.networkManager) {
                this.networkManager.resetConnection();
                console.log('NetworkEventManager: 네트워크 연결 초기화 완료');
            } else {
                console.warn('NetworkEventManager: networkManager가 없음');
            }
            
            console.log('NetworkEventManager: 게임 상태 초기화 중...');
            
            // 게임 상태 초기화
            if (this.scene.forceResetGame) {
                this.scene.forceResetGame();
                console.log('NetworkEventManager: 게임 상태 초기화 완료 (forceResetGame 사용)');
            } else {
                this.resetGameState();
                console.log('NetworkEventManager: 게임 상태 초기화 완료 (resetGameState 사용)');
            }
            
            console.log('NetworkEventManager: 2초 후 MenuScene으로 전환 예약...');
            
            // 잠시 대기 후 MenuScene으로 전환 (에러 메시지 표시 시간 확보)
            this.scene.time.delayedCall(2000, () => {
                console.log('NetworkEventManager: MenuScene으로 전환 중...');
                this.scene.scene.start('MenuScene');
                console.log('NetworkEventManager: MenuScene 전환 완료');
            });
            
        } catch (error) {
            console.error('NetworkEventManager: Player not found 에러 처리 중 오류 발생:', error);
            // 오류 발생 시에도 강제로 MenuScene으로 전환
            try {
                console.log('NetworkEventManager: 강제 MenuScene 전환 시도...');
                this.scene.scene.start('MenuScene');
                console.log('NetworkEventManager: 강제 MenuScene 전환 완료');
            } catch (fallbackError) {
                console.error('NetworkEventManager: 강제 MenuScene 전환도 실패:', fallbackError);
            }
        }
    }

    /**
     * 게임 상태 초기화
     */
    resetGameState() {
        console.log('게임 상태 초기화 중...');
        
        try {
            // 플레이어 제거
            if (this.scene.player) {
                this.scene.player.destroy();
                this.scene.player = null;
            }
            
            // 다른 플레이어들 제거 (안전한 방법으로)
            if (this.scene.otherPlayers) {
                try {
                    // 개별 요소들 먼저 안전하게 제거
                    const otherPlayerChildren = this.scene.otherPlayers.getChildren();
                    otherPlayerChildren.forEach(player => {
                        if (player && player.active) {
                            player.destroy();
                        }
                    });
                    // 그룹 자체는 clear(false)로 정리
                    this.scene.otherPlayers.clear(false);
                } catch (e) {
                    console.warn('다른 플레이어 제거 중 오류:', e);
                }
            }
            
            // 적들 제거 (안전한 방법으로)
            if (this.scene.enemies) {
                try {
                    // 개별 요소들 먼저 안전하게 제거
                    const enemyChildren = this.scene.enemies.getChildren();
                    enemyChildren.forEach(enemy => {
                        if (enemy && enemy.active) {
                            enemy.destroy();
                        }
                    });
                    // 그룹 자체는 clear(false)로 정리
                    this.scene.enemies.clear(false);
                } catch (e) {
                    console.warn('적 제거 중 오류:', e);
                }
            }
            
            // 기타 게임 오브젝트들 초기화
            this.gameJoined = false;
            this.playerId = null;
            this.playerTeam = null;
            
            console.log('게임 상태 초기화 완료');
            
            // 초기화 후 혹시 모를 중복 적들 정리
            setTimeout(() => {
                this.cleanupDuplicateEnemies();
            }, 100); // 100ms 후 정리 (초기화가 완전히 끝난 후)
            
        } catch (error) {
            console.error('게임 상태 초기화 중 오류:', error);
        }
    }

    /**
     * 플레이어 상태 업데이트 처리
     */
    handlePlayersStateUpdate(playerStates) {
        // 본인 플레이어 상태 업데이트
        const myPlayerState = playerStates.find(p => p.id === this.networkManager.playerId);
        if (myPlayerState && this.scene.player) {
            // 기본 상태 정보
            this.scene.player.hp = myPlayerState.hp;
            this.scene.player.maxHp = myPlayerState.maxHp;
            this.scene.player.level = myPlayerState.level;
            this.scene.player.jobClass = myPlayerState.jobClass;
            
            // 스탯 정보 업데이트 (서버에서 계산된 값 사용)
            if (myPlayerState.stats) {
                this.scene.player.attack = myPlayerState.stats.attack;
                this.scene.player.speed = myPlayerState.stats.speed;
                this.scene.player.visionRange = myPlayerState.stats.visionRange;
            }
            
            // 직업 정보 저장 (UI에서 사용)
            this.scene.player.jobInfo = myPlayerState.jobInfo;
            
            // 스킬 쿨타임 정보 저장
            this.scene.player.serverSkillCooldowns = myPlayerState.skillCooldowns;
            
            // 활성 효과 정보
            this.scene.player.activeEffects = new Set(myPlayerState.activeEffects || []);
            
            // 은신 상태
            this.scene.player.isStealth = myPlayerState.isStealth;
            
            // 스킬 시전 중 상태
            this.scene.player.isCasting = myPlayerState.isCasting;
            
            // size 정보 업데이트
            if (myPlayerState.size !== undefined && myPlayerState.size !== this.scene.player.size) {
                this.scene.player.size = myPlayerState.size;
                this.scene.player.updateSize();
            }
            
            // 무적 상태 정보 업데이트
            if (myPlayerState.isInvincible !== undefined) {
                this.scene.player.isInvincible = myPlayerState.isInvincible;
            }
            
            // 기절 상태 정보 업데이트
            if (myPlayerState.isStunned !== undefined && myPlayerState.isStunned !== this.scene.player.isStunned) {
                this.scene.player.isStunned = myPlayerState.isStunned;
                
                // 기절 상태가 true로 변경되었을 때 시각적 효과 표시
                if (myPlayerState.isStunned) {
                    this.showStunEffect(this.scene.player, 2000); // 2초 기절
                }
            }
            
            // UI 업데이트 (클라이언트 로컬 정보 반영)
            this.scene.player.updateUI();
        }
        
        // 다른 플레이어들 상태 업데이트
        if (this.scene.otherPlayers?.children) {
            // 서버에서 받은 플레이어 ID 목록 생성
            const serverPlayerIds = new Set(playerStates.map(p => p.id));
            
            playerStates.forEach(playerState => {
                if (playerState.id === this.networkManager.playerId) return; // 본인 제외
                
                const otherPlayer = this.scene.otherPlayers.getChildren().find(p => p.networkId === playerState.id);
                if (otherPlayer) {
                    otherPlayer.hp = playerState.hp;
                    otherPlayer.maxHp = playerState.maxHp;
                    otherPlayer.level = playerState.level;
                    otherPlayer.jobClass = playerState.jobClass;
                    
                    // 스킬 시전 중 상태
                    otherPlayer.isCasting = playerState.isCasting;
                    
                    // size 정보 업데이트 추가
                    if (playerState.size !== undefined && playerState.size !== otherPlayer.size) {
                        otherPlayer.size = playerState.size;
                        otherPlayer.updateSize();
                    }
                    
                    // 무적 상태 정보 업데이트
                    if (playerState.isInvincible !== undefined) {
                        otherPlayer.isInvincible = playerState.isInvincible;
                    }
                    
                    // 기절 상태 정보 업데이트
                    if (playerState.isStunned !== undefined && playerState.isStunned !== otherPlayer.isStunned) {
                        otherPlayer.isStunned = playerState.isStunned;
                        
                        // 기절 상태가 true로 변경되었을 때 시각적 효과 표시
                        if (playerState.isStunned) {
                            this.showStunEffect(otherPlayer, 2000); // 2초 기절
                        }
                    }
                    
                    otherPlayer.updateJobSprite();
                }
            });
            
            // 서버에 없는 다른 플레이어들 제거 (서버와 동기화되지 않은 플레이어 정리)
            this.scene.otherPlayers.getChildren().forEach(otherPlayer => {
                if (otherPlayer.networkId && !serverPlayerIds.has(otherPlayer.networkId)) {
                    console.log(`서버에 존재하지 않는 다른 플레이어 제거: ${otherPlayer.networkId}`);
                    otherPlayer.destroy();
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
            
            // 데미지 효과 표시
            const damageToShow = data.actualDamage || data.damage;
            this.takeDamage(this.scene.player, damageToShow);
            
            // UI 업데이트
            this.scene.player.updateUI();
            
            // 사망 처리는 서버에서만 판정하므로 클라이언트에서는 제거
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
     * 플레이어 무적 상태 변경 처리
     */
    handlePlayerInvincibleChanged(data) {
        if (data.playerId === this.networkManager.playerId && this.scene.player) {
            // 본인 플레이어의 무적 상태 업데이트
            this.scene.player.isInvincible = data.isInvincible;
            
            // 무적 상태 메시지 표시
            const message = data.isInvincible ? '무적 모드 ON' : '무적 모드 OFF';
            const color = data.isInvincible ? '#00ff00' : '#ff0000';
            
            this.scene.effectManager.showMessage(
                this.scene.player.x, 
                this.scene.player.y - 80, 
                message, 
                { fill: color }
            );
            
            // UI 업데이트
            this.scene.player.updateUI();
        }
    }

    /**
     * 투사체 생성 처리
     */
    handleProjectileCreated(data) {
        if (this.scene.projectileManager) {
            this.scene.projectileManager.handleProjectileCreated(data);
        }
    }

    /**
     * 투사체 업데이트 처리
     */
    handleProjectilesUpdate(data) {
        if (this.scene.projectileManager) {
            this.scene.projectileManager.handleProjectilesUpdate(data);
        }
    }

    /**
     * 투사체 제거 처리
     */
    handleProjectileRemoved(data) {
        if (this.scene.projectileManager) {
            this.scene.projectileManager.handleProjectileRemoved(data);
        }
    }

    /**
     * 플레이어 기절 상태 처리
     */
    handlePlayerStunned(data) {
        const player = data.playerId === this.networkManager.playerId 
            ? this.scene.player 
            : this.scene.otherPlayers?.getChildren().find(p => p.networkId === data.playerId);
        
        if (player) {
            player.isStunned = data.isStunned;
            
            if (data.isStunned) {
                // 기절 효과 표시
                this.showStunEffect(player, data.duration || 2000);
            } else {
                // 기절 상태 해제 시 색상 복원
                player.clearTint();
            }
        }
    }

    /**
     * 플레이어 레벨업 처리
     */
    handlePlayerLevelUp(data) {
        // 본인 플레이어인 경우
        if (data.playerId === this.networkManager.playerId && this.scene.player) {
            const player = this.scene.player;
            
            // 서버에서 받은 스탯으로 업데이트
            if (data.level !== undefined) player.level = data.level;
            if (data.hp !== undefined) player.hp = data.hp;
            if (data.maxHp !== undefined) player.maxHp = data.maxHp;
            if (data.attack !== undefined) player.attack = data.attack;
            if (data.speed !== undefined) player.speed = data.speed;
            if (data.visionRange !== undefined) player.visionRange = data.visionRange;
            
            // 서버에서 받은 size로 직접 설정 (updateCharacterSize 대신)
            if (data.size !== undefined) {
                player.size = data.size;
                player.updateSize(); // 물리적 크기 업데이트
            } else {
                // 서버에서 size 정보가 없으면 경고만 출력 (클라이언트에서 계산하지 않음)
                console.warn(`handlePlayerLevelUp: 서버에서 size 정보가 누락됨. 기본값 유지: ${player.size}`);
            }
            
            // 레벨업 이펙트 표시
            this.scene.effectManager.showLevelUpEffect(player.x, player.y);
            
            // UI 업데이트
            player.updateUI();
            
        }
        
        // 다른 플레이어인 경우 (레벨 정보만 업데이트)
        if (this.scene.otherPlayers?.children) {
            const otherPlayer = this.scene.otherPlayers.getChildren().find(p => p.networkId === data.playerId);
            if (otherPlayer && data.level !== undefined) {
                otherPlayer.level = data.level;
                if (data.size !== undefined) {
                    otherPlayer.size = data.size;
                    otherPlayer.updateSize();
                }
            }
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
     * 적 상태 업데이트 처리 (중복 적 정리 포함)
     */
    handleEnemiesUpdate(enemiesData) {
        if (!this.scene.enemies) return;

        // 먼저 중복된 적들 정리
        this.cleanupDuplicateEnemies();

        // 서버에서 받은 적 데이터로 클라이언트 적들 업데이트
        enemiesData.forEach(enemyData => {
            // 같은 ID를 가진 모든 적들을 찾기
            const enemiesWithSameId = this.scene.enemies.getChildren().filter(e => e.networkId === enemyData.id);
            
            if (enemiesWithSameId.length === 0) {
                // 새로운 적 생성
                this.createNetworkEnemy(enemyData);
            } else if (enemiesWithSameId.length === 1) {
                // 정상적인 경우: 기존 적 상태 업데이트
                enemiesWithSameId[0].applyServerStats(enemyData);
            } else {
                // 중복된 적들이 있는 경우: 첫 번째만 유지하고 나머지 제거
                console.warn(`중복된 적 발견 (ID: ${enemyData.id}): ${enemiesWithSameId.length}개 → 1개로 정리`);
                
                // 첫 번째 적만 업데이트하고 유지
                enemiesWithSameId[0].applyServerStats(enemyData);
                
                // 나머지 중복된 적들 제거
                for (let i = 1; i < enemiesWithSameId.length; i++) {
                    console.log(`중복 적 제거: ID ${enemyData.id} (${i + 1}/${enemiesWithSameId.length})`);
                    enemiesWithSameId[i].destroy();
                }
            }
        });

        // 서버에 없는 적들 제거 (클라이언트에서만 존재하는 적들)
        const serverEnemyIds = new Set(enemiesData.map(e => e.id));
        this.scene.enemies.getChildren().forEach(enemy => {
            if (enemy.networkId && !serverEnemyIds.has(enemy.networkId)) {
                console.log(`서버에 존재하지 않는 적 제거: ${enemy.networkId}`);
                enemy.destroy();
            }
        });
    }

    /**
     * 플레이어 직업 변경 처리
     */
    handlePlayerJobChanged(data) {
        // 본인 플레이어 직업 변경 처리
        if (data.id === this.networkManager.playerId && this.scene.player) {
            this.scene.player.setJobClass(data.jobClass);
            
            // 직업 변경 후 UI 업데이트
            this.scene.player.updateUI();
            
            return;
        }
        
        // 다른 플레이어 직업 변경 처리
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
                
                // 데미지 효과 표시 (스폰 배리어 표시 포함)
                this.scene.effectManager.showDamageText(
                    this.scene.player.x, 
                    this.scene.player.y - 60, 
                    `-${data.damage} (스폰 배리어)`, 
                    '#ff0000'
                );
                
                // 피격 효과
                this.scene.player.setTint(0xff0000);
                this.scene.time.delayedCall(200, () => {
                    if (this.scene.player && this.scene.player.active && !this.scene.player.isDead) {
                        this.scene.player.clearTint();
                    }
                });
            }
        } else {
            // 다른 플레이어가 데미지를 받은 경우
            const otherPlayer = this.scene.otherPlayers?.getChildren().find(p => p.networkId === data.playerId);
            if (otherPlayer) {
                otherPlayer.hp = data.currentHp;
                
                // 다른 플레이어 데미지 효과 표시
                this.takeDamage(otherPlayer, data.damage);
            }
        }
    }
    
    /**
     * 플레이어 사망 처리
     */
    handlePlayerDied(data) {
        if (data.playerId === this.networkManager.playerId) {
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
                
                // 스킬 관련 상태 초기화
                otherPlayer.isCasting = false;
                otherPlayer.isStunned = false;
                otherPlayer.isStealth = false;
                
                // 지연된 스킬 이펙트들 정리
                if (otherPlayer.clearDelayedSkillEffects) {
                    otherPlayer.clearDelayedSkillEffects();
                }
                
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
        if (data.playerId === this.networkManager.playerId) {
            // 본인 리스폰 처리
            if (this.scene.player) {
                // 플레이어 다시 활성화
                this.scene.player.isDead = false;
                this.scene.player.setVisible(true);
                this.scene.player.setActive(true);
                
                // 스킬 관련 상태 초기화
                this.scene.player.isCasting = false;
                this.scene.player.isUsingSlimeSkill = false;
                this.scene.player.isUsingWarriorSkill = false;
                this.scene.player.isStunned = false;
                this.scene.player.isStealth = false;
                
                // 색상 초기화 (데미지로 인한 빨간색 제거)
                this.scene.player.clearTint();
                
                // 위치 설정 (스프라이트와 물리 바디 모두)
                this.scene.player.setPosition(data.x, data.y);
                if (this.scene.player.body) {
                    this.scene.player.body.setEnable(true);
                    this.scene.player.body.reset(data.x, data.y);
                }
                
                // 방향을 front로 초기화
                this.scene.player.direction = 'front';
                this.scene.player.updateJobSprite();
                
                // 이름표도 다시 표시
                if (this.scene.player.nameText) {
                    this.scene.player.nameText.setVisible(true);
                    this.scene.player.updateNameTextPosition();
                }
                
                // HP 완전 회복
                this.scene.player.hp = data.hp;
                this.scene.player.maxHp = data.maxHp;
                this.scene.player.updateUI();
                
                // 카메라가 플레이어를 다시 따라가도록 설정
                this.scene.cameras.main.startFollow(this.scene.player);
                
                // 리스폰 이펙트
                this.scene.effectManager.showExplosion(data.x, data.y, 0x00ff00, 50);
                this.scene.effectManager.showMessage(
                    data.x, 
                    data.y - 50, 
                    '리스폰!', 
                    { fill: '#00ff00', fontSize: '20px' }
                );
                
                console.log('플레이어 리스폰 완료:', { x: data.x, y: data.y });
            }
        } else {
            // 다른 플레이어 리스폰 처리
            const otherPlayer = this.scene.otherPlayers?.getChildren().find(p => p.networkId === data.playerId);
            if (otherPlayer) {
                // 플레이어 상태 복원
                otherPlayer.isDead = false;
                otherPlayer.x = data.x;
                otherPlayer.y = data.y;
                otherPlayer.hp = data.hp;
                otherPlayer.maxHp = data.maxHp;
                otherPlayer.setVisible(true);
                
                // 스킬 관련 상태 초기화
                otherPlayer.isCasting = false;
                otherPlayer.isStunned = false;
                otherPlayer.isStealth = false;
                
                // 지연된 스킬 이펙트들 정리
                if (otherPlayer.clearDelayedSkillEffects) {
                    otherPlayer.clearDelayedSkillEffects();
                }
                
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
            
            // size는 항상 서버에서 제공되어야 함 (클라이언트에서 계산하지 않음)
            if (playerData.size !== undefined) {
                player.size = playerData.size;
            } else {
                console.warn(`handlePlayerStateSync: 서버에서 size 정보가 누락됨. 기본값 유지: ${player.size}`);
            }
            
            // UI 및 스프라이트 업데이트
            player.updateCharacterSize();
            player.updateSize();
            player.updateJobSprite();
            player.updateNameTextPosition();
            player.updateUI();
            
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
        
        // size는 항상 서버에서 제공되어야 함 (클라이언트에서 계산하지 않음)
        if (playerData.size !== undefined) {
            otherPlayer.size = playerData.size;
        } else {
            console.warn(`createOtherPlayer: 서버에서 size 정보가 누락됨. 기본값 사용`);
            otherPlayer.size = 32; // 기본 크기로 설정
        }
        
        // 사망 상태 설정
        otherPlayer.isDead = playerData.isDead || false;
        if (otherPlayer.isDead) {
            otherPlayer.setVisible(false);
            console.log(`다른 플레이어 ${playerData.id} 생성 시 사망 상태로 숨김`);
        }
        
        // 무적 상태 설정
        otherPlayer.isInvincible = playerData.isInvincible || false;
        
        otherPlayer.updateSize(); // 크기 업데이트 적용
        otherPlayer.updateJobSprite();
        
        this.scene.otherPlayers.add(otherPlayer);
        
        const otherPlayerDepth = 650;
        const nameTagDepth = otherPlayerDepth + 10; // VisionManager와 같은 로직 적용
        
        otherPlayer.setDepth(otherPlayerDepth);
        
        const displayName = playerData.nickname || `Player ${playerData.id.slice(0, 6)}`;
        otherPlayer.createNameText(displayName, playerData.team, nameTagDepth);
        
        // 체력바 depth도 이름표와 같게 설정
        if (otherPlayer.healthBar && otherPlayer.healthBar.container) {
            otherPlayer.healthBar.container.setDepth(nameTagDepth);
        }
        
        return otherPlayer;
    }

    /**
     * 네트워크 적 생성 (중복 생성 방지 포함)
     */
    createNetworkEnemy(enemyData) {
        // 중복 생성 방지: 이미 같은 ID의 적이 있는지 확인
        if (this.scene.enemies) {
            const existingEnemy = this.scene.enemies.getChildren().find(e => e.networkId === enemyData.id);
            if (existingEnemy) {
                console.warn(`적 중복 생성 방지: ID ${enemyData.id}가 이미 존재합니다. 기존 적 업데이트.`);
                existingEnemy.applyServerStats(enemyData);
                return existingEnemy;
            }
        }

        const enemy = new Enemy(this.scene, enemyData.x, enemyData.y, enemyData.type);
        enemy.setNetworkId(enemyData.id);
        enemy.setDepth(600); // 그림자(700) 아래로 설정
        
        // 서버에서 받은 모든 정보 적용
        enemy.applyServerStats(enemyData);
        
        if (this.scene.enemies?.add) {
            this.scene.enemies.add(enemy);
        }
        return enemy;
    }

    /**
     * 중복된 적들 정리 (같은 ID를 가진 적이 여러 개 있는 경우)
     */
    cleanupDuplicateEnemies() {
        if (!this.scene.enemies) return;

        const enemies = this.scene.enemies.getChildren();
        const enemyGroups = new Map(); // ID별로 적들을 그룹화

        // ID별로 적들 그룹화
        enemies.forEach(enemy => {
            if (enemy.networkId) {
                if (!enemyGroups.has(enemy.networkId)) {
                    enemyGroups.set(enemy.networkId, []);
                }
                enemyGroups.get(enemy.networkId).push(enemy);
            }
        });

        // 중복된 적들 정리
        let totalDuplicatesRemoved = 0;
        enemyGroups.forEach((enemyList, enemyId) => {
            if (enemyList.length > 1) {
                console.warn(`중복 적 정리: ID ${enemyId}에 ${enemyList.length}개의 적이 있음`);
                
                // 첫 번째 적만 유지하고 나머지 제거
                for (let i = 1; i < enemyList.length; i++) {
                    console.log(`중복 적 제거: ID ${enemyId} (${i + 1}/${enemyList.length})`);
                    enemyList[i].destroy();
                    totalDuplicatesRemoved++;
                }
            }
        });

        if (totalDuplicatesRemoved > 0) {
            console.log(`중복 적 정리 완료: 총 ${totalDuplicatesRemoved}개 제거`);
        }
    }

    /**
     * 스킬 이펙트 표시 - 각 직업 클래스에 위임
     */
    showSkillEffect(player, skillType, data = null) {
        if (!player || !player.job) return;
        
        switch (skillType) {
            case 'basic_attack':
                this.showBasicAttackEffect(player, data);
                break;
            case 'stealth':
                if (player.job.showStealthEffect) {
                    player.job.showStealthEffect(data);
                }
                break;
            case 'jump':
                this.showJumpEffect(player, data);
                break;
            case 'spread':
            case 'slime_spread':
                if (player.job.showSpreadEffect) {
                    player.job.showSpreadEffect(data);
                }
                break;
            case 'ward':
                if (player.job.showWardEffect) {
                    player.job.showWardEffect(data);
                }
                break;
            case 'ice_field':
                if (player.job.showIceFieldEffect) {
                    player.job.showIceFieldEffect(data);
                }
                break;
            case 'magic_missile':
                if (player.job.showMagicMissileEffect) {
                    player.job.showMagicMissileEffect(data);
                }
                break;
            case 'roar':
                if (player.job.showRoarEffect) {
                    player.job.showRoarEffect(data);
                }
                break;
            case 'sweep':
                if (player.job.showSweepEffect) {
                    player.job.showSweepEffect(data);
                }
                break;
            case 'thrust':
                if (player.job.showThrustEffect) {
                    player.job.showThrustEffect(data);
                }
                break;
        }
    }

    /**
     * 기본 공격 이펙트 - 각 직업 클래스에 위임
     */
    showBasicAttackEffect(player, data = null) {
        if (!player || !player.job) return;
        
        const jobClass = data?.jobClass || player.jobClass;
        
        // targetX, targetY를 숫자로 확실히 변환
        let targetX = player.x;
        let targetY = player.y;
        
        if (data && typeof data.targetX === 'number' && typeof data.targetY === 'number') {
            targetX = data.targetX;
            targetY = data.targetY;
        }
        
        // 각 직업의 기본 공격 애니메이션 메서드 호출
        if (player.job.showBasicAttackEffect) {
            player.job.showBasicAttackEffect(targetX, targetY);
        }
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
        const skillInfo = data?.skillInfo || {};
        const duration = skillInfo.duration || 400;
        
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
     * 기절 이펙트
     */
    showStunEffect(player, duration = 2000) {
        // 기절 상태 표시 (회색으로 변색)
        player.setTint(0x888888);
        
        // 기절 텍스트 표시
        const stunText = this.scene.add.text(
            player.x, 
            player.y - 80, 
            '기절!', 
            {
                fontSize: '16px',
                fill: '#888888',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        // 기절 지속시간 후 효과 제거
        this.scene.time.delayedCall(duration, () => {
            if (player.active) {
                player.clearTint();
            }
            if (stunText.active) {
                stunText.destroy();
            }
        });
        
        // 기절 텍스트는 1초 후 제거
        this.scene.time.delayedCall(1000, () => {
            if (stunText.active) {
                stunText.destroy();
            }
        });
    }

    /**
     * 정리 작업
     */
    destroy() {
        if (this.networkManager) {
            this.networkManager.disconnect();
        }
    }

    /**
     * 플레이어 업데이트 에러 처리 (이동 시 player not found)
     */
    handlePlayerUpdateError(data) {
        console.log('플레이어 업데이트 실패:', data.error);
        
        // "Player not found" 에러 감지 시 즉시 게임 초기화
        if (data.error && (
            data.error.includes('Player not found') || 
            data.error.includes('player not found') ||
            data.error === 'Player not found'
        )) {
            console.warn('이동 중 Player not found 에러 감지! 게임을 초기화하고 로그인 화면으로 돌아갑니다.');
            this.handlePlayerNotFoundError();
            return;
        }
        
        // 기타 에러 처리 (필요시 추가)
        console.warn('알 수 없는 플레이어 업데이트 에러:', data.error);
    }

    /**
     * 네트워크 연결 해제 처리
     */
    handleNetworkDisconnect() {
        console.warn('NetworkEventManager: 서버 연결이 끊어졌습니다. 로그인 화면으로 돌아갑니다.');
        console.log('NetworkEventManager: handlePlayerNotFoundError 호출 중...');
        
        // 연결 해제 시에도 같은 방식으로 처리
        this.handlePlayerNotFoundError();
    }

    /**
     * 네트워크 연결 오류 처리
     */
    handleNetworkError(error) {
        console.error('서버 연결 오류:', error);
        // 여기에 추가적인 오류 처리 로직을 추가할 수 있습니다.
    }

    /**
     * 레벨업 에러 처리
     */
    handleLevelUpError(data) {
        console.error('레벨업 실패:', data.error);
        
        if (this.scene.player && this.scene.effectManager) {
            this.scene.effectManager.showMessage(
                this.scene.player.x, 
                this.scene.player.y - 60, 
                `레벨업 실패: ${data.error}`, 
                { fill: '#ff0000' }
            );
        }
    }

    /**
     * 몬스터 공격 처리 (데미지만 처리, 애니메이션 제거)
     */
    handleMonsterAttack(data) {
        if (data.playerId === this.networkManager.playerId) {
            // 자신이 공격받은 경우
            if (this.scene.player) {
                this.scene.player.hp = data.newHp;
                this.scene.player.updateUI();
                
                // 데미지 효과 처리
                if (data.damage > 0) {
                    this.takeDamage(this.scene.player, data.damage);
                } else {
                    // 무적 상태로 데미지가 0일 때
                    this.scene.effectManager.showMessage(
                        this.scene.player.x, 
                        this.scene.player.y - 30, 
                        '무적!', 
                        { fill: '#00ff00' }
                    );
                }
            }
        } else {
            // 다른 플레이어가 공격받은 경우
            const otherPlayer = this.scene.otherPlayers?.getChildren().find(p => p.networkId === data.playerId);
            if (otherPlayer) {
                // 다른 플레이어 피격 효과 처리
                if (data.damage > 0) {
                    this.takeDamage(otherPlayer, data.damage);
                } else {
                    // 무적 상태로 데미지가 0일 때
                    this.scene.effectManager.showMessage(
                        otherPlayer.x, 
                        otherPlayer.y - 30, 
                        '무적!',
                        { fill: '#00ff00' }
                    );
                }
            }
        }
    }

    /**
     * 플레이어 데미지 받는 효과 처리 (빨간색 틴트만, 원 애니메이션 제거)
     * @param {Object} player - 대상 플레이어 객체
     * @param {number} damage - 데미지 양
     */
    takeDamage(player, damage) {
        if (!player || damage <= 0) return;

        // 데미지 텍스트 표시
        this.scene.effectManager.showDamageText(
            player.x,
            player.y,
            `${damage}`,
            '#ff0000'
        );

        // 피격 효과 (연한 빨간색 tint만)
        player.setTint(0xff0000);
        this.scene.time.delayedCall(200, () => {
            if (player && player.active && !player.isDead) {
                player.clearTint();
            }
        });
    }

    /**
     * 공격 무효 처리
     */
    handleAttackInvalid(data) {
        console.log('attack-invalid 이벤트 수신:', data);
        
        // effectManager가 있는지 확인
        if (!this.scene.effectManager) {
            console.error('effectManager가 없습니다!');
            return;
        }

        const color = data.message === '공격 무효!' ? '#ff0000' : '#00ff00';
        
        // 빨간색 "공격 무효!" 메시지를 해당 위치에 표시
        this.scene.effectManager.showMessage(
            data.x, 
            data.y - 30, 
            data.message, 
            { 
                fill: color,
                fontSize: '18px',
                fontStyle: 'bold'
            },
            500 // 1.5초 동안 표시
        );
        
        console.log(`메시지 표시: "${data.message}" at (${data.x}, ${data.y})`);
    }

    /**
     * 몬스터 기절 상태 처리
     */
    handleEnemyStunned(data) {
        // 해당 몬스터를 찾아서 기절 상태 업데이트
        const enemy = this.scene.enemies?.getChildren().find(e => e.networkId === data.enemyId);
        if (enemy) {
            // 몬스터의 기절 상태 업데이트
            if (data.isStunned) {
                // 기절 시작 - 몬스터 위에 기절 표시
                this.scene.effectManager.showMessage(
                    enemy.x, 
                    enemy.y - 40, 
                    '기절!', 
                    { 
                        fill: '#ffff00',
                        fontSize: '14px',
                        fontStyle: 'bold'
                    },
                    data.duration || 2000
                );
                
                // 몬스터 색상 변경 (기절 표시)
                if (enemy.sprite) {
                    enemy.sprite.setTint(0x888888); // 회색으로 변경
                }
            } else {
                // 기절 해제 - 몬스터 색상 복구
                if (enemy.sprite) {
                    enemy.sprite.clearTint();
                }
            }
        }
    }
}