const gameConfig = require('../config/GameConfig');

/**
 * 서버에서 플레이어 스폰 위치 생성
 */
function generateSpawnPosition(team, gameConfig) {
  const { MAP_WIDTH_TILES, MAP_HEIGHT_TILES, SPAWN_WIDTH_TILES, TILE_SIZE } = gameConfig;
  
  // 타일 기반으로 계산 후 픽셀로 변환
  const MAP_WIDTH = MAP_WIDTH_TILES * TILE_SIZE;
  const MAP_HEIGHT = MAP_HEIGHT_TILES * TILE_SIZE;
  const SPAWN_WIDTH = SPAWN_WIDTH_TILES * TILE_SIZE;
  
  if (team === 'red') {
    return {
      x: Math.random() * (SPAWN_WIDTH - TILE_SIZE * 2) + TILE_SIZE,
      y: Math.random() * (MAP_HEIGHT - TILE_SIZE * 2) + TILE_SIZE
    };
  } else {
    return {
      x: MAP_WIDTH - Math.random() * (SPAWN_WIDTH - TILE_SIZE * 2) - TILE_SIZE,
      y: Math.random() * (MAP_HEIGHT - TILE_SIZE * 2) + TILE_SIZE
    };
  }
}

/**
 * 서버 유틸리티 함수들
 */
class ServerUtils {
  /**
   * 팀에 따른 스폰 지점 계산
   */
  static getSpawnPoint(team) {
    return generateSpawnPosition(team, gameConfig);
  }

  /**
   * 특정 위치가 벽인지 확인
   */
  static isWallPosition(x, y, mapData) {
    if (!mapData || !mapData.walls) {
      return false;
    }

    const tolerance = gameConfig.TILE_SIZE / 2;
    
    return mapData.walls.some(wall => {
      const dx = Math.abs(wall.x - x);
      const dy = Math.abs(wall.y - y);
      return dx < tolerance && dy < tolerance;
    });
  }

  /**
   * 두 점 사이의 거리 계산
   */
  static getDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 각도 계산 (라디안)
   */
  static getAngle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
  }

  /**
   * 각도를 정규화 (0 ~ 2π)
   */
  static normalizeAngle(angle) {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
  }

  /**
   * 벡터 정규화
   */
  static normalizeVector(x, y) {
    const length = Math.sqrt(x * x + y * y);
    if (length === 0) return { x: 0, y: 0 };
    return { x: x / length, y: y / length };
  }

  /**
   * 범위 내 랜덤 값 생성
   */
  static randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  /**
   * 정수 범위 내 랜덤 값 생성
   */
  static randomIntBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 배열에서 랜덤 요소 선택
   */
  static randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * 좌표가 맵 경계 내에 있는지 확인
   */
  static isInMapBounds(x, y, margin = 0) {
    const MAP_WIDTH = gameConfig.MAP_WIDTH_TILES * gameConfig.TILE_SIZE;
    const MAP_HEIGHT = gameConfig.MAP_HEIGHT_TILES * gameConfig.TILE_SIZE;
    return x >= margin && 
           x <= MAP_WIDTH - margin && 
           y >= margin && 
           y <= MAP_HEIGHT - margin;
  }

  /**
   * 좌표를 맵 경계 내로 제한
   */
  static clampToMapBounds(x, y, margin = 0) {
    const MAP_WIDTH = gameConfig.MAP_WIDTH_TILES * gameConfig.TILE_SIZE;
    const MAP_HEIGHT = gameConfig.MAP_HEIGHT_TILES * gameConfig.TILE_SIZE;
    return {
      x: Math.max(margin, Math.min(MAP_WIDTH - margin, x)),
      y: Math.max(margin, Math.min(MAP_HEIGHT - margin, y))
    };
  }

  /**
   * 원형 범위 내에 있는지 확인
   */
  static isInCircle(x, y, centerX, centerY, radius) {
    const distance = this.getDistance(x, y, centerX, centerY);
    return distance <= radius;
  }

  /**
   * 사각형 범위 내에 있는지 확인
   */
  static isInRectangle(x, y, rectX, rectY, rectWidth, rectHeight) {
    return x >= rectX && 
           x <= rectX + rectWidth && 
           y >= rectY && 
           y <= rectY + rectHeight;
  }

  /**
   * 현재 시간을 포맷된 문자열로 반환
   */
  static getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * 로그 메시지 포맷
   */
  static formatLog(level, message, data = null) {
    const timestamp = this.getTimestamp();
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
      logMessage += ` ${JSON.stringify(data)}`;
    }
    
    return logMessage;
  }

  /**
   * 디버그 로그
   */
  static debugLog(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      console.log(this.formatLog('debug', message, data));
    }
  }

  /**
   * 정보 로그
   */
  static infoLog(message, data = null) {
    console.log(this.formatLog('info', message, data));
  }

  /**
   * 경고 로그
   */
  static warnLog(message, data = null) {
    console.warn(this.formatLog('warn', message, data));
  }

  /**
   * 오류 로그
   */
  static errorLog(message, data = null) {
    console.error(this.formatLog('error', message, data));
  }

  /**
   * 성능 측정 시작
   */
  static startPerformanceTimer(label) {
    console.time(label);
  }

  /**
   * 성능 측정 종료
   */
  static endPerformanceTimer(label) {
    console.timeEnd(label);
  }

  /**
   * 메모리 사용량 조회
   */
  static getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100
    };
  }

  /**
   * 서버 상태 정보
   */
  static getServerStatus() {
    return {
      uptime: process.uptime(),
      memory: this.getMemoryUsage(),
      timestamp: Date.now(),
      nodeVersion: process.version,
      platform: process.platform
    };
  }
}

module.exports = ServerUtils; 