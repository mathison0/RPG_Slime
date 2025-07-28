/**
 * 에셋 관련 설정 (클라이언트용)
 */

const AssetConfig = {
    _serverConfig: null,
    SPRITE_SIZES: {
        PLAYER: {
            WIDTH: 64,
            HEIGHT: 64,
            STANDARD_SIZE: 64,
            MIN_SIZE: 38,
            MAX_SIZE: 77,
            COLLIDER_SIZE: 32,
            GROWTH_RATE: 2
        },
        ENEMY: {
            WIDTH: 32,
            HEIGHT: 32,
            RADIUS: 16
        },
        WALL: {
            WIDTH: 100,
            HEIGHT: 100
        },
        ITEM: {
            EXP_ORB: {
                WIDTH: 16,
                HEIGHT: 16,
                RADIUS: 8
            },
            HEALTH_POTION: {
                WIDTH: 16,
                HEIGHT: 16,
                RADIUS: 8
            }
        },
        PROJECTILE: {
            WIDTH: 8,
            HEIGHT: 8,
            RADIUS: 4
        },
        PARTICLE: {
            WIDTH: 4,
            HEIGHT: 4,
            RADIUS: 2
        }
    },
    UI_SIZES: {
        PANEL: {
            WIDTH: 200,
            HEIGHT: 50
        },
        HEALTH_BAR: {
            WIDTH: 100,
            HEIGHT: 10
        },
        EXP_BAR: {
            WIDTH: 100,
            HEIGHT: 10
        }
    },
    COLORS: {
        ENEMY: 0xff0000,
        WALL: 0x8b4513,
        EXP_ORB: 0xffff00,
        HEALTH_POTION: 0x00ffff,
        PROJECTILE: 0xff6600,
        PARTICLE: 0xffffff,
        UI_PANEL: 0x000000,
        HEALTH_BAR: 0x00ff00,
        EXP_BAR: 0x0000ff
    },
    ALPHA: {
        UI_PANEL: 0.7
    },
    SUPPORTED_JOBS: ['slime', 'warrior', 'mage', 'assassin', 'mechanic', 'ninja', 'archer', 'supporter'],
    DIRECTIONS: ['front', 'back', 'left', 'right'],
    ADDITIONAL_ASSETS: [
        'ping_arrow',
        'slime_skill',
        'ward',
        'warrior_skill',
        'ninja_basic_attack',
        'slime_basic_attack',
        'archer_basic_attack'
    ]
};

function getPlayerSpriteKey(jobType, direction = 'front') {
    return `player_${jobType}_${direction}`;
}

function isJobSupported(jobType) {
    return AssetConfig.SUPPORTED_JOBS.includes(jobType);
}

function getSpriteSize(assetType) {
    return AssetConfig.SPRITE_SIZES[assetType] || { WIDTH: 32, HEIGHT: 32 };
}

function getUISize(uiType) {
    return AssetConfig.UI_SIZES[uiType] || { WIDTH: 100, HEIGHT: 20 };
}

function updateServerConfig(serverConfig) {
    AssetConfig._serverConfig = serverConfig;
    console.log('서버 설정 업데이트됨:', serverConfig);
}

function getDynamicWallSize() {
    if (AssetConfig._serverConfig && AssetConfig._serverConfig.TILE_SIZE) {
        return AssetConfig._serverConfig.TILE_SIZE;
    }
    return 100;
}

function getDynamicPlayerSize() {
    const baseConfig = AssetConfig.SPRITE_SIZES.PLAYER;
    
    if (AssetConfig._serverConfig && AssetConfig._serverConfig.PLAYER) {
        const serverSize = AssetConfig._serverConfig.PLAYER.DEFAULT_SIZE || baseConfig.STANDARD_SIZE;
        return {
            WIDTH: serverSize,
            HEIGHT: serverSize,
            STANDARD_SIZE: serverSize,
            MIN_SIZE: Math.floor(serverSize * 0.6),
            MAX_SIZE: Math.floor(serverSize * 1.2),
            COLLIDER_SIZE: baseConfig.COLLIDER_SIZE,
            GROWTH_RATE: baseConfig.GROWTH_RATE
        };
    }
    
    return {
        WIDTH: baseConfig.STANDARD_SIZE,
        HEIGHT: baseConfig.STANDARD_SIZE,
        STANDARD_SIZE: baseConfig.STANDARD_SIZE,
        MIN_SIZE: baseConfig.MIN_SIZE,
        MAX_SIZE: baseConfig.MAX_SIZE,
        COLLIDER_SIZE: baseConfig.COLLIDER_SIZE,
        GROWTH_RATE: baseConfig.GROWTH_RATE
    };
}

export {
    AssetConfig,
    getPlayerSpriteKey,
    isJobSupported,
    getSpriteSize,
    getUISize,
    updateServerConfig,
    getDynamicWallSize,
    getDynamicPlayerSize
}; 