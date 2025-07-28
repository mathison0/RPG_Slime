// ES6 wrapper for AssetConfig CommonJS module
import * as AssetConfigModule from './AssetConfig.js';

export const {
    AssetConfig,
    getPlayerSpriteKey,
    isJobSupported,
    getSpriteSize,
    getUISize,
    updateServerConfig,
    getDynamicWallSize,
    getDynamicPlayerSize
} = AssetConfigModule; 