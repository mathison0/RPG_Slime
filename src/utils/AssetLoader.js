export default class AssetLoader {
    static preload(scene) {
        // 플레이어 스프라이트 (원형으로 생성)
        scene.add.graphics()
            .fillStyle(0x00ff00)
            .fillCircle(16, 16, 16)
            .generateTexture('player', 32, 32);
        
        // 적 스프라이트 (원형으로 생성)
        scene.add.graphics()
            .fillStyle(0xff0000)
            .fillCircle(16, 16, 16)
            .generateTexture('enemy', 32, 32);
        
        // 벽 스프라이트 (사각형으로 생성)
        scene.add.graphics()
            .fillStyle(0x8b4513)
            .fillRect(0, 0, 50, 50)
            .generateTexture('wall', 50, 50);
        
        // 아이템 스프라이트들
        scene.add.graphics()
            .fillStyle(0xffff00)
            .fillCircle(8, 8, 8)
            .generateTexture('exp_orb', 16, 16);
        
        scene.add.graphics()
            .fillStyle(0x00ffff)
            .fillCircle(8, 8, 8)
            .generateTexture('health_potion', 16, 16);
        
        // 투사체 스프라이트
        scene.add.graphics()
            .fillStyle(0xff6600)
            .fillCircle(4, 4, 4)
            .generateTexture('projectile', 8, 8);
        
        // 파티클 효과들
        scene.add.graphics()
            .fillStyle(0xffffff)
            .fillCircle(2, 2, 2)
            .generateTexture('particle', 4, 4);
        
        // UI 요소들
        scene.add.graphics()
            .fillStyle(0x000000, 0.7)
            .fillRect(0, 0, 200, 50)
            .generateTexture('ui_panel', 200, 50);
        
        scene.add.graphics()
            .fillStyle(0x00ff00)
            .fillRect(0, 0, 100, 10)
            .generateTexture('health_bar', 100, 10);
        
        scene.add.graphics()
            .fillStyle(0x0000ff)
            .fillRect(0, 0, 100, 10)
            .generateTexture('exp_bar', 100, 10);
    }
    
    static createAnimations(scene) {
        // 플레이어 애니메이션
        scene.anims.create({
            key: 'player_idle',
            frames: scene.anims.generateFrameNumbers('player', { start: 0, end: 0 }),
            frameRate: 10,
            repeat: -1
        });
        
        scene.anims.create({
            key: 'player_walk',
            frames: scene.anims.generateFrameNumbers('player', { start: 0, end: 0 }),
            frameRate: 10,
            repeat: -1
        });
        
        // 적 애니메이션
        scene.anims.create({
            key: 'enemy_idle',
            frames: scene.anims.generateFrameNumbers('enemy', { start: 0, end: 0 }),
            frameRate: 8,
            repeat: -1
        });
        
        scene.anims.create({
            key: 'enemy_walk',
            frames: scene.anims.generateFrameNumbers('enemy', { start: 0, end: 0 }),
            frameRate: 8,
            repeat: -1
        });
        
        // 파티클 애니메이션
        scene.anims.create({
            key: 'explosion',
            frames: scene.anims.generateFrameNumbers('particle', { start: 0, end: 0 }),
            frameRate: 20,
            repeat: 0
        });
    }
} 