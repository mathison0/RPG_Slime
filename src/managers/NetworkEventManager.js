import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import JobOrb from '../entities/JobOrb.js';
import { AssetConfig } from '../shared/AssetConfig.js';
import AssetLoader from '../utils/AssetLoader.js';
import PingManager from './PingManager.js';
import MinimapManager from './MinimapManager.js';
import { getGlobalTimerManager } from './AbsoluteTimerManager.js';

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
        
        // 참고: this.effectManager는 제거됨 - scene.effectManager 사용
        // 참고: player, otherPlayers, enemies, cheatManager는 scene에서 직접 접근
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
        
        console.log('NetworkEventManager: networkManager 확인됨, 이벤트 리스너 등록 시작');
        
        // 먼저 기존 리스너들 제거 (중복 방지)
        this.networkManager.off('game-joined');
        this.networkManager.off('player-joined');
        this.networkManager.off('player-left');
        this.networkManager.off('player-moved');
        this.networkManager.off('player-skill-used');
        this.networkManager.off('skill-error');
        this.networkManager.off('player-update-error');
        // this.networkManager.off('player-death'); // 사용되지 않는 이벤트 제거
        this.networkManager.off('suicide-error');
        this.networkManager.off('player-invincible-changed');
        this.networkManager.off('invincible-error');
        this.networkManager.off('disconnect');
        this.networkManager.off('connect_error');
        this.networkManager.off('player-stunned');
        this.networkManager.off('projectiles-update');
        this.networkManager.off('projectile-removed');
        this.networkManager.off('attack-invalid');
        this.networkManager.off('player-exp-gained');
        this.networkManager.off('enemy-stunned');
        this.networkManager.off('magic-missile-explosion');
        this.networkManager.off('shield-removed');
        this.networkManager.off('player-buffed');
        this.networkManager.off('enemy-slowed');
        this.networkManager.off('player-slowed');
        
        // 직업 변경 오브 관련 이벤트 제거
        this.networkManager.off('job-orb-spawned');
        this.networkManager.off('job-orb-removed');
        this.networkManager.off('job-orb-collected');
        this.networkManager.off('job-orb-collision-result');
        
        this.networkManager.off('stealth-ended');
      
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

        this.networkManager.on('skill-error', (data) => {
            this.handleSkillError(data);
        });
        
        this.networkManager.on('player-damaged', (data) => {
            this.handlePlayerDamaged(data);
        });
        
        this.networkManager.on('player-healed', (data) => {
            this.handlePlayerHealed(data);
        });
        
        this.networkManager.on('player-buffed', (data) => {
            this.handlePlayerBuffed(data);
        });
        
        this.networkManager.on('ward-destroyed', (data) => {
            this.handleWardDestroyed(data);
        });
        
        this.networkManager.on('player-level-up', (data) => {
            this.handlePlayerLevelUp(data);
        });

        this.networkManager.on('level-up-error', (data) => {
            this.handleLevelUpError(data);
        });

        this.networkManager.on('player-exp-gained', (data) => {
            this.handlePlayerExpGained(data);
        });

        this.networkManager.on('attack-invalid', (data) => {
            this.handleAttackInvalid(data);
        });

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

        // 몬스터 기절 상태
        this.networkManager.on('enemy-stunned', (data) => {
            this.handleEnemyStunned(data);
        });

        // 마법 투사체 폭발
        this.networkManager.on('magic-missile-explosion', (data) => {
            this.handleMagicMissileExplosion(data);
        });
        

        
        // 보호막 제거 이벤트
        this.networkManager.on('shield-removed', (data) => {
            this.handleShieldRemoved(data);
        });
        

        
        // 슬로우 효과 이벤트 리스너 추가
        this.networkManager.on('enemy-slowed', (data) => {
            this.handleEnemySlowed(data);
        });
        
        this.networkManager.on('player-slowed', (data) => {
            this.handlePlayerSlowed(data);
        });
        
        // 플레이어 상태 업데이트
        this.networkManager.on('players-state-update', (data) => {
            this.handlePlayersStateUpdate(data);
        });

        // 플레이어 기절 상태
        this.networkManager.on('player-stunned', (data) => {
            this.handlePlayerStunned(data);
        });

        // 은신 종료 이벤트
        console.log('NetworkEventManager: stealth-ended 이벤트 리스너 등록');
        this.networkManager.on('stealth-ended', (data) => {
            console.log('NetworkEventManager: stealth-ended 이벤트 수신됨:', data);
            this.handleStealthEnded(data);
        });

        // 투사체 업데이트 (스킬로 통합된 이후에도 필요)
        this.networkManager.on('projectiles-update', (data) => {
            this.handleProjectilesUpdate(data);
        });

        // 와드 업데이트
        this.networkManager.on('wards-update', (data) => {
            this.handleWardsUpdate(data);
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
        
        console.log('NetworkEventManager: 모든 이벤트 리스너 등록 완료');
    }

    /**
     * 기타 이벤트 설정
     */
    setupMiscEvents() {
        console.log('🔧 NetworkEventManager setupMiscEvents 시작');
        
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
        
        // 직업 변경 오브 관련 이벤트
        console.log('🔧 직업 변경 오브 이벤트 리스너 등록 중...');
        
        this.networkManager.on('job-orb-spawned', (data) => {
            console.log('🎯 job-orb-spawned 이벤트 리스너 호출됨');
            this.handleJobOrbSpawned(data);
        });
        
        this.networkManager.on('job-orb-removed', (data) => {
            console.log('🎯 job-orb-removed 이벤트 리스너 호출됨');
            this.handleJobOrbRemoved(data);
        });
        
        this.networkManager.on('job-orb-collected', (data) => {
            console.log('🎯 job-orb-collected 이벤트 리스너 호출됨');
            this.handleJobOrbCollected(data);
        });
        
        this.networkManager.on('job-orb-collision-result', (data) => {
            console.log('🎯 job-orb-collision-result 이벤트 리스너 호출됨');
            this.handleJobOrbCollisionResult(data);
        });
        
        console.log('✅ 직업 변경 오브 이벤트 리스너 등록 완료');
    }

    /**
     * 게임 입장 처리
     */
    handleGameJoined(data) {
    
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
        
        // 직업 변경 오브 충돌 감지 설정
        this.scene.setupJobOrbCollision();
        
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
                        otherPlayer.updateHealthBar();
                        
                        // 집중 이펙트가 있다면 함께 이동
                        if (otherPlayer.focusEffect && otherPlayer.focusEffect.active) {
                            otherPlayer.focusEffect.setPosition(otherPlayer.x, otherPlayer.y);
                        }
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
                
                // 스킬 시전 중이 아닐 때만 스프라이트 업데이트 (스킬 스프라이트 보호)
                if (!otherPlayer.isCasting) {
                    otherPlayer.updateJobSprite();
                }
            }
            // HP 정보 업데이트
            if (data.hp !== undefined && data.hp !== otherPlayer.hp) {
                otherPlayer.hp = data.hp;
            }
            if (data.maxHp !== undefined && data.maxHp !== otherPlayer.maxHp) {
                otherPlayer.maxHp = data.maxHp;
            }
            
            // 기절 상태는 player-stunned 이벤트로만 업데이트 (중복 처리 방지)
            
            // 스킬 시전 중이 아닐 때만 스프라이트 업데이트 (스킬 스프라이트 보호)
            if (!otherPlayer.isCasting) {
                otherPlayer.updateJobSprite();
            }
        }
    }

    /**
     * 스킬 사용 처리
     */
    handlePlayerSkillUsed(data) {
        const player = data.playerId === this.networkManager.playerId 
            ? this.scene.player 
            : this.scene.otherPlayers?.getChildren().find(p => p.networkId === data.playerId);
        
        if (!player) {
            console.warn(`플레이어를 찾을 수 없음: ${data.playerId}`);
            return;
        }

        // 플레이어가 사망한 경우 스킬 이펙트 무시
        if (player.isDead) {
            return;
        }

        // 스킬 스프라이트 상태 설정 (roar, spread 스킬만)
        if (data.skillType === 'roar' || data.skillType === 'spread') {
            const skillInfo = data.skillInfo;
            const duration = skillInfo?.duration || 0;
            
            if (duration > 0) {
                player.setSkillSpriteState(data.skillType, duration);
                console.log(`스킬 스프라이트 상태 설정: ${data.skillType}, 플레이어: ${data.playerId}, 지속시간: ${duration}ms`);
            }
        }

        // 칼춤 스킬 처리는 showSkillEffect에서 직접 처리

        // 본인 플레이어인 경우 쿨타임 설정 (서버 endTime 기반)
        if (data.playerId === this.networkManager.playerId && player.job) {
            // 서버에서 온 쿨타임 정보 사용
            const cooldownInfo = data.cooldownInfo;
            if (cooldownInfo && cooldownInfo.totalCooldown > 0) {
                // 서버 스킬 타입을 클라이언트 스킬 키로 변환
                let skillKey = null;
                
                if (data.skillType === 'basic_attack') {
                    skillKey = 'basic_attack'; // 기본 공격은 그대로 사용
                } else {
                    skillKey = player.getClientSkillKey(data.skillType);
                }
                
                if (skillKey && typeof player.job.setSkillCooldown === 'function') {
                    // 서버에서 온 총 쿨타임 시간 사용
                    player.job.setSkillCooldown(skillKey, cooldownInfo.totalCooldown);
                    
                    // 서버에서 온 쿨타임 정보를 플레이어에 저장 (UI에서 사용)
                    if (!player.serverCooldownInfo) {
                        player.serverCooldownInfo = {};
                    }
                    player.serverCooldownInfo[skillKey] = {
                        totalCooldown: cooldownInfo.totalCooldown,
                        endTime: cooldownInfo.cooldownEndTime
                    };
                    
                    console.log(`서버 승인 후 쿨타임 설정: ${skillKey} (총 ${cooldownInfo.totalCooldown}ms, 종료: ${cooldownInfo.cooldownEndTime})`);
                }
            }
        }

        // 서버 스킬 정보 추출
        const skillInfo = data.skillInfo;
        const delay = skillInfo.delay || 0;           // 시전시간 (예: 전사 휩쓸기 1초)
        const duration = skillInfo.duration || 0;     // 지속시간 (예: 은신 3초)
        const afterDelay = skillInfo.afterDelay || 0; // 후딜레이 시간
        
        // endTime 기준으로 타이밍 계산
        const currentTime = Date.now();
        const endTime = data.endTime;
        const timeUntilEnd = endTime - currentTime;
        
        // 후딜레이 완료 시간 계산
        const effectEndTime = endTime - afterDelay; // 실제 스킬 효과 종료 시간
        
        // 스킬이 이미 완료된 경우 스킵 (목긋기는 제외)
        if (timeUntilEnd < 0 && data.skillType !== 'backstab') {
            return;
        }

        if (delay > 0) {
            // 시전시간이 있는 스킬 (전사 휩쓸기, 찌르기 등)
            this.handleDelayedSkill(player, data, delay, duration, afterDelay, endTime, effectEndTime);
        } else if (duration > 0 && data.skillType === 'blade_dance') {
            // 칼춤 스킬은 showSkillEffect에서만 처리 (입력 차단 없음)
            this.showSkillEffect(player, data.skillType, {
                ...data,
                endTime: endTime,
                effectEndTime: effectEndTime
            });
        } else if (data.skillType === 'backstab') {
            // 목긋기 스킬은 즉시 처리 (순간이동)
            this.showSkillEffect(player, data.skillType, {
                ...data,
                endTime: endTime,
                effectEndTime: effectEndTime
            });
        } else if (duration > 0) {
            // 즉시 시작되는 지속 스킬 (은신, 와드 등)
            this.handleDurationSkill(player, data, duration, afterDelay, endTime, effectEndTime);
        } else {
            // 즉시 실행되는 스킬 (기본 공격 등)
            this.handleInstantSkill(player, data, afterDelay, endTime, effectEndTime);
        }
    }

    /**
     * 시전시간이 있는 스킬 처리 (전사 휩쓸기, 찌르기 등)
     */
    handleDelayedSkill(player, data, delay, duration, afterDelay, endTime, effectEndTime) {
        const currentTime = Date.now();
        const timeUntilCastEnd = effectEndTime - currentTime;

        // 위치 고정이 필요한 스킬인지 확인
        const needsPositionFreeze = this.shouldFreezePosition(data.skillType);
        
        // 플레이어 위치를 서버 위치로 고정 (시전시간 동안)
        if (needsPositionFreeze) {
            this.freezePlayerPosition(player, data.x, data.y);
        }

        // 후딜레이가 있는 스킬이면 플레이어 상태 설정
        if (afterDelay > 0) {
            player.isInAfterDelay = true;
            player.afterDelayEndTime = endTime; // 전체 스킬 완료 시간 (후딜레이 포함)
        }
        
        if (timeUntilCastEnd > 0) {
            // 즉시 시전 애니메이션 시작
            this.showSkillCastingEffect(player, data.skillType, {
                ...data,
                effectEndTime: effectEndTime,
                endTime: endTime,
            });

            // 시전 완료 시 위치 고정 해제
            if (needsPositionFreeze) {
                setTimeout(() => {
                    this.restorePlayerMovement(player);
                }, Math.max(0, timeUntilCastEnd));
            }
        } else {
            console.log(`스킬 효과 완료됨: ${data.skillType}`);
            // 이미 완료된 스킬인 경우 즉시 복원
            if (needsPositionFreeze) {
                this.restorePlayerMovement(player);
            }
        }
    }

    /**
     * 즉시 시작되는 지속 스킬 처리 (은신, 와드, 슬라임 퍼지기, 구르기 등)
     * 구르기는 위치 고정 없이 처리 (이동 중에도 사용 가능)
     */
    handleDurationSkill(player, data, duration, afterDelay, endTime, effectEndTime) {
        const currentTime = Date.now();
        const timeUntilEffectEnd = effectEndTime - currentTime;
        
        // 위치 고정이 필요한 스킬인지 확인 (슬라임 퍼지기 등)
        const needsPositionFreeze = this.shouldFreezePosition(data.skillType);
        
        // 구르기 스킬은 위치 고정 없이 처리
        if (data.skillType === 'roll') {
            if (timeUntilEffectEnd > 0) {
                this.showSkillEffect(player, data.skillType, {
                    ...data,
                    isDelayed: false,
                    endTime: endTime,
                    effectEndTime: effectEndTime
                });
            }
            
            // 구르기 완료 후 서버 위치로 동기화
            setTimeout(() => {
                if (data.x !== undefined && data.y !== undefined) {
                    console.log(`구르기 완료 후 위치 동기화: (${player.x}, ${player.y}) -> (${data.x}, ${data.y})`);
                    player.setPosition(data.x, data.y);
                }
            }, Math.max(0, timeUntilEffectEnd));
        } else {
            // 기존 위치 고정 스킬들 처리
            if (needsPositionFreeze) {
                this.freezePlayerPosition(player, data.x, data.y);
            }
            
            if (timeUntilEffectEnd > 0) {
                this.showSkillEffect(player, data.skillType, {
                    ...data,
                    isDelayed: false,
                    endTime: endTime,
                    effectEndTime: effectEndTime
                });

                // 스킬 효과 완료 시 위치 고정 해제
                if (needsPositionFreeze) {
                    setTimeout(() => {
                        this.restorePlayerMovement(player);
                    }, Math.max(0, timeUntilEffectEnd));
                }
            } else {
                // 스킬 효과는 끝났지만 아직 후딜레이 진행 중일 수 있음
                console.log(`지속 스킬 효과 완료됨: ${data.skillType}`);
                // 이미 완료된 스킬인 경우 즉시 복원
                if (needsPositionFreeze) {
                    this.restorePlayerMovement(player);
                }
            }
        }
    }

    /**
     * 즉시 실행되는 스킬 처리 (기본 공격 등)
     */
    handleInstantSkill(player, data, afterDelay, endTime, effectEndTime) {
        this.showSkillEffect(player, data.skillType, {
            ...data,
            endTime: endTime,
            effectEndTime: effectEndTime
        });
    }

    /**
     * 스킬 시전 이펙트 표시 (시전시간 동안의 애니메이션)
     */
    showSkillCastingEffect(player, skillType, data) {
        // 플레이어 job이 없는 경우 처리
        if (!player.job) {
            console.warn(`플레이어 ${player.networkId || 'local'}의 job이 null입니다. 직업: ${player.jobClass}`);
            // job 인스턴스 강제 생성 시도
            if (player.updateJobClass) {
                player.updateJobClass();
                console.log(`플레이어 ${player.networkId || 'local'}의 job 강제 생성 완료`);
            }
        }
        
        // 각 직업별 시전 이펙트 처리
        if (player.job) {
            switch (skillType) {
                case 'sweep':
                    if (player.job.showSweepCastingEffect) {
                        const mouseX = data.targetX;
                        const mouseY = data.targetY;
                        const skillInfo = data.skillInfo;
                        const angleOffset = skillInfo.angleOffset;
                        const range = skillInfo.range;
                        
                        player.job.showSweepCastingEffect(mouseX, mouseY, angleOffset, range, data.effectEndTime, data.endTime);
                    } else {
                        console.warn(`플레이어 ${player.networkId || 'local'}의 job에 showSweepCastingEffect 메서드가 없습니다`);
                    }
                    break;
                    
                case 'thrust':
                    // 전사 찌르기 시전 이펙트
                    if (player.job.showThrustCastingEffect) {
                        const mouseX = data.targetX;
                        const mouseY = data.targetY;
                        const skillInfo = data.skillInfo;
                        const height = skillInfo.range;
                        const width = skillInfo.width;
                        
                        player.job.showThrustCastingEffect(mouseX, mouseY, height, width, data.effectEndTime, data.endTime);
                    } else {
                        console.warn(`플레이어 ${player.networkId || 'local'}의 job에 showThrustCastingEffect 메서드가 없습니다`);
                    }
                    break;
                    
                default:
                    // 기타 직업의 시전 이펙트가 있다면 여기서 처리
                    if (player.job.showCastingEffect) {
                        player.job.showCastingEffect(skillType, data);
                    }
                    break;
            }
        } else {
            console.error(`플레이어 ${player.networkId || 'local'}의 job 생성에 실패했습니다. 스킬 이펙트를 표시할 수 없습니다.`);
        }
    }

    // setSkillCooldown 메서드는 사용되지 않아서 제거함
    // 쿨타임은 서버에서 계산하여 handlePlayerSkillUsed에서 직접 처리됨

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

    // handleSkillDamageResult 메서드는 사용되지 않아서 제거함
    // 데미지 결과는 각각의 개별 이벤트 (enemy-damaged, player-damaged 등)로 처리됨

    /**
     * 스킬 에러 처리
     */
    handleSkillError(data) {
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
            // 네트워크 핑 계산
            if (myPlayerState.timestamp) {
                const currentTime = Date.now();
                const ping = currentTime - myPlayerState.timestamp;
                this.scene.player.networkPing = Math.max(0, ping); // 음수 방지
            }
            
            // 기본 상태 정보
            this.scene.player.hp = myPlayerState.hp;
            this.scene.player.maxHp = myPlayerState.maxHp;
            this.scene.player.level = myPlayerState.level;
            this.scene.player.exp = myPlayerState.exp;
            this.scene.player.expToNext = myPlayerState.expToNext;
            this.scene.player.jobClass = myPlayerState.jobClass;
            
            // 스탯 정보 업데이트 (서버에서 계산된 값 사용)
            if (myPlayerState.stats) {
                // stats 객체 전체를 업데이트
                this.scene.player.stats = {
                    attack: myPlayerState.stats.attack,
                    speed: myPlayerState.stats.speed,
                    visionRange: myPlayerState.stats.visionRange,
                    basicAttackCooldown: myPlayerState.stats.basicAttackCooldown || 600 // 기본값 포함
                };
                
                // 개별 속성도 호환성을 위해 유지
                this.scene.player.attack = myPlayerState.stats.attack;
                this.scene.player.speed = myPlayerState.stats.speed;
                
                // 은신 해제 후 일정 시간 동안 시야 범위 업데이트 무시
                const currentTime = Date.now();
                const visionRestoreTime = this.scene.player.job?.visionRestoreTime || 0;
                const shouldIgnoreVisionUpdate = currentTime - visionRestoreTime < 1000; // 1초 동안 무시
                
                if (!shouldIgnoreVisionUpdate) {
                    this.scene.player.visionRange = myPlayerState.stats.visionRange;
                } else {
                    console.log('NetworkEventManager: 은신 해제 후 시야 범위 업데이트 무시됨 (경과시간:', currentTime - visionRestoreTime, 'ms)');
                }
            }
            
            // 직업 정보 저장 (UI에서 사용)
            this.scene.player.jobInfo = myPlayerState.jobInfo;
            
            // 스킬 쿨타임 endTime만 저장 (최대 쿨타임은 SkillCooldownUI에서 관리)
            if (myPlayerState.skillCooldowns) {
                this.scene.player.serverSkillCooldowns = {};
                Object.keys(myPlayerState.skillCooldowns).forEach(skillKey => {
                    const cooldownInfo = myPlayerState.skillCooldowns[skillKey];
                    if (cooldownInfo && cooldownInfo.nextAvailableTime) {
                        this.scene.player.serverSkillCooldowns[skillKey] = {
                            nextAvailableTime: cooldownInfo.nextAvailableTime
                        };
                    }
                });
            }
            
            // 활성 효과 정보
            this.scene.player.activeEffects = new Set(myPlayerState.activeEffects || []);
            
            // 버프 상태 동기화
            if (myPlayerState.buffs) {
                // console.log(`[클라이언트] 서버에서 받은 버프 정보:`, myPlayerState.buffs);
                // 기존 버프들 제거
                this.scene.player.buffs.clear();
                
                // 서버에서 받은 버프들 적용
                Object.keys(myPlayerState.buffs).forEach(buffType => {
                    const buffInfo = myPlayerState.buffs[buffType];
                    if (buffInfo.remainingTime > 0) {
                        this.scene.player.buffs.set(buffType, {
                            startTime: Date.now(),
                            duration: buffInfo.remainingTime,
                            endTime: Date.now() + buffInfo.remainingTime,
                            effect: buffInfo.effect
                        });
                    }
                });
            }
            
            // 은신 상태
            this.scene.player.isStealth = myPlayerState.isStealth;
            
            // 스킬 시전 중 상태
            this.scene.player.isCasting = myPlayerState.isCasting;

            this.scene.player.isJumping = myPlayerState.isJumping;

            this.scene.player.isDead = myPlayerState.isDead;
            
            // size 정보 업데이트
            if (myPlayerState.size !== undefined && myPlayerState.size !== this.scene.player.size) {
                this.scene.player.size = myPlayerState.size;
                this.scene.player.updateSize();
            }
            
            // 무적 상태 정보 업데이트
            if (myPlayerState.isInvincible !== undefined) {
                this.scene.player.isInvincible = myPlayerState.isInvincible;
            }
            
            // 활성 액션 정보 업데이트 (점프 endTime 포함)
            if (myPlayerState.activeActions) {
                // 점프 액션 처리
                if (myPlayerState.activeActions.jump && myPlayerState.activeActions.jump.endTime > Date.now()) {
                    this.scene.player.jumpEndTime = myPlayerState.activeActions.jump.endTime;
                    console.log(`점프 endTime 업데이트: ${this.scene.player.jumpEndTime}`);
                } else if (!myPlayerState.activeActions.jump && this.scene.player.jumpEndTime) {
                    // 점프 액션이 없으면 초기화
                    this.scene.player.jumpEndTime = null;
                    console.log('점프 endTime 초기화');
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
                    
                    // 직업 변경 시 job 인스턴스 업데이트
                    if (otherPlayer.jobClass !== playerState.jobClass) {
                        otherPlayer.jobClass = playerState.jobClass;
                        otherPlayer.updateJobClass();
                    }
                    
                    // 스킬 시전 중 상태
                    otherPlayer.isCasting = playerState.isCasting;
                    
                    // 은신 상태 처리
                    if (playerState.isStealth !== undefined) {
                        otherPlayer.isStealth = playerState.isStealth;
                    }
                    
                    // 다른 팀에게 보이는지 여부 처리
                    if (playerState.visibleToEnemies !== undefined) {
                        otherPlayer.visibleToEnemies = playerState.visibleToEnemies;
                        
                        // 다른 팀 플레이어가 은신 중이면 숨김 처리
                        if (this.scene.player && this.scene.player.team !== otherPlayer.team) {
                            if (!otherPlayer.visibleToEnemies && otherPlayer.isStealth) {
                                otherPlayer.setVisible(false);
                                // 닉네임과 체력바도 숨김
                                if (otherPlayer.nameText) {
                                    otherPlayer.nameText.setVisible(false);
                                }
                                if (otherPlayer.healthBar) {
                                    otherPlayer.healthBar.setVisible(false);
                                }
                            } else {
                                otherPlayer.setVisible(true);
                                // 닉네임과 체력바도 다시 표시
                                if (otherPlayer.nameText) {
                                    otherPlayer.nameText.setVisible(true);
                                }
                                if (otherPlayer.healthBar) {
                                    otherPlayer.healthBar.setVisible(true);
                                }
                            }
                        }
                        
                        // 체력바 강제 업데이트 (은신 상태 반영)
                        if (otherPlayer.healthBar) {
                            otherPlayer.healthBar.updateHealth(otherPlayer.hp, otherPlayer.maxHp);
                        }
                    }
                    
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
     * 플레이어 힐 처리 - 서버 신호 기반으로 틴트만 처리
     */
    handlePlayerHealed(data) {
        const targetPlayer = data.playerId === this.networkManager.playerId 
            ? this.scene.player 
            : this.scene.otherPlayers?.getChildren().find(p => p.networkId === data.playerId);
        
        if (!targetPlayer) return;
        
        // 본인 플레이어인 경우 체력 정보 업데이트
        if (targetPlayer === this.scene.player) {
            targetPlayer.setHealthFromServer(data.newHp, data.maxHp);
            targetPlayer.updateUI();
        }
        
        // 힐 텍스트 표시 (녹색)
        if (data.healAmount > 0) {
            this.scene.effectManager.showHealText(targetPlayer.x, targetPlayer.y, data.healAmount);
        }
        
        // 힐 상태 설정 및 노란색 tint 업데이트 (짧은 시간만)
        targetPlayer.isHealedTint = true;
        if (targetPlayer.updateTint) {
            targetPlayer.updateTint();
        }
        
        // 300ms 후 힐 tint 해제 (시각적 효과만)
        this.scene.time.delayedCall(300, () => {
            if (targetPlayer && targetPlayer.active && !targetPlayer.isDead) {
                targetPlayer.isHealedTint = false;
                if (targetPlayer.updateTint) {
                    targetPlayer.updateTint();
                }
            }
        });
    }

    /**
     * 플레이어 버프 처리 - 서버 신호 기반으로 추가/제거
     */
    handlePlayerBuffed(data) {
        const { playerId, effectId, speedMultiplier, attackSpeedMultiplier, duration } = data;
        
        const targetPlayer = this.findPlayerById(playerId);
        if (targetPlayer) {

            if (speedMultiplier === 1 && attackSpeedMultiplier === 1 && duration === 0) {
                
                // 버프 효과 해제 (서버 신호 기반)
                if (targetPlayer.buffEffects) {
                    targetPlayer.buffEffects = targetPlayer.buffEffects.filter(effect => effect.id !== effectId);
                }
                
                // 다른 버프 효과가 없으면 버프 tint 상태 해제
                if (!targetPlayer.buffEffects || targetPlayer.buffEffects.length === 0) {
                    targetPlayer.isBuffedTint = false;
                    if (targetPlayer.updateTint) {
                        targetPlayer.updateTint();
                    }
                    
                    // 실제 버프 시스템에서도 제거 (메인 플레이어인 경우)
                    if (targetPlayer === this.scene.player && targetPlayer.buffs) {
                        targetPlayer.buffs.clear();
                    }
                }
                
            } else {
                // 버프 효과 적용 (서버 신호 기반)
                if (!targetPlayer.buffEffects) {
                    targetPlayer.buffEffects = [];
                }
                
                const buffEffect = {
                    id: effectId,
                    speedMultiplier: speedMultiplier,
                    attackSpeedMultiplier: attackSpeedMultiplier
                };
                
                targetPlayer.buffEffects.push(buffEffect);
                
                // 버프 tint 상태 설정
                targetPlayer.isBuffedTint = true;
                if (targetPlayer.updateTint) {
                    targetPlayer.updateTint();
                }
                
                // 실제 버프 시스템에도 적용 (메인 플레이어인 경우)
                if (targetPlayer === this.scene.player && targetPlayer.applyBuff) {
                    const effect = {
                        speedMultiplier: speedMultiplier,
                        attackSpeedMultiplier: attackSpeedMultiplier
                    };
                    targetPlayer.applyBuff('speed_attack_boost', duration, effect);
                }
                
            }
        } else {
            console.warn(`[handlePlayerBuffed] 대상 플레이어를 찾을 수 없음: ${playerId}`);
        }
    }



    /**
     * 와드 파괴 처리
     */
    handleWardDestroyed(data) {
        console.log('와드 파괴 이벤트 받음:', data);
        
        // 와드 ID로 해당 와드 찾기
        this.scene.children.list.forEach(child => {
            if (child.texture && child.texture.key === 'ward') {
                // 와드 ID가 일치하거나, 소유자가 일치하는 와드 찾기
                if (child.wardId === data.wardId || 
                    (child.ownerId === data.playerId && !child.isOtherPlayerWard)) {
                    
                    console.log('와드 파괴됨:', child);
                    
                    if (child.destroyWard) {
                        child.destroyWard();
                    } else {
                        child.destroy();
                    }
                }
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
     * 투사체 업데이트 처리
     */
    handleProjectilesUpdate(data) {
        if (this.scene.projectileManager) {
            this.scene.projectileManager.handleProjectilesUpdate(data);
        }
    }

    /**
     * 와드 업데이트
     */
    handleWardsUpdate(data) {
        if (!this.scene || !this.scene.player) return;
        
        const { wards } = data;
        
        // 현재 씬의 와드 관리 초기화
        if (!this.scene.allWards) {
            this.scene.allWards = new Map(); // wardId -> wardSprite
        }
        
        // 서버에서 받은 와드 ID들
        const serverWardIds = new Set(wards.map(ward => ward.id));
        
        // 현재 씬에 있는 와드 중 서버에 없는 것들 제거
        for (const [wardId, wardSprite] of this.scene.allWards) {
            if (!serverWardIds.has(wardId)) {
                this.removeWardSprite(wardSprite);
                this.scene.allWards.delete(wardId);
            }
        }
        
        // 서버에서 받은 와드들 처리
        wards.forEach(ward => {
            if (!this.scene.allWards.has(ward.id)) {
                // 새로운 와드 생성
                this.createWardSprite(ward);
            }
            // 기존 와드는 위치나 속성이 변경되지 않으므로 업데이트 필요 없음
        });
    }
    
    /**
     * 와드 스프라이트 생성
     */
    createWardSprite(wardData) {
        const ward = this.scene.add.sprite(wardData.x, wardData.y, 'ward');
        ward.setScale(0.2);
        
        // 와드 소유자 확인
        const isMyWard = wardData.playerId === this.networkManager.playerId;
        const isMyTeam = wardData.team === this.scene.player.team;
        
        // 깊이 설정
        if (isMyWard) {
            ward.setDepth(1001); // 자신의 와드는 가장 위에
        } else if (isMyTeam) {
            ward.setDepth(1000); // 같은 팀 와드
        } else {
            ward.setDepth(999); // 다른 팀 와드는 시야 그림자보다 낮게
        }
        
        // 물리 바디 추가
        this.scene.physics.add.existing(ward);
        ward.body.setImmovable(true);
        ward.body.setSize(125, 125);
        
        // 와드 정보 저장
        ward.wardData = wardData;
        ward.wardId = wardData.id;
        ward.ownerId = wardData.playerId;
        ward.ownerTeam = wardData.team;
        
        // 범위 표시 (내 팀 와드만 표시)
        if (isMyTeam) {
            const rangeIndicator = this.scene.add.circle(ward.x, ward.y, wardData.range, 0xffffff, 0.1);
            rangeIndicator.setDepth(ward.depth - 1);
            ward.rangeIndicator = rangeIndicator;
        }
        
        // 와드 파괴 함수
        ward.destroyWard = () => {
            if (ward.rangeIndicator) {
                ward.rangeIndicator.destroy();
            }
            ward.destroy();
        };
        
        // 씬의 와드 맵에 추가
        this.scene.allWards.set(wardData.id, ward);
        
        // 내 와드인 경우 wardList에도 추가 (시야 시스템용)
        if (isMyWard) {
            if (!this.scene.wardList) {
                this.scene.wardList = [];
            }
            
            // 최대 2개 제한
            if (this.scene.wardList.length >= 2) {
                this.scene.wardList.shift();
            }
            
            const wardInfo = {
                id: wardData.id,
                x: wardData.x,
                y: wardData.y,
                radius: wardData.range,
                sprite: ward,
                ownerId: wardData.playerId
            };
            
            this.scene.wardList.push(wardInfo);
            this.scene.activeWard = wardInfo;
        }
        
        console.log(`와드 생성: ${wardData.id}, 위치: (${wardData.x}, ${wardData.y}), 소유자: ${wardData.playerId}, 내 와드: ${isMyWard}`);
    }
    
    /**
     * 와드 스프라이트 제거
     */
    removeWardSprite(wardSprite) {
        if (!wardSprite || !wardSprite.active) return;
        
        const wardId = wardSprite.wardId;
        const isMyWard = wardSprite.ownerId === this.networkManager.playerId;
        
        // 내 와드인 경우 wardList에서도 제거
        if (isMyWard && this.scene.wardList) {
            this.scene.wardList = this.scene.wardList.filter(ward => ward.id !== wardId);
        }
        
        wardSprite.destroyWard();
        
        console.log(`와드 제거: ${wardId}, 내 와드: ${isMyWard}`);
    }

    /**
     * 투사체 제거 처리
     */
    handleProjectileRemoved(data) {
        if (this.scene.projectileManager && data.projectileId) {
            this.scene.projectileManager.removeProjectile(data.projectileId);
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
            player.isStunnedTint = data.isStunned; // tint 상태 변수 업데이트
            
            if (data.isStunned) {
                this.scene.effectManager.showSkillMessage(
                    player.x,
                    player.y,
                    '기절!', 
                    { 
                        fill: '#ffff00',
                        fontSize: '14px',
                        fontStyle: 'bold'
                    }
                );
            }
            
            // updateTint 호출하여 우선순위에 따라 tint 적용
            if (player.updateTint) {
                player.updateTint();
            }
        } else {
            console.warn(`[기절 이벤트] 플레이어를 찾을 수 없음: ${data.playerId}`);
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
            // tint 상태 모두 초기화 (사망 시)
            enemy.isDamaged = false;
            enemy.isStunnedTint = false;
            enemy.isSlowedTint = false;
            if (enemy.updateTint) {
                enemy.updateTint();
            }
            
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
            
            // 데미지 텍스트 표시
            this.scene.effectManager.showDamageText(enemy.x, enemy.y, data.damage, '#ff0000');
            
            // 피격 상태 설정 및 tint 업데이트
            enemy.isDamaged = true;
            if (enemy.updateTint) {
                enemy.updateTint();
            }
            
            // 200ms 후 피격 상태 해제
            this.scene.time.delayedCall(200, () => {
                if (enemy && enemy.active && !enemy.isDead) {
                    enemy.isDamaged = false;
                    if (enemy.updateTint) {
                        enemy.updateTint();
                    }
                }
            });
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
            otherPlayer.updateJobClass(); // updateJobSprite -> updateJobClass로 변경
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
            this.scene.pingManager.createPing(data.x, data.y, data.playerId, data.nickname);
            this.scene.pingManager.showPingMessage('팀원이 핑을 찍었습니다!');
            
            const pingId = `${data.playerId}_${Date.now()}`;
            this.scene.pingManager.activePingPositions.set(pingId, { x: data.x, y: data.y });
            this.scene.pingManager.checkAndShowPingArrow(data.x, data.y, pingId, data.nickname);
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
                    this.scene.player.y, 
                    `${data.damage} (스폰 배리어)`, 
                    '#ff0000'
                );
                
                // 피격 효과
                this.scene.player.isDamaged = true;
                if (this.scene.player.updateTint) {
                    this.scene.player.updateTint();
                }
                
                this.scene.time.delayedCall(200, () => {
                    if (this.scene.player && this.scene.player.active && !this.scene.player.isDead) {
                        this.scene.player.isDamaged = false;
                        if (this.scene.player.updateTint) {
                            this.scene.player.updateTint();
                        }
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
                
                // tint 상태 모두 초기화 (사망 시)
                otherPlayer.isDamaged = false;
                otherPlayer.isStunnedTint = false;
                otherPlayer.isStealthTint = false;
                otherPlayer.isSlowedTint = false;
                if (otherPlayer.updateTint) {
                    otherPlayer.updateTint();
                }
                
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
                this.scene.player.isStunned = false;
                this.scene.player.isStealth = false;
                
                // tint 상태 모두 초기화 (리스폰 시)
                this.scene.player.isDamaged = false;
                this.scene.player.isStunnedTint = false;
                this.scene.player.isStealthTint = false;
                this.scene.player.isSlowedTint = false;
                if (this.scene.player.updateTint) {
                    this.scene.player.updateTint();
                }
                
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
                
                // tint 상태 모두 초기화 (리스폰 시)
                otherPlayer.isDamaged = false;
                otherPlayer.isStunnedTint = false;
                otherPlayer.isStealthTint = false;
                otherPlayer.isSlowedTint = false;
                if (otherPlayer.updateTint) {
                    otherPlayer.updateTint();
                }
                
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
        
        // 직업 클래스 인스턴스 생성 (스킬 애니메이션을 위해 필수)
        otherPlayer.updateJobClass();
        
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
        console.log(`showSkillEffect 호출: skillType=${skillType}, player=${player?.id}, job=${player?.job?.constructor?.name}`);
        if (!player || !player.job) return;
        
        switch (skillType) {
            case 'basic_attack':
                this.showBasicAttackEffect(player, data);
                break;
            case 'stealth':
                if (player.job && player.job.startStealth) {
                    player.job.startStealth(data);
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
            case 'shield':
                if (player.job.showShieldEffect) {
                    player.job.showShieldEffect(data);
                }
                break;
            case 'roar':
                player.job.showRoarEffect();
                break;
            case 'roll':
                if (player.job.showRollEffect) {
                    player.job.showRollEffect(data);
                }
                break;
            case 'focus':
                if (player.job.showFocusEffect) {
                    player.job.showFocusEffect(data);
                }
                // 서버에서 받은 배율 사용
                if (data.skillInfo && data.skillInfo.duration) {
                    const focusEffect = {
                        attackSpeedMultiplier: data.attackSpeedMultiplier || 2.0
                    };
                    player.applyBuff('attack_speed_boost', data.skillInfo.duration, focusEffect);
                }
                break;
            case 'blade_dance':
                if (player.job.showBladeDanceEffect) {
                    player.job.showBladeDanceEffect(data);
                }
                // 서버에서 받은 배율 사용
                if (data.skillInfo && data.skillInfo.duration) {
                    const bladeDanceEffect = {
                        attackPowerMultiplier: data.attackPowerMultiplier || 2.5
                    };
                    player.applyBuff('attack_power_boost', data.skillInfo.duration, bladeDanceEffect);
                }
                break;
            case 'backstab':
                console.log('목긋기 케이스 처리:', data);
                console.log('목긋기 backstabData:', data.backstabData);
                if (player.job.showBackstabEffect) {
                    console.log('showBackstabEffect 호출');
                    player.job.showBackstabEffect(data.backstabData || data);
                } else {
                    console.log('showBackstabEffect 메서드가 없습니다');
                }
                break;
            case 'heal_field':
                if (player.job.showHealFieldEffect) {
                    player.job.showHealFieldEffect(data);
                }
                break;
            case 'buff_field':
                if (player.job.showBuffFieldEffect) {
                    player.job.showBuffFieldEffect(data);
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
        // 점프 애니메이션이 이미 진행 중이면 중복 실행 방지
        if (player.jumpAnimationInProgress) return;
        
        const originalY = player.y;
        const originalNameY = player.nameText ? player.nameText.y : null;
        const originalHealthBarY = player.healthBar?.container ? player.healthBar.container.y : null;
        player.jumpAnimationInProgress = true;  // isJumping 대신 애니메이션 진행 상태만 관리
        
        const targets = [player];
        if (player.nameText) {
            targets.push(player.nameText);
        }
        if (player.healthBar?.container) {
            targets.push(player.healthBar.container);
        }
        
        // 점프 애니메이션 끝나는 시점 저장 (서버에서 받은 endTime 사용)
        let jumpEndTime;
        if (data?.endTime) {
            jumpEndTime = data.endTime;
            player.jumpEndTime = data.endTime;
        } else {
            // endTime이 없으면 기본 지속시간(400ms)으로 계산
            const defaultDuration = 400;
            jumpEndTime = Date.now() + defaultDuration;
            player.jumpEndTime = jumpEndTime;
        }
        
        // endTime까지 남은 시간으로 애니메이션 지속시간 계산
        const totalRemainingTime = Math.max(0, jumpEndTime - Date.now());
        const halfDuration = totalRemainingTime / 2; // yoyo 애니메이션이므로 절반씩
        
        this.scene.tweens.add({
            targets: targets,
            y: '-=50',
            duration: halfDuration,
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
                if (player.active) {
                    player.y = originalY;
                    if (player.nameText && originalNameY !== null) {
                        player.nameText.y = originalNameY;
                    }
                    if (player.healthBar?.container && originalHealthBarY !== null) {
                        player.healthBar.container.y = originalHealthBarY;
                    }
                    player.jumpAnimationInProgress = false;  // 애니메이션 진행 상태만 관리, isJumping은 서버에서만 관리
                    
                    // jumpEndTime은 서버 playerStateUpdate에서 관리되므로 여기서 초기화하지 않음
                    player.updateNameTextPosition();
                    player.updateHealthBar();
                }
            }
        });
    }

    /**
     * 은신 종료 이벤트 처리
     */
         handleStealthEnded(data) {
         const player = this.findPlayerById(data.playerId);
         
         if (player && player.job && player.job.endStealth) {
             player.job.endStealth(data);
         }
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

        // 피격 상태 설정 및 tint 업데이트
        player.isDamaged = true;
        if (player.updateTint) {
            player.updateTint();
        }
        
        // 200ms 후 피격 상태 해제
        this.scene.time.delayedCall(200, () => {
            if (player && player.active && !player.isDead) {
                player.isDamaged = false;
                if (player.updateTint) {
                    player.updateTint();
                }
            }
        });
    }

    /**
     * 공격 무효 처리
     */
    handleAttackInvalid(data) {
        // effectManager가 있는지 확인
        if (!this.scene.effectManager) {
            console.error('effectManager가 없습니다!');
            return;
        }

        const color = data.message === '공격 무효!' ? '#ff0000' : '#00ff00';
        
        // 빨간색 "공격 무효!" 메시지를 해당 위치에 표시
        this.scene.effectManager.showSkillMessage(
            data.x, 
            data.y,
            data.message, 
            {
                fill: color,
                fontSize: '16px',
                fontStyle: 'bold'
            },
            500 // 0.5초 동안 표시
        );
    }

    /**
     * 몬스터 기절 상태 처리
     */
    handleEnemyStunned(data) {
        // 해당 몬스터를 찾아서 기절 상태 업데이트
        const enemy = this.scene.enemies?.getChildren().find(e => e.networkId === data.enemyId);
        if (enemy) {
            // 몬스터의 기절 tint 상태 업데이트
            enemy.isStunnedTint = data.isStunned;
            
            if (data.isStunned) {
                // 기절 시작 - 몬스터 위에 기절 표시
                this.scene.effectManager.showSkillMessage(
                    enemy.x, 
                    enemy.y,
                    '기절!', 
                    { 
                        fill: '#ffff00',
                        fontSize: '14px',
                        fontStyle: 'bold'
                    }
                );
            }
            
            // updateTint 호출하여 우선순위에 따라 tint 적용
            if (enemy.updateTint) {
                enemy.updateTint();
            }
        }
    }

    handleMagicMissileExplosion(data) {
        console.log('마법 투사체 폭발 이벤트 받음:', data);
        
        const { x, y, radius, casterId, affectedEnemies, affectedPlayers } = data;
        
        // 폭발 이펙트 생성 (모든 클라이언트에서 동일하게 표시)
        this.scene.effectManager.showMagicExplosion(x, y, radius);
        
        // 데미지 표시 (서버에서 계산된 결과)
        if (affectedEnemies && affectedEnemies.length > 0) {
            affectedEnemies.forEach(enemyData => {
                const enemy = this.scene.enemies.getChildren().find(e => e.networkId === enemyData.enemyId);
                if (enemy) {
                    this.scene.effectManager.showDamageText(enemy.x, enemy.y, enemyData.damage, 'red');
                    
                    // 피격 상태 설정 및 tint 업데이트
                    enemy.isDamaged = true;
                    if (enemy.updateTint) {
                        enemy.updateTint();
                    }
                    
                    // 200ms 후 피격 상태 해제
                    this.scene.time.delayedCall(200, () => {
                        if (enemy && enemy.active && !enemy.isDead) {
                            enemy.isDamaged = false;
                            if (enemy.updateTint) {
                                enemy.updateTint();
                            }
                        }
                    });
                }
            });
        }
        
        if (affectedPlayers && affectedPlayers.length > 0) {
            affectedPlayers.forEach(playerData => {
                const targetPlayer = this.findPlayerById(playerData.playerId);
                if (targetPlayer) {
                    this.scene.effectManager.showDamageText(targetPlayer.x, targetPlayer.y, playerData.damage, 'red');
                }
            });
        }
        
        console.log(`마법 투사체 폭발 처리 완료 - 적중 적: ${affectedEnemies?.length || 0}명, 적중 플레이어: ${affectedPlayers?.length || 0}명`);
    }

    /**
     * 적 슬로우 상태 처리
     */
    handleEnemySlowed(data) {
        console.log('몬스터 슬로우 상태 변경:', data);
        
        const enemy = this.scene.enemies?.getChildren().find(e => e.networkId === data.enemyId);
        if (enemy) {
            // 슬로우 상태 업데이트
            enemy.isSlowedTint = data.isSlowed;
            
            if (data.isSlowed) {
                console.log(`몬스터 ${data.enemyId} 슬로우 적용: 지속시간=${data.duration}ms`);
                
                // 슬로우 메시지 표시
                this.scene.effectManager.showSkillMessage(
                    enemy.x,
                    enemy.y - 30,
                    '슬로우!', 
                    { 
                        fill: '#87ceeb',
                        fontSize: '12px',
                        fontStyle: 'bold'
                    }
                );
            } else {
                console.log(`몬스터 ${data.enemyId} 슬로우 해제됨`);
            }
            
            // tint 상태 업데이트
            if (enemy.updateTint) {
                enemy.updateTint();
            }
        } else {
            console.warn(`슬로우 대상 몬스터를 찾을 수 없음: ${data.enemyId}`);
        }
    }

    /**
     * 플레이어 슬로우 효과 처리 - 서버 신호 기반으로 추가/제거
     */
    handlePlayerSlowed(data) {
        console.log('플레이어 슬로우 효과 받음:', data);
        const { playerId, effectId, speedReduction, duration } = data;
        
        const targetPlayer = this.findPlayerById(playerId);
        if (targetPlayer) {
            if (speedReduction === 1 && duration === 0) {
                console.log(`[handlePlayerSlowed] 슬로우 해제 처리: ${playerId}`);
                
                // 슬로우 효과 해제 (서버 신호 기반)
                if (targetPlayer.slowEffects) {
                    targetPlayer.slowEffects = targetPlayer.slowEffects.filter(effect => effect.id !== effectId);
                }
                
                // 다른 슬로우 효과가 없으면 슬로우 tint 상태 해제
                if (!targetPlayer.slowEffects || targetPlayer.slowEffects.length === 0) {
                    targetPlayer.isSlowedTint = false;
                    if (targetPlayer.updateTint) {
                        targetPlayer.updateTint();
                    }
                }
                
                console.log(`[handlePlayerSlowed] 슬로우 해제 완료: ${playerId}`);
            } else {
                console.log(`[handlePlayerSlowed] 슬로우 적용 처리: ${playerId}, 감소율=${speedReduction}`);
                
                // 슬로우 효과 적용 (서버 신호 기반)
                if (!targetPlayer.slowEffects) {
                    targetPlayer.slowEffects = [];
                }
                
                const slowEffect = {
                    id: effectId,
                    speedReduction: speedReduction
                };
                
                targetPlayer.slowEffects.push(slowEffect);
                
                // 슬로우 tint 상태 설정
                targetPlayer.isSlowedTint = true;
                if (targetPlayer.updateTint) {
                    targetPlayer.updateTint();
                }
                
                // 슬로우 효과 메시지 표시
                this.scene.effectManager.showSkillMessage(targetPlayer.x, targetPlayer.y, '슬로우!');
                
                console.log(`[handlePlayerSlowed] 슬로우 적용 완료: ${playerId}`);
            }
        } else {
            console.warn(`[handlePlayerSlowed] 대상 플레이어를 찾을 수 없음: ${playerId}`);
        }
    }
  
    freezePlayerPosition(player, serverX, serverY) {
        if (!player || !player.body) return;

        // 기존 상태 백업 (복원을 위해)
        if (!player.frozenState) {
            player.frozenState = {
                wasFrozen: false,
                originalVelocityX: player.body.velocity.x,
                originalVelocityY: player.body.velocity.y
            };
        }

        // 플레이어 위치를 서버 위치로 설정
        player.setPosition(serverX, serverY);
        
        // 속도를 0으로 고정
        player.body.setVelocity(0, 0);
        
        // 고정 상태 표시
        player.frozenState.wasFrozen = true;
        player.isCasting = true; // 시전 중 표시

        console.log(`플레이어 위치 고정: (${serverX}, ${serverY}), 속도: 0`);
    }

    /**
     * 플레이어 이동 상태 복원
     */
    restorePlayerMovement(player) {
        if (!player || !player.frozenState || !player.frozenState.wasFrozen) return;

        // 시전 상태 해제
        player.isCasting = false;
        
        // 원래 속도는 복원하지 않음 (현재 입력 상태에 따라 자연스럽게 변경되도록)
        // 대신 현재 속도만 0으로 리셋하여 부드러운 전환
        if (player.body) {
            player.body.setVelocity(0, 0);
        }

        // 상태 정리
        player.frozenState = null;

        console.log(`플레이어 이동 상태 복원 완료`);
    }

    /**
     * 스킬이 위치 고정이 필요한지 확인
     */
    shouldFreezePosition(skillType) {
        const freezeSkills = [
            'sweep',    // 전사 휩쓸기
            'thrust',   // 전사 찌르기  
            'roar',     // 전사 포효
            'spread'    // 슬라임 퍼지기
        ];
        
        return freezeSkills.includes(skillType);
    }





    handleShieldRemoved(data) {
        console.log('보호막 제거 이벤트 받음:', data);
        
        // 해당 플레이어가 본인인지 확인
        if (data.playerId === this.networkManager.playerId && this.scene.player) {
            const player = this.scene.player;
            
            // 마법사 직업이고 보호막 제거 메서드가 있으면 호출
            if (player.job && typeof player.job.removeShieldEffect === 'function') {
                player.job.removeShieldEffect();
            }
        }
    }

    /**
     * 플레이어 경험치 획득 처리
     */
    handlePlayerExpGained(data) {
        const { playerId, expGained, newExp, newLevel } = data;
        
        const targetPlayer = this.findPlayerById(playerId);
        if (targetPlayer) {
            // 경험치 업데이트
            targetPlayer.exp = newExp;
            
            // 레벨업이 발생한 경우
            if (newLevel && newLevel !== targetPlayer.level) {
                targetPlayer.level = newLevel;
                console.log(`플레이어 ${playerId} 레벨업: ${newLevel}`);
            }
            
            // UI 업데이트
            if (targetPlayer.updateUI) {
                targetPlayer.updateUI();
            }
        }
    }

    /**
     * 직업 변경 오브 스폰 처리
     */
    handleJobOrbSpawned(data) {
        console.log('🎯 클라이언트에서 job-orb-spawned 이벤트 받음:', data);
        
        const { orbId, jobClass, x, y } = data;
        
        // 이미 존재하는 오브인지 확인
        if (this.scene.jobOrbs && this.scene.jobOrbs.has(orbId)) {
            console.warn(`❌ 이미 존재하는 오브 ID: ${orbId}`);
            return;
        }
        
        console.log(`✅ 새로운 직업 변경 오브 생성 시도: ${jobClass} at (${x}, ${y})`);
        
        // 새로운 직업 변경 오브 생성
        const jobOrb = new JobOrb(this.scene, x, y, orbId, jobClass);
        
        // 오브 저장
        if (!this.scene.jobOrbs) {
            this.scene.jobOrbs = new Map();
            console.log('🗂️ jobOrbs Map 새로 생성됨');
        }
        this.scene.jobOrbs.set(orbId, jobOrb);
        
        // 오브 그룹에 추가 (충돌 감지용)
        if (!this.scene.jobOrbGroup) {
            this.scene.jobOrbGroup = this.scene.physics.add.group();
            console.log('🗂️ jobOrbGroup 새로 생성됨');
        }
        this.scene.jobOrbGroup.add(jobOrb);
        
        console.log(`✅ 직업 변경 오브 스폰 완료: ${jobClass} (${x}, ${y}), 총 오브 수: ${this.scene.jobOrbs.size}`);
    }
    
    /**
     * 직업 변경 오브 제거 처리
     */
    handleJobOrbRemoved(data) {
        const { orbId } = data;
        
        if (!this.scene.jobOrbs || !this.scene.jobOrbs.has(orbId)) {
            return;
        }
        
        const jobOrb = this.scene.jobOrbs.get(orbId);
        
        // 오브 제거 애니메이션
        this.scene.tweens.add({
            targets: jobOrb,
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: 200,
            onComplete: () => {
                jobOrb.destroy();
            }
        });
        
        this.scene.jobOrbs.delete(orbId);
        
        console.log(`직업 변경 오브 제거: ${orbId}`);
    }
    
    /**
     * 직업 변경 오브 수집 처리 (다른 플레이어가 수집한 경우)
     */
    handleJobOrbCollected(data) {
        const { playerId, orbId, jobClass } = data;
        
        if (!this.scene.jobOrbs || !this.scene.jobOrbs.has(orbId)) {
            return;
        }
        
        const jobOrb = this.scene.jobOrbs.get(orbId);
        const collector = this.findPlayerById(playerId);
        
        // 수집 애니메이션
        jobOrb.collect();
        
        // 오브 제거
        this.scene.jobOrbs.delete(orbId);
        
        // 수집자 표시 (옵션)
        if (collector) {
            console.log(`플레이어 ${playerId}가 ${jobClass} 오브를 수집했습니다.`);
        }
    }
    
    /**
     * 직업 변경 오브 충돌 결과 처리 (자신이 수집한 경우)
     */
    handleJobOrbCollisionResult(data) {
        console.log('🎯 job-orb-collision-result 이벤트 리스너 호출됨');
        console.log('받은 데이터:', data);
        const { success, jobClass, message, orbId } = data;
        
        if (success) {
            console.log(`✅ 오브 수집 성공: ${jobClass}, orbId: ${orbId}`);
            
            // 성공 시 클라이언트에서도 오브 제거
            if (orbId && this.scene.jobOrbs && this.scene.jobOrbs.has(orbId)) {
                const orb = this.scene.jobOrbs.get(orbId);
                if (orb) {
                    // 오브 그룹에서 제거
                    if (this.scene.jobOrbGroup) {
                        this.scene.jobOrbGroup.remove(orb);
                    }
                    // 오브 스프라이트 제거
                    orb.destroy();
                    // 맵에서 제거
                    this.scene.jobOrbs.delete(orbId);
                    console.log(`🗑️ 클라이언트에서 오브 제거 완료: ${orbId}`);
                }
            } else if (!orbId) {
                // orbId가 없는 경우, 해당 직업의 모든 오브를 찾아서 제거
                console.log('⚠️ orbId가 없음, 직업 기반으로 오브 찾기 시도:', jobClass);
                const orbsToRemove = [];
                if (this.scene.jobOrbs) {
                    for (const [id, orb] of this.scene.jobOrbs.entries()) {
                        if (orb && orb.jobClass === jobClass && orb.isCollected) {
                            orbsToRemove.push({id, orb});
                        }
                    }
                }
                
                // 찾은 오브들 제거
                orbsToRemove.forEach(({id, orb}) => {
                    if (this.scene.jobOrbGroup) {
                        this.scene.jobOrbGroup.remove(orb);
                    }
                    orb.destroy();
                    this.scene.jobOrbs.delete(id);
                    console.log(`🗑️ 직업 기반으로 오브 제거 완료: ${id}`);
                });
            }
            
            // 전직 선택 UI 표시
            console.log(`🎮 전직 UI 표시 시작: ${jobClass}`);
            this.showJobChangeUI(jobClass);
        } else {
            console.log(`오브 수집 실패: ${message}`);
        }
    }
    
    /**
     * 전직 선택 UI 표시
     */
    showJobChangeUI(jobClass) {
        console.log(`🎮 showJobChangeUI 호출됨: ${jobClass}`);
        
        // 이미 전직 UI가 표시되어 있으면 무시
        if (this.scene.jobChangeUI && this.scene.jobChangeUI.isVisible) {
            console.log('⚠️ 이미 전직 UI가 표시되어 있음');
            return;
        }
        
        // 상단 알림 메시지 표시
        const topMessage = this.scene.add.text(this.scene.cameras.main.centerX, 50, 
            `${this.getJobDisplayName(jobClass)} 직업 변경 오브를 획득했습니다!`, {
            fontSize: '18px',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        });
        topMessage.setOrigin(0.5);
        topMessage.setScrollFactor(0);
        topMessage.setDepth(1000);
        
        // 3초 후 알림 메시지 제거
        this.scene.time.delayedCall(3000, () => {
            if (topMessage) {
                topMessage.destroy();
            }
        });
        
        this.scene.jobChangeUI = {
            isVisible: true,
            targetJobClass: jobClass,
            container: null,
            topMessage: topMessage
        };
        
        // UI 컨테이너 생성
        const centerX = this.scene.cameras.main.centerX;
        const centerY = this.scene.cameras.main.centerY;
        
        const container = this.scene.add.container(centerX, centerY);
        container.setScrollFactor(0); // 카메라에 고정
        container.setDepth(999); // 다른 UI보다 앞에 표시
        
        // 배경
        const background = this.scene.add.rectangle(0, 0, 450, 250, 0x000000, 0.9);
        background.setStrokeStyle(3, 0xffffff); // setStroke 대신 setStrokeStyle 사용
        container.add(background);
        
        // 제목 텍스트
        const jobDisplayName = this.getJobDisplayName(jobClass);
        const titleText = this.scene.add.text(0, -80, `${jobDisplayName}으로 전직하시겠습니까?`, {
            fontSize: '22px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 1,
            align: 'center'
        });
        titleText.setOrigin(0.5);
        container.add(titleText);
        
        // 안내 텍스트
        const guideText = this.scene.add.text(0, -30, 'ENTER: 전직 확인    ESC: 취소', {
            fontSize: '18px',
            fill: '#00ff00',
            stroke: '#000000',
            strokeThickness: 1,
            align: 'center'
        });
        guideText.setOrigin(0.5);
        container.add(guideText);
        
        // 직업 설명 (간단히)
        const descText = this.scene.add.text(0, 30, this.getJobDescription(jobClass), {
            fontSize: '16px',
            fill: '#cccccc',
            stroke: '#000000',
            strokeThickness: 1,
            align: 'center',
            wordWrap: { width: 400 }
        });
        descText.setOrigin(0.5);
        container.add(descText);
        
        // 컨테이너를 jobChangeUI에 저장
        this.scene.jobChangeUI.container = container;
        
        console.log(`✅ 전직 UI 생성 완료: ${jobClass}`);
        console.log('UI 상태:', this.scene.jobChangeUI);
    }
    
    /**
     * 전직 선택 UI 숨기기
     */
    hideJobChangeUI() {
        console.log('🚫 전직 UI 숨김');
        
        if (this.scene.jobChangeUI) {
            // 컨테이너 제거
            if (this.scene.jobChangeUI.container) {
                this.scene.jobChangeUI.container.destroy();
            }
            
            // 상단 메시지 제거
            if (this.scene.jobChangeUI.topMessage) {
                this.scene.jobChangeUI.topMessage.destroy();
            }
            
            // jobChangeUI 객체 제거
            this.scene.jobChangeUI = null;
        }
    }
    
    /**
     * 직업 표시 이름 반환
     */
    getJobDisplayName(jobClass) {
        const jobNames = {
            slime: '슬라임',
            assassin: '어쌔신',
            warrior: '전사',
            mage: '마법사',
            archer: '궁수',
            supporter: '서포터'
        };
        
        return jobNames[jobClass] || jobClass;
    }
    
    /**
     * 직업 설명 반환
     */
    getJobDescription(jobClass) {
        const descriptions = {
            assassin: '은신과 기습 공격에 특화된 직업입니다.',
            warrior: '높은 체력과 방어력을 가진 근접 전투 전문가입니다.',
            mage: '다양한 마법 스킬과 원거리 공격에 특화된 직업입니다.',
            archer: '원거리 공격에 특화된 직업입니다.',
            supporter: '팀원을 지원하고 치유하는 서포터 직업입니다.'
        };
        
        return descriptions[jobClass] || '특별한 능력을 가진 직업입니다.';
    }
}