import { AssetConfig, getPlayerSpriteKey, isJobSupported, getSpriteSize, getUISize, updateServerConfig, getDynamicWallSize, getDynamicPlayerSize } from '../../shared/AssetConfig.js';

export default class AssetLoader {
    static preload(scene) {
        console.log('AssetLoader.preload() 시작');
        
        // 직업별 플레이어 이미지 로드
        this.loadJobImages(scene);
        
        console.log('loadJobImages() 완료');
        
        // 기본 스프라이트들 생성
        this.createBasicSprites(scene);
        
        // 추가 에셋들 로드
        this.loadAdditionalAssets(scene);
        
        console.log('모든 에셋 로딩 완료');
    }
    
    static loadJobImages(scene) {
        // 지원되는 직업들의 이미지만 로드
        AssetConfig.SUPPORTED_JOBS.forEach(job => {
            AssetConfig.DIRECTIONS.forEach(direction => {
                const textureKey = getPlayerSpriteKey(job, direction);
                const imagePath = `assets/${job}_${direction}.png`;
                console.log(`이미지 로드: ${textureKey} <- ${imagePath}`);
                scene.load.image(textureKey, imagePath);
            });
        });
        
        // 이미지 로딩 완료 시 크기 정보 저장
        scene.load.on('complete', () => {
            console.log('이미지 로딩 완료!');
            this.storeImageSizes(scene);
        });
        
        // 로딩 에러 처리
        scene.load.on('loaderror', (file) => {
            console.error(`파일 로딩 실패: ${file.src}`);
        });
        
        // 개별 파일 로딩 완료
        scene.load.on('filecomplete', (key, type, data) => {
            console.log(`파일 로딩 완료: ${key} (${type})`);
        });
    }
    
    static createBasicSprites(scene) {
        const enemySize = getSpriteSize('ENEMY');
        const wallSize = this.getDynamicWallSize();
        const expOrbSize = getSpriteSize('ITEM').EXP_ORB;
        const healthPotionSize = getSpriteSize('ITEM').HEALTH_POTION;
        const projectileSize = getSpriteSize('PROJECTILE');
        const particleSize = getSpriteSize('PARTICLE');
        const panelSize = getUISize('PANEL');
        const healthBarSize = getUISize('HEALTH_BAR');
        const expBarSize = getUISize('EXP_BAR');
        
        // 적 스프라이트 (원형으로 생성)
        scene.add.graphics()
            .fillStyle(AssetConfig.COLORS.ENEMY)
            .fillCircle(enemySize.RADIUS, enemySize.RADIUS, enemySize.RADIUS)
            .generateTexture('enemy', enemySize.WIDTH, enemySize.HEIGHT);
        
        // 벽 스프라이트 (사각형으로 생성)
        scene.add.graphics()
            .fillStyle(AssetConfig.COLORS.WALL)
            .fillRect(0, 0, wallSize.WIDTH, wallSize.HEIGHT)
            .generateTexture('wall', wallSize.WIDTH, wallSize.HEIGHT);
        
        // 경험치 구슬 스프라이트
        scene.add.graphics()
            .fillStyle(AssetConfig.COLORS.EXP_ORB)
            .fillCircle(expOrbSize.RADIUS, expOrbSize.RADIUS, expOrbSize.RADIUS)
            .generateTexture('exp_orb', expOrbSize.WIDTH, expOrbSize.HEIGHT);
        
        // 체력 포션 스프라이트
        scene.add.graphics()
            .fillStyle(AssetConfig.COLORS.HEALTH_POTION)
            .fillCircle(healthPotionSize.RADIUS, healthPotionSize.RADIUS, healthPotionSize.RADIUS)
            .generateTexture('health_potion', healthPotionSize.WIDTH, healthPotionSize.HEIGHT);
        
        // 투사체 스프라이트
        scene.add.graphics()
            .fillStyle(AssetConfig.COLORS.PROJECTILE)
            .fillCircle(projectileSize.RADIUS, projectileSize.RADIUS, projectileSize.RADIUS)
            .generateTexture('projectile', projectileSize.WIDTH, projectileSize.HEIGHT);
        
        // 파티클 효과
        scene.add.graphics()
            .fillStyle(AssetConfig.COLORS.PARTICLE)
            .fillCircle(particleSize.RADIUS, particleSize.RADIUS, particleSize.RADIUS)
            .generateTexture('particle', particleSize.WIDTH, particleSize.HEIGHT);
        
        // UI 패널
        scene.add.graphics()
            .fillStyle(AssetConfig.COLORS.UI_PANEL, AssetConfig.ALPHA.UI_PANEL)
            .fillRect(0, 0, panelSize.WIDTH, panelSize.HEIGHT)
            .generateTexture('ui_panel', panelSize.WIDTH, panelSize.HEIGHT);
        
        // 체력바
        scene.add.graphics()
            .fillStyle(AssetConfig.COLORS.HEALTH_BAR)
            .fillRect(0, 0, healthBarSize.WIDTH, healthBarSize.HEIGHT)
            .generateTexture('health_bar', healthBarSize.WIDTH, healthBarSize.HEIGHT);
        
        // 경험치바
        scene.add.graphics()
            .fillStyle(AssetConfig.COLORS.EXP_BAR)
            .fillRect(0, 0, expBarSize.WIDTH, expBarSize.HEIGHT)
            .generateTexture('exp_bar', expBarSize.WIDTH, expBarSize.HEIGHT);
    }
    
    static loadAdditionalAssets(scene) {
        // 추가 에셋들 로드
        AssetConfig.ADDITIONAL_ASSETS.forEach(assetName => {
            scene.load.image(assetName, `assets/${assetName}.png`);
        });
    }
    
    static createAnimations(scene) {
        console.log('애니메이션 생성 시작');
        
        // 중복 생성 방지
        if (scene.anims.exists('slime_idle')) {
            console.log('애니메이션이 이미 생성되어 있음, 건너뛰기');
            return;
        }
        
        // 직업별 플레이어 애니메이션
        AssetConfig.SUPPORTED_JOBS.forEach(job => {
            const textureKey = getPlayerSpriteKey(job, 'front');
            
            // 기본 애니메이션
            if (!scene.anims.exists(`${job}_idle`)) {
                scene.anims.create({
                    key: `${job}_idle`,
                    frames: scene.anims.generateFrameNumbers(textureKey, { start: 0, end: 0 }),
                    frameRate: 10,
                    repeat: -1
                });
            }
            
            if (!scene.anims.exists(`${job}_walk`)) {
                scene.anims.create({
                    key: `${job}_walk`,
                    frames: scene.anims.generateFrameNumbers(textureKey, { start: 0, end: 0 }),
                    frameRate: 10,
                    repeat: -1
                });
            }
        });
        
        // 적 애니메이션
        if (!scene.anims.exists('enemy_idle')) {
            scene.anims.create({
                key: 'enemy_idle',
                frames: scene.anims.generateFrameNumbers('enemy', { start: 0, end: 0 }),
                frameRate: 8,
                repeat: -1
            });
        }
        
        if (!scene.anims.exists('enemy_walk')) {
            scene.anims.create({
                key: 'enemy_walk',
                frames: scene.anims.generateFrameNumbers('enemy', { start: 0, end: 0 }),
                frameRate: 8,
                repeat: -1
            });
        }
        
        // 파티클 애니메이션
        if (!scene.anims.exists('explosion')) {
            scene.anims.create({
                key: 'explosion',
                frames: scene.anims.generateFrameNumbers('particle', { start: 0, end: 0 }),
                frameRate: 20,
                repeat: 0
            });
        }
        
        console.log('애니메이션 생성 완료');
    }
    
    // 이미지 크기 정보를 저장하는 정적 변수
    static imageSizes = new Map();
    
    // 이미지 크기 정보 저장
    static storeImageSizes(scene) {
        AssetConfig.SUPPORTED_JOBS.forEach(job => {
            AssetConfig.DIRECTIONS.forEach(direction => {
                const textureKey = getPlayerSpriteKey(job, direction);
                if (scene.textures.exists(textureKey)) {
                    const texture = scene.textures.get(textureKey);
                    const source = texture.source[0];
                    this.imageSizes.set(textureKey, {
                        width: source.width,
                        height: source.height
                    });
                    console.log(`이미지 크기 저장: ${textureKey} - ${source.width}x${source.height}`);
                } else {
                    console.warn(`텍스처가 존재하지 않음: ${textureKey}`);
                }
            });
        });
    }
    
    // 스프라이트 크기를 일정하게 조정하는 메서드
    static adjustSpriteSize(sprite, targetWidth = null, targetHeight = null) {
        const playerSize = this.getDynamicPlayerSize();
        const finalTargetWidth = targetWidth || playerSize.WIDTH;
        const finalTargetHeight = targetHeight || playerSize.HEIGHT;
        
        const textureKey = sprite.texture.key;
        const sizeInfo = this.imageSizes.get(textureKey);
        
        if (sizeInfo) {
            // 원본 이미지 크기 정보가 있으면 비율을 유지하면서 크기 조정
            const aspectRatio = sizeInfo.width / sizeInfo.height;
            
            if (aspectRatio > 1) {
                // 가로가 더 긴 경우
                const newWidth = finalTargetWidth;
                const newHeight = finalTargetWidth / aspectRatio;
                sprite.setDisplaySize(newWidth, newHeight);
            } else {
                // 세로가 더 긴 경우
                const newHeight = finalTargetHeight;
                const newWidth = finalTargetHeight * aspectRatio;
                sprite.setDisplaySize(newWidth, newHeight);
            }
        } else {
            // 원본 크기 정보가 없으면 기본 크기로 설정
            sprite.setDisplaySize(finalTargetWidth, finalTargetHeight);
        }
    }

    // 에셋 설정 정보 접근용 메서드들
    static getWallSize() {
        return getSpriteSize('WALL');
    }
    
    static getPlayerSize() {
        return getSpriteSize('PLAYER');
    }
    
    static getEnemySize() {
        return getSpriteSize('ENEMY');
    }
    
    static getProjectileSize() {
        return getSpriteSize('PROJECTILE');
    }
    
    static getItemSize(itemType = 'EXP_ORB') {
        return getSpriteSize('ITEM')[itemType];
    }
    
    static getUISize(uiType) {
        return getUISize(uiType);
    }
    
    static isJobSupported(jobType) {
        return isJobSupported(jobType);
    }
    
    // 플레이어 스프라이트 키 생성 (하위 호환성을 위해 유지)
    static getPlayerSpriteKey(jobType, direction = 'front') {
        return getPlayerSpriteKey(jobType, direction);
    }
    
    // 서버 설정 업데이트
    static updateServerConfig(serverConfig) {
        updateServerConfig(serverConfig);
        console.log('AssetLoader: 서버 설정이 업데이트되었습니다.');
    }
    
    // 동적 크기 조회 메서드들 (서버 설정 반영)
    static getDynamicWallSize() {
        return {
            WIDTH: getDynamicWallSize(),
            HEIGHT: getDynamicWallSize()
        };
    }
    
    static getDynamicPlayerSize() {
        return getDynamicPlayerSize();
    }
} 