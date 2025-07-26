import { io } from 'socket.io-client';

class NetworkManager {
    constructor() {
        // 싱글톤 패턴 - 이미 인스턴스가 있으면 기존 인스턴스 반환
        if (NetworkManager.instance) {
            console.log('기존 NetworkManager 인스턴스 반환');
            return NetworkManager.instance;
        }
        
        console.log('새 NetworkManager 인스턴스 생성');
        
        // 개발환경과 프로덕션 환경 구분
        const serverUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : window.location.origin;
        
        this.socket = io(serverUrl);
        this.isConnected = false;
        this.playerId = null;
        this.callbacks = new Map();
        this.pendingJoinGameData = null; // 게임 입장 대기 데이터
        this.hasJoinedGame = false; // 게임 입장 완료 여부
        this.setupSocketEvents();
        
        // 싱글톤 인스턴스 저장
        NetworkManager.instance = this;
    }

    // 싱글톤 인스턴스 제거 (필요시)
    static destroyInstance() {
        if (NetworkManager.instance) {
            NetworkManager.instance.socket.disconnect();
            NetworkManager.instance = null;
            console.log('NetworkManager 인스턴스 제거됨');
        }
    }

    setupSocketEvents() {
        this.socket.on('connect', () => {
            console.log('서버에 연결되었습니다.');
            this.isConnected = true;
            
            // 연결 완료 후 대기 중인 게임 입장 요청 처리
            if (this.pendingJoinGameData && !this.hasJoinedGame) {
                const dataToSend = this.pendingJoinGameData;
                this.pendingJoinGameData = null;
                console.log('연결 완료 후 대기 중인 join-game 요청 처리:', dataToSend);
                this.socket.emit('join-game', dataToSend);
            }
        });

        this.socket.on('disconnect', () => {
            console.log('서버 연결이 끊어졌습니다.');
            this.isConnected = false;
            this.hasJoinedGame = false; // 연결이 끊어지면 다시 입장 가능하도록
        });

        // 게임 이벤트 리스너들
        this.socket.on('game-joined', (data) => {
            this.playerId = data.playerId;
            this.hasJoinedGame = true; // 게임 입장 완료 표시
            this.emit('game-joined', data);
        });

        this.socket.on('player-joined', (data) => {
            this.emit('player-joined', data);
        });

        this.socket.on('player-left', (data) => {
            this.emit('player-left', data);
        });

        this.socket.on('player-moved', (data) => {
            this.emit('player-moved', data);
        });

        this.socket.on('player-skill-used', (data) => {
            this.emit('player-skill-used', data);
        });

        this.socket.on('skill-error', (data) => {
            this.emit('skill-error', data);
        });

        this.socket.on('player-level-up', (data) => {
            this.emit('player-level-up', data);
        });

        this.socket.on('enemy-spawned', (data) => {
            this.emit('enemy-spawned', data);
        });

        this.socket.on('enemy-destroyed', (data) => {
            this.emit('enemy-destroyed', data);
        });

        this.socket.on('enemy-damaged', (data) => {
            this.emit('enemy-damaged', data);
        });

        this.socket.on('enemies-update', (data) => {
            this.emit('enemies-update', data);
        });

        this.socket.on('player-job-changed', (data) => {
            this.emit('player-job-changed', data);
        });

        this.socket.on('game-synced', (data) => {
            this.emit('game-synced', data);
        });
      
        this.socket.on('player-ping', (data) => {
            this.emit('player-ping', data);
        });
    }

    // 게임 입장
    joinGame(playerData = {}) {
        const timestamp = Date.now();
        console.log(`[${timestamp}] NetworkManager.joinGame() 호출:`, playerData);
        console.log(`[${timestamp}] 현재 상태 - isConnected:`, this.isConnected, 'hasJoinedGame:', this.hasJoinedGame, 'playerId:', this.playerId);
        
        // 이미 게임에 입장했다면 무시
        if (this.hasJoinedGame && this.playerId) {
            console.log(`[${timestamp}] 이미 게임에 입장했습니다. playerId:`, this.playerId);
            return;
        }
        
        // 대기 중인 요청이 있다면 무시 (중복 요청 방지)
        if (this.pendingJoinGameData) {
            console.log(`[${timestamp}] 이미 대기 중인 join-game 요청이 있습니다.`);
            return;
        }

        if (this.isConnected) {
            console.log(`[${timestamp}] 서버에 join-game 이벤트 전송:`, playerData);
            this.socket.emit('join-game', playerData);
        } else {
            // 연결이 완료되지 않았으면 데이터를 저장하고 대기
            this.pendingJoinGameData = playerData;
            console.log(`[${timestamp}] 서버 연결 대기 중...`);
        }
    }

    // 플레이어 위치 업데이트
    updatePlayerPosition(x, y, direction, isJumping, additionalData = {}) {
        if (this.isConnected) {
            this.socket.emit('player-update', {
                x: x,
                y: y,
                direction: direction,
                isJumping: isJumping,
                ...additionalData
            });
        }
    }

    // 스킬 사용
    useSkill(skillType, additionalData = {}) {
        if (this.isConnected) {
            this.socket.emit('player-skill', {
                skillType: skillType,
                ...additionalData
            });
        }
    }

    // 적 공격
    hitEnemy(enemyId) {
        if (this.isConnected) {
            this.socket.emit('enemy-hit', {
                enemyId: enemyId
            });
        }
    }

    // 직업 변경
    changeJob(jobClass) {
        if (this.isConnected) {
            this.socket.emit('player-job-change', {
                jobClass: jobClass
            });
        }
    }

    // 핑 전송
    sendPing(x, y) {
        if (this.isConnected) {
            this.socket.emit('player-ping', {
                x: x,
                y: y
            });
        }
    }

    // 이벤트 리스너 등록
    on(eventName, callback) {
        if (!this.callbacks.has(eventName)) {
            this.callbacks.set(eventName, []);
        }
        this.callbacks.get(eventName).push(callback);
    }

    // 이벤트 리스너 제거
    off(eventName, callback) {
        if (this.callbacks.has(eventName)) {
            const callbacks = this.callbacks.get(eventName);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    // 이벤트 발생
    emit(eventName, data) {
        if (this.callbacks.has(eventName)) {
            this.callbacks.get(eventName).forEach(callback => {
                callback(data);
            });
        }
    }
    
    // 치트: 리스폰 요청 (자살)
    requestRespawn() {
        if (this.socket && this.isConnected) {
            console.log('리스폰 요청 (자살)');
            this.socket.emit('cheat-respawn');
        }
    }

    // 게임 상태 동기화 요청 (탭 포커스 복원 시)
    requestGameSync() {
        if (this.socket && this.isConnected) {
            console.log('게임 상태 동기화 요청');
            this.socket.emit('request-game-sync');
        }
    }

    // 연결 해제
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
} 

// 싱글톤 인스턴스 저장
NetworkManager.instance = null;

export default NetworkManager; 