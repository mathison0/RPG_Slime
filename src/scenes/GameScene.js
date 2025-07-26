import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import AssetLoader from '../utils/AssetLoader.js';
import NetworkManager from '../utils/NetworkManager.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.playerNickname = 'Player';
        this.gameJoined = false; // 게임 입장 완료 여부
        this.playerId = null; // 현재 플레이어 ID
        this.isFirstJoin = true; // 첫 게임 입장 여부 (세션 구분용)
        this.playerTeam = null; // 플레이어 팀 정보
        
        // 벽 충돌 판정 관련 상수
        this.WALL_COLLISION_BUFFER = -5; // 벽 충돌 판정 완충 범위 (픽셀)
    }
    
    init(data) {
        // MenuScene에서 전달받은 닉네임
        if (data && data.playerNickname) {
            this.playerNickname = data.playerNickname;
            console.log('플레이어 닉네임:', this.playerNickname);
        }
    }
    
    create() {
        console.log('GameScene create() 시작');
        
        // 탭 활성 상태 추적
        this.isTabActive = true;
        
        this.createGradientTexture();
        
        // 네트워크 매니저 초기화 (싱글톤)
        this.networkManager = new NetworkManager();
        
        // 게임 상태 리셋 (이전 게임 세션 정리)
        this.resetGameState();
        
        this.otherPlayers = this.physics.add.group();
        this.enemies = this.physics.add.group();
        
        console.log('네트워크 매니저 초기화 완료');
        
        // 네트워크 이벤트 리스너 설정
        this.setupNetworkListeners();
        
        // 게임 입장 요청 (닉네임 포함)
        this.networkManager.joinGame({
            nickname: this.playerNickname
        });
        
        console.log('게임 입장 요청 완료');
        
        // 물리 충돌은 플레이어가 생성된 후에 설정
        // 충돌 객체들 초기화
        this.playerWallCollider = null;
        this.enemyWallCollider = null;
        this.otherPlayerWallCollider = null;
        this.playerEnemyCollider = null;

        this.wasJumping = false;

        this.setupUI();

        this.setupCheatKeys();

        // 브라우저 탭 포커스 이벤트 처리
        this.setupTabFocusHandlers();

        // 1단계: 전체 화면을 덮는 기본 어둠 (시야 범위 밖)
        this.baseVisionTexture = this.make.renderTexture({
            width: this.scale.width,
            height: this.scale.height
        }, false);
        this.baseVisionTexture.setDepth(980); // 시야 범위 밖 가리개는 플레이어보다 높은 depth
        this.baseVisionTexture.setOrigin(0, 0);
        this.baseVisionTexture.fill(0x000000, 1);
        this.baseVisionTexture.setScrollFactor(0);
        this.add.existing(this.baseVisionTexture);

        // 2단계: 플레이어 시야 범위 내의 벽 그림자
        this.shadowVisionTexture = this.make.renderTexture({
            width: this.scale.width,
            height: this.scale.height
        }, false);
        this.shadowVisionTexture.setDepth(700); // 벽 그림자는 플레이어보다 낮은 depth
        this.shadowVisionTexture.setOrigin(0, 0);
        this.shadowVisionTexture.fill(0x000000, 0); // 처음엔 투명
        this.shadowVisionTexture.setScrollFactor(0);
        this.add.existing(this.shadowVisionTexture);

        this.updateUIScale(this.cameras.main.zoom);
    }
    
    // 브라우저 탭 포커스 이벤트 핸들러 설정
    setupTabFocusHandlers() {
        // 탭이 비활성화될 때
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onTabBlur();
            } else {
                this.onTabFocus();
            }
        });

        // Phaser의 pause/resume 이벤트 처리
        this.game.events.on('pause', () => {
            this.onGamePause();
        });

        this.game.events.on('resume', () => {
            this.onGameResume();
        });

        console.log('탭 포커스 이벤트 핸들러 설정 완료');
    }

    // 탭이 비활성화될 때 호출
    onTabBlur() {
        console.log('탭 비활성화 - 게임 일시정지');
        this.isTabActive = false;
        
        // 진행 중인 모든 트윈 애니메이션 일시정지
        this.tweens.pauseAll();
        
        // 점프 상태 저장 (복원을 위해)
        this.savePlayerStates();
    }

    // 탭이 활성화될 때 호출
    onTabFocus() {
        console.log('탭 활성화 - 게임 재개 및 동기화');
        this.isTabActive = true;
        
        // 서버로부터 최신 상태 요청
        this.requestGameStateSync();
        
        // 잠시 후 트윈 재개 (서버 동기화 후)
        this.time.delayedCall(500, () => {
            this.tweens.resumeAll();
        });
    }

    // 게임 일시정지 시 호출
    onGamePause() {
        console.log('게임 일시정지');
        this.savePlayerStates();
    }

    // 게임 재개 시 호출
    onGameResume() {
        console.log('게임 재개 - 상태 동기화');
        this.requestGameStateSync();
    }

    // 플레이어 상태 저장 (복원을 위해)
    savePlayerStates() {
        if (this.player) {
            this.playerStateBeforePause = {
                x: this.player.x,
                y: this.player.y,
                isJumping: this.player.isJumping
            };
        }

        // 다른 플레이어들의 상태도 저장
        this.otherPlayerStatesBeforePause = {};
        if (this.otherPlayers && this.otherPlayers.children) {
            this.otherPlayers.getChildren().forEach(otherPlayer => {
                this.otherPlayerStatesBeforePause[otherPlayer.networkId] = {
                    x: otherPlayer.x,
                    y: otherPlayer.y,
                    isJumping: otherPlayer.isJumping
                };
            });
        }
    }

    // 서버로부터 게임 상태 동기화 요청
    requestGameStateSync() {
        if (this.networkManager && this.playerId) {
            console.log('서버 상태 동기화 요청');
            this.networkManager.requestGameSync();
        }
    }

    // 동기화된 상태로 복원
    restorePlayerStates(syncData) {
        // 본인 플레이어 상태 복원
        if (this.player && syncData.players) {
            const myPlayerData = syncData.players.find(p => p.id === this.playerId);
            if (myPlayerData) {
                // 진행 중인 점프 애니메이션 정리
                if (this.player.isJumping) {
                    this.player.isJumping = false;
                    this.tweens.killTweensOf(this.player);
                }
                
                // 위치 복원
                this.player.x = myPlayerData.x;
                this.player.y = myPlayerData.y;
                this.player.direction = myPlayerData.direction;
                
                console.log('본인 플레이어 상태 복원 완료');
            }
        }

        // 다른 플레이어들 상태 복원
        if (this.otherPlayers && this.otherPlayers.children && syncData.players) {
            this.otherPlayers.getChildren().forEach(otherPlayer => {
                const playerData = syncData.players.find(p => p.id === otherPlayer.networkId);
                if (playerData) {
                    // 진행 중인 애니메이션 정리
                    if (otherPlayer.isJumping) {
                        otherPlayer.isJumping = false;
                        this.tweens.killTweensOf(otherPlayer);
                        if (otherPlayer.nameText) {
                            this.tweens.killTweensOf(otherPlayer.nameText);
                        }
                    }
                    
                    // 위치 복원
                    otherPlayer.x = playerData.x;
                    otherPlayer.y = playerData.y;
                    otherPlayer.direction = playerData.direction;
                    
                    // 이름표 위치 업데이트
                    otherPlayer.updateNameTextPosition();
                }
            });
            
            console.log('다른 플레이어들 상태 복원 완료');
        }

        // 적들 상태 복원
        if (this.enemies && this.enemies.children && syncData.enemies) {
            this.enemies.getChildren().forEach(enemy => {
                const enemyData = syncData.enemies.find(e => e.id === enemy.networkId);
                if (enemyData) {
                    // 진행 중인 애니메이션 정리
                    this.tweens.killTweensOf(enemy);
                    
                    // 위치 및 상태 복원
                    enemy.x = enemyData.x;
                    enemy.y = enemyData.y;
                    enemy.hp = enemyData.hp;
                    enemy.maxHp = enemyData.maxHp;
                }
            });
            
            console.log('적들 상태 복원 완료');
        }
    }

    // 디버그 치트 키 설정
    setupCheatKeys() {
        // 치트 상태 변수들
        this.isSpeedBoostActive = false;
        
        // 키 바인딩
        this.cheatKeys = {
            o: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.O),
            p: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
            shift: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
            one: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
            two: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
            three: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
            four: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
            zero: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO)
        };
        
        console.log('디버그 치트 키 활성화됨:');
        console.log('O - 전체 맵 발견 처리');
        console.log('P - 자살 (리스폰)');
        console.log('Shift - 속도 부스트 (누르고 있기)');
        console.log('1,2,3,4 - 맵 꼭짓점으로 이동');
        console.log('0 - 광장 중앙으로 이동');
    }
    
    // 치트 키 처리
    handleCheatKeys() {
        if (!this.cheatKeys || !this.player) return;
        
        // O - 전체 맵 발견 처리
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.o)) {
            this.revealEntireMap();
        }
        
        // P - 자살 (리스폰)
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.p)) {
            console.log('자살 치트 사용 - 리스폰');
            this.player.suicide();
        }
        
        // Shift - 속도 부스트
        if (this.cheatKeys.shift.isDown) {
            if (!this.isSpeedBoostActive) {
                this.isSpeedBoostActive = true;
                this.player.activateSpeedBoost(3); // 3배 속도
            }
        } else {
            if (this.isSpeedBoostActive) {
                this.isSpeedBoostActive = false;
                this.player.deactivateSpeedBoost();
            }
        }
        
        // 1,2,3,4 - 맵 꼭짓점으로 이동
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.one)) {
            this.teleportToCorner(1); // 좌상단
        }
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.two)) {
            this.teleportToCorner(2); // 우상단
        }
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.three)) {
            this.teleportToCorner(3); // 좌하단
        }
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.four)) {
            this.teleportToCorner(4); // 우하단
        }
        
        // 0 - 광장 중앙으로 이동
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.zero)) {
            this.teleportToPlaza();
        }
    }
    
    // 맵 꼭짓점으로 텔레포트 (클라이언트 직접 이동)
    teleportToCorner(corner) {
        if (!this.player) return;
        
        let x, y;
        const margin = this.SPAWN_WIDTH + 100; // 스폰 구역 밖으로
        
        switch(corner) {
            case 1: // 좌상단
                x = margin;
                y = 100;
                break;
            case 2: // 우상단
                x = this.MAP_WIDTH - margin;
                y = 100;
                break;
            case 3: // 좌하단
                x = margin;
                y = this.MAP_HEIGHT - 100;
                break;
            case 4: // 우하단
                x = this.MAP_WIDTH - margin;
                y = this.MAP_HEIGHT - 100;
                break;
        }
        
        console.log(`텔레포트: 꼭짓점 ${corner} (${x}, ${y})`);
        this.player.x = x;
        this.player.y = y;
    }
    
    // 광장 중앙으로 텔레포트 (클라이언트 직접 이동)
    teleportToPlaza() {
        if (!this.player) return;
        
        const x = this.PLAZA_X + this.PLAZA_SIZE / 2;
        const y = this.PLAZA_Y + this.PLAZA_SIZE / 2;
        
        console.log(`텔레포트: 광장 중앙 (${x}, ${y})`);
        this.player.x = x;
        this.player.y = y;
    }
    
    // 전체 맵 발견 처리 (치트)
    revealEntireMap() {
        if (!this.discovered) return;
        
        console.log('치트: 전체 맵 발견 처리');
        
        // 모든 타일을 발견된 것으로 표시
        for (let y = 0; y < this.mapRows; y++) {
            for (let x = 0; x < this.mapCols; x++) {
                if (this.discovered[y]) {
                    this.discovered[y][x] = true;
                }
            }
        }
        
        console.log(`전체 맵 공개 완료: ${this.mapCols} x ${this.mapRows} 타일`);
    }
    
    // 게임 상태 리셋 메서드
    resetGameState() {
        console.log('게임 상태 리셋 시작');
        
        // 기존 플레이어 제거
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
        
        // 다른 플레이어들 제거 (그룹이 존재하고 올바르게 초기화된 경우에만)
        if (this.otherPlayers && this.otherPlayers.children) {
            this.otherPlayers.clear(true, true);
        }
        
        // 적들 제거 (그룹이 존재하고 올바르게 초기화된 경우에만)
        if (this.enemies && this.enemies.children) {
            this.enemies.clear(true, true);
        }
        
        // 클라이언트 측 게임 상태만 초기화 (NetworkManager 상태는 보존)
        this.gameJoined = false;
        this.playerId = null;
        
        // 새로운 세션 시작 (새로운 닉네임으로 접속하는 경우)
        this.isFirstJoin = true;
        this.playerTeam = null;
        
        // 대기 중인 join-game 요청만 정리 (hasJoinedGame은 서버 상태와 동기화되므로 보존)
        if (this.networkManager) {
            this.networkManager.pendingJoinGameData = null;
            console.log('NetworkManager pendingJoinGameData 정리 완료');
        }
        
        // 방문 지역 데이터는 세션 기반으로 관리됨
        // 새로운 닉네임으로 접속 시: 초기화, 같은 세션에서 리스폰 시: 유지
        
        console.log('게임 상태 리셋 완료 (세션 기반 방문 지역 관리)');
    }
    
    recreateMapFromServer(mapData) {
        console.log('서버 맵 데이터로 맵 재생성:', mapData);
        
        // 기존 맵 제거
        if (this.walls) {
            this.walls.clear(true, true);
        }
        
        // 기존 스폰 구역 제거
        if (this.spawnBarriers) {
            this.spawnBarriers.clear(true, true);
        }
        
        // 기존 스폰 구역 표시 제거
        this.children.list.forEach(child => {
            if (child.type === 'Rectangle' && child.depth === -1) {
                child.destroy();
            }
        });
        
        // 서버 맵 데이터 적용
        this.MAP_WIDTH = mapData.MAP_WIDTH;
        this.MAP_HEIGHT = mapData.MAP_HEIGHT;
        this.TILE_SIZE = mapData.TILE_SIZE;
        this.SPAWN_WIDTH = mapData.SPAWN_WIDTH;
        this.PLAZA_SIZE = mapData.PLAZA_SIZE;
        this.PLAZA_X = mapData.PLAZA_X;
        this.PLAZA_Y = mapData.PLAZA_Y;

        this.physics.world.setBounds(0, 0, this.MAP_WIDTH, this.MAP_HEIGHT);
        this.walls = this.physics.add.staticGroup();
        this.spawnBarriers = this.physics.add.staticGroup();

        // 서버에서 받은 벽 데이터로 벽 생성
        mapData.walls.forEach(wallPos => {
            this.walls.create(wallPos.x, wallPos.y, 'wall').setSize(this.TILE_SIZE, this.TILE_SIZE).refreshBody();
        });

        // 스폰 및 광장 구역 시각화
        this.add.rectangle(this.SPAWN_WIDTH / 2, this.MAP_HEIGHT / 2, this.SPAWN_WIDTH, this.MAP_HEIGHT, 0xff0000, 0.25).setDepth(-1);
        this.add.rectangle(this.MAP_WIDTH - this.SPAWN_WIDTH / 2, this.MAP_HEIGHT / 2, this.SPAWN_WIDTH, this.MAP_HEIGHT, 0x0000ff, 0.25).setDepth(-1);
        
        this.plazaRect = new Phaser.Geom.Rectangle(this.PLAZA_X, this.PLAZA_Y, this.PLAZA_SIZE, this.PLAZA_SIZE);
        this.add.rectangle(this.plazaRect.centerX, this.plazaRect.centerY, this.PLAZA_SIZE, this.PLAZA_SIZE, 0xffff00, 0.15).setDepth(-1);

        this.redSpawnRect = new Phaser.Geom.Rectangle(mapData.redSpawnRect.x, mapData.redSpawnRect.y, mapData.redSpawnRect.width, mapData.redSpawnRect.height);
        this.blueSpawnRect = new Phaser.Geom.Rectangle(mapData.blueSpawnRect.x, mapData.blueSpawnRect.y, mapData.blueSpawnRect.width, mapData.blueSpawnRect.height);

        // 상대팀 스폰 구역에 물리적 벽 생성 (투명한 장벽)
        this.createSpawnBarriers();

        // 시야 계산을 위해 모든 벽의 선분 정보를 미리 추출
        this.wallLines = [];
        this.walls.getChildren().forEach(wall => {
            const bounds = wall.getBounds();
            this.wallLines.push(new Phaser.Geom.Line(bounds.left, bounds.top, bounds.right, bounds.top));
            this.wallLines.push(new Phaser.Geom.Line(bounds.right, bounds.top, bounds.right, bounds.bottom));
            this.wallLines.push(new Phaser.Geom.Line(bounds.left, bounds.bottom, bounds.right, bounds.bottom));
            this.wallLines.push(new Phaser.Geom.Line(bounds.left, bounds.top, bounds.left, bounds.bottom));
        });
        
        console.log(`맵 재생성 완료: 벽 ${this.walls.getChildren().length}개`);
        
        // 미니맵 변수들 재계산 및 초기화
        // isFirstJoin 플래그를 통해 새로운 세션인지 판단
        this.reinitializeMinimap(this.isFirstJoin, this.playerTeam);
        
        // 맵 재생성 후 충돌 설정 업데이트
        if (this.player) {
            this.setupCollisions();
        }
    }
    
    // 미니맵 재초기화 (맵 크기 변경 후 호출)
    reinitializeMinimap(isNewSession = false, playerTeam = null) {
        console.log('미니맵 재초기화 시작');
        
        // 미니맵 크기 관련 변수들 재계산
        this.mapCols = Math.ceil(this.MAP_WIDTH / this.TILE_SIZE);
        this.mapRows = Math.ceil(this.MAP_HEIGHT / this.TILE_SIZE);
        
        console.log(`미니맵 그리드 크기: ${this.mapCols} x ${this.mapRows}`);
        
        // 방문 지역 데이터 처리
        if (isNewSession || !this.discovered) {
            // 새로운 세션이거나 방문 지역 데이터가 없으면 초기화
            this.initializeDiscoveredData(playerTeam);
        } else {
            // 기존 세션에서 리스폰 시에는 기존 데이터 유지, 크기만 조정
            if (this.discovered.length !== this.mapRows || 
                (this.discovered[0] && this.discovered[0].length !== this.mapCols)) {
                console.log('맵 크기 변경으로 인한 방문 지역 데이터 재초기화');
                this.initializeDiscoveredData(playerTeam);
            } else {
                console.log('기존 방문 지역 데이터 유지');
            }
        }
        
        // 미니맵과 빅맵 스케일 재계산
        this.minimapScale = this.minimapSize / this.minimapViewSize;
        this.bigMapScale = this.bigMapSize / this.MAP_WIDTH;
        
        console.log('미니맵 재초기화 완료');
    }
    
    // 방문 지역 데이터 초기화 (세션 기반)
    initializeDiscoveredData(playerTeam = null) {
        // 새로운 discovered 배열 초기화
        this.discovered = Array.from({ length: this.mapRows }, () => Array(this.mapCols).fill(false));
        
        // 시작 스폰 지역은 기본으로 공개 (플레이어 팀에 따라)
        const spawnCols = Math.ceil(this.SPAWN_WIDTH / this.TILE_SIZE);
        for (let y = 0; y < this.mapRows; y++) {
            if (playerTeam === 'red') {
                for (let x = 0; x < spawnCols + 2; x++) this.discovered[y][x] = true;
            } else if (playerTeam === 'blue') {
                for (let x = this.mapCols - spawnCols - 2; x < this.mapCols; x++) this.discovered[y][x] = true;
            } else {
                // 팀 정보가 없으면 양쪽 스폰 지역 모두 공개
                for (let x = 0; x < spawnCols + 2; x++) this.discovered[y][x] = true;
                for (let x = this.mapCols - spawnCols - 2; x < this.mapCols; x++) this.discovered[y][x] = true;
            }
        }
        
        console.log('세션 기반 방문 지역 데이터 초기화 완료');
    }
    
    // 상대팀 스폰 구역에 물리적 장벽 생성
    createSpawnBarriers() {
        if (!this.player) return;
        
        const barrierThickness = 10; // 장벽 두께
        
        if (this.player.team === 'red') {
            // 빨간팀 플레이어는 파란팀 스폰 구역을 막음
            // 왼쪽 벽 (스폰 구역 경계)
            this.spawnBarriers.create(
                this.blueSpawnRect.x - barrierThickness / 2, 
                this.blueSpawnRect.centerY, 
                null
            ).setSize(barrierThickness, this.blueSpawnRect.height).refreshBody().setVisible(false);
            
        } else if (this.player.team === 'blue') {
            // 파란팀 플레이어는 빨간팀 스폰 구역을 막음
            // 오른쪽 벽 (스폰 구역 경계)
            this.spawnBarriers.create(
                this.redSpawnRect.right + barrierThickness / 2, 
                this.redSpawnRect.centerY, 
                null
            ).setSize(barrierThickness, this.redSpawnRect.height).refreshBody().setVisible(false);
        }
        
        console.log('스폰 구역 물리적 장벽 생성 완료');
    }

    // 물리 충돌 설정 (별도 함수로 분리)
    setupCollisions() {
        // 기존 충돌 제거
        if (this.playerWallCollider) this.playerWallCollider.destroy();
        if (this.enemyWallCollider) this.enemyWallCollider.destroy();
        if (this.otherPlayerWallCollider) this.otherPlayerWallCollider.destroy();
        if (this.playerEnemyCollider) this.playerEnemyCollider.destroy();
        if (this.playerSpawnBarrierCollider) this.playerSpawnBarrierCollider.destroy();
        if (this.enemyWardCollider) this.enemyWardCollider.destroy();
        
        // 새 충돌 설정
        this.playerWallCollider = this.physics.add.collider(this.player, this.walls, null, this.player.handleWallCollision, this.player);
        this.enemyWallCollider = this.physics.add.collider(this.enemies, this.walls);
        this.otherPlayerWallCollider = this.physics.add.collider(this.otherPlayers, this.walls);
        this.playerEnemyCollider = this.physics.add.collider(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
        
        // 스폰 구역 물리적 장벽 충돌 추가
        if (this.spawnBarriers) {
            this.playerSpawnBarrierCollider = this.physics.add.collider(this.player, this.spawnBarriers);
        }
      
        // 와드 충돌 설정 (와드가 있을 때만)
        if (this.activeWard && this.activeWard.sprite) {
            this.enemyWardCollider = this.physics.add.collider(this.enemies, this.activeWard.sprite, this.handleEnemyWardCollision, null, this);
        }
        
        console.log('물리 충돌 설정 완료');
    }
    
    updateVision() {
        // 0. 필수 객체 확인
        if (!this.player || !this.wallLines || !this.baseVisionTexture || !this.shadowVisionTexture) {
            return;
        }
        

    
        // =================================================================
        // Part 1. 월드 좌표계에서 시야 폴리곤 계산
        // =================================================================
        const playerPos = new Phaser.Math.Vector2(this.player.x, this.player.y);
        const visionRadius = this.player.visionRange || 300;
        const cam = this.cameras.main;
    
        const playerCircle = new Phaser.Geom.Circle(playerPos.x, playerPos.y, visionRadius);
        const nearbyWalls = this.wallLines.filter(line =>
            Phaser.Geom.Intersects.LineToCircle(line, playerCircle)
        );
    
        const rays = [];
        nearbyWalls.forEach(line => {
            [line.getPointA(), line.getPointB()].forEach(p => {
                const angle = Phaser.Math.Angle.BetweenPoints(playerPos, p);
                rays.push(angle - 0.0001, angle, angle + 0.0001); // 오차를 더 줄임
            });
        });
        for (let i = 0; i < 360; i += 4) { // 레이를 더 촘촘하게 쏴서 부드럽게 만듬
            rays.push(Phaser.Math.DegToRad(i));
        }
        rays.push(Phaser.Math.DegToRad(359.999999));
    
        const endpoints = [];
        rays.forEach(angle => {
            const rayLine = new Phaser.Geom.Line(
                playerPos.x,
                playerPos.y,
                playerPos.x + Math.cos(angle) * visionRadius,
                playerPos.y + Math.sin(angle) * visionRadius
            );
    
            let closestIntersection = null;
            let minDistanceSq = visionRadius * visionRadius;
    
            nearbyWalls.forEach(wallLine => {
                const intersectPoint = new Phaser.Geom.Point();
                if (Phaser.Geom.Intersects.LineToLine(rayLine, wallLine, intersectPoint)) {
                    const dSq = Phaser.Math.Distance.Squared(playerPos.x, playerPos.y, intersectPoint.x, intersectPoint.y);
                    if (dSq < minDistanceSq) {
                        minDistanceSq = dSq;
                        closestIntersection = intersectPoint;
                    }
                }
            });
            
            // [수정 2] 시야를 막는 벽을 보이게 하기 위한 로직
            let finalPoint;
            if (closestIntersection) {
                // 레이가 벽에 부딪혔을 경우, 해당 지점에서 1픽셀 더 나아가게 만듭니다.
                finalPoint = new Phaser.Math.Vector2(closestIntersection.x, closestIntersection.y);
                const direction = new Phaser.Math.Vector2(rayLine.x2 - rayLine.x1, rayLine.y2 - rayLine.y1).normalize();
            } else {
                // 벽에 부딪히지 않으면 레이의 최대 길이 지점을 사용합니다.
                finalPoint = new Phaser.Math.Vector2(rayLine.x2, rayLine.y2);
            }
            endpoints.push(finalPoint);
        });
    
        // [수정 1] 렌더링 실선(틈)을 없애기 위한 정규화된 각도 정렬
        endpoints.sort(
            (a, b) => 
                Phaser.Math.Angle.Normalize(Phaser.Math.Angle.BetweenPoints(playerPos, a)) -
                Phaser.Math.Angle.Normalize(Phaser.Math.Angle.BetweenPoints(playerPos, b))
        );
    
                // =================================================================
        // Part 2. 2단계 시야 시스템 구현
        // =================================================================
        
        // 1단계: 기본 시야 범위 (전체를 덮고 시야 범위만큼 원으로 뚫기)
        this.baseVisionTexture.clear();
        this.baseVisionTexture.fill(0x000000, 1);
        
        const baseVisionMask = this.make.graphics({ add: false });
        baseVisionMask.fillStyle(0xffffff);
        baseVisionMask.fillCircle(
            playerPos.x - cam.scrollX, 
            playerPos.y - cam.scrollY, 
            visionRadius
        );
        
        this.baseVisionTexture.erase(baseVisionMask);
        baseVisionMask.destroy();

        // 2단계: 벽 그림자 (시야 범위 내에서 raycast로 그림자 생성)
        this.shadowVisionTexture.clear();
        this.shadowVisionTexture.fill(0x000000, 0); // 투명하게 시작
        
        // 시야 범위를 먼저 어둠으로 덮기
        const shadowMask = this.make.graphics({ add: false });
        shadowMask.fillStyle(0x000000, 0.9);
        shadowMask.fillCircle(
            playerPos.x - cam.scrollX, 
            playerPos.y - cam.scrollY, 
            visionRadius
        );
        this.shadowVisionTexture.draw(shadowMask);
        
        // raycast로 보이는 부분 지우기
        const visionMaskGraphics = this.make.graphics({ add: false });
        visionMaskGraphics.fillStyle(0xffffff);
        visionMaskGraphics.beginPath();
        visionMaskGraphics.moveTo(playerPos.x - cam.scrollX, playerPos.y - cam.scrollY);
        endpoints.forEach(p => {
            visionMaskGraphics.lineTo(p.x - cam.scrollX, p.y - cam.scrollY);
        });
        visionMaskGraphics.closePath();
        visionMaskGraphics.fillPath();

        this.shadowVisionTexture.erase(visionMaskGraphics);
    
        // 와드 범위 내 시야 확장 (와드가 있을 때)
        this.addWardVisionToMask(visionMaskGraphics, cam);
        
        shadowMask.destroy();
        visionMaskGraphics.destroy();
        
        // 다른 플레이어들의 가시성에 따른 depth 조정
        this.updateOtherPlayersDepth(playerPos, endpoints);
    }
    
    // 다른 플레이어들의 가시성에 따른 depth 조정
    updateOtherPlayersDepth(playerPos, endpoints) {
        if (!this.otherPlayers || !this.otherPlayers.children || !this.wallLines) {
            return;
        }
        
        const visionRadius = this.player.visionRange || 300;
        
        this.otherPlayers.getChildren().forEach(otherPlayer => {
            // 점프 중일 때는 점프 전 위치를 기준으로 계산
            let checkX, checkY;
            if (otherPlayer.isJumping && otherPlayer.preJumpPosition) {
                checkX = otherPlayer.preJumpPosition.x;
                checkY = otherPlayer.preJumpPosition.y;
            } else {
                checkX = otherPlayer.x;
                checkY = otherPlayer.y;
                // 점프 중이 아닐 때는 현재 위치를 저장 (다음 점프를 위해)
                if (!otherPlayer.preJumpPosition) {
                    otherPlayer.preJumpPosition = { x: checkX, y: checkY };
                } else {
                    otherPlayer.preJumpPosition.x = checkX;
                    otherPlayer.preJumpPosition.y = checkY;
                }
            }
            
            // 플레이어와의 거리 체크 (시야 범위 밖이면 무조건 가려짐)
            const distance = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, checkX, checkY);
            if (distance > visionRadius) {
                if (otherPlayer.depth !== 650) {
                    this.setPlayerDepthWithNameTag(otherPlayer, 650, false); // 시야 범위 밖은 가려진 상태
                }
                return;
            }
            
            // 플레이어의 바운딩 박스 정보 가져오기
            const bounds = otherPlayer.getBounds();
            const playerSize = Math.max(bounds.width, bounds.height);
            const checkRadius = playerSize / 2;
            // 벽에 붙었을 때의 오차를 줄이기 위해 체크 포인트를 약간 안쪽으로 조정
            const adjustedRadius = checkRadius * 0.85; // 15% 안쪽으로
            const diagonalRadius = adjustedRadius * 0.7; // 대각선은 더 안쪽으로
            
            // 플레이어 몸체의 여러 점들을 체크 (점프 전 위치 기준, 약간 안쪽으로 조정)
            const checkPoints = [
                // 중심점
                new Phaser.Math.Vector2(checkX, checkY),
                // 상하좌우 (조정된 반지름 사용)
                new Phaser.Math.Vector2(checkX, checkY - adjustedRadius),
                new Phaser.Math.Vector2(checkX, checkY + adjustedRadius),
                new Phaser.Math.Vector2(checkX - adjustedRadius, checkY),
                new Phaser.Math.Vector2(checkX + adjustedRadius, checkY),
                // 대각선 (더 안쪽으로 조정)
                new Phaser.Math.Vector2(checkX - diagonalRadius, checkY - diagonalRadius),
                new Phaser.Math.Vector2(checkX + diagonalRadius, checkY - diagonalRadius),
                new Phaser.Math.Vector2(checkX - diagonalRadius, checkY + diagonalRadius),
                new Phaser.Math.Vector2(checkX + diagonalRadius, checkY + diagonalRadius)
            ];
            
            // 각 체크 포인트에서 플레이어까지의 직선이 벽에 막히는지 확인
            let visiblePointsCount = 0;
            
            checkPoints.forEach(point => {
                const isVisible = this.isPointVisibleFromPlayer(playerPos, point);
                if (isVisible) {
                    visiblePointsCount++;
                }
            });
            
            // 모든 체크 포인트가 보이면 완전히 노출된 것으로 판단
            const allPointsVisible = visiblePointsCount === checkPoints.length;
            
            // depth 조정 (몸 전체가 보이면 950, 일부라도 가려지면 650)
            const targetDepth = allPointsVisible ? 950 : 650;
            const isFullyVisible = allPointsVisible;
            
            if (otherPlayer.depth !== targetDepth) {
                this.setPlayerDepthWithNameTag(otherPlayer, targetDepth, isFullyVisible);
            }
        });
    }
    
    // 특정 지점이 플레이어로부터 보이는지 확인 (벽에 막히지 않는지)
    isPointVisibleFromPlayer(playerPos, targetPoint) {
        // 플레이어에서 대상 지점까지의 직선
        const rayLine = new Phaser.Geom.Line(playerPos.x, playerPos.y, targetPoint.x, targetPoint.y);
        
        // 모든 벽과의 교차 확인
        for (let wallLine of this.wallLines) {
            const intersectPoint = new Phaser.Geom.Point();
            if (Phaser.Geom.Intersects.LineToLine(rayLine, wallLine, intersectPoint)) {
                // 교차점이 플레이어와 대상 지점 사이에 있는지 확인
                const distToPlayer = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, intersectPoint.x, intersectPoint.y);
                const distToTarget = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, targetPoint.x, targetPoint.y);
                
                // 교차점이 플레이어와 대상 사이에 있다면 가려진 것
                // 벽에 붙었을 때 오차를 고려하여 허용 범위를 늘림
                if (distToPlayer < distToTarget - 5) { // 5픽셀 오차 허용
                    return false;
                }
            }
        }
        
        return true; // 벽에 막히지 않음
    }
    
    // 플레이어 depth 설정 및 상대팀 이름표 가시성 조정 헬퍼 메서드
    setPlayerDepthWithNameTag(player, playerDepth, isFullyVisible) {
        player.setDepth(playerDepth);
        if (player.nameText) {
            // 이름표는 항상 960 depth로 고정
            player.nameText.setDepth(960);
            
            // 상대팀인 경우 가려진 상태에서는 이름표 숨김
            const isEnemyTeam = this.player && player.team !== this.player.team;
            if (isEnemyTeam && !isFullyVisible) {
                player.nameText.setVisible(false);
            } else {
                player.nameText.setVisible(true);
            }
        }
    }
    
    // 와드 범위 내 시야를 마스크에 추가
    addWardVisionToMask(visionMaskGraphics, cam) {
        // 같은 팀 플레이어들의 와드 시야만 추가
        
        // 1. 로컬 와드 (같은 팀이므로 항상 추가)
        if (this.activeWard) {
            const ward = this.activeWard;
            visionMaskGraphics.fillCircle(ward.x - cam.scrollX, ward.y - cam.scrollY, ward.radius);
        }
        
        // 2. 같은 팀 다른 플레이어들의 와드들만 추가
        this.children.list.forEach(child => {
            if (child.texture && child.texture.key === 'ward' && child.isOtherPlayerWard) {
                // 와드를 설치한 플레이어의 팀 확인
                const wardOwner = this.otherPlayers.getChildren().find(p => p.networkId === child.wardOwnerId);
                
                if (wardOwner && wardOwner.team === this.player.team) {
                    // 같은 팀의 와드만 시야 추가
                    visionMaskGraphics.fillCircle(child.x - cam.scrollX, child.y - cam.scrollY, 120); // 와드 반지름
                }
            }
        });
    }

    createGradientTexture() {
        const size = 512;
        const graphics = this.make.graphics({ width: size, height: size, add: false });

        const radius = size / 2;
        const gradient = graphics.fillGradientStyle(0xffffff, 0xffffff, 0x000000, 0x000000, 1, 1, 0, 0);

        // 원형 그래디언트를 그립니다.
        graphics.beginPath();
        graphics.arc(radius, radius, radius, 0, 2 * Math.PI, false);
        graphics.closePath();
        graphics.fillPath();

        // 생성된 그래픽을 'vision_gradient'라는 키의 텍스처로 만듭니다.
        graphics.generateTexture('vision_gradient', size, size);
        graphics.destroy(); // 임시 그래픽 객체는 파괴합니다.
    }
    
    handlePlayerEnemyCollision(player, enemy) {
        // 본인 플레이어만 적과 상호작용
        if (player === this.player && player.body.velocity.length() > 50) {
            // 서버에 적 공격 알림
            if (this.networkManager && enemy.networkId) {
                this.networkManager.hitEnemy(enemy.networkId);
            }
            
            // 넉백 효과 (즉시 표시)
            const angle = Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
            const knockbackForce = 200;
            enemy.setVelocity(
                Math.cos(angle) * knockbackForce,
                Math.sin(angle) * knockbackForce
            );
        }
    }
    
    // 적과 와드 충돌 처리
    handleEnemyWardCollision(enemy, ward) {
        // 와드가 존재하고 체력이 있을 때만 데미지
        if (this.activeWard && this.activeWard.hp > 0) {
            // 슬라임 공격력 (20)으로 와드 데미지
            const damage = 20;
            this.activeWard.hp -= damage;
            
            // 와드 데미지 이펙트
            ward.setTint(0xff0000);
            this.time.delayedCall(200, () => {
                ward.clearTint();
            });
            
            console.log(`와드가 공격받음! 남은 체력: ${this.activeWard.hp}/${this.activeWard.maxHp}`);
            
            // 와드 체력이 0 이하가 되면 파괴
            if (this.activeWard.hp <= 0) {
                console.log('와드가 파괴되었습니다!');
                
                // 와드 파괴 이펙트
                const explosion = this.add.circle(ward.x, ward.y, 50, 0xff0000, 0.5);
                this.tweens.add({
                    targets: explosion,
                    scaleX: 2,
                    scaleY: 2,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        explosion.destroy();
                    }
                });
                
                // 와드 파괴 함수 호출
                if (ward.destroyWard) {
                    ward.destroyWard();
                }
                
                // 네트워크에 와드 파괴 알림
                if (this.networkManager) {
                    this.networkManager.emit('ward-destroyed', {
                        playerId: this.networkManager.playerId,
                        x: ward.x,
                        y: ward.y
                    });
                }
                
                // 충돌 설정 업데이트
                this.setupCollisions();
            }
        }
    }
    
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

        // 미니맵 & 빅맵 초기화
        this.initMinimap();
    }

    initMinimap() {
        this.minimapSize = 200;
        this.minimapViewSize = 1000;
        this.minimapScale = this.minimapSize / this.minimapViewSize;
        
        this.bigMapSize = 800;
        this.bigMapScale = this.bigMapSize / this.MAP_WIDTH;

        this.mapCols = Math.ceil(this.MAP_WIDTH / this.TILE_SIZE);
        this.mapRows = Math.ceil(this.MAP_HEIGHT / this.TILE_SIZE);

        // discovered 배열은 reinitializeMinimap에서 초기화됨 (세션 기반 관리)

        this.minimap = this.add.graphics();
        this.minimap.setScrollFactor(0);
        this.minimap.setDepth(1002);
        this.positionMinimap();

        this.bigMap = this.add.graphics();
        this.bigMap.setScrollFactor(0);
        this.bigMap.setDepth(1001);
        this.bigMap.setVisible(false);
        this.bigMap.setPosition((this.scale.width - this.bigMapSize) / 2, (this.scale.height - this.bigMapSize) / 2);

        this.mapToggleKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.bigMapVisible = false;

        // 핑 관련 변수들
        this.pingKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);
        this.pings = this.add.group();
        this.pingMessageText = null;
        this.pingCooldown = 0;
        this.pingCooldownTime = 1000; // 1초 쿨다운
        
        // 핑 화살표 추적을 위한 변수들
        this.activePingArrows = new Map(); // 핑 ID별 화살표 객체 저장
        this.activePingPositions = new Map(); // 핑 ID별 위치 저장

        // 마우스 핑 이벤트 설정 (마우스휠 클릭)
        this.input.on('pointerdown', (pointer) => {
            if (pointer.button === 1) { // 마우스 휠 클릭 (중간 버튼)
                this.sendPingAtPosition(pointer.worldX, pointer.worldY);
            }
        });
    }

    positionMinimap() {
        if (!this.minimap) return;
        const cam = this.cameras.main;
        this.minimap.setPosition(
            cam.width - this.minimapSize - 10,
            65
        );
    }

    updateMinimapVision() {
        if (!this.player || !this.discovered) return;
        
        const radius = this.player.minimapVisionRange;
        const startCol = Math.max(0, Math.floor((this.player.x - radius) / this.TILE_SIZE));
        const endCol = Math.min(this.mapCols - 1, Math.floor((this.player.x + radius) / this.TILE_SIZE));
        const startRow = Math.max(0, Math.floor((this.player.y - radius) / this.TILE_SIZE));
        const endRow = Math.min(this.mapRows - 1, Math.floor((this.player.y + radius) / this.TILE_SIZE));

        let hasNewDiscovery = false;
        const radiusSq = radius * radius;
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                if (this.discovered[row] && !this.discovered[row][col]) {
                    const cellCenterX = col * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const cellCenterY = row * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const dx = cellCenterX - this.player.x;
                    const dy = cellCenterY - this.player.y;
                    if (dx * dx + dy * dy <= radiusSq) {
                        this.discovered[row][col] = true;
                        hasNewDiscovery = true;
                    }
                }
            }
        }
    }

    updateMinimap() {
        if (!this.player || !this.minimap || !this.discovered || !this.walls) return;
    
        const size = this.minimapSize;
        const scale = this.minimapScale;
        
        this.positionMinimap();
        this.minimap.clear();
        
        // 1. 미니맵 배경 그리기
        this.minimap.fillStyle(0x000000, 0.8);
        this.minimap.fillRect(0, 0, size, size);
    
        // 2. 플레이어 위치를 중심으로 미니맵에 보일 월드 좌표의 시작점 계산
        const offsetX = this.player.x - (size / 2) / scale;
        const offsetY = this.player.y - (size / 2) / scale;
    
        // 3. 미니맵 경계와 클리핑을 위한 헬퍼 함수 정의
        const minimapBounds = new Phaser.Geom.Rectangle(0, 0, size, size);
        
        // 월드 좌표의 사각형(rect)을 받아 미니맵 경계에 맞게 잘라 그리는 함수
        const drawClippedRect = (rect, color, alpha) => {
            const zoneInMinimap = new Phaser.Geom.Rectangle(
                (rect.x - offsetX) * scale,
                (rect.y - offsetY) * scale,
                rect.width * scale,
                rect.height * scale
            );
            // 미니맵 경계와 그릴 사각형의 겹치는 부분만 계산
            const intersection = Phaser.Geom.Rectangle.Intersection(minimapBounds, zoneInMinimap);
            
            // 겹치는 부분이 있을 경우에만 그리기
            if (!intersection.isEmpty()) {
                this.minimap.fillStyle(color, alpha);
                this.minimap.fillRect(intersection.x, intersection.y, intersection.width, intersection.height);
            }
        };
        
        // 시야가 있는 지역에서만 색깔 구역을 그리는 함수
        const drawDiscoveredRect = (rect, color, alpha) => {
            // 사각형 영역의 타일들을 검사해서 발견된 부분만 그리기
            const startCol = Math.max(0, Math.floor(rect.x / this.TILE_SIZE));
            const endCol = Math.min(this.mapCols - 1, Math.floor((rect.x + rect.width) / this.TILE_SIZE));
            const startRow = Math.max(0, Math.floor(rect.y / this.TILE_SIZE));
            const endRow = Math.min(this.mapRows - 1, Math.floor((rect.y + rect.height) / this.TILE_SIZE));
            
            for (let y = startRow; y <= endRow; y++) {
                for (let x = startCol; x <= endCol; x++) {
                    if (this.discovered[y] && this.discovered[y][x]) {
                        const tileWorldRect = new Phaser.Geom.Rectangle(
                            x * this.TILE_SIZE, 
                            y * this.TILE_SIZE, 
                            this.TILE_SIZE, 
                            this.TILE_SIZE
                        );
                        // 원래 구역과 겹치는 부분만 그리기
                        const intersection = Phaser.Geom.Rectangle.Intersection(rect, tileWorldRect);
                        if (!intersection.isEmpty()) {
                            drawClippedRect(intersection, color, alpha);
                        }
                    }
                }
            }
        };
    
        // 4. 발견된 타일(회색 영역) 그리기
        const startCol = Math.max(0, Math.floor(offsetX / this.TILE_SIZE));
        const endCol = Math.min(this.mapCols - 1, Math.ceil((offsetX + this.minimapViewSize) / this.TILE_SIZE));
        const startRow = Math.max(0, Math.floor(offsetY / this.TILE_SIZE));
        const endRow = Math.min(this.mapRows - 1, Math.ceil((offsetY + this.minimapViewSize) / this.TILE_SIZE));
    
        for (let y = startRow; y <= endRow; y++) {
            for (let x = startCol; x <= endCol; x++) {
                if (this.discovered[y][x]) {
                    // BUG FIX: 직접 그리는 대신 클리핑 함수를 사용
                    const tileWorldRect = new Phaser.Geom.Rectangle(x * this.TILE_SIZE, y * this.TILE_SIZE, this.TILE_SIZE, this.TILE_SIZE);
                    drawClippedRect(tileWorldRect, 0x333333, 0.8);
                }
            }
        }
    
        // 5. 특별 구역 그리기 (시야가 있는 지역에서만)
        drawDiscoveredRect(this.redSpawnRect, 0xff0000, 0.25);
        drawDiscoveredRect(this.blueSpawnRect, 0x0000ff, 0.25);
        drawDiscoveredRect(this.plazaRect, 0xffff00, 0.15);
    
        // 6. 벽 그리기
        this.walls.getChildren().forEach(wall => {
            const col = Math.floor(wall.x / this.TILE_SIZE);
            const row = Math.floor(wall.y / this.TILE_SIZE);
            
            if (this.discovered[row] && this.discovered[row][col]) {
                // BUG FIX: 잘못된 경계 체크 로직을 제거하고 클리핑 함수를 사용
                // (wall의 x, y가 중앙 좌표라고 가정)
                const wallWorldRect = new Phaser.Geom.Rectangle(
                    wall.x - this.TILE_SIZE / 2, 
                    wall.y - this.TILE_SIZE / 2, 
                    this.TILE_SIZE, 
                    this.TILE_SIZE
                );
                drawClippedRect(wallWorldRect, 0x8b4513, 1.0);
            }
        });
    
        // 7. 다른 플레이어들 그리기
        if (this.otherPlayers && this.otherPlayers.children) {
            this.otherPlayers.getChildren().forEach(otherPlayer => {
                const playerX = (otherPlayer.x - offsetX) * scale;
                const playerY = (otherPlayer.y - offsetY) * scale;
                
                // 미니맵 범위 안에 있는지 확인
                if (playerX >= 0 && playerX <= size && playerY >= 0 && playerY <= size) {
                    if (otherPlayer.team === this.player.team) {
                        // 같은 팀: 초록색
                        this.minimap.fillStyle(0x00ff00);
                        this.minimap.fillCircle(playerX, playerY, 3);
                    } else {
                        // 상대팀: 완전히 드러난 경우에만 빨간색으로 표시
                        if (otherPlayer.depth === 950) { // 완전히 드러난 상태
                            this.minimap.fillStyle(0xff0000);
                            this.minimap.fillCircle(playerX, playerY, 3);
                        }
                    }
                }
            });
        }
        
        // 8. 내 플레이어 아이콘 그리기 (항상 중앙에 위치, 파란색)
        this.minimap.fillStyle(0x0099ff);
        this.minimap.fillCircle(size / 2, size / 2, 4);
        
        // 8. 핑 점들의 위치 업데이트
        this.updateMinimapPingPositions();
    }

    // 미니맵 핑 점들과 화살표들의 위치 업데이트
    updateMinimapPingPositions() {
        const scale = this.minimapScale;
        const offsetX = this.player.x - (this.minimapSize / 2) / scale;
        const offsetY = this.player.y - (this.minimapSize / 2) / scale;
        
        // 모든 핑 점들과 화살표들을 찾아서 위치 업데이트
        this.children.list.forEach(child => {
            if (child.pingWorldX !== undefined && child.pingWorldY !== undefined) {
                // 핑의 절대 위치를 미니맵 좌표로 변환
                const minimapX = (child.pingWorldX - offsetX) * scale;
                const minimapY = (child.pingWorldY - offsetY) * scale;
                
                // 미니맵 위치 업데이트 (경계 내로 제한)
                const clampedX = Math.max(0, Math.min(this.minimapSize, minimapX));
                const clampedY = Math.max(0, Math.min(this.minimapSize, minimapY));
                child.setPosition(this.minimap.x + clampedX, this.minimap.y + clampedY);
                
                // 화살표가 미니맵 경계를 벗어나면 강제로 경계에 고정
                if (child.texture && child.texture.key === 'ping_arrow') {
                    const margin = 5;
                    const maxX = this.minimapSize - margin;
                    const maxY = this.minimapSize - margin;
                    
                    if (clampedX < margin || clampedX > maxX || clampedY < margin || clampedY > maxY) {
                        const finalX = Math.max(margin, Math.min(maxX, clampedX));
                        const finalY = Math.max(margin, Math.min(maxY, clampedY));
                        child.setPosition(this.minimap.x + finalX, this.minimap.y + finalY);
                    }
                }
                
                // 화살표인 경우 방향도 업데이트
                if (child.texture && child.texture.key === 'ping_arrow') {
                    const margin = 5;
                    const isOffMinimap = minimapX < margin || minimapX > this.minimapSize - margin || 
                                        minimapY < margin || minimapY > this.minimapSize - margin;
                    
                    // 미니맵 밖에 있는 모든 핑은 화살표로 표시 (거리에 상관없이)
                    const isOutsideMinimap = minimapX < 0 || minimapX > this.minimapSize || 
                                            minimapY < 0 || minimapY > this.minimapSize;
                    
                    // 미니맵 밖에 있으면 무조건 화살표 표시
                    if (isOutsideMinimap || isOffMinimap) {
                        // 화살표 방향 재계산 (경계에 고정)
                        // 화살표가 미니맵 바깥으로 나가지 않도록 clamp 처리
                        let arrowX = Math.max(margin, Math.min(this.minimapSize - margin, minimapX));
                        let arrowY = Math.max(margin, Math.min(this.minimapSize - margin, minimapY));
                        // 화살표 방향 계산 (미니맵 경계에서 핑의 실제 위치를 가리킴)
                        const angle = Phaser.Math.Angle.Between(arrowX, arrowY, minimapX, minimapY);
                        child.setRotation(angle);
                        child.setVisible(true);
                    } else {
                        // 미니맵 안에 있으면 화살표 숨김
                        child.setVisible(false);
                    }
                }
                
                // 핑은 2초 후 자동으로 사라지므로 제거 코드 불필요
                // 한국어 주석: 핑의 수명은 애니메이션으로 관리되므로 여기서 제거하지 않음
            }
        });
    }

    // 시야 판정 함수 - 해당 좌표가 플레이어의 시야 안에 있는지 확인
    isInVision(x, y) {
        if (!this.player) return false;
        
        // 플레이어와 핑 사이의 거리 계산
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
        
        // 시야 반지름 (기존 시야 시스템과 동일하게 설정)
        const visionRadius = this.player.visionRange || 300; // 기존 시야 반지름 사용
        
        return distance <= visionRadius;
    }

    drawBigMap() {
        if (!this.player || !this.bigMap || !this.discovered || !this.walls) return;
        
        const size = this.bigMapSize;
        const scale = this.bigMapScale;
        this.bigMap.clear();

        this.bigMap.fillStyle(0x000000, 0.85);
        this.bigMap.fillRect(0, 0, size, size);

        this.bigMap.fillStyle(0x333333, 0.85);
        const tileW = this.TILE_SIZE * scale;
        const tileH = this.TILE_SIZE * scale;
        for (let y = 0; y < this.mapRows; y++) {
            for (let x = 0; x < this.mapCols; x++) {
                if (this.discovered[y][x]) {
                    this.bigMap.fillRect(x * tileW, y * tileH, tileW, tileH);
                }
            }
        }
        
        // 특별 구역을 시야가 있는 지역에서만 그리기
        this.drawBigMapZone(this.redSpawnRect, 0xff0000, 0.25, scale);
        this.drawBigMapZone(this.blueSpawnRect, 0x0000ff, 0.25, scale);
        this.drawBigMapZone(this.plazaRect, 0xffff00, 0.15, scale);

        this.bigMap.fillStyle(0x8b4513);
        this.walls.getChildren().forEach(wall => {
            const col = Math.floor(wall.x / this.TILE_SIZE);
            const row = Math.floor(wall.y / this.TILE_SIZE);
            if (this.discovered[row] && this.discovered[row][col]) {
                const x = (wall.x - this.TILE_SIZE / 2) * scale;
                const y = (wall.y - this.TILE_SIZE / 2) * scale;
                this.bigMap.fillRect(x, y, this.TILE_SIZE * scale, this.TILE_SIZE * scale);
            }
        });

        // 다른 플레이어들 그리기
        if (this.otherPlayers && this.otherPlayers.children) {
            this.otherPlayers.getChildren().forEach(otherPlayer => {
                const playerX = otherPlayer.x * scale;
                const playerY = otherPlayer.y * scale;
                
                // 빅맵 범위 안에 있는지 확인
                if (playerX >= 0 && playerX <= size && playerY >= 0 && playerY <= size) {
                    if (otherPlayer.team === this.player.team) {
                        // 같은 팀: 초록색
                        this.bigMap.fillStyle(0x00ff00);
                        this.bigMap.fillCircle(playerX, playerY, 4);
                    } else {
                        // 상대팀: 완전히 드러난 경우에만 빨간색으로 표시
                        if (otherPlayer.depth === 950) { // 완전히 드러난 상태
                            this.bigMap.fillStyle(0xff0000);
                            this.bigMap.fillCircle(playerX, playerY, 4);
                        }
                    }
                }
            });
        }
        
        // 내 플레이어 그리기 (파란색)
        this.bigMap.fillStyle(0x0099ff);
        this.bigMap.fillCircle(this.player.x * scale, this.player.y * scale, 5);
    }
    
    // 빅맵에서 시야가 있는 지역의 특별 구역만 그리는 헬퍼 메서드
    drawBigMapZone(rect, color, alpha, scale) {
        // 사각형 영역의 타일들을 검사해서 발견된 부분만 그리기
        const startCol = Math.max(0, Math.floor(rect.x / this.TILE_SIZE));
        const endCol = Math.min(this.mapCols - 1, Math.floor((rect.x + rect.width) / this.TILE_SIZE));
        const startRow = Math.max(0, Math.floor(rect.y / this.TILE_SIZE));
        const endRow = Math.min(this.mapRows - 1, Math.floor((rect.y + rect.height) / this.TILE_SIZE));
        
        this.bigMap.fillStyle(color, alpha);
        
        for (let y = startRow; y <= endRow; y++) {
            for (let x = startCol; x <= endCol; x++) {
                if (this.discovered[y] && this.discovered[y][x]) {
                    const tileWorldRect = new Phaser.Geom.Rectangle(
                        x * this.TILE_SIZE, 
                        y * this.TILE_SIZE, 
                        this.TILE_SIZE, 
                        this.TILE_SIZE
                    );
                    // 원래 구역과 겹치는 부분만 그리기
                    const intersection = Phaser.Geom.Rectangle.Intersection(rect, tileWorldRect);
                    if (!intersection.isEmpty()) {
                        this.bigMap.fillRect(
                            intersection.x * scale, 
                            intersection.y * scale, 
                            intersection.width * scale, 
                            intersection.height * scale
                        );
                    }
                }
            }
        }
    }
    
    update(time, delta) {
        // 플레이어가 아직 생성되지 않았으면 대기
        if (!this.player) {
            return;
        }
        
        // 치트 키 처리
        this.handleCheatKeys();
        
        // 점프 상태 변화 감지 및 카메라 제어
        if (this.player.isJumping && !this.wasJumping) {
            // 점프 시작 - 카메라 추적 중단
            this.cameras.main.stopFollow();
            this.wasJumping = true;
        } else if (!this.player.isJumping && this.wasJumping) {
            // 점프 종료 - 카메라 추적 재시작
            this.cameras.main.startFollow(this.player);
            this.wasJumping = false;
        }
        
        // 플레이어가 점프 중이 아닐 때만 벽 충돌 체크 및 강제 이동
        if (!this.player.isJumping) {
            const collidingWall = this.checkPlayerWallCollision();
            if (collidingWall) {
                this.pushPlayerOutOfWall(collidingWall);
            }
        }
        
        this.player.update(time, delta);
        
        if (this.enemies && this.enemies.children) {
            this.enemies.getChildren().forEach(enemy => {
                enemy.update(time, delta);
            });
        }

        if (this.mapToggleKey && Phaser.Input.Keyboard.JustDown(this.mapToggleKey)) {
            this.bigMapVisible = !this.bigMapVisible;
            this.bigMap.setVisible(this.bigMapVisible);
            this.minimap.setVisible(!this.bigMapVisible);
        }



        if (!this.player.isJumping) {
            this.updateMinimapVision();
            this.updateVision();

            if (this.bigMapVisible) {
                this.drawBigMap();
            } else {
                this.updateMinimap();
            }
        }

        // 활성 핑 화살표들의 방향 실시간 업데이트
        this.updatePingArrows();
        
        // 와드로 탐지된 적들의 미니맵 위치 업데이트
        this.updateWardDetectedEnemies();

        this.restrictMovement();
    }

    getRandomPointInRect(rect) {
        return {
            x: Phaser.Math.Between(rect.x + this.TILE_SIZE, rect.right - this.TILE_SIZE),
            y: Phaser.Math.Between(rect.y + this.TILE_SIZE, rect.bottom - this.TILE_SIZE)
        };
    }

    restrictMovement() {
        // 적들만 스폰 구역에서 밀어내기 (플레이어는 물리적 장벽으로 처리)
        if (this.enemies && this.enemies.children) {
            this.enemies.getChildren().forEach(enemy => {
                if (this.redSpawnRect.contains(enemy.x, enemy.y)) {
                    enemy.x = this.redSpawnRect.right + this.TILE_SIZE;
                } 
                else if (this.blueSpawnRect.contains(enemy.x, enemy.y)) {
                    enemy.x = this.blueSpawnRect.x - this.TILE_SIZE;
                }
            });
        }
    }

    // 카메라 줌 변경 시 UI 스케일 조정 (안개와 미니맵이 영향받지 않도록)
    updateUIScale(cameraZoom) {
        const inverseZoom = 1 / cameraZoom;
        
        // 안개 스케일 조정
        if (this.baseVisionTexture) {
            this.baseVisionTexture.setScale(inverseZoom);
        }
        if (this.shadowVisionTexture) {
            this.shadowVisionTexture.setScale(inverseZoom);
        }
        
        // 미니맵 스케일 조정
        if (this.minimap) {
            this.minimap.setScale(inverseZoom);
        }
        
        // 빅맵 스케일 조정
        if (this.bigMap) {
            this.bigMap.setScale(inverseZoom);
        }
    }

    // 플레이어가 벽과 충돌하는지 체크
    checkPlayerWallCollision() {
        if (!this.player || !this.walls || !this.walls.children) {
            return null;
        }

        const playerBounds = this.player.getBounds();
        
        // 플레이어 바운딩 박스에 완충 범위를 추가
        const expandedBounds = new Phaser.Geom.Rectangle(
            playerBounds.x - this.WALL_COLLISION_BUFFER,
            playerBounds.y - this.WALL_COLLISION_BUFFER,
            playerBounds.width + this.WALL_COLLISION_BUFFER * 2,
            playerBounds.height + this.WALL_COLLISION_BUFFER * 2
        );

        // 모든 벽과 충돌 체크
        for (let wall of this.walls.children.entries) {
            const wallBounds = wall.getBounds();
            
            if (Phaser.Geom.Rectangle.Overlaps(expandedBounds, wallBounds)) {
                return wall;
            }
        }
        
        return null;
    }

    // 플레이어를 가장 가까운 벽 밖으로 강제 이동
    pushPlayerOutOfWall(collidingWall) {
        if (!this.player || !collidingWall) {
            return;
        }

        const playerBounds = this.player.getBounds();
        const wallBounds = collidingWall.getBounds();
        
        // 플레이어 중심점과 벽 중심점 계산
        const playerCenterX = playerBounds.centerX;
        const playerCenterY = playerBounds.centerY;
        const wallCenterX = wallBounds.centerX;
        const wallCenterY = wallBounds.centerY;
        
        // 플레이어에서 벽 중심까지의 방향 벡터
        const deltaX = playerCenterX - wallCenterX;
        const deltaY = playerCenterY - wallCenterY;
        
        // 각 축에서의 겹침 정도 계산
        const overlapX = (playerBounds.width / 2 + wallBounds.width / 2) - Math.abs(deltaX);
        const overlapY = (playerBounds.height / 2 + wallBounds.height / 2) - Math.abs(deltaY);
        
        // 더 적게 겹친 축으로 밀어내기 (최소 침투 깊이 원칙)
        // 겹친 만큼 + 1픽셀 여유만 이동
        const minSeparation = 1; // 벽과의 최소 간격 (1픽셀)
        
        if (overlapX < overlapY) {
            // X축으로 밀어내기
            if (deltaX > 0) {
                // 플레이어가 벽의 오른쪽에 있음 - 오른쪽으로 밀어내기
                this.player.x += overlapX + minSeparation;
            } else {
                // 플레이어가 벽의 왼쪽에 있음 - 왼쪽으로 밀어내기
                this.player.x -= overlapX + minSeparation;
            }
        } else {
            // Y축으로 밀어내기
            if (deltaY > 0) {
                // 플레이어가 벽의 아래쪽에 있음 - 아래쪽으로 밀어내기
                this.player.y += overlapY + minSeparation;
            } else {
                // 플레이어가 벽의 위쪽에 있음 - 위쪽으로 밀어내기
                this.player.y -= overlapY + minSeparation;
            }
        }
        
        // 월드 경계 내로 제한
        this.player.x = Phaser.Math.Clamp(this.player.x, playerBounds.width / 2, this.MAP_WIDTH - playerBounds.width / 2);
        this.player.y = Phaser.Math.Clamp(this.player.y, playerBounds.height / 2, this.MAP_HEIGHT - playerBounds.height / 2);
        
        console.log('플레이어를 벽 밖으로 강제 이동:', this.player.x, this.player.y);
    }

    // 네트워크 이벤트 리스너 설정
    setupNetworkListeners() {
        // 기존 리스너들 정리 (중복 방지)
        this.networkManager.off('game-joined');
        this.networkManager.off('player-joined');
        this.networkManager.off('player-left');
        this.networkManager.off('player-moved');
        this.networkManager.off('player-skill-used');
        this.networkManager.off('enemies-update');
        this.networkManager.off('player-job-changed');
        
        // 게임 입장 완료
        this.networkManager.on('game-joined', (data) => {
            console.log('game-joined 이벤트 수신:', data.playerId, '현재 상태:', {
                gameJoined: this.gameJoined,
                playerId: this.playerId,
                hasPlayer: !!this.player
            });
            
            // 중복 처리 방지 - 더 강력한 검사
            if (this.gameJoined && this.playerId === data.playerId) {
                console.log('게임 입장 이미 완료됨, 중복 처리 무시');
                return;
            }
            
            // 같은 플레이어 ID로 이미 플레이어가 생성된 경우
            if (this.player && this.player.networkId === data.playerId) {
                console.log('같은 플레이어 ID로 이미 플레이어가 존재함, 중복 처리 무시');
                return;
            }
            
            console.log('게임 입장 처리 시작:', data);
            this.gameJoined = true;
            this.playerId = data.playerId;
            
            // 플레이어 팀 정보 저장
            this.playerTeam = data.playerData.team;
            
            // 서버 맵 데이터로 맵 재생성
            if (data.mapData) {
                console.log('서버 맵 데이터로 맵 재생성');
                this.recreateMapFromServer(data.mapData);
            }
            
            // 텍스처 존재 여부 확인
            const testTexture = `player_${data.playerData.jobClass}_front`;
            console.log(`텍스처 확인: ${testTexture} exists = ${this.textures.exists(testTexture)}`);
            
            // 기존 플레이어가 있다면 제거
            if (this.player) {
                this.player.destroy();
                this.player = null;
            }
            
            // 본인 플레이어 생성
            this.player = new Player(this, data.playerData.x, data.playerData.y, data.playerData.team);
            this.player.setNetworkId(data.playerId);
            this.player.setNetworkManager(this.networkManager);
            
            // 플레이어가 시야 그림자에 가려지지 않도록 depth 설정 (visionTexture: 900)
            this.player.setDepth(950);
            
            // 내 플레이어 이름표 생성
            this.player.createNameText(this.playerNickname, data.playerData.team, 960);
            
            // 물리 충돌 설정 (맵 재생성 후에도 작동하도록)
            this.setupCollisions();
            
            // 카메라 설정
            this.cameras.main.startFollow(this.player);
            this.cameras.main.setZoom(1);
            
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
            
            // 첫 입장 완료 후 플래그 해제 (이후 리스폰은 기존 데이터 유지)
            this.isFirstJoin = false;
            
            console.log('플레이어 생성 완료:', this.player);
        });

        // 다른 플레이어 입장
        this.networkManager.on('player-joined', (playerData) => {
            console.log('플레이어 입장:', playerData);
            this.createOtherPlayer(playerData);
        });

        // 플레이어 퇴장
        this.networkManager.on('player-left', (data) => {
            console.log('플레이어 퇴장:', data);
            if (!this.otherPlayers || !this.otherPlayers.children) return;
            const otherPlayer = this.otherPlayers.getChildren().find(p => p.networkId === data.playerId);
            if (otherPlayer) {
                otherPlayer.destroy();
            }
        });

        // 플레이어 이동
        this.networkManager.on('player-moved', (data) => {
            if (!this.otherPlayers || !this.otherPlayers.children) return;
            const otherPlayer = this.otherPlayers.getChildren().find(p => p.networkId === data.id);
            if (otherPlayer && !otherPlayer.isJumping) { // 점프 중이 아닐 때만 위치 업데이트
                // 부드러운 이동을 위한 트윈 (이름표도 함께 업데이트)
                this.tweens.add({
                    targets: otherPlayer,
                    x: data.x,
                    y: data.y,
                    duration: 50,
                    ease: 'Linear',
                    onUpdate: () => {
                        // 매 프레임마다 이름표 위치 업데이트
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
        });

        // 스킬 사용
        this.networkManager.on('player-skill-used', (data) => {
            const player = data.playerId === this.networkManager.playerId 
                ? this.player 
                : (this.otherPlayers && this.otherPlayers.children 
                   ? this.otherPlayers.getChildren().find(p => p.networkId === data.playerId)
                   : null);
            
            if (player) {
                // 본인이 아닌 다른 플레이어의 스킬만 실행
                if (data.playerId !== this.networkManager.playerId) {
                    this.showSkillEffect(player, data.skillType, data);
                }
            }
        });
        
        // 와드 파괴 (다른 플레이어의 와드가 파괴될 때)
        this.networkManager.on('ward-destroyed', (data) => {
            // 다른 플레이어의 와드 스프라이트들을 찾아서 제거
            this.children.list.forEach(child => {
                if (child.texture && child.texture.key === 'ward' && child.isOtherPlayerWard) {
                    // 파괴 이펙트
                    const explosion = this.add.circle(child.x, child.y, 50, 0xff0000, 0.5);
                    this.tweens.add({
                        targets: explosion,
                        scaleX: 2,
                        scaleY: 2,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            explosion.destroy();
                        }
                    });
                    
                    child.destroy();
                }
            });
        });

        // 플레이어 레벨업
        this.networkManager.on('player-level-up', (data) => {
            const player = data.playerId === this.networkManager.playerId 
                ? this.player 
                : (this.otherPlayers && this.otherPlayers.children 
                   ? this.otherPlayers.getChildren().find(p => p.networkId === data.playerId)
                   : null);
            
            if (player) {
                const levelUpText = this.add.text(player.x, player.y - 50, 'LEVEL UP!', {
                    fontSize: '24px',
                    fill: '#ffff00'
                }).setOrigin(0.5);
                
                this.time.delayedCall(2000, () => {
                    levelUpText.destroy();
                });
            }
        });

        // 적 스폰
        this.networkManager.on('enemy-spawned', (enemyData) => {
            this.createNetworkEnemy(enemyData);
        });

        // 적 제거
        this.networkManager.on('enemy-destroyed', (data) => {
            if (!this.enemies || !this.enemies.children) return;
            const enemy = this.enemies.getChildren().find(e => e.networkId === data.enemyId);
            if (enemy) {
                enemy.destroy();
            }
        });

        // 적 데미지
        this.networkManager.on('enemy-damaged', (data) => {
            if (!this.enemies || !this.enemies.children) return;
            const enemy = this.enemies.getChildren().find(e => e.networkId === data.enemyId);
            if (enemy) {
                enemy.hp = data.hp;
                enemy.maxHp = data.maxHp;
                
                // 데미지 표시
                const damageText = this.add.text(enemy.x, enemy.y - 30, `${enemy.hp}/${enemy.maxHp}`, {
                    fontSize: '12px',
                    fill: '#ff0000'
                }).setOrigin(0.5);
                
                this.time.delayedCall(1000, () => {
                    damageText.destroy();
                });
            }
        });

        // 적 위치 업데이트 (서버에서 관리)
        this.networkManager.on('enemies-update', (enemiesData) => {
            enemiesData.forEach(enemyData => {
                if (!this.enemies || !this.enemies.children) return;
                const enemy = this.enemies.getChildren().find(e => e.networkId === enemyData.id);
                if (enemy) {
                    // 부드러운 이동을 위한 보간
                    this.tweens.add({
                        targets: enemy,
                        x: enemyData.x,
                        y: enemyData.y,
                        duration: 50,
                        ease: 'Linear'
                    });
                    
                    // HP 업데이트
                    enemy.hp = enemyData.hp;
                    enemy.maxHp = enemyData.maxHp;
                    
                    // 공격 애니메이션
                    if (enemyData.isAttacking) {
                        this.showEnemyAttack(enemy);
                    }
                }
            });
         });

        // 플레이어 직업 변경
        this.networkManager.on('player-job-changed', (data) => {
            if (!this.otherPlayers || !this.otherPlayers.children) return;
            const otherPlayer = this.otherPlayers.getChildren().find(p => p.networkId === data.id);
            if (otherPlayer) {
                otherPlayer.jobClass = data.jobClass;
                otherPlayer.updateJobSprite();
            }
        });

        // 게임 상태 동기화 (탭 포커스 복원 시)
        this.networkManager.on('game-synced', (syncData) => {
            console.log('게임 상태 동기화 완료:', syncData);
            this.restorePlayerStates(syncData);
        });
      
        // 핑 수신
        this.networkManager.on('player-ping', (data) => {
            // 같은 팀의 핑만 표시
            if (data.team === this.player.team && data.playerId !== this.networkManager.playerId) {
                this.createPing(data.x, data.y, data.playerId);
                this.showPingMessage(`팀원이 핑을 찍었습니다!`);
                
                // 핑 ID 생성 (플레이어 ID + 타임스탬프)
                const pingId = `${data.playerId}_${Date.now()}`;
                
                // 핑 위치 저장
                this.activePingPositions.set(pingId, { x: data.x, y: data.y });
                
                // 화면 밖에 있는 핑인지 확인하고 화살표 표시
                this.checkAndShowPingArrow(data.x, data.y, pingId);
            }
        });
    }

    // 다른 플레이어 생성
    createOtherPlayer(playerData) {
        const otherPlayer = new Player(this, playerData.x, playerData.y, playerData.team);
        otherPlayer.setNetworkId(playerData.id);
        otherPlayer.setIsOtherPlayer(true); // 다른 플레이어임을 표시
        otherPlayer.level = playerData.level;
        otherPlayer.hp = playerData.hp;
        otherPlayer.maxHp = playerData.maxHp;
        otherPlayer.jobClass = playerData.jobClass;
        otherPlayer.direction = playerData.direction;
        otherPlayer.size = playerData.size;
        otherPlayer.updateJobSprite();
        
        this.otherPlayers.add(otherPlayer);
        
        // 다른 플레이어가 시야 그림자에 가려지지 않도록 depth 설정
        otherPlayer.setDepth(650);
        
        // 다른 플레이어 이름표 생성 (항상 960 depth로 고정)
        const displayName = playerData.nickname || `Player ${playerData.id.slice(0, 6)}`;
        otherPlayer.createNameText(displayName, playerData.team, 960);
        
        return otherPlayer;
    }

    // 네트워크 적 생성
    createNetworkEnemy(enemyData) {
        const enemy = new Enemy(this, enemyData.x, enemyData.y, enemyData.type);
        enemy.setNetworkId(enemyData.id);
        enemy.hp = enemyData.hp;
        enemy.maxHp = enemyData.maxHp;
        enemy.isServerControlled = true; // 서버에서 관리됨을 표시
        
        // 적이 시야 그림자에 가려지지 않도록 depth 설정
        enemy.setDepth(940);
        
        // enemies 그룹이 초기화되었는지 확인
        if (this.enemies && this.enemies.add) {
            this.enemies.add(enemy);
        }
        return enemy;
    }

    // 적 공격 애니메이션 표시
    showEnemyAttack(enemy) {
        // 간단한 공격 이펙트
        enemy.setTint(0xff0000);
        this.time.delayedCall(200, () => {
            enemy.clearTint();
        });
        
        // 공격 범위 표시
        const attackRange = this.add.circle(enemy.x, enemy.y, 60, 0xff0000, 0.3);
        this.time.delayedCall(300, () => {
            attackRange.destroy();
        });
    }

    // 스킬 이펙트 표시
    showSkillEffect(player, skillType, data = null) {
        switch (skillType) {
            case 'stealth':
                player.setAlpha(0.3);
                player.setTint(0x888888);
                this.time.delayedCall(3000, () => {
                    player.setAlpha(1);
                    player.clearTint();
                });
                break;
            case 'jump':
                // 다른 플레이어의 점프 애니메이션 (위치 동기화 없이 시각적 효과만)
                if (player.isOtherPlayer) {
                    const originalY = player.y;
                    const originalNameY = player.nameText ? player.nameText.y : null;
                    player.isJumping = true;
                    
                    // 플레이어와 이름 태그를 함께 애니메이션
                    const targets = [player];
                    if (player.nameText) {
                        targets.push(player.nameText);
                    }
                    
                    this.tweens.add({
                        targets: targets,
                        y: '-=50', // 현재 위치에서 50 위로
                        duration: 200,
                        yoyo: true,
                        ease: 'Power2',
                        onComplete: () => {
                            // 원래 위치로 정확히 복원
                            player.y = originalY;
                            if (player.nameText && originalNameY !== null) {
                                player.nameText.y = originalNameY;
                            }
                            player.isJumping = false;
                        }
                    });
                }
                break;
            case 'slime_spread':
                // 슬라임 퍼지기 이펙트 (다른 플레이어용)
                if (player.isOtherPlayer) {
                    // 플레이어 스프라이트를 슬라임 스킬 이미지로 변경 (로컬과 동일)
                    const originalTexture = player.texture.key;
                    player.setTexture('slime_skill');
                    
                    // 시각적 이펙트(원형 범위 표시) - 원래 방식과 동일
                    const effect = this.add.circle(player.x, player.y, 50, 0x00ff00, 0.3);
                    this.time.delayedCall(300, () => {
                        effect.destroy();
                    });
                    
                    // 400ms 후 원래 스프라이트로 복원 (로컬과 동일)
                    this.time.delayedCall(400, () => {
                        player.updateJobSprite();
                    });
                    
                    console.log('다른 플레이어의 슬라임 퍼지기 스킬 사용됨:', player.x, player.y);
                }
                break;
            case 'ward':
                // 마법사 와드 이펙트 (다른 플레이어용)
                if (player.isOtherPlayer) {
                    // 와드 스프라이트 생성
                    const ward = this.add.sprite(player.x, player.y, 'ward');
                    ward.setScale(0.02); // 로컬과 동일한 크기
                    ward.isOtherPlayerWard = true; // 다른 플레이어 와드 표시
                    ward.wardOwnerId = data.playerId; // 와드 소유자 ID 저장
                    
                    // 와드 이펙트 (깜빡이는 효과)
                    this.tweens.add({
                        targets: ward,
                        alpha: 0.8,
                        duration: 1000,
                        yoyo: true,
                        repeat: -1
                    });
                    
                    // 와드가 파괴될 때까지 유지 (실제로는 서버에서 관리)
                    // 다른 플레이어의 와드는 시각적 표시만
                    console.log('다른 플레이어의 와드 설치됨:', player.x, player.y, '팀:', player.team);
                }
                break;
            case 'ice_field':
                // 마법사 얼음 장판 이펙트 (다른 플레이어용)
                if (player.isOtherPlayer) {
                    const iceField = this.add.circle(player.x, player.y, 100, 0x87ceeb, 0.4);
                    this.tweens.add({
                        targets: iceField,
                        scaleX: 1.2,
                        scaleY: 1.2,
                        duration: 2000,
                        yoyo: true,
                        repeat: 2
                    });
                    this.time.delayedCall(6000, () => {
                        iceField.destroy();
                    });
                }
                break;
            case 'magic_missile':
                // 마법사 마법 투사체 이펙트 (다른 플레이어용)
                if (player.isOtherPlayer && data && data.startX !== undefined && data.targetX !== undefined) {
                    // 사거리 제한 적용 (로컬과 동일하게)
                    let finalTargetX = data.targetX;
                    let finalTargetY = data.targetY;
                    const maxRange = data.maxRange || 400; // 기본값 400
                    
                    // 시작점에서 목표점까지의 거리 계산
                    const distance = Phaser.Math.Distance.Between(data.startX, data.startY, data.targetX, data.targetY);
                    console.log('투사체 사거리 계산:', {
                        start: [data.startX, data.startY],
                        target: [data.targetX, data.targetY],
                        distance: distance,
                        maxRange: maxRange,
                        isOverRange: distance > maxRange
                    });
                    
                    if (distance > maxRange) {
                        // 사거리 밖이면 최대 사거리만큼만 이동
                        const angle = Phaser.Math.Angle.Between(data.startX, data.startY, data.targetX, data.targetY);
                        finalTargetX = data.startX + Math.cos(angle) * maxRange;
                        finalTargetY = data.startY + Math.sin(angle) * maxRange;
                        console.log('사거리 제한 적용됨:', {
                            originalTarget: [data.targetX, data.targetY],
                            finalTarget: [finalTargetX, finalTargetY],
                            angle: angle * (180 / Math.PI) // 라디안을 도로 변환
                        });
                    }
                    
                    // 투사체 생성 (시작 위치에서)
                    const missile = this.add.circle(data.startX, data.startY, 8, 0xff00ff, 0.3); // 투명도 낮춤
                    missile.team = data.team; // 팀 정보 저장 (충돌 판정용)
                    
                    // 물리 바디 추가 (충돌 판정용)
                    this.physics.add.existing(missile);
                    missile.body.setSize(8, 8); // 투사체 크기를 더 작게 설정
                    missile.body.setOffset(0, 0); // 오프셋 설정
                    
                    // 투사체 충돌 디버깅을 위한 이벤트 추가
                    missile.body.onOverlap = (bodyA, bodyB) => {
                        console.log('투사체 충돌 발생:', {
                            missileTeam: missile.team,
                            bodyAType: bodyA.gameObject?.constructor?.name || 'unknown',
                            bodyBType: bodyB.gameObject?.constructor?.name || 'unknown',
                            bodyAIsPlayer: bodyA.gameObject?.team !== undefined,
                            bodyBIsPlayer: bodyB.gameObject?.team !== undefined,
                            bodyATeam: bodyA.gameObject?.team,
                            bodyBTeam: bodyB.gameObject?.team
                        });
                    };
                    
                    // 투사체 이펙트 (깜빡이는 효과)
                    this.tweens.add({
                        targets: missile,
                        scaleX: 1.5,
                        scaleY: 1.5,
                        duration: 500,
                        yoyo: true,
                        repeat: -1
                    });
                    
                    // 투사체 이동 (최종 목표 위치로) - 로컬과 동일한 속도로 계산
                    const finalDistance = Phaser.Math.Distance.Between(data.startX, data.startY, finalTargetX, finalTargetY);
                    const velocity = 400; // 로컬과 동일한 속도 (pixels/second)
                    const duration = (finalDistance / velocity) * 1000; // 밀리초 단위로 변환
                    
                    console.log('투사체 이동 계산:', {
                        finalDistance: finalDistance,
                        velocity: velocity,
                        duration: duration,
                        finalTarget: [finalTargetX, finalTargetY]
                    });
                    
                    this.tweens.add({
                        targets: missile,
                        x: finalTargetX,
                        y: finalTargetY,
                        duration: duration,
                        ease: 'Linear',
                        onComplete: () => {
                            // 최종 목표 지점에서 폭발 이펙트
                            const explosion = this.add.circle(finalTargetX, finalTargetY, 20, 0xff00ff, 0.8);
                            this.tweens.add({
                                targets: explosion,
                                scaleX: 2,
                                scaleY: 2,
                                alpha: 0,
                                duration: 300,
                                onComplete: () => {
                                    explosion.destroy();
                                }
                            });
                            missile.destroy();
                        }
                    });
                    
                    // 다른 플레이어 투사체와 팀원 충돌 방지
                    // 다른 플레이어 투사체는 벽과만 충돌 (팀원과는 충돌하지 않음)
                    // 팀원과의 충돌은 아예 등록하지 않음
                    
                    // 모든 플레이어(본인+otherPlayers)와 투사체 충돌 등록
                    const allPlayers = [this.player, ...this.otherPlayers.getChildren()];
                    allPlayers.forEach(targetPlayer => {
                        if (!targetPlayer) return; // null 체크
                        // 같은 팀이면 충돌 등록하지 않음
                        if (missile.team === targetPlayer.team) return;
                        // 다른 팀이면 충돌 등록
                        this.physics.add.overlap(missile, targetPlayer, (missile, hitPlayer) => {
                            // 적팀 플레이어에게 데미지 적용 (마법 데미지: 1.5배, 예시값 30)
                            const damage = 30; // 실제 밸런스에 맞게 조정
                            if (typeof hitPlayer.takeDamage === 'function') {
                                hitPlayer.takeDamage(damage);
                            }
                            // 폭발 이펙트
                            const explosion = this.add.circle(missile.x, missile.y, 20, 0xff00ff, 0.8);
                            this.tweens.add({
                                targets: explosion,
                                scaleX: 2,
                                scaleY: 2,
                                alpha: 0,
                                duration: 300,
                                onComplete: () => {
                                    explosion.destroy();
                                }
                            });
                            missile.destroy();
                        });
                    });
                    
                    // 다른 플레이어 투사체와 적(Enemy) 충돌
                    this.physics.add.overlap(missile, this.enemies, (missile, enemy) => {
                        console.log('다른 플레이어 투사체가 적과 충돌:', missile.x, missile.y);
                        // 서버에 적 공격 알림 (서버에서 관리되는 적이므로)
                        if (this.networkManager && enemy.networkId) {
                            this.networkManager.hitEnemy(enemy.networkId);
                        }
                        // 폭발 이펙트
                        const explosion = this.add.circle(missile.x, missile.y, 20, 0xff00ff, 0.8);
                        this.tweens.add({
                            targets: explosion,
                            scaleX: 2,
                            scaleY: 2,
                            alpha: 0,
                            duration: 300,
                            onComplete: () => {
                                explosion.destroy();
                            }
                        });
                        missile.destroy();
                    });
                    
                    // 다른 플레이어 투사체와 벽 충돌
                    this.physics.add.collider(missile, this.walls, (missile, wall) => {
                        console.log('다른 플레이어 투사체가 벽과 충돌:', missile.x, missile.y);
                        // 벽에 부딪혔을 때 폭발 이펙트
                        const explosion = this.add.circle(missile.x, missile.y, 20, 0xff00ff, 0.8);
                        this.tweens.add({
                            targets: explosion,
                            scaleX: 2,
                            scaleY: 2,
                            alpha: 0,
                            duration: 300,
                            onComplete: () => {
                                explosion.destroy();
                            }
                        });
                        missile.destroy();
                    });
                    
                    // 디버깅: 현재 등록된 충돌체 확인
                    console.log('투사체 충돌 정보:', {
                        missileId: missile.id,
                        missileTeam: missile.team,
                        hasPhysicsBody: missile.body !== undefined,
                        colliders: this.physics.world.colliders?.entries?.length || 0,
                        overlaps: this.physics.world.overlaps?.entries?.length || 0,
                        isInOtherPlayersGroup: this.otherPlayers.contains(missile),
                        isInEnemiesGroup: this.enemies.contains(missile),
                        isInWallsGroup: this.walls.contains(missile),
                        registeredOverlaps: allPlayers.filter(p => p && missile.team !== p.team).length
                    });
                    
                    // 3초 후 투사체 제거 (혹시라도)
                    this.time.delayedCall(3000, () => {
                        if (missile.active) {
                            missile.destroy();
                        }
                    });
                    
                    console.log('다른 플레이어의 마법 미사일 발사:', {
                        start: [data.startX, data.startY],
                        originalTarget: [data.targetX, data.targetY],
                        finalTarget: [finalTargetX, finalTargetY],
                        maxRange: maxRange,
                        missileTeam: data.team,
                        myTeam: this.player.team,
                        otherPlayersCount: this.otherPlayers.getChildren().length
                    });
                }
                break;
            case 'charge':
                // 돌진 이펙트
                break;
        }
    }

    // 핑 생성
    createPing(x, y, playerId) {
        // 시야 안에 있는 핑만 메인 화면에 표시
        const isInVision = this.isInVision(x, y);
        
        if (isInVision) {
            // 핑 이펙트 생성 (불투명하게)
            const ping = this.add.circle(x, y, 20, 0xff0000, 1.0);
            ping.setStrokeStyle(2, 0xffffff);
            
            // 핑 애니메이션 (4초 지속)
            this.tweens.add({
                targets: ping,
                scaleX: 3,
                scaleY: 3,
                alpha: 0,
                duration: 4000,
                ease: 'Power2',
                onComplete: () => {
                    ping.destroy();
                }
            });

            // 핑 텍스트 (플레이어 ID)
            const pingText = this.add.text(x, y - 30, `PING`, {
                fontSize: '12px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);

            this.tweens.add({
                targets: pingText,
                y: '-=20',
                alpha: 0,
                duration: 4000,
                ease: 'Power2',
                onComplete: () => {
                    pingText.destroy();
                }
            });
        }

        // 미니맵에 핑 표시 (화살표 또는 점)
        this.createMinimapPingArrow(x, y, 'local-ping');
    }

    // 미니맵 핑 생성
    createMinimapPing(x, y) {
        const scale = this.minimapScale;
        const offsetX = this.player.x - (this.minimapSize / 2) / scale;
        const offsetY = this.player.y - (this.minimapSize / 2) / scale;
        
        const minimapX = (x - offsetX) * scale;
        const minimapY = (y - offsetY) * scale;
        
        // 미니맵 경계 내에 있는지 확인
        if (minimapX >= 0 && minimapX <= this.minimapSize && 
            minimapY >= 0 && minimapY <= this.minimapSize) {
            
            const minimapPing = this.add.circle(
                this.minimap.x + minimapX, 
                this.minimap.y + minimapY, 
                3, 
                0xff0000, 
                1.0
            );
            minimapPing.setScrollFactor(0);
            minimapPing.setDepth(1001);
            
            // 핑의 절대 위치를 저장 (플레이어 이동에 영향받지 않도록)
            minimapPing.pingWorldX = x;
            minimapPing.pingWorldY = y;
            
            // 미니맵 핑 애니메이션 (4초 지속)
            this.tweens.add({
                targets: minimapPing,
                scaleX: 2,
                scaleY: 2,
                alpha: 0,
                duration: 4000,
                ease: 'Power2',
                onComplete: () => {
                    minimapPing.destroy();
                }
            });
        }
    }

    // 핑 메시지 표시
    showPingMessage(message) {
        // 기존 메시지 제거
        if (this.pingMessageText) {
            this.pingMessageText.destroy();
        }

        // 새 메시지 생성 (좌측 하단)
        this.pingMessageText = this.add.text(20, this.scale.height - 60, message, {
            fontSize: '16px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: '#ff0000',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0);

        // 3초 후 메시지 제거
        this.time.delayedCall(3000, () => {
            if (this.pingMessageText) {
                this.pingMessageText.destroy();
                this.pingMessageText = null;
            }
        });
    }

    // 핑 전송 (플레이어 위치)
    sendPing() {
        this.sendPingAtPosition(this.player.x, this.player.y);
    }

    // 핑 전송 (지정된 위치)
    sendPingAtPosition(x, y) {
        const currentTime = Date.now();
        if (currentTime - this.pingCooldown < this.pingCooldownTime) {
            // 쿨다운 중
            const remainingTime = Math.ceil((this.pingCooldownTime - (currentTime - this.pingCooldown)) / 1000);
            this.showPingMessage(`핑 쿨다운: ${remainingTime}초`);
            return;
        }

        // 핑 전송
        this.networkManager.sendPing(x, y);
        this.pingCooldown = currentTime;
        
        // 로컬 핑 표시
        this.createPing(x, y, this.networkManager.playerId);
        this.showPingMessage('핑을 찍었습니다!');
    }

    // 핑 화살표 확인 및 표시 (시야 고려)
    checkAndShowPingArrow(pingX, pingY, pingId) {
        const cam = this.cameras.main;
        const screenWidth = this.scale.width;
        const screenHeight = this.scale.height;
        
        // 화면 좌표로 변환
        const screenX = pingX - cam.scrollX;
        const screenY = pingY - cam.scrollY;
        
        // 화면 밖에 있는지 확인
        const margin = 20; // 화면 가장자리 여백
        const isOffScreen = screenX < margin || screenX > screenWidth - margin || 
                           screenY < margin || screenY > screenHeight - margin;
        
        // 시야 안에 있는지 확인
        const isInVision = this.isInVision(pingX, pingY);
        
        // 화면 밖이거나 시야 밖이면 화살표 표시
        if (isOffScreen || !isInVision) {
            this.createPingArrow(pingX, pingY, pingId);
        }
    }

    // 핑 화살표 생성
    createPingArrow(pingX, pingY, pingId) {
        const cam = this.cameras.main;
        const screenWidth = this.scale.width;
        const screenHeight = this.scale.height;
        
        // 화면 좌표로 변환
        const screenX = pingX - cam.scrollX;
        const screenY = pingY - cam.scrollY;
        
        // 화면 경계 내에서 화살표 위치 계산 (더 여유있는 위치)
        const margin = 5;
        let arrowX = Math.max(margin, Math.min(screenWidth - margin, screenX));
        let arrowY = Math.max(margin, Math.min(screenHeight - margin, screenY));
        
        // 화살표 방향 계산 (플레이어 현재 위치 기준)
        const angle = Phaser.Math.Angle.Between(arrowX, arrowY, screenX, screenY);
        
        // 화살표 이미지 생성
        const arrow = this.add.image(arrowX, arrowY, 'ping_arrow');
        arrow.setScrollFactor(0);
        arrow.setDepth(1001);
        
        // 화살표 크기 설정
        arrow.setScale(0.07);
        
        // 화살표 방향 회전 (오른쪽을 가리키는 이미지를 핑 방향으로 회전)
        arrow.setRotation(angle);
        
        // 화살표 객체를 Map에 저장 (실시간 업데이트를 위해)
        this.activePingArrows.set(pingId, {
            arrow: arrow,
            pingX: pingX,
            pingY: pingY,
            startTime: Date.now()
        });
        
        // 화살표 애니메이션 (3초 지속)
        this.tweens.add({
            targets: arrow,
            alpha: 0,
            duration: 3000,
            ease: 'Power2',
            onComplete: () => {
                // 화살표 제거 및 Map에서 삭제
                arrow.destroy();
                this.activePingArrows.delete(pingId);
                this.activePingPositions.delete(pingId);
            }
        });
        
        // 미니맵에 핑 표시 (화살표 또는 점)
        this.createMinimapPingArrow(pingX, pingY, pingId);
    }

    // 미니맵 핑 화살표 생성
    createMinimapPingArrow(pingX, pingY, pingId) {
        const scale = this.minimapScale;
        const offsetX = this.player.x - (this.minimapSize / 2) / scale;
        const offsetY = this.player.y - (this.minimapSize / 2) / scale;
        
        const minimapX = (pingX - offsetX) * scale;
        const minimapY = (pingY - offsetY) * scale;
        
        // 미니맵 경계 margin (화살표가 미니맵 끝에 붙어서 나오도록)
        const margin = 5;
        // 미니맵 내부(점) 판정 - margin 안쪽에 있는 핑만 점으로 표시
        const isInsideMinimap = minimapX >= margin && minimapX <= this.minimapSize - margin &&
                               minimapY >= margin && minimapY <= this.minimapSize - margin;
        // 미니맵 밖에 있는 핑 판정 (미니맵 전체 영역 밖)
        const isOutsideMinimap = minimapX < 0 || minimapX > this.minimapSize || 
                                 minimapY < 0 || minimapY > this.minimapSize;
        // 미니맵 경계에 있는 핑 판정 (margin 밖이지만 미니맵 안)
        const isOnMinimapBorder = !isInsideMinimap && !isOutsideMinimap;
        
        // 미니맵 내부가 아니면 모두 화살표로 표시 (경계 + 밖)
        // 또는 미니맵 밖에 있는 핑은 무조건 화살표로 표시
        if (!isInsideMinimap || isOutsideMinimap) {
            // 디버깅: 화살표 생성 조건 확인
            console.log('미니맵 화살표 생성:', {
                pingX, pingY,
                minimapX, minimapY,
                isInsideMinimap, isOutsideMinimap, isOnMinimapBorder,
                margin, minimapSize: this.minimapSize
            });
            // 미니맵 경계에 화살표 위치 고정 (경계 밖이어도 무조건 경계에 붙임)
            // 한국어 주석: clamp로 경계에 고정
            let arrowX = Math.max(margin, Math.min(this.minimapSize - margin, minimapX));
            let arrowY = Math.max(margin, Math.min(this.minimapSize - margin, minimapY));
            // 화살표 방향 계산 (경계에서 실제 핑 위치를 바라보게)
            const angle = Phaser.Math.Angle.Between(arrowX, arrowY, minimapX, minimapY);
            // 화살표 생성
            const minimapArrow = this.add.image(
                this.minimap.x + arrowX, 
                this.minimap.y + arrowY, 
                'ping_arrow'
            );
            minimapArrow.setScrollFactor(0);
            minimapArrow.setDepth(1003);
            // 핑의 절대 위치 저장 (플레이어 이동에 영향받지 않게)
            minimapArrow.pingWorldX = pingX;
            minimapArrow.pingWorldY = pingY;
            // 화살표 크기 (더 크게 설정)
            minimapArrow.setScale(0.02);
            // 화살표 방향
            minimapArrow.setRotation(angle);
            
            // 디버깅: 화살표 생성 확인
            console.log('미니맵 화살표 생성 완료:', {
                arrowX, arrowY,
                finalX: this.minimap.x + arrowX,
                finalY: this.minimap.y + arrowY,
                angle: angle * (180 / Math.PI), // 라디안을 도로 변환
                scale: minimapArrow.scale,
                visible: minimapArrow.visible,
                depth: minimapArrow.depth
            });
            
            // 디버깅: 화살표 생성 확인
            console.log('미니맵 화살표 생성 완료:', {
                arrowX, arrowY,
                finalX: this.minimap.x + arrowX,
                finalY: this.minimap.y + arrowY,
                angle: angle * (180 / Math.PI), // 라디안을 도로 변환
                scale: minimapArrow.scale,
                visible: minimapArrow.visible,
                depth: minimapArrow.depth
            });
            // 화살표 애니메이션 (4초)
            this.tweens.add({
                targets: minimapArrow,
                alpha: 0,
                duration: 3000,
                ease: 'Power2',
                onComplete: () => {
                    minimapArrow.destroy();
                }
            });
        } else {
            // 미니맵 내부면 점으로 표시
            const minimapDot = this.add.circle(
                this.minimap.x + minimapX,
                this.minimap.y + minimapY,
                2,
                0xff0000,
                1.0
            );
            minimapDot.setScrollFactor(0);
            minimapDot.setDepth(1003);
            // 핑의 절대 위치 저장
            minimapDot.pingWorldX = pingX;
            minimapDot.pingWorldY = pingY;
            // 점 애니메이션 (4초)
            this.tweens.add({
                targets: minimapDot,
                scaleX: 2,
                scaleY: 2,
                alpha: 0,
                duration: 3000,
                ease: 'Power2',
                onComplete: () => {
                    minimapDot.destroy();
                }
            });
        }
    }

    // 활성 핑 화살표들의 방향 실시간 업데이트
    updatePingArrows() {
        if (!this.player || this.activePingArrows.size === 0) {
            return;
        }

        const cam = this.cameras.main;
        const screenWidth = this.scale.width;
        const screenHeight = this.scale.height;
        const margin = 120;

        // 각 활성 핑 화살표 업데이트
        for (const [pingId, arrowData] of this.activePingArrows) {
            const { arrow, pingX, pingY } = arrowData;
            
            // 화면 좌표로 변환 (플레이어 현재 위치 기준)
            const screenX = pingX - cam.scrollX;
            const screenY = pingY - cam.scrollY;
            
            // 화면 밖에 있는지 확인
            const isOffScreen = screenX < margin || screenX > screenWidth - margin || 
                               screenY < margin || screenY > screenHeight - margin;
            
            // 시야 밖에 있는지 확인
            const isOutOfVision = !this.isInVision(pingX, pingY);
            
            // 화면 밖이거나 시야 밖이면 화살표 표시
            if (isOffScreen || isOutOfVision) {
                // 화살표를 화면 경계 내로 이동
                let arrowX = Math.max(margin, Math.min(screenWidth - margin, screenX));
                let arrowY = Math.max(margin, Math.min(screenHeight - margin, screenY));
                
                // 화살표 위치 업데이트
                arrow.setPosition(arrowX, arrowY);
                
                // 화살표 방향 재계산 (플레이어 현재 위치 기준)
                const angle = Phaser.Math.Angle.Between(arrowX, arrowY, screenX, screenY);
                arrow.setRotation(angle);
                
                // 화살표가 보이도록 설정
                arrow.setVisible(true);
            } else {
                // 화면 안에 있으면 화살표 숨김
                arrow.setVisible(false);
            }
        }
    }
    
    // 와드로 탐지된 적들의 미니맵 위치 업데이트
    updateWardDetectedEnemies() {
        if (!this.player) return;
        
        const scale = this.minimapScale;
        const offsetX = this.player.x - (this.minimapSize / 2) / scale;
        const offsetY = this.player.y - (this.minimapSize / 2) / scale;
        
        // 같은 팀 플레이어들의 와드 위치만 수집
        const allWards = [];
        
        // 1. 로컬 와드 (같은 팀이므로 항상 추가)
        if (this.activeWard) {
            allWards.push(this.activeWard);
        }
        
        // 2. 같은 팀 다른 플레이어들의 와드들만 추가
        this.children.list.forEach(child => {
            if (child.texture && child.texture.key === 'ward' && child.isOtherPlayerWard) {
                // 와드를 설치한 플레이어의 팀 확인
                const wardOwner = this.otherPlayers.getChildren().find(p => p.networkId === child.wardOwnerId);
                
                if (wardOwner && wardOwner.team === this.player.team) {
                    // 같은 팀의 와드만 추가
                    allWards.push({ x: child.x, y: child.y, radius: 120 });
                }
            }
        });
        
        // 모든 적들을 모든 와드로 체크
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.isDead) {
                let isDetectedByAnyWard = false;
                
                // 모든 와드에서 적 탐지
                allWards.forEach(ward => {
                    const distance = Phaser.Math.Distance.Between(ward.x, ward.y, enemy.x, enemy.y);
                    if (distance <= ward.radius) {
                        isDetectedByAnyWard = true;
                    }
                });
                
                // 와드에 탐지된 적 처리
                if (isDetectedByAnyWard) {
                    if (!enemy.wardDetected) {
                        enemy.wardDetected = true;
                        enemy.setTint(0xff0000);
                        enemy.setAlpha(0.8);
                        
                        // 미니맵에 표시
                        if (!enemy.minimapIndicator) {
                            this.showEnemyOnMinimapForWard(enemy);
                        }
                    }
                } else {
                    if (enemy.wardDetected) {
                        enemy.wardDetected = false;
                        enemy.clearTint();
                        enemy.setAlpha(1.0);
                        
                        // 미니맵에서 제거
                        if (enemy.minimapIndicator) {
                            this.hideEnemyFromMinimapForWard(enemy);
                        }
                    }
                }
            }
        });
        
        // 와드로 탐지된 적들의 미니맵 위치 업데이트
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.wardDetected && enemy.minimapIndicator) {
                const minimapX = (enemy.x - offsetX) * scale;
                const minimapY = (enemy.y - offsetY) * scale;
                
                // 미니맵 경계 내로 제한
                const clampedX = Math.max(0, Math.min(this.minimapSize, minimapX));
                const clampedY = Math.max(0, Math.min(this.minimapSize, minimapY));
                
                // 미니맵 표시 위치 업데이트
                enemy.minimapIndicator.setPosition(
                    this.minimap.x + clampedX, 
                    this.minimap.y + clampedY
                );
                
                // 미니맵 밖으로 나가면 숨김
                if (minimapX < 0 || minimapX > this.minimapSize || 
                    minimapY < 0 || minimapY > this.minimapSize) {
                    enemy.minimapIndicator.setVisible(false);
                } else {
                    enemy.minimapIndicator.setVisible(true);
                }
            }
        });
    }
    
    // 와드용 미니맵 적 표시 함수
    showEnemyOnMinimapForWard(enemy) {
        // 이미 미니맵에 표시되어 있으면 중복 생성 방지
        if (enemy.minimapIndicator) {
            return;
        }
        
        // 미니맵 위치 확인
        if (!this.minimap) {
            return;
        }
        
        // 미니맵에 빨간색 점으로 적 표시
        const scale = this.minimapScale;
        const offsetX = this.player.x - (this.minimapSize / 2) / scale;
        const offsetY = this.player.y - (this.minimapSize / 2) / scale;
        
        const minimapX = (enemy.x - offsetX) * scale;
        const minimapY = (enemy.y - offsetY) * scale;
        
        // 미니맵 경계 내로 제한
        const clampedX = Math.max(0, Math.min(this.minimapSize, minimapX));
        const clampedY = Math.max(0, Math.min(this.minimapSize, minimapY));
        
        const minimapEnemy = this.add.circle(
            this.minimap.x + clampedX,
            this.minimap.y + clampedY,
            3, // 적당한 크기
            0xff0000, 
            1.0
        );
        minimapEnemy.setScrollFactor(0);
        minimapEnemy.setDepth(1004); // 미니맵 위에 표시
        
        // 적 객체에 미니맵 표시 참조 저장
        enemy.minimapIndicator = minimapEnemy;
        
        // 깜빡이는 효과
        this.tweens.add({
            targets: minimapEnemy,
            alpha: 0.3,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }
    
    // 와드용 미니맵 적 표시 제거 함수
    hideEnemyFromMinimapForWard(enemy) {
        if (enemy.minimapIndicator) {
            enemy.minimapIndicator.destroy();
            enemy.minimapIndicator = null;
        }
    }
}