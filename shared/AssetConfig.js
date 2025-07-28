/**
 * 에셋 관련 설정
 * 클라이언트와 서버가 공통으로 사용하는 에셋 관련 상수값들을 중앙에서 관리
 * 서버에서 받은 설정으로 동적으로 업데이트 가능
 */

const AssetConfig = {
    // 서버에서 받은 설정을 저장하는 공간
    _serverConfig: null,
    // 스프라이트 크기 설정
    SPRITE_SIZES: {
        PLAYER: {
            WIDTH: 64,
            HEIGHT: 64,
            // 표준화된 플레이어 크기 설정
            STANDARD_SIZE: 64,        // 모든 직업의 기본 표준 크기
            MIN_SIZE: 38,             // 최소 크기 (레벨 1, 표준의 60%)
            MAX_SIZE: 77,             // 최대 크기 (표준의 120%)
            COLLIDER_SIZE: 32,        // 표준 충돌 박스 크기 (모든 직업 동일)
            GROWTH_RATE: 2            // 레벨당 증가 픽셀
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

    // UI 요소 크기 설정
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

    // 색상 설정
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

    // 투명도 설정
    ALPHA: {
        UI_PANEL: 0.7
    },

    // 지원되는 직업 목록
    SUPPORTED_JOBS: ['slime', 'warrior', 'mage', 'assassin', 'mechanic', 'ninja', 'archer', 'supporter'],

    // 스프라이트 방향
    DIRECTIONS: ['front', 'back', 'left', 'right'],

    // 추가 에셋 목록
    ADDITIONAL_ASSETS: [
        'ping_arrow',
        'slime_skill',
        'ward',
        'warrior_skill'
    ]
};

/**
 * 플레이어 스프라이트 키 생성
 * @param {string} jobType - 직업 타입
 * @param {string} direction - 방향 (front, back, left, right)
 * @returns {string} 스프라이트 키
 */
function getPlayerSpriteKey(jobType, direction = 'front') {
    return `player_${jobType}_${direction}`;
}

/**
 * 특정 직업이 지원되는지 확인
 * @param {string} jobType - 직업 타입
 * @returns {boolean} 지원 여부
 */
function isJobSupported(jobType) {
    return AssetConfig.SUPPORTED_JOBS.includes(jobType);
}

/**
 * 스프라이트 크기 정보 조회
 * @param {string} assetType - 에셋 타입 (PLAYER, ENEMY, WALL 등)
 * @returns {object} 크기 정보 객체
 */
function getSpriteSize(assetType) {
    return AssetConfig.SPRITE_SIZES[assetType] || { WIDTH: 32, HEIGHT: 32 };
}

/**
 * UI 크기 정보 조회
 * @param {string} uiType - UI 타입 (PANEL, HEALTH_BAR 등)
 * @returns {object} 크기 정보 객체
 */
function getUISize(uiType) {
    return AssetConfig.UI_SIZES[uiType] || { WIDTH: 100, HEIGHT: 20 };
}

/**
 * 서버 설정을 업데이트
 * @param {object} serverConfig - 서버에서 받은 설정 객체
 */
function updateServerConfig(serverConfig) {
    AssetConfig._serverConfig = serverConfig;
    console.log('서버 설정 업데이트됨:', serverConfig);
}

/**
 * 동적 벽 크기 계산 (서버 설정 기반)
 * @returns {number} 벽 크기
 */
function getDynamicWallSize() {
    if (AssetConfig._serverConfig && AssetConfig._serverConfig.TILE_SIZE) {
        return AssetConfig._serverConfig.TILE_SIZE;
    }
    return 100; // 기본값
}

/**
 * 동적 플레이어 크기 계산 (서버 설정 기반, 표준화 적용)
 * @returns {object} 플레이어 크기 객체
 */
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
    
    // 기본값 (표준화된 설정 포함)
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

// ES6 exports
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