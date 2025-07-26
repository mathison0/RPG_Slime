const ServerPlayer = require('../entities/ServerPlayer');
const ServerEnemy = require('../entities/ServerEnemy');
const gameConfig = require('../config/GameConfig');

/**
 * 게임 상태 관리 매니저
 */
class GameStateManager {
  constructor() {
    this.players = new Map();
    this.enemies = new Map();
    this.rooms = new Map();
    this.mapData = null;
  }

  /**
   * 플레이어 추가
   */
  addPlayer(id, x, y, team, nickname) {
    if (this.players.has(id)) {
      console.log(`플레이어 ${id} 이미 존재함, 기존 플레이어 반환`);
      return this.players.get(id);
    }

    const player = new ServerPlayer(id, x, y, team);
    player.nickname = nickname || `Player${Math.floor(Math.random() * 1000)}`;
    this.players.set(id, player);
    
    console.log(`플레이어 추가: ${id} (${nickname}), 팀: ${team}`);
    return player;
  }

  /**
   * 플레이어 제거
   */
  removePlayer(id) {
    const removed = this.players.delete(id);
    if (removed) {
      console.log(`플레이어 제거: ${id}`);
    }
    return removed;
  }

  /**
   * 플레이어 조회
   */
  getPlayer(id) {
    return this.players.get(id);
  }

  /**
   * 모든 플레이어 조회
   */
  getAllPlayers() {
    return Array.from(this.players.values());
  }

  /**
   * 플레이어 상태 배열 조회
   */
  getPlayersState() {
    return Array.from(this.players.values()).map(p => p.getState());
  }

  /**
   * 적 추가
   */
  addEnemy(id, x, y, type) {
    const enemy = new ServerEnemy(id, x, y, type);
    this.enemies.set(id, enemy);
    console.log(`적 추가: ${id} (${type}) at (${x}, ${y})`);
    return enemy;
  }

  /**
   * 적 제거
   */
  removeEnemy(id) {
    const removed = this.enemies.delete(id);
    if (removed) {
      console.log(`적 제거: ${id}`);
    }
    return removed;
  }

  /**
   * 적 조회
   */
  getEnemy(id) {
    return this.enemies.get(id);
  }

  /**
   * 모든 적 조회
   */
  getAllEnemies() {
    return Array.from(this.enemies.values());
  }

  /**
   * 적 상태 배열 조회
   */
  getEnemiesState() {
    return Array.from(this.enemies.values()).map(e => e.getState());
  }

  /**
   * 연결 해제된 플레이어들 정리
   */
  cleanupDisconnectedPlayers() {
    const disconnectedPlayers = [];
    
    for (const [id, player] of this.players) {
      if (player.isDisconnected()) {
        disconnectedPlayers.push(id);
      }
    }
    
    disconnectedPlayers.forEach(id => {
      this.removePlayer(id);
    });
    
    return disconnectedPlayers;
  }

  /**
   * 팀별 플레이어 수 계산
   */
  getTeamCounts() {
    const counts = { red: 0, blue: 0 };
    
    for (const player of this.players.values()) {
      if (player.team === 'red') counts.red++;
      else if (player.team === 'blue') counts.blue++;
    }
    
    return counts;
  }

  /**
   * 균형 잡힌 팀 반환 (새 플레이어용)
   */
  getBalancedTeam() {
    const counts = this.getTeamCounts();
    return counts.red <= counts.blue ? 'red' : 'blue';
  }

  /**
   * 맵 데이터 설정
   */
  setMapData(mapData) {
    this.mapData = mapData;
    console.log('게임 맵 데이터 설정 완료');
  }

  /**
   * 전체 게임 상태 조회
   */
  getFullGameState() {
    return {
      players: this.getPlayersState(),
      enemies: this.getEnemiesState(),
      mapData: this.mapData,
      timestamp: Date.now()
    };
  }

  /**
   * 통계 정보 조회
   */
  getStats() {
    const teamCounts = this.getTeamCounts();
    return {
      totalPlayers: this.players.size,
      totalEnemies: this.enemies.size,
      redTeam: teamCounts.red,
      blueTeam: teamCounts.blue,
      timestamp: Date.now()
    };
  }

  /**
   * 게임 상태 리셋
   */
  reset() {
    this.players.clear();
    this.enemies.clear();
    this.rooms.clear();
    console.log('게임 상태 리셋 완료');
  }
}

module.exports = GameStateManager; 