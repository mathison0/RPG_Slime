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
        
        // 플레이어 생성
        this.player = new Player(this, 100, 100);
        
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
        
        // 시야 제한 (미로 효과)
        this.createFogOfWar();
        
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
        // 간단한 미로 생성 (실제로는 더 복잡하게 구현)
        this.walls = this.physics.add.staticGroup();
        
        // 외벽
        for (let x = 0; x < 2000; x += 50) {
            this.walls.create(x, 0, 'wall');
            this.walls.create(x, 1950, 'wall');
        }
        for (let y = 0; y < 2000; y += 50) {
            this.walls.create(0, y, 'wall');
            this.walls.create(1950, y, 'wall');
        }
        
        // 내부 벽들 (미로 패턴)
        const wallPositions = [
            // 수평 벽들
            { x: 200, y: 200, width: 300, height: 20 },
            { x: 600, y: 400, width: 200, height: 20 },
            { x: 100, y: 600, width: 400, height: 20 },
            { x: 700, y: 800, width: 300, height: 20 },
            { x: 200, y: 1000, width: 250, height: 20 },
            { x: 600, y: 1200, width: 350, height: 20 },
            
            // 수직 벽들
            { x: 300, y: 100, width: 20, height: 200 },
            { x: 700, y: 300, width: 20, height: 250 },
            { x: 400, y: 500, width: 20, height: 200 },
            { x: 800, y: 700, width: 20, height: 200 },
            { x: 500, y: 900, width: 20, height: 200 },
            { x: 900, y: 1100, width: 20, height: 200 }
        ];
        
        wallPositions.forEach(wall => {
            const wallSprite = this.add.rectangle(wall.x, wall.y, wall.width, wall.height, 0x8b4513);
            this.walls.add(wallSprite);
        });
    }
    
    createFogOfWar() {
        // 시야 제한을 위한 어두운 오버레이
        this.fogOfWar = this.add.graphics();
        this.fogOfWar.setScrollFactor(0);
        this.fogOfWar.fillStyle(0x000000, 0.8);
        this.fogOfWar.fillRect(0, 0, this.scale.width, this.scale.height);
        
        // 플레이어 주변 시야 영역
        this.visionCircle = this.add.graphics();
        this.visionCircle.setScrollFactor(0);
    }
    
    updateFogOfWar() {
        if (!this.player) return;
        
        // 전체 화면을 어둡게
        this.fogOfWar.clear();
        this.fogOfWar.fillStyle(0x000000, 0.8);
        this.fogOfWar.fillRect(0, 0, this.scale.width, this.scale.height);
        
        // 플레이어 주변 시야 영역을 밝게
        const playerScreenX = this.player.x - this.cameras.main.scrollX;
        const playerScreenY = this.player.y - this.cameras.main.scrollY;
        
        this.visionCircle.clear();
        this.visionCircle.fillStyle(0x000000, 0);
        this.visionCircle.fillCircle(playerScreenX, playerScreenY, this.player.visionRange);
        
        // 시야 영역을 잘라내기
        this.fogOfWar.setMask(this.visionCircle.createGeometryMask());
    }
    
    spawnEnemies() {
        const enemyTypes = ['basic', 'fast', 'tank', 'ranged'];
        const spawnCount = 10;
        
        for (let i = 0; i < spawnCount; i++) {
            const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            const x = Phaser.Math.Between(100, 1900);
            const y = Phaser.Math.Between(100, 1900);
            
            const enemy = new Enemy(this, x, y, type);
            this.enemies.add(enemy);
        }
    }
    
    spawnEnemy() {
        if (this.enemies.getChildren().length < 15) {
            const enemyTypes = ['basic', 'fast', 'tank', 'ranged'];
            const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            
            // 플레이어로부터 일정 거리 떨어진 곳에 스폰
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = Phaser.Math.Between(300, 500);
            const x = this.player.x + Math.cos(angle) * distance;
            const y = this.player.y + Math.sin(angle) * distance;
            
            const enemy = new Enemy(this, x, y, type);
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
        // 게임 내 UI 요소들
        this.add.text(16, 16, 'RPG Slime', {
            fontSize: '32px',
            fill: '#fff',
            fontFamily: 'Arial'
        }).setScrollFactor(0);
        
        // 미니맵 (간단한 버전)
        this.minimap = this.add.graphics();
        this.minimap.setScrollFactor(0);
        this.minimap.setPosition(this.scale.width - 150, 10);
    }
    
    updateMinimap() {
        this.minimap.clear();
        
        // 미니맵 배경
        this.minimap.fillStyle(0x000000, 0.5);
        this.minimap.fillRect(0, 0, 140, 140);
        
        // 플레이어 위치
        this.minimap.fillStyle(0x00ff00);
        this.minimap.fillCircle(70, 70, 3);
        
        // 적들 위치
        this.minimap.fillStyle(0xff0000);
        this.enemies.getChildren().forEach(enemy => {
            const x = (enemy.x / 2000) * 140;
            const y = (enemy.y / 2000) * 140;
            this.minimap.fillCircle(x, y, 2);
        });
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
        
        // 시야 업데이트
        this.updateFogOfWar();
        
        // 미니맵 업데이트
        this.updateMinimap();
    }
} 