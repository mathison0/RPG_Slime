import { io } from 'socket.io-client';

export default class NetworkManager {
    constructor() {
        // 개발환경과 프로덕션 환경 구분
        const serverUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : window.location.origin;
        
        this.socket = io(serverUrl);
        this.isConnected = false;
        this.playerId = null;
        this.callbacks = new Map();
        this.pendingJoinGame = false; // 게임 입장 대기 상태
        this.setupSocketEvents();
    }

    setupSocketEvents() {
        this.socket.on('connect', () => {
            console.log('서버에 연결되었습니다.');
            this.isConnected = true;
            
            // 연결 완료 후 대기 중인 게임 입장 요청 처리
            if (this.pendingJoinGame) {
                this.pendingJoinGame = false;
                this.socket.emit('join-game', {});
            }
        });

        this.socket.on('disconnect', () => {
            console.log('서버 연결이 끊어졌습니다.');
            this.isConnected = false;
        });

        // 게임 이벤트 리스너들
        this.socket.on('game-joined', (data) => {
            this.playerId = data.playerId;
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
    }

    // 게임 입장
    joinGame(playerData = {}) {
        if (this.isConnected) {
            this.socket.emit('join-game', playerData);
        } else {
            // 연결이 완료되지 않았으면 대기 상태로 설정
            this.pendingJoinGame = true;
            console.log('서버 연결 대기 중...');
        }
    }

    // 플레이어 위치 업데이트
    updatePlayerPosition(x, y, direction, isJumping) {
        if (this.isConnected) {
            this.socket.emit('player-update', {
                x: x,
                y: y,
                direction: direction,
                isJumping: isJumping
            });
        }
    }

    // 스킬 사용
    useSkill(skillType) {
        if (this.isConnected) {
            this.socket.emit('player-skill', {
                skillType: skillType
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

    // 연결 해제
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
} 