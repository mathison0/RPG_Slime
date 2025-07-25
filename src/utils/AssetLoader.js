export default class AssetLoader {
    static preload(scene) {
        // 직업별 플레이어 스프라이트 생성
        this.createJobSprites(scene);
        
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
    
    static createJobSprites(scene) {
        const jobSprites = ['slime', 'assassin', 'ninja', 'warrior', 'mage'];
        const directions = ['front', 'back', 'left', 'right'];
        
        // 이미지 파일이 있는 직업들 (slime, warrior)
        const imageJobs = ['slime', 'warrior'];
        
        jobSprites.forEach(job => {
            directions.forEach(direction => {
                const textureKey = `player_${job}_${direction}`;
                
                if (imageJobs.includes(job)) {
                    // 이미지 파일 로드
                    scene.load.image(textureKey, `assets/${job}_${direction}.png`);
                } else {
                    // 코드로 생성된 스프라이트 사용
                    this.createGeneratedSprite(scene, job, direction);
                }
            });
        });
        
        // 이미지 로딩이 완료되면 생성된 스프라이트를 대체
        scene.load.on('complete', () => {
            jobSprites.forEach(job => {
                if (!imageJobs.includes(job)) {
                    directions.forEach(direction => {
                        const textureKey = `player_${job}_${direction}`;
                        if (!scene.textures.exists(textureKey)) {
                            this.createGeneratedSprite(scene, job, direction);
                        }
                    });
                }
            });
        });
    }
    
    static createGeneratedSprite(scene, jobType, direction) {
        const textureKey = `player_${jobType}_${direction}`;
        
        switch (jobType) {
            case 'slime':
                this.createSlimeSprite(scene, textureKey, direction);
                break;
                
            case 'assassin':
                this.createAssassinSprite(scene, textureKey, direction);
                break;
                
            case 'ninja':
                this.createNinjaSprite(scene, textureKey, direction);
                break;
                
            case 'warrior':
                this.createWarriorSprite(scene, textureKey, direction);
                break;
                
            case 'mage':
                this.createMageSprite(scene, textureKey, direction);
                break;
        }
    }
    
    static createSlimeSprite(scene, textureKey, direction) {
        const graphics = scene.add.graphics();
        graphics.fillStyle(0x00ff00);
        
        switch (direction) {
            case 'front':
                // 앞을 보는 슬라임 (둥근 모양)
                graphics.fillCircle(32, 32, 32);
                break;
            case 'back':
                // 뒤를 보는 슬라임 (약간 작은 원)
                graphics.fillCircle(32, 32, 28);
                break;
            case 'left':
                // 왼쪽을 보는 슬라임 (타원형)
                graphics.fillEllipse(32, 32, 36, 28);
                break;
            case 'right':
                // 오른쪽을 보는 슬라임 (타원형)
                graphics.fillEllipse(32, 32, 36, 28);
                break;
        }
        
        graphics.generateTexture(textureKey, 64, 64);
    }
    
    static createAssassinSprite(scene, textureKey, direction) {
        const graphics = scene.add.graphics();
        
        switch (direction) {
            case 'front':
                // 앞을 보는 어쌔신 (검은색 타원 + 뾰족한 부분)
                graphics.fillStyle(0x000000);
                graphics.fillEllipse(32, 32, 28, 36);
                graphics.fillStyle(0x333333);
                graphics.fillEllipse(32, 24, 12, 8);
                break;
            case 'back':
                // 뒤를 보는 어쌔신 (작은 타원)
                graphics.fillStyle(0x000000);
                graphics.fillEllipse(32, 32, 24, 32);
                break;
            case 'left':
                // 왼쪽을 보는 어쌔신 (타원형 + 왼쪽 뾰족한 부분)
                graphics.fillStyle(0x000000);
                graphics.fillEllipse(32, 32, 32, 28);
                graphics.fillStyle(0x333333);
                graphics.fillEllipse(24, 32, 8, 12);
                break;
            case 'right':
                // 오른쪽을 보는 어쌔신 (타원형 + 오른쪽 뾰족한 부분)
                graphics.fillStyle(0x000000);
                graphics.fillEllipse(32, 32, 32, 28);
                graphics.fillStyle(0x333333);
                graphics.fillEllipse(40, 32, 8, 12);
                break;
        }
        
        graphics.generateTexture(textureKey, 64, 64);
    }
    
    static createNinjaSprite(scene, textureKey, direction) {
        const graphics = scene.add.graphics();
        
        switch (direction) {
            case 'front':
                // 앞을 보는 닌자 (보라색 타원 + 표창 모양)
                graphics.fillStyle(0x800080);
                graphics.fillEllipse(32, 32, 28, 36);
                graphics.fillStyle(0x600060);
                graphics.fillEllipse(32, 24, 8, 12);
                break;
            case 'back':
                // 뒤를 보는 닌자 (작은 타원)
                graphics.fillStyle(0x800080);
                graphics.fillEllipse(32, 32, 24, 32);
                break;
            case 'left':
                // 왼쪽을 보는 닌자 (타원형 + 왼쪽 표창)
                graphics.fillStyle(0x800080);
                graphics.fillEllipse(32, 32, 32, 28);
                graphics.fillStyle(0x600060);
                graphics.fillEllipse(24, 32, 6, 10);
                break;
            case 'right':
                // 오른쪽을 보는 닌자 (타원형 + 오른쪽 표창)
                graphics.fillStyle(0x800080);
                graphics.fillEllipse(32, 32, 32, 28);
                graphics.fillStyle(0x600060);
                graphics.fillEllipse(40, 32, 6, 10);
                break;
        }
        
        graphics.generateTexture(textureKey, 64, 64);
    }
    
    static createWarriorSprite(scene, textureKey, direction) {
        const graphics = scene.add.graphics();
        
        switch (direction) {
            case 'front':
                // 앞을 보는 전사 (빨간색 둥근 사각형 + 각진 부분)
                graphics.fillStyle(0xff0000);
                graphics.fillRoundedRect(16, 16, 32, 32, 8);
                graphics.fillStyle(0xcc0000);
                graphics.fillRect(24, 12, 16, 8);
                break;
            case 'back':
                // 뒤를 보는 전사 (작은 둥근 사각형)
                graphics.fillStyle(0xff0000);
                graphics.fillRoundedRect(20, 20, 24, 24, 6);
                break;
            case 'left':
                // 왼쪽을 보는 전사 (타원형 + 왼쪽 각진 부분)
                graphics.fillStyle(0xff0000);
                graphics.fillRoundedRect(16, 16, 32, 32, 8);
                graphics.fillStyle(0xcc0000);
                graphics.fillRect(12, 24, 8, 16);
                break;
            case 'right':
                // 오른쪽을 보는 전사 (타원형 + 오른쪽 각진 부분)
                graphics.fillStyle(0xff0000);
                graphics.fillRoundedRect(16, 16, 32, 32, 8);
                graphics.fillStyle(0xcc0000);
                graphics.fillRect(44, 24, 8, 16);
                break;
        }
        
        graphics.generateTexture(textureKey, 64, 64);
    }
    
    static createMageSprite(scene, textureKey, direction) {
        const graphics = scene.add.graphics();
        
        switch (direction) {
            case 'front':
                // 앞을 보는 마법사 (파란색 원 + 흰색 원 + 파란색 중심)
                graphics.fillStyle(0x0000ff);
                graphics.fillCircle(32, 32, 32);
                graphics.fillStyle(0xffffff);
                graphics.fillCircle(32, 32, 16);
                graphics.fillStyle(0x0000ff);
                graphics.fillCircle(32, 32, 8);
                break;
            case 'back':
                // 뒤를 보는 마법사 (작은 원들)
                graphics.fillStyle(0x0000ff);
                graphics.fillCircle(32, 32, 28);
                graphics.fillStyle(0xffffff);
                graphics.fillCircle(32, 32, 12);
                graphics.fillStyle(0x0000ff);
                graphics.fillCircle(32, 32, 6);
                break;
            case 'left':
                // 왼쪽을 보는 마법사 (타원형 + 왼쪽 마법 효과)
                graphics.fillStyle(0x0000ff);
                graphics.fillEllipse(32, 32, 32, 28);
                graphics.fillStyle(0xffffff);
                graphics.fillEllipse(32, 32, 16, 12);
                graphics.fillStyle(0x00ffff);
                graphics.fillEllipse(24, 32, 6, 6);
                break;
            case 'right':
                // 오른쪽을 보는 마법사 (타원형 + 오른쪽 마법 효과)
                graphics.fillStyle(0x0000ff);
                graphics.fillEllipse(32, 32, 32, 28);
                graphics.fillStyle(0xffffff);
                graphics.fillEllipse(32, 32, 16, 12);
                graphics.fillStyle(0x00ffff);
                graphics.fillEllipse(40, 32, 6, 6);
                break;
        }
        
        graphics.generateTexture(textureKey, 64, 64);
    }
    
    static createAnimations(scene) {
        // 직업별 플레이어 애니메이션
        const jobs = ['slime', 'thief', 'warrior', 'mage'];
        
        jobs.forEach(job => {
            const textureKey = `player_${job}`;
            
            // 기본 애니메이션
            scene.anims.create({
                key: `${job}_idle`,
                frames: scene.anims.generateFrameNumbers(textureKey, { start: 0, end: 0 }),
                frameRate: 10,
                repeat: -1
            });
            
            scene.anims.create({
                key: `${job}_walk`,
                frames: scene.anims.generateFrameNumbers(textureKey, { start: 0, end: 0 }),
                frameRate: 10,
                repeat: -1
            });
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
    
    // 직업과 방향에 따른 스프라이트 키 반환
    static getPlayerSpriteKey(jobType, direction = 'front') {
        return `player_${jobType}_${direction}`;
    }
} 