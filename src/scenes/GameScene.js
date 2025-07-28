import Phaser from 'phaser';
import NetworkManager from '../utils/NetworkManager.js';
import NetworkEventManager from '../managers/NetworkEventManager.js';
import MapManager from '../managers/MapManager.js';
import VisionManager from '../managers/VisionManager.js';
import MinimapManager from '../managers/MinimapManager.js';
import PingManager from '../managers/PingManager.js';
import CheatManager from '../managers/CheatManager.js';
import EffectManager from '../effects/EffectManager.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        
        // 기본 상태
        this.playerNickname = 'Player';
        this.isFirstJoin = true;
        this.playerTeam = null;
        this.playerId = null;
        
        // 게임 오브젝트
        this.player = null;
        this.otherPlayers = null;
        this.enemies = null;
        this.walls = null;
        this.spawnBarriers = null;
        this.activeWard = null;
        
        // 맵 정보
        this.MAP_WIDTH = 0;
        this.MAP_HEIGHT = 0;
        this.TILE_SIZE = 0;
        this.SPAWN_WIDTH = 0;
        this.PLAZA_SIZE = 0;
        this.PLAZA_X = 0;
        this.PLAZA_Y = 0;
        this.redSpawnRect = null;
        this.blueSpawnRect = null;
        this.plazaRect = null;
        
        // 탭 활성 상태
        this.isTabActive = true;
        this.wasJumping = false;
        
        // 매니저들
        this.networkManager = null;
        this.networkEventManager = null;
        this.mapManager = null;
        this.visionManager = null;
        this.minimapManager = null;
        this.pingManager = null;
        this.cheatManager = null;
        this.effectManager = null;
    }
    
    init(data) {
        if (data?.playerNickname) {
            this.playerNickname = data.playerNickname;
            console.log('플레이어 닉네임:', this.playerNickname);
        }
    }
    
    create() {
        console.log('GameScene create() 시작');
        
        // 네트워크 매니저 초기화
        this.networkManager = new NetworkManager();
        
        // 게임 상태 리셋
        this.resetGameState();
        
        // 물리 그룹 초기화
        this.otherPlayers = this.physics.add.group();
        this.enemies = this.physics.add.group();
        
        // 매니저들 초기화
        this.initializeManagers();
        
        // 네트워크 이벤트 설정
        this.networkEventManager.setupNetworkListeners();
        
        // 게임 입장 요청
        this.networkManager.joinGame({
            nickname: this.playerNickname
        });
        
        // UI 설정
        this.setupUI();
        
        // 탭 포커스 이벤트 처리
        this.setupTabFocusHandlers();
        
        console.log('GameScene 초기화 완료');
    }



    /**
     * 매니저들 초기화
     */
    initializeManagers() {
        this.networkEventManager = new NetworkEventManager(this);
        this.mapManager = new MapManager(this);
        this.visionManager = new VisionManager(this);
        this.minimapManager = new MinimapManager(this);
        this.pingManager = new PingManager(this);
        this.cheatManager = new CheatManager(this);
        this.effectManager = new EffectManager(this);
        
        // 그래디언트 텍스처 생성
        this.visionManager.createGradientTexture();
        
        console.log('모든 매니저 초기화 완료');
    }
    
    /**
     * 게임 상태 리셋
     */
    resetGameState() {
        console.log('게임 상태 리셋 시작');
        
        // 기존 플레이어 제거
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
        
        // 다른 플레이어들 제거
        if (this.otherPlayers?.children) {
            this.otherPlayers.clear(true, true);
        }
        
        // 적들 제거
        if (this.enemies?.children) {
            this.enemies.clear(true, true);
        }
        
        // 네트워크 상태 초기화
        if (this.networkEventManager) {
            this.networkEventManager.resetGameState();
        }
        
        console.log('게임 상태 리셋 완료');
    }
    
    /**
     * UI 설정
     */
    setupUI() {
        // 게임 UI 표시
        const gameUI = document.getElementById('game-ui');
        if (gameUI) {
            gameUI.style.display = 'block';
        }

        // 게임 제목 텍스트
        this.add.text(16, 16, 'RPG Slime', {
            fontSize: '32px',
            fill: '#fff',
            fontFamily: 'Arial'
        }).setScrollFactor(0);
    }

    /**
     * 탭 포커스 이벤트 핸들러 설정
     */
    setupTabFocusHandlers() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onTabBlur();
            } else {
                this.onTabFocus();
            }
        });

        this.game.events.on('pause', () => {
            this.onGamePause();
        });

        this.game.events.on('resume', () => {
            this.onGameResume();
        });

        console.log('탭 포커스 이벤트 핸들러 설정 완료');
    }

    /**
     * 탭 비활성화 처리
     */
    onTabBlur() {
        console.log('탭 비활성화 - 게임 일시정지');
        this.isTabActive = false;
        this.tweens.pauseAll();
        this.savePlayerStates();
    }

    /**
     * 탭 활성화 처리
     */
    onTabFocus() {
        console.log('탭 활성화 - 게임 재개 및 동기화');
        this.isTabActive = true;
        this.requestGameStateSync();
        
        this.time.delayedCall(500, () => {
            this.tweens.resumeAll();
        });
    }

    /**
     * 게임 일시정지 처리
     */
    onGamePause() {
        console.log('게임 일시정지');
        this.savePlayerStates();
    }

    /**
     * 게임 재개 처리
     */
    onGameResume() {
        console.log('게임 재개 - 상태 동기화');
        this.requestGameStateSync();
    }

    /**
     * 플레이어 상태 저장
     */
    savePlayerStates() {
        if (this.player) {
            this.playerStateBeforePause = {
                x: this.player.x,
                y: this.player.y,
                isJumping: this.player.isJumping
            };
        }

        this.otherPlayerStatesBeforePause = {};
        if (this.otherPlayers?.children) {
            this.otherPlayers.getChildren().forEach(otherPlayer => {
                this.otherPlayerStatesBeforePause[otherPlayer.networkId] = {
                    x: otherPlayer.x,
                    y: otherPlayer.y,
                    isJumping: otherPlayer.isJumping
                };
            });
        }
    }

    /**
     * 서버 상태 동기화 요청
     */
    requestGameStateSync() {
        if (this.networkManager && this.playerId) {
            console.log('서버 상태 동기화 요청');
            this.networkManager.requestGameSync();
        }
    }

    /**
     * 플레이어 상태 복원
     */
    restorePlayerStates(syncData) {
        // 본인 플레이어 상태 복원
        if (this.player && syncData.players) {
            const myPlayerData = syncData.players.find(p => p.id === this.playerId);
            if (myPlayerData) {
                // 기존 액션 중단
                if (this.player.isJumping) {
                    this.player.isJumping = false;
                    this.tweens.killTweensOf(this.player);
                }
                
                // 위치 및 기본 상태 복원
                this.player.x = myPlayerData.x;
                this.player.y = myPlayerData.y;
                this.player.direction = myPlayerData.direction;
                
                // 크기 정보 복원
                if (myPlayerData.size && myPlayerData.size !== this.player.size) {
                    this.player.setSize(myPlayerData.size);
                }
                
                // 액션 상태 복원
                this.restorePlayerActions(this.player, myPlayerData.activeActions);
                
                console.log('본인 플레이어 상태 복원 완료');
            }
        }

        // 다른 플레이어들 상태 복원
        if (this.otherPlayers?.children && syncData.players) {
            this.otherPlayers.getChildren().forEach(otherPlayer => {
                const playerData = syncData.players.find(p => p.id === otherPlayer.networkId);
                if (playerData) {
                    // 기존 액션 중단
                    if (otherPlayer.isJumping) {
                        otherPlayer.isJumping = false;
                        this.tweens.killTweensOf(otherPlayer);
                        if (otherPlayer.nameText) {
                            this.tweens.killTweensOf(otherPlayer.nameText);
                        }
                    }
                    
                    // 위치 및 기본 상태 복원
                    otherPlayer.x = playerData.x;
                    otherPlayer.y = playerData.y;
                    otherPlayer.direction = playerData.direction;
                    
                    // 크기 정보 복원
                    if (playerData.size && playerData.size !== otherPlayer.size) {
                        otherPlayer.size = playerData.size;
                        otherPlayer.updateSize();
                    }
                    
                    // 액션 상태 복원
                    this.restorePlayerActions(otherPlayer, playerData.activeActions);
                    
                    otherPlayer.updateNameTextPosition();
                }
            });
            
            console.log('다른 플레이어들 상태 복원 완료');
        }

        // 적들 상태 복원
        if (this.enemies?.children && syncData.enemies) {
            this.enemies.getChildren().forEach(enemy => {
                const enemyData = syncData.enemies.find(e => e.id === enemy.networkId);
                if (enemyData) {
                    // 기존 이동 애니메이션 중단
                    this.tweens.killTweensOf(enemy);
                    
                    // 즉시 위치 및 상태 업데이트
                    enemy.x = enemyData.x;
                    enemy.y = enemyData.y;
                    enemy.hp = enemyData.hp;
                    enemy.maxHp = enemyData.maxHp;
                    
                    // 물리 바디 위치 즉시 반영
                    if (enemy.body) {
                        enemy.body.setPosition(enemyData.x - enemy.width/2, enemyData.y - enemy.height/2);
                        
                        // 속도 정보도 복원
                        if (enemyData.vx !== undefined && enemyData.vy !== undefined) {
                            enemy.body.setVelocity(enemyData.vx, enemyData.vy);
                        }
                    }
                    
                    // HP 바 업데이트
                    if (enemy.hpBar) {
                        enemy.updateHpBar();
                    }
                    
                    // 공격 상태 복원
                    if (enemyData.isAttacking) {
                        enemy.playAttackAnimation();
                    }
                }
            });
            
            console.log('적들 상태 복원 완료');
        }
    }

    /**
     * 플레이어 액션 상태 복원
     */
    restorePlayerActions(player, activeActions) {
        if (!activeActions) return;

        // 점프 상태 복원
        if (activeActions.jump && activeActions.jump.remainingTime > 0) {
            player.isJumping = true;
            
            // 남은 시간만큼 점프 애니메이션 진행
            const remainingTime = activeActions.jump.remainingTime;
            this.tweens.add({
                targets: player,
                y: player.y - 40,
                duration: remainingTime / 2,
                ease: 'Power2.easeOut',
                yoyo: true,
                onComplete: () => {
                    player.isJumping = false;
                }
            });
            
            console.log(`점프 상태 복원: ${remainingTime}ms 남음`);
        }

        // 스킬 상태 복원
        if (activeActions.skills && activeActions.skills.length > 0) {
            activeActions.skills.forEach(skillData => {
                if (skillData.remainingTime > 0) {
                    // 스킬 효과 복원 (남은 시간 고려)
                    this.restoreSkillEffect(player, skillData);
                    console.log(`스킬 ${skillData.skillType} 상태 복원: ${skillData.remainingTime}ms 남음`);
                }
            });
        }
    }

    /**
     * 스킬 효과 복원
     */
    restoreSkillEffect(player, skillData) {
        // 스킬 타입별로 남은 시간만큼 효과 적용
        switch (skillData.skillType) {
            case 'stealth':
                // 은신 효과 복원
                player.setAlpha(0.3);
                this.time.delayedCall(skillData.remainingTime, () => {
                    player.setAlpha(1);
                });
                break;
                
            case 'ward':
                // 와드 효과 복원
                if (player.wardEffect) {
                    player.wardEffect.destroy();
                }
                player.wardEffect = this.add.circle(player.x, player.y, 30, 0x00ff00, 0.3);
                this.time.delayedCall(skillData.remainingTime, () => {
                    if (player.wardEffect) {
                        player.wardEffect.destroy();
                        player.wardEffect = null;
                    }
                });
                break;
                
            case 'charge':
                // 차지 효과는 이미 완료되었을 가능성이 높으므로 스킵
                break;
                
            default:
                // 기타 스킬들은 남은 시간만큼 대기
                this.time.delayedCall(skillData.remainingTime, () => {
                    console.log(`스킬 ${skillData.skillType} 효과 종료`);
                });
                break;
        }
    }
    
    update(time, delta) {
        // 플레이어가 생성되지 않았으면 대기
        if (!this.player) {
            return;
        }
        
        // 치트 키 처리
        this.cheatManager.handleCheatKeys();
        
        // 점프 상태 변화 감지 및 카메라 제어
        if (this.player.isJumping && !this.wasJumping) {
            this.cameras.main.stopFollow();
            this.wasJumping = true;
        } else if (!this.player.isJumping && this.wasJumping) {
            this.cameras.main.startFollow(this.player);
            this.wasJumping = false;
        }
        
        // 벽 충돌 체크 (점프 중이 아닐 때만)
        if (!this.player.isJumping) {
            const collidingWall = this.mapManager.checkPlayerWallCollision();
            if (collidingWall) {
                this.mapManager.pushPlayerOutOfWall(collidingWall);
            }
        }
        
        // 플레이어 업데이트
        this.player.update(time, delta);
        
        // 적들 업데이트
        if (this.enemies?.children) {
            this.enemies.getChildren().forEach(enemy => {
                enemy.update(time, delta);
            });
        }

        // 맵 토글 처리
        this.minimapManager.handleMapToggle();

        // 점프 중이 아닐 때만 시야 및 미니맵 업데이트
        if (!this.player.isJumping) {
            this.minimapManager.updateMinimapVision();
            this.visionManager.updateVision();

            if (this.minimapManager.bigMapVisible) {
                this.minimapManager.drawBigMap();
            } else {
                this.minimapManager.updateMinimap();
            }
        }

        // 핑 시스템 업데이트
        this.pingManager.updatePingArrows();
        this.pingManager.updateMinimapPingPositions();
        
        // 와드 탐지 시스템 업데이트
        this.minimapManager.updateWardDetectedEnemies();

        // 이동 제한
        this.mapManager.restrictMovement();
    }

    /**
     * 카메라 줌 변경 시 UI 스케일 조정
     */
    updateUIScale(cameraZoom) {
        this.visionManager.updateUIScale(cameraZoom);
        this.minimapManager.updateUIScale(cameraZoom);
    }

    /**
     * 정리 작업
     */
    destroy() {
        // 매니저들 정리
        if (this.networkEventManager) {
            this.networkEventManager.destroy();
        }
        if (this.mapManager) {
            this.mapManager.destroy();
        }
        if (this.visionManager) {
            this.visionManager.destroy();
        }
        if (this.minimapManager) {
            this.minimapManager.destroy();
        }
        if (this.pingManager) {
            this.pingManager.destroy();
        }
        if (this.cheatManager) {
            this.cheatManager.destroy();
        }
        
        super.destroy();
    }
}