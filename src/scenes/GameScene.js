import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import AssetLoader from '../utils/AssetLoader.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        AssetLoader.preload(this);
    }
    
    create() {
        AssetLoader.createAnimations(this);
        
        // 맵 생성
        this.createMaze();
        
        // 플레이어 생성 (팀 및 랜덤 스폰)
        // TODO: 팀 선택 UI가 생기면 'red' 대신 선택 값 사용
        const playerTeam = 'red';
        const spawnPoint = this.getRandomPointInRect(playerTeam === 'red' ? this.redSpawnRect : this.blueSpawnRect);
        this.player = new Player(this, spawnPoint.x, spawnPoint.y, playerTeam);
        
        // 적 그룹 생성
        this.enemies = this.physics.add.group();
        
        // 적 생성
        this.spawnEnemies();
        
        // 충돌 설정
        this.physics.add.collider(this.player, this.walls);
        this.physics.add.collider(this.enemies, this.walls);
        this.physics.add.collider(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
        
        // 카메라 설정
        this.cameras.main.startFollow(this.player);
        this.cameras.main.setZoom(1);
        



        // UI 설정
        this.setupUI();
        
        // 적 스폰 타이머
        this.enemySpawnTimer = this.time.addEvent({
            delay: 5000,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });
    }
    
    createMaze() {
        const MAP_WIDTH = 3000;
        const MAP_HEIGHT = 3000;
        const TILE_SIZE = 50;
        const SPAWN_WIDTH = 300; // 각 팀 부활 구역의 폭
        const PLAZA_SIZE = 1000;  // 중앙 광장의 한 변 길이
        const PLAZA_X = (MAP_WIDTH - PLAZA_SIZE) / 2;
        const PLAZA_Y = (MAP_HEIGHT - PLAZA_SIZE) / 2;

        // Scene-wide 접근을 위해 저장
        this.MAP_WIDTH = MAP_WIDTH;
        this.MAP_HEIGHT = MAP_HEIGHT;
        this.TILE_SIZE = TILE_SIZE;
        this.SPAWN_WIDTH = SPAWN_WIDTH;
        this.PLAZA_SIZE = PLAZA_SIZE;
        this.PLAZA_X = PLAZA_X;
        this.PLAZA_Y = PLAZA_Y;

        // 월드 바운드 설정
        this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

        // 벽 그룹
        this.walls = this.physics.add.staticGroup();

        // 1) 외벽 생성
        for (let x = 0; x < MAP_WIDTH; x += TILE_SIZE) {
            this.walls.create(x, 0, 'wall');
            this.walls.create(x, MAP_HEIGHT - TILE_SIZE, 'wall');
        }
        for (let y = 0; y < MAP_HEIGHT; y += TILE_SIZE) {
            this.walls.create(0, y, 'wall');
            this.walls.create(MAP_WIDTH - TILE_SIZE, y, 'wall');
        }

        // 2) 스폰 구역(무적 영역) 시각화
        // 레드 팀 (왼쪽)
        this.add.rectangle(SPAWN_WIDTH / 2, MAP_HEIGHT / 2, SPAWN_WIDTH, MAP_HEIGHT, 0xff0000, 0.25).setDepth(-1);
        // 블루 팀 (오른쪽)
        this.add.rectangle(MAP_WIDTH - SPAWN_WIDTH / 2, MAP_HEIGHT / 2, SPAWN_WIDTH, MAP_HEIGHT, 0x0000ff, 0.25).setDepth(-1);

        // 3) 중앙 광장 시각화
        this.add.rectangle(PLAZA_X + PLAZA_SIZE / 2, PLAZA_Y + PLAZA_SIZE / 2, PLAZA_SIZE, PLAZA_SIZE, 0xffff00, 0.15).setDepth(-1);

        // 3-1) 광장 테두리 벽 + 10개 출입구
        const borderPositions = [];
        // 상단, 하단
        for (let x = PLAZA_X; x < PLAZA_X + PLAZA_SIZE; x += TILE_SIZE) {
            borderPositions.push({ x: x + TILE_SIZE / 2, y: PLAZA_Y - TILE_SIZE / 2 });
            borderPositions.push({ x: x + TILE_SIZE / 2, y: PLAZA_Y + PLAZA_SIZE + TILE_SIZE / 2 });
        }
        // 좌, 우
        for (let y = PLAZA_Y; y < PLAZA_Y + PLAZA_SIZE; y += TILE_SIZE) {
            borderPositions.push({ x: PLAZA_X - TILE_SIZE / 2, y: y + TILE_SIZE / 2 });
            borderPositions.push({ x: PLAZA_X + PLAZA_SIZE + TILE_SIZE / 2, y: y + TILE_SIZE / 2 });
        }

        // 무작위 10개 출입구 선정
        Phaser.Utils.Array.Shuffle(borderPositions);
        const openings = new Set(borderPositions.slice(0, 10).map(p => `${p.x}_${p.y}`));

        // 테두리 벽 생성 (출입구 제외)
        borderPositions.forEach(p => {
            const key = `${p.x}_${p.y}`;
            if (!openings.has(key)) {
                const wallSprite = this.add.rectangle(p.x, p.y, TILE_SIZE, TILE_SIZE, 0x8b4513);
                this.walls.add(wallSprite);
            }
        });

        // 내부 미로에서 테두리 타일을 건너뛰기 위한 Set
        const borderSet = new Set(borderPositions.map(p => `${p.x}_${p.y}`));

        // 4) 미로 영역 생성 (스폰 구역과 광장을 제외한 중간 영역)
        for (let x = SPAWN_WIDTH; x < MAP_WIDTH - SPAWN_WIDTH; x += TILE_SIZE) {
            for (let y = 0; y < MAP_HEIGHT; y += TILE_SIZE) {
                // 중앙 광장 영역은 비워둔다
                const inPlaza = x >= PLAZA_X && x < PLAZA_X + PLAZA_SIZE && y >= PLAZA_Y && y < PLAZA_Y + PLAZA_SIZE;
                if (inPlaza) continue;

                // 광장 테두리(벽/출입구) 위치는 건너뜀
                const key = `${x + TILE_SIZE / 2}_${y + TILE_SIZE / 2}`;
                if (borderSet.has(key)) continue;

                // 출입구가 많은 느낌을 주기 위해 경계 근처 확률 조정
                let wallProbability = 0.3; // 기본 벽 생성 확률

                const nearRedGate = x < SPAWN_WIDTH + TILE_SIZE * 2;
                const nearBlueGate = x > MAP_WIDTH - SPAWN_WIDTH - TILE_SIZE * 3;
                const nearPlazaHoriz = x >= PLAZA_X - TILE_SIZE * 2 && x <= PLAZA_X + PLAZA_SIZE + TILE_SIZE * 2;
                const nearPlazaVert = y >= PLAZA_Y - TILE_SIZE * 2 && y <= PLAZA_Y + PLAZA_SIZE + TILE_SIZE * 2;

                if (nearRedGate || nearBlueGate || (nearPlazaHoriz && nearPlazaVert)) {
                    wallProbability = 0.1; // 경계와 출입구 근처는 벽이 덜 생김
                }

                if (Math.random() < wallProbability) {
                    const wallSprite = this.add.rectangle(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 0x8b4513);
                    this.walls.add(wallSprite);
                }
            }
        }

        // 5) 스폰 구역 정보 저장 (다른 곳에서 충돌/팀별 판정에 사용 가능)
        this.redSpawnRect = new Phaser.Geom.Rectangle(0, 0, SPAWN_WIDTH, MAP_HEIGHT);
        this.blueSpawnRect = new Phaser.Geom.Rectangle(MAP_WIDTH - SPAWN_WIDTH, 0, SPAWN_WIDTH, MAP_HEIGHT);
    }
    
    spawnEnemies() {
        const enemyTypes = ['basic', 'fast', 'tank', 'ranged'];
        const spawnCount = 10;
        
        for (let i = 0; i < spawnCount; i++) {
            const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            let point;
            // 스폰구역을 피한 위치 선정
            do {
                point = {
                    x: Phaser.Math.Between(this.SPAWN_WIDTH + 50, this.MAP_WIDTH - this.SPAWN_WIDTH - 50),
                    y: Phaser.Math.Between(50, this.MAP_HEIGHT - 50)
                };
            } while (this.redSpawnRect.contains(point.x, point.y) || this.blueSpawnRect.contains(point.x, point.y));

            const enemy = new Enemy(this, point.x, point.y, type);
            this.enemies.add(enemy);
        }
    }
    
    spawnEnemy() {
        if (this.enemies.getChildren().length < 15) {
            const enemyTypes = ['basic', 'fast', 'tank', 'ranged'];
            const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

            let point;
            // 스폰구역을 피한 위치 선정 (플레이어 주변)
            let attempts = 0;
            do {
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const distance = Phaser.Math.Between(300, 500);
                point = {
                    x: this.player.x + Math.cos(angle) * distance,
                    y: this.player.y + Math.sin(angle) * distance
                };
                attempts++;
            } while ((this.redSpawnRect.contains(point.x, point.y) || this.blueSpawnRect.contains(point.x, point.y)) && attempts < 10);

            const enemy = new Enemy(this, point.x, point.y, type);
            this.enemies.add(enemy);
        }
    }
    
    handlePlayerEnemyCollision(player, enemy) {
        // 플레이어가 적을 공격
        if (player.body.velocity.length() > 50) {
            enemy.takeDamage(player.getAttackDamage());
            
            // 넉백 효과
            const angle = Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
            const knockbackForce = 200;
            enemy.setVelocity(
                Math.cos(angle) * knockbackForce,
                Math.sin(angle) * knockbackForce
            );
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

    /**
     * 미니맵, 빅맵 및 시야 관리용 데이터 초기화
     */
    initMinimap() {
        // ---------- 공통 설정 ----------
        this.minimapSize = 100; // px
        this.bigMapSize = 800; // px (화면 중앙에 표시)

        this.minimapScale = this.minimapSize / this.MAP_WIDTH;
        this.bigMapScale = this.bigMapSize / this.MAP_WIDTH;

        this.mapCols = Math.ceil(this.MAP_WIDTH / this.TILE_SIZE);
        this.mapRows = Math.ceil(this.MAP_HEIGHT / this.TILE_SIZE);

        // 방문(밝혀진) 여부 배열
        this.discovered = Array.from({ length: this.mapRows }, () => Array(this.mapCols).fill(false));

        // 스폰 구역은 기본적으로 시야 제공
        const spawnCols = Math.ceil(this.SPAWN_WIDTH / this.TILE_SIZE);
        for (let y = 0; y < this.mapRows; y++) {
            for (let x = 0; x < spawnCols + 2; x++) this.discovered[y][x] = true; // 레드팀
            for (let x = this.mapCols - spawnCols - 2; x < this.mapCols; x++) this.discovered[y][x] = true; // 블루팀
        }

        // 미니맵 그래픽스 (화면 우측 상단)
        this.minimap = this.add.graphics();
        this.minimap.setScrollFactor(0);
        this.minimap.setDepth(1000);
        
        // 최초 위치 설정 (오른쪽 위)
        this.positionMinimap();

        // 빅맵 그래픽스 (숨김; 토글용)
        this.bigMap = this.add.graphics();
        this.bigMap.setScrollFactor(0);
        this.bigMap.setDepth(1001);
        this.bigMap.setVisible(false);
        this.bigMap.setPosition((this.scale.width - this.bigMapSize) / 2, (this.scale.height - this.bigMapSize) / 2);

        // 입력키(M) 등록
        this.mapToggleKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.bigMapVisible = false;
    }

    /**
     * 현재 화면 크기에 맞추어 미니맵을 화면 오른쪽 위 10px 여백으로 재배치한다.
     * 카메라 스크롤과 무관하게 고정되도록 scrollFactor(0)를 사용하는 오버레이 방식이다.
     */
    positionMinimap() {
        if (!this.minimap) return;
        const cam = this.cameras.main;
        // setScrollFactor(0)이 적용된 UI 요소는 카메라 뷰포트를 기준으로 위치가 결정됩니다.
        // 따라서 cam.worldView.x/y를 더하지 않고, 카메라의 너비(cam.width)를 기준으로 위치를 잡아야 합니다.
        this.minimap.setPosition(
            cam.width - this.minimapSize - 10,
            10
        );
    }

    /** 플레이어 시야에 들어온 타일을 discovered 처리 */
    updateVision() {
        if (!this.player) return;
        const radius = this.player.visionRange;
        const startCol = Math.max(0, Math.floor((this.player.x - radius) / this.TILE_SIZE));
        const endCol = Math.min(this.mapCols - 1, Math.floor((this.player.x + radius) / this.TILE_SIZE));
        const startRow = Math.max(0, Math.floor((this.player.y - radius) / this.TILE_SIZE));
        const endRow = Math.min(this.mapRows - 1, Math.floor((this.player.y + radius) / this.TILE_SIZE));

        const radiusSq = radius * radius;
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const cellCenterX = col * this.TILE_SIZE + this.TILE_SIZE / 2;
                const cellCenterY = row * this.TILE_SIZE + this.TILE_SIZE / 2;
                const dx = cellCenterX - this.player.x;
                const dy = cellCenterY - this.player.y;
                if (dx * dx + dy * dy <= radiusSq) {
                    this.discovered[row][col] = true;
                }
            }
        }
    }

    /** 미니맵(플레이어를 중심) 그리기 */
    updateMinimap() {
        if (!this.player) return;
        // 매 프레임 현재 뷰포트 기준으로 위치 재조정 (윈도우 리사이즈 등에 대응)
        this.positionMinimap();
        const size = this.minimapSize;
        const scale = this.minimapScale;

        // 플레이어 기준 offset (플레이어를 중앙에 두기 위해)
        const offsetX = this.player.x - (size / 2) / scale;
        const offsetY = this.player.y - (size / 2) / scale;

        this.minimap.clear();
        // 배경(어두운 영역)
        this.minimap.fillStyle(0x000000, 0.8);
        this.minimap.fillRect(0, 0, size, size);

        // 벽들 (밝혀진 셀만)
        this.minimap.fillStyle(0x8b4513);
        this.walls.getChildren().forEach(wall => {
            const col = Math.floor(wall.x / this.TILE_SIZE);
            const row = Math.floor(wall.y / this.TILE_SIZE);
            if (!this.discovered[row] || !this.discovered[row][col]) return; // 미발견

            const screenX = (wall.x - offsetX) * scale;
            const screenY = (wall.y - offsetY) * scale;
            if (screenX < -this.TILE_SIZE * scale || screenX > size || screenY < -this.TILE_SIZE * scale || screenY > size) return;
            this.minimap.fillRect(screenX, screenY, this.TILE_SIZE * scale, this.TILE_SIZE * scale);
        });

        // 플레이어 표시 (항상 중앙)
        this.minimap.fillStyle(0x00ff00);
        this.minimap.fillCircle(size / 2, size / 2, 4);
    }

    /** 빅맵(전체 맵) 다시 그리기 */
    drawBigMap() {
        const size = this.bigMapSize;
        const scale = this.bigMapScale;
        this.bigMap.clear();
        // 전체 배경
        this.bigMap.fillStyle(0x000000, 0.9);
        this.bigMap.fillRect(0, 0, size, size);

        // 벽들 - 발견된 영역만 표시
        this.bigMap.fillStyle(0x444444);
        this.walls.getChildren().forEach(wall => {
            const col = Math.floor(wall.x / this.TILE_SIZE);
            const row = Math.floor(wall.y / this.TILE_SIZE);
            if (!this.discovered[row] || !this.discovered[row][col]) return;
            const x = wall.x * scale;
            const y = wall.y * scale;
            this.bigMap.fillRect(x, y, this.TILE_SIZE * scale, this.TILE_SIZE * scale);
        });

        // 플레이어 위치
        this.bigMap.fillStyle(0x00ff00);
        this.bigMap.fillCircle(this.player.x * scale, this.player.y * scale, 5);
    }
    
    update(time, delta) {
        // 플레이어 업데이트
        if (this.player) {
            this.player.update(time, delta);
        }
        
        // 적들 업데이트
        this.enemies.getChildren().forEach(enemy => {
            enemy.update(time, delta);
        });
        

        // 미니맵 및 시야 업데이트
        this.updateVision();

        this.updateMinimap();

        // M 키 토글로 빅맵 표시/숨김
        if (Phaser.Input.Keyboard.JustDown(this.mapToggleKey)) {
            this.bigMapVisible = !this.bigMapVisible;
            this.bigMap.setVisible(this.bigMapVisible);
            if (this.bigMapVisible) this.drawBigMap();
        }

        // 스폰구역 진입 제한
        this.restrictMovement();
    }

    /** 주어진 Phaser.Geom.Rectangle 내부의 임의 좌표 반환 */
    getRandomPointInRect(rect) {
        return {
            x: Phaser.Math.Between(rect.x + this.TILE_SIZE, rect.right - this.TILE_SIZE),
            y: Phaser.Math.Between(rect.y + this.TILE_SIZE, rect.bottom - this.TILE_SIZE)
        };
    }

    /** 팀 스폰구역 및 적 진입 제한 처리 */
    restrictMovement() {
        // 플레이어 제한
        if (this.player) {
            // 레드팀 플레이어가 블루팀 스폰(오른쪽)에 들어갔을 경우
            if (this.player.team === 'red' && this.blueSpawnRect.contains(this.player.x, this.player.y)) {
                // 블루팀 스폰 구역의 왼쪽 경계로 밀어냄
                this.player.x = this.blueSpawnRect.x;
            } 
            // 블루팀 플레이어가 레드팀 스폰(왼쪽)에 들어갔을 경우
            else if (this.player.team === 'blue' && this.redSpawnRect.contains(this.player.x, this.player.y)) {
                // 레드팀 스폰 구역의 오른쪽 경계로 밀어냄
                this.player.x = this.redSpawnRect.right;
            }
        }

        // 적 제한
        this.enemies.getChildren().forEach(enemy => {
            // 레드팀 스폰 구역(왼쪽)에 들어갔을 경우
            if (this.redSpawnRect.contains(enemy.x, enemy.y)) {
                // 스폰 구역의 오른쪽 바깥으로 밀어냄
                enemy.x = this.redSpawnRect.right + this.TILE_SIZE;
            } 
            // 블루팀 스폰 구역(오른쪽)에 들어갔을 경우
            else if (this.blueSpawnRect.contains(enemy.x, enemy.y)) {
                // 스폰 구역의 왼쪽 바깥으로 밀어냄
                enemy.x = this.blueSpawnRect.x - this.TILE_SIZE;
            }
        });
    }
}