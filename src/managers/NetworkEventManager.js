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
        console.log('NetworkEventManager: 이벤트 리스너 설정 시작');
        
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

        // 적 관련 이벤트
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



        this.networkManager.on('monster-attack', (data) => {
            this.handleMonsterAttack(data);
        });
        
        // 플레이어 상태 업데이트
        this.networkManager.on('players-state-update', (data) => {
            this.handlePlayersStateUpdate(data);
        });
        
        // 기타 이벤트
        this.setupMiscEvents();

        // 연결 해제
        this.networkManager.on('disconnect', () => {
            console.log('NetworkEventManager: disconnect 이벤트 수신됨');
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
            console.log('player-invincible-changed 이벤트 수신:', data);
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
        
        // 서버의 무적 상태 동기화
        this.scene.player.isInvincible = data.playerData.isInvincible || false;
        if (this.scene.player.isInvincible) {
            console.log('게임 입장 시 무적 상태로 설정됨');
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
            // 본인 플레이어의 스킬 사용 성공 시 쿨타임 설정 (울부짖기는 이미 설정됨)
            if (isOwnPlayer && player.job && data.skillType !== 'roar') {
                this.setSkillCooldown(player, data.skillType);
            }
            
            // 기본 공격 쿨다운 설정
            if (isOwnPlayer && data.skillType === 'basic_attack' && player.job) {
                const cooldowns = {
                    'slime': 600,
                    'ninja': 500,
                    'archer': 500,
                    'mage': 800,
                    'assassin': 300,
                    'warrior': 800,
                    'supporter': 700,
                    'mechanic': 750
                };
                const cooldown = cooldowns[player.jobClass] || 600;
                player.job.setSkillCooldown('basic_attack', cooldown);
            }
            
            // 데미지 결과 처리
            if (data.damageResult) {
                this.handleSkillDamageResult(data.damageResult);
            }
            
            // 타임스탬프 기반 이펙트 동기화 (모든 스킬 타입 통일 처리)
            const currentTime = Date.now();
            const skillDelay = currentTime - data.timestamp;
            
            // 지연시간이 너무 크면 (1초 이상) 이펙트 스킵
            if (skillDelay > 1000) {
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
            
            // 다른 플레이어들 제거
            if (this.scene.otherPlayers && this.scene.otherPlayers.active) {
                try {
                    this.scene.otherPlayers.clear(true, true);
                } catch (e) {
                    console.warn('다른 플레이어 제거 중 오류:', e);
                }
            }
            
            // 적들 제거
            if (this.scene.enemies && this.scene.enemies.active) {
                try {
                    this.scene.enemies.clear(true, true);
                } catch (e) {
                    console.warn('적 제거 중 오류:', e);
                }
            }
            
            // 기타 게임 오브젝트들 초기화
            this.gameJoined = false;
            this.playerId = null;
            this.playerTeam = null;
            
            console.log('게임 상태 초기화 완료');
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
                this.scene.player.defense = myPlayerState.stats.defense;
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
            
            // size 정보 업데이트
            if (myPlayerState.size !== undefined && myPlayerState.size !== this.scene.player.size) {
                this.scene.player.size = myPlayerState.size;
                this.scene.player.updateSize();
            }
            
            // 무적 상태 정보 업데이트
            if (myPlayerState.isInvincible !== undefined) {
                this.scene.player.isInvincible = myPlayerState.isInvincible;
            }
            
            // UI 업데이트 (서버에서 받은 정보 사용)
            this.scene.player.updateUIFromServer();
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
                    
                    // size 정보 업데이트 추가
                    if (playerState.size !== undefined && playerState.size !== otherPlayer.size) {
                        otherPlayer.size = playerState.size;
                        otherPlayer.updateSize();
                    }
                    
                    // 무적 상태 정보 업데이트
                    if (playerState.isInvincible !== undefined) {
                        otherPlayer.isInvincible = playerState.isInvincible;
                    }
                    
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
            
            console.log(`본인 플레이어 무적 상태 변경: ${data.isInvincible}`);
        }
    }

    /**
     * 플레이어 레벨업 처리
     */
    handlePlayerLevelUp(data) {
        console.log('서버에서 레벨업 처리:', data);
        
        // 본인 플레이어인 경우
        if (data.playerId === this.networkManager.playerId && this.scene.player) {
            const player = this.scene.player;
            
            // 서버에서 받은 스탯으로 업데이트
            if (data.level !== undefined) player.level = data.level;
            if (data.hp !== undefined) player.hp = data.hp;
            if (data.maxHp !== undefined) player.maxHp = data.maxHp;
            if (data.attack !== undefined) player.attack = data.attack;
            if (data.defense !== undefined) player.defense = data.defense;
            if (data.speed !== undefined) player.speed = data.speed;
            if (data.visionRange !== undefined) player.visionRange = data.visionRange;
            
            // 서버에서 받은 size로 직접 설정 (updateCharacterSize 대신)
            if (data.size !== undefined) {
                console.log(`서버에서 받은 size로 업데이트: ${player.size} -> ${data.size}`);
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
            
            console.log(`본인 플레이어 레벨업 완료: 레벨 ${player.level}, HP: ${player.hp}/${player.maxHp}, 크기: ${player.size}`);
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
                console.log(`다른 플레이어 ${data.playerId} 레벨업: 레벨 ${data.level}, 크기: ${otherPlayer.size}`);
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
                // 기존 적 상태 업데이트 - 서버에서 받은 모든 정보 적용
                enemy.applyServerStats(enemyData);
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
        // 본인 플레이어 직업 변경 처리
        if (data.id === this.networkManager.playerId && this.scene.player) {
            this.scene.player.setJobClass(data.jobClass);
            console.log(`본인 직업 변경: ${data.jobClass}`);
            return;
        }
        
        // 다른 플레이어 직업 변경 처리
        if (!this.scene.otherPlayers?.children) return;
        
        const otherPlayer = this.scene.otherPlayers.getChildren().find(p => p.networkId === data.id);
        if (otherPlayer) {
            otherPlayer.jobClass = data.jobClass;
            otherPlayer.updateJobSprite();
            console.log(`다른 플레이어 ${data.id} 직업 변경: ${data.jobClass}`);
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
        console.log('플레이어 리스폰 이벤트 수신:', data);
        
        if (data.playerId === this.networkManager.playerId) {
            // 본인 리스폰 처리
            if (this.scene.player) {
                // 플레이어 다시 활성화
                this.scene.player.isDead = false;
                this.scene.player.setVisible(true);
                this.scene.player.setActive(true);
                
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
            
            // size는 항상 서버에서 제공되어야 함 (클라이언트에서 계산하지 않음)
            if (playerData.size !== undefined) {
                player.size = playerData.size;
                console.log(`handlePlayerStateSync: 서버에서 받은 size 설정: ${playerData.size}`);
            } else {
                console.warn(`handlePlayerStateSync: 서버에서 size 정보가 누락됨. 기본값 유지: ${player.size}`);
            }
            
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
        
        // size는 항상 서버에서 제공되어야 함 (클라이언트에서 계산하지 않음)
        if (playerData.size !== undefined) {
            otherPlayer.size = playerData.size;
            console.log(`createOtherPlayer: 서버에서 받은 size 설정: ${playerData.size}`);
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
        enemy.setDepth(600); // 그림자(700) 아래로 설정
        
        // 서버에서 받은 모든 정보 적용
        enemy.applyServerStats(enemyData);
        
        if (this.scene.enemies?.add) {
            this.scene.enemies.add(enemy);
        }
        return enemy;
    }



    /**
     * 스킬 이펙트 표시
     */
    showSkillEffect(player, skillType, data = null) {
        switch (skillType) {
            case 'basic_attack':
                this.showBasicAttackEffect(player, data);
                break;
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
     * 기본 공격 이펙트
     */
    showBasicAttackEffect(player, data = null) {
        const jobClass = data?.jobClass || player.jobClass;
        
        // targetX, targetY를 숫자로 확실히 변환
        let targetX = player.x;
        let targetY = player.y;
        
        if (data && typeof data.targetX === 'number' && typeof data.targetY === 'number') {
            targetX = data.targetX;
            targetY = data.targetY;
        }
        
        // 직업별 기본 공격 이펙트 처리
        switch (jobClass) {
            case 'slime':
                this.showSlimeBasicAttackEffect(player, targetX, targetY);
                break;
            case 'ninja':
                this.showNinjaBasicAttackEffect(player, targetX, targetY);
                break;
            case 'archer':
                this.showArcherBasicAttackEffect(player, targetX, targetY);
                break;
            case 'mage':
                this.showMageBasicAttackEffect(player, targetX, targetY);
                break;
            case 'assassin':
                this.showAssassinBasicAttackEffect(player, targetX, targetY);
                break;
            case 'warrior':
                this.showWarriorBasicAttackEffect(player, targetX, targetY);
                break;
            case 'supporter':
                this.showSupporterBasicAttackEffect(player, targetX, targetY);
                break;
            case 'mechanic':
                this.showMechanicBasicAttackEffect(player, targetX, targetY);
                break;
        }
    }

    /**
     * 마법 폭발 이펙트 생성
     */
    createMagicExplosion(x, y) {
        console.log('마법 범위 공격 효과 생성:', x, y);
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
     * 화살 폭발 이펙트 생성 (매우 작게)
     */
    createArrowExplosion(x, y) {
        console.log('화살 폭발 효과 생성:', x, y);
        const explosion = this.scene.add.circle(x, y, 5, 0xFF8C00, 0.6);
        this.scene.tweens.add({
            targets: explosion,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                explosion.destroy();
            }
        });
    }

    /**
     * 표창 폭발 이펙트 생성 (매우 작게)
     */
    createShurikenExplosion(x, y) {
        console.log('표창 폭발 효과 생성:', x, y);
        const explosion = this.scene.add.circle(x, y, 5, 0x800080, 0.6);
        this.scene.tweens.add({
            targets: explosion,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                explosion.destroy();
            }
        });
    }

    /**
     * 슬라임 폭발 이펙트 생성 (매우 작게)
     */
    createSlimeExplosion(x, y) {
        console.log('슬라임 폭발 효과 생성:', x, y);
        const explosion = this.scene.add.circle(x, y, 5, 0x00ff00, 0.6);
        this.scene.tweens.add({
            targets: explosion,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                explosion.destroy();
            }
        });
    }

    /**
     * 슬라임 기본 공격 이펙트 (원거리 투사체)
     */
    showSlimeBasicAttackEffect(player, targetX, targetY) {
        // 투사체 생성 (슬라임 투사체 스프라이트 사용)
        const projectile = this.scene.add.sprite(player.x, player.y, 'slime_basic_attack');
        this.scene.physics.add.existing(projectile);
        
        // 투사체 크기 설정
        projectile.setDisplaySize(12, 12);
        
        // 투사체 콜라이더 설정
        projectile.body.setCircle(32);
        projectile.body.setCollideWorldBounds(false);
        projectile.body.setBounce(0, 0);
        projectile.body.setDrag(0, 0);
        
        // 커서 방향으로 특정 거리까지 날아가도록 계산
        const angle = Phaser.Math.Angle.Between(player.x, player.y, targetX, targetY);
        const maxDistance = 250; // 최대 사정거리
        const finalX = player.x + Math.cos(angle) * maxDistance;
        const finalY = player.y + Math.sin(angle) * maxDistance;
        
        // 투사체 회전 (슬라임 투사체가 날아가는 방향을 향하도록)
        projectile.setRotation(angle);
        
        // 투사체 이동 (Tween 사용 + 물리 바디 위치 업데이트)
        const distance = Phaser.Math.Distance.Between(player.x, player.y, finalX, finalY);
        const duration = (distance / 250) * 1000; // 250은 투사체 속도
        
        const moveTween = this.scene.tweens.add({
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
                    projectile.destroy();
                }
            }
        });
        
        // 투사체 이펙트 (미세한 크기 변화)
        const effectTween = this.scene.tweens.add({
            targets: projectile,
            
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
        this.scene.physics.add.collider(projectile, this.scene.walls, (projectile, wall) => {
            if (projectile && projectile.active) {
                this.createSlimeExplosion(projectile.x, projectile.y);
                projectile.destroyProjectile();
            }
        });
        
        // 다른 플레이어와의 충돌 (시각적 효과만, 데미지는 서버에서 처리)
        if (this.scene.otherPlayers && this.scene.otherPlayers.getChildren) {
            this.scene.physics.add.overlap(projectile, this.scene.otherPlayers, (projectile, otherPlayer) => {
                // 발사한 플레이어 자신과는 충돌하지 않도록 제외
                if (otherPlayer && otherPlayer.networkId === player.networkId) {
                    return;
                }
                
                // 다른 팀 플레이어와만 충돌 처리 (발사한 플레이어 팀과 충돌 대상 플레이어 팀 비교)
                if (otherPlayer && otherPlayer.team && player.team && otherPlayer.team !== player.team) {
                    if (projectile && projectile.active) {
                        this.createSlimeExplosion(projectile.x, projectile.y);
                        projectile.destroyProjectile();
                    }
                }
            });
        }
        
        // 로컬 플레이어와의 충돌 (다른 팀 투사체만)
        if (this.scene.player && player.networkId !== this.scene.player.networkId) {
            this.scene.physics.add.overlap(projectile, this.scene.player, (projectile, localPlayer) => {
                // 발사한 플레이어와 로컬 플레이어가 다른 팀인지 확인
                const localPlayerTeam = this.scene.player?.team;
                const shooterTeam = player?.team;
                
                if (shooterTeam && localPlayerTeam && shooterTeam !== localPlayerTeam) {
                    if (projectile && projectile.active) {
                        console.log('슬라임 투사체가 다른 팀 로컬 플레이어와 충돌 - 폭발 효과 생성');
                        this.createSlimeExplosion(projectile.x, projectile.y);
                        projectile.destroyProjectile();
                    }
                }
            });
        }
        
        // 투사체 수명 설정 (3초 후 자동 제거)
        this.scene.time.delayedCall(3000, () => {
            if (projectile.active) {
                projectile.destroy();
            }
        });
    }

    /**
     * 닌자 기본 공격 이펙트 (원거리 투사체)
     */
    showNinjaBasicAttackEffect(player, targetX, targetY) {
        // 투사체 생성 (수리검 스프라이트 사용)
        const projectile = this.scene.add.sprite(player.x, player.y, 'ninja_basic_attack');
        this.scene.physics.add.existing(projectile);
        
        // 투사체 크기 설정
        projectile.setDisplaySize(18, 18);
        
        // 투사체 콜라이더 설정
        projectile.body.setCircle(20);
        projectile.body.setCollideWorldBounds(false);
        projectile.body.setBounce(0, 0);
        projectile.body.setDrag(0, 0);
        
        // 커서 방향으로 특정 거리까지 날아가도록 계산
        const angle = Phaser.Math.Angle.Between(player.x, player.y, targetX, targetY);
        const maxDistance = 300; // 최대 사정거리
        const finalX = player.x + Math.cos(angle) * maxDistance;
        const finalY = player.y + Math.sin(angle) * maxDistance;
        
        // 투사체 회전 (수리검이 날아가는 방향을 향하도록)
        projectile.setRotation(angle);
        
        // 투사체 이동 (Tween 사용 + 물리 바디 위치 업데이트)
        const distance = Phaser.Math.Distance.Between(player.x, player.y, finalX, finalY);
        const duration = (distance / 300) * 1000; // 300은 투사체 속도
        
        const moveTween = this.scene.tweens.add({
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
                    projectile.destroy();
                }
            }
        });
        
        // 투사체 이펙트 (회전 효과)
        const effectTween = this.scene.tweens.add({
            targets: projectile,
            angle: projectile.angle + 360,
            duration: 1000,
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
        this.scene.physics.add.collider(projectile, this.scene.walls, (projectile, wall) => {
            if (projectile && projectile.active) {
                this.createShurikenExplosion(projectile.x, projectile.y);
                projectile.destroyProjectile();
            }
        });
        
        // 다른 플레이어와의 충돌 (시각적 효과만, 데미지는 서버에서 처리)
        if (this.scene.otherPlayers && this.scene.otherPlayers.getChildren) {
            this.scene.physics.add.overlap(projectile, this.scene.otherPlayers, (projectile, otherPlayer) => {
                // 발사한 플레이어 자신과는 충돌하지 않도록 제외
                if (otherPlayer && otherPlayer.networkId === player.networkId) {
                    return;
                }
                
                // 다른 팀 플레이어와만 충돌 처리 (발사한 플레이어 팀과 충돌 대상 플레이어 팀 비교)
                if (otherPlayer && otherPlayer.team && player.team && otherPlayer.team !== player.team) {
                    if (projectile && projectile.active) {
                        this.createShurikenExplosion(projectile.x, projectile.y);
                        projectile.destroyProjectile();
                    }
                }
            });
        }
        
        // 로컬 플레이어와의 충돌 (다른 팀 투사체만)
        if (this.scene.player && player.networkId !== this.scene.player.networkId) {
            this.scene.physics.add.overlap(projectile, this.scene.player, (projectile, localPlayer) => {
                // 발사한 플레이어와 로컬 플레이어가 다른 팀인지 확인
                const localPlayerTeam = this.scene.player?.team;
                const shooterTeam = player?.team;
                
                if (shooterTeam && localPlayerTeam && shooterTeam !== localPlayerTeam) {
                    if (projectile && projectile.active) {
                        console.log('닌자 투사체가 다른 팀 로컬 플레이어와 충돌 - 폭발 효과 생성');
                        this.createShurikenExplosion(projectile.x, projectile.y);
                        projectile.destroyProjectile();
                    }
                }
            });
        }
        
        // 투사체 수명 설정 (3초 후 자동 제거)
        this.scene.time.delayedCall(3000, () => {
            if (projectile.active) {
                projectile.destroy();
            }
        });
    }

    /**
     * 궁수 기본 공격 이펙트 (원거리 투사체)
     */
    showArcherBasicAttackEffect(player, targetX, targetY) {
        // 투사체 생성 (화살 스프라이트 사용)
        const projectile = this.scene.add.sprite(player.x, player.y, 'archer_basic_attack');
        this.scene.physics.add.existing(projectile);
        
        // 투사체 크기 설정
        projectile.setDisplaySize(16, 16);
        
        // 투사체 콜라이더 설정
        projectile.body.setCircle(24);
        projectile.body.setCollideWorldBounds(false);
        projectile.body.setBounce(0, 0);
        projectile.body.setDrag(0, 0);
        
        // 커서 방향으로 특정 거리까지 날아가도록 계산
        const angle = Phaser.Math.Angle.Between(player.x, player.y, targetX, targetY);
        const maxDistance = 400; // 최대 사정거리
        const finalX = player.x + Math.cos(angle) * maxDistance;
        const finalY = player.y + Math.sin(angle) * maxDistance;
        
        // 투사체 회전 (화살이 날아가는 방향을 향하도록)
        projectile.setRotation(angle);
        
        // 투사체 이동 (Tween 사용 + 물리 바디 위치 업데이트)
        const distance = Phaser.Math.Distance.Between(player.x, player.y, finalX, finalY);
        const duration = (distance / 300) * 1000; // 300은 투사체 속도
        
        const moveTween = this.scene.tweens.add({
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
                    projectile.destroy();
                }
            }
        });
        
        const effectTween = this.scene.tweens.add({
            targets: projectile,
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
        this.scene.physics.add.collider(projectile, this.scene.walls, (projectile, wall) => {
            if (projectile && projectile.active) {
                this.createArrowExplosion(projectile.x, projectile.y);
                projectile.destroyProjectile();
            }
        });
        
        // 다른 플레이어와의 충돌 (시각적 효과만, 데미지는 서버에서 처리)
        if (this.scene.otherPlayers && this.scene.otherPlayers.getChildren) {
            this.scene.physics.add.overlap(projectile, this.scene.otherPlayers, (projectile, otherPlayer) => {
                // 발사한 플레이어 자신과는 충돌하지 않도록 제외
                if (otherPlayer && otherPlayer.networkId === player.networkId) {
                    return;
                }
                
                // 다른 팀 플레이어와만 충돌 처리 (발사한 플레이어 팀과 충돌 대상 플레이어 팀 비교)
                if (otherPlayer && otherPlayer.team && player.team && otherPlayer.team !== player.team) {
                    if (projectile && projectile.active) {
                        this.createArrowExplosion(projectile.x, projectile.y);
                        projectile.destroyProjectile();
                    }
                }
            });
        }
        
        // 로컬 플레이어와의 충돌 (다른 팀 투사체만)
        if (this.scene.player && player.networkId !== this.scene.player.networkId) {
            this.scene.physics.add.overlap(projectile, this.scene.player, (projectile, localPlayer) => {
                // 발사한 플레이어와 로컬 플레이어가 다른 팀인지 확인
                const localPlayerTeam = this.scene.player?.team;
                const shooterTeam = player?.team;
                
                if (shooterTeam && localPlayerTeam && shooterTeam !== localPlayerTeam) {
                    if (projectile && projectile.active) {
                        console.log('궁수 투사체가 다른 팀 로컬 플레이어와 충돌 - 폭발 효과 생성');
                        this.createArrowExplosion(projectile.x, projectile.y);
                        projectile.destroyProjectile();
                    }
                }
            });
        }
        
        // 투사체 수명 설정 (3초 후 자동 제거)
        this.scene.time.delayedCall(3000, () => {
            if (projectile.active) {
                projectile.destroy();
            }
        });
    }

    /**
     * 마법사 기본 공격 이펙트 (원거리 투사체)
     */
    showMageBasicAttackEffect(player, targetX, targetY) {
        // 투사체 생성 (파란색 빛나는 점)
        const projectile = this.scene.add.circle(player.x, player.y, 4, 0x0000ff, 1);
        this.scene.physics.add.existing(projectile);
        
        // 투사체 콜라이더 설정
        projectile.body.setCircle(4);
        projectile.body.setCollideWorldBounds(false);
        projectile.body.setBounce(0, 0);
        projectile.body.setDrag(0, 0);
        
        // 커서 방향으로 특정 거리까지 날아가도록 계산
        const angle = Phaser.Math.Angle.Between(player.x, player.y, targetX, targetY);
        const maxDistance = 350; // 최대 사정거리
        const finalX = player.x + Math.cos(angle) * maxDistance;
        const finalY = player.y + Math.sin(angle) * maxDistance;
        
        // 투사체 이동 (Tween 사용 + 물리 바디 위치 업데이트)
        const distance = Phaser.Math.Distance.Between(player.x, player.y, finalX, finalY);
        const duration = (distance / 280) * 1000; // 280은 투사체 속도
        
        const moveTween = this.scene.tweens.add({
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
        const effectTween = this.scene.tweens.add({
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
        this.scene.physics.add.collider(projectile, this.scene.walls, (projectile, wall) => {
            if (projectile && projectile.active) {
                // 마법사는 벽 충돌 시에도 범위 공격 실행
                this.createMagicExplosion(projectile.x, projectile.y);
                projectile.destroyProjectile();
            }
        });
        
        // 다른 플레이어와의 충돌 (시각적 효과만, 데미지는 서버에서 처리)
        if (this.scene.otherPlayers && this.scene.otherPlayers.getChildren) {
            this.scene.physics.add.overlap(projectile, this.scene.otherPlayers, (projectile, otherPlayer) => {
                // 발사한 플레이어 자신과는 충돌하지 않도록 제외
                if (otherPlayer && otherPlayer.networkId === player.networkId) {
                    return;
                }
                
                // 다른 팀 플레이어와만 충돌 처리 (발사한 플레이어 팀과 충돌 대상 플레이어 팀 비교)
                if (otherPlayer && otherPlayer.team && player.team && otherPlayer.team !== player.team) {
                    if (projectile && projectile.active) {
                        // 마법사는 충돌 시 범위 공격 실행
                        this.createMagicExplosion(projectile.x, projectile.y);
                        projectile.destroyProjectile();
                    }
                }
            });
        }
        
        // 로컬 플레이어와의 충돌 (다른 팀 투사체만)
        if (this.scene.player && player.networkId !== this.scene.player.networkId) {
            this.scene.physics.add.overlap(projectile, this.scene.player, (projectile, localPlayer) => {
                // 발사한 플레이어와 로컬 플레이어가 다른 팀인지 확인
                const localPlayerTeam = this.scene.player?.team;
                const shooterTeam = player?.team;
                
                if (shooterTeam && localPlayerTeam && shooterTeam !== localPlayerTeam) {
                    if (projectile && projectile.active) {
                        console.log('마법사 투사체가 다른 팀 로컬 플레이어와 충돌 - 폭발 효과 생성');
                        this.createMagicExplosion(projectile.x, projectile.y);
                        projectile.destroyProjectile();
                    }
                }
            });
        }
        
        // 투사체 수명 설정 (3초 후 자동 제거)
        this.scene.time.delayedCall(3000, () => {
            if (projectile.active) {
                projectile.destroy();
            }
        });
    }

    /**
     * 어쌔신 기본 공격 이펙트 (근접 부채꼴)
     */
    showAssassinBasicAttackEffect(player, targetX, targetY) {
        // 부채꼴 공격 범위 설정
        const attackRange = 40;
        const angleOffset = Math.PI / 6; // 30도 (π/6)
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = player.x;
        const centerY = player.y;
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
        // 부채꼴의 시작과 끝 각도 계산
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        // 부채꼴 근접 공격 이펙트 (검은색 부채꼴)
        const graphics = this.scene.add.graphics();
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
        this.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                graphics.destroy();
            }
        });
        
        // 두 번째 공격 (150ms 후)
        this.scene.time.delayedCall(150, () => {
            const graphics2 = this.scene.add.graphics();
            graphics2.fillStyle(0x000000, 0.7);
            graphics2.lineStyle(2, 0x000000, 1);
            
            graphics2.beginPath();
            graphics2.moveTo(centerX, centerY);
            graphics2.arc(centerX, centerY, attackRange, startAngle, endAngle);
            graphics2.closePath();
            graphics2.fill();
            graphics2.stroke();
            
            this.scene.tweens.add({
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
     * 전사 기본 공격 이펙트 (근접 부채꼴)
     */
    showWarriorBasicAttackEffect(player, targetX, targetY) {
        // 부채꼴 공격 범위 설정
        const attackRange = 60;
        const angleOffset = Math.PI / 6; // 30도 (π/6)
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = player.x;
        const centerY = player.y;
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
        // 부채꼴의 시작과 끝 각도 계산
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        // 부채꼴 근접 공격 이펙트 (빨간색 부채꼴)
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(0xff0000, 0.8);
        graphics.lineStyle(3, 0xff0000, 1);
        
        // 부채꼴 그리기
        graphics.beginPath();
        graphics.moveTo(centerX, centerY);
        graphics.arc(centerX, centerY, attackRange, startAngle, endAngle);
        graphics.closePath();
        graphics.fill();
        graphics.stroke();
        
        // 이펙트 애니메이션
        this.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 400,
            onComplete: () => {
                graphics.destroy();
            }
        });
    }

    /**
     * 서포터 기본 공격 이펙트 (근접 부채꼴)
     */
    showSupporterBasicAttackEffect(player, targetX, targetY) {
        // 부채꼴 공격 범위 설정
        const attackRange = 55;
        const angleOffset = Math.PI / 6; // 30도 (π/6)
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = player.x;
        const centerY = player.y;
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
        // 부채꼴의 시작과 끝 각도 계산
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        // 부채꼴 근접 공격 이펙트 (노란색 부채꼴)
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(0xFFFF00, 0.6);
        graphics.lineStyle(2, 0xFFFF00, 1);
        
        // 부채꼴 그리기
        graphics.beginPath();
        graphics.moveTo(centerX, centerY);
        graphics.arc(centerX, centerY, attackRange, startAngle, endAngle);
        graphics.closePath();
        graphics.fill();
        graphics.stroke();
        
        // 이펙트 애니메이션
        this.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 350,
            onComplete: () => {
                graphics.destroy();
            }
        });
    }

    /**
     * 메카닉 기본 공격 이펙트 (근접 부채꼴)
     */
    showMechanicBasicAttackEffect(player, targetX, targetY) {
        // 부채꼴 공격 범위 설정
        const attackRange = 50;
        const angleOffset = Math.PI / 6; // 30도 (π/6)
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = player.x;
        const centerY = player.y;
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
        // 부채꼴의 시작과 끝 각도 계산
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        // 부채꼴 근접 공격 이펙트 (카키색 부채꼴)
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(0x556B2F, 0.7);
        graphics.lineStyle(2, 0x556B2F, 1);
        
        // 부채꼴 그리기
        graphics.beginPath();
        graphics.moveTo(centerX, centerY);
        graphics.arc(centerX, centerY, attackRange, startAngle, endAngle);
        graphics.closePath();
        graphics.fill();
        graphics.stroke();
        
        // 이펙트 애니메이션
        this.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 380,
            onComplete: () => {
                graphics.destroy();
            }
        });
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
     * 몬스터 공격 처리
     */
    handleMonsterAttack(data) {
        if (data.playerId === this.networkManager.playerId) {
            // 자신이 공격받은 경우
            if (this.scene.player) {
                this.scene.player.hp = data.newHp;
                this.scene.player.updateUI();
                
                // 데미지 이펙트 표시
                if (data.damage > 0) {
                    this.scene.effectManager.showDamageText(
                        this.scene.player.x,
                        this.scene.player.y - 60,
                        `-${data.damage}`,
                        '#ff0000'
                    );
                } else {
                    // 무적 상태로 데미지가 0일 때
                    this.scene.effectManager.showMessage(
                        this.scene.player.x, 
                        this.scene.player.y - 30, 
                        '무적!', 
                        { fill: '#00ff00' }
                    );
                }
                
                // 피격 효과 (사망 판정은 서버에서만 처리, 데미지가 있을 때만)
                if (data.damage > 0) {
                    this.scene.player.setTint(0xff0000);
                    this.scene.time.delayedCall(200, () => {
                        if (this.scene.player && this.scene.player.active && !this.scene.player.isDead) {
                            this.scene.player.clearTint();
                        }
                    });
                }
            }
        } else {
            // 다른 플레이어가 공격받은 경우
            const otherPlayer = this.scene.otherPlayers?.getChildren().find(p => p.networkId === data.playerId);
            if (otherPlayer) {
                // 다른 플레이어도 피격 효과 표시
                if (data.damage > 0) {
                    this.scene.effectManager.showDamageText(
                        otherPlayer.x,
                        otherPlayer.y - 60,
                        `-${data.damage}`,
                        '#ff0000'
                    );
                    
                    // 피격 효과 (사망 판정은 서버에서만 처리)
                    otherPlayer.setTint(0xff0000);
                    this.scene.time.delayedCall(200, () => {
                        if (otherPlayer && otherPlayer.active && !otherPlayer.isDead) {
                            otherPlayer.clearTint();
                        }
                    });
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
} 