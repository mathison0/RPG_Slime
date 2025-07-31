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
            ? 'http://localhost:80' 
            : window.location.origin;
        
        // Socket.IO 연결 옵션 최적화
        this.socket = io(serverUrl, {
            timeout: 10000,          // 연결 타임아웃 10초
            forceNew: true,          // 새 연결 강제
            transports: ['websocket', 'polling'], // WebSocket 우선, polling 백업
            upgrade: true,           // 자동 업그레이드 활성화
            rememberUpgrade: true    // 업그레이드 기억
        });
        
        this.isConnected = false;
        this.playerId = null;
        this.callbacks = new Map();
        this.pendingJoinGameData = null; // 게임 입장 대기 데이터
        this.hasJoinedGame = false; // 게임 입장 완료 여부
        
        // 핑 테스트 관련 변수
        this.ping = 0;
        this.pingTestInterval = null;
        this.lastPingTime = 0;
        
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
            
            // 핑 테스트 시작
            this.startPingTest();
            
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
            this.emit('disconnect'); // NetworkEventManager로 이벤트 전달
            
            // 핑 테스트 정지
            this.stopPingTest();
        });

        // 핑 테스트 응답 처리
        this.socket.on('ping-response', (serverTimestamp) => {
            const now = Date.now();
            if (this.lastPingTime && serverTimestamp === this.lastPingTime) {
                this.ping = now - this.lastPingTime;
                // console.log(`핑: ${this.ping}ms`); // 디버그용 (필요시 활성화)
            }
        });

        this.socket.on('connect_error', (error) => {
            console.log('서버 연결 오류:', error);
            this.isConnected = false;
            this.hasJoinedGame = false;
            this.emit('connect_error', error); // NetworkEventManager로 이벤트 전달
        });

        this.socket.on('error', (error) => {
            console.error('Socket.IO 에러:', error);
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

        this.socket.on('player-update-error', (data) => {
            this.emit('player-update-error', data);
        });

        this.socket.on('player-level-up', (data) => {
            this.emit('player-level-up', data);
        });

        this.socket.on('level-up-error', (data) => {
            this.emit('level-up-error', data);
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

        // player-death 이벤트는 사용되지 않음 (player-died 이벤트만 사용)
        // this.socket.on('player-death', (data) => {
        //     this.emit('player-death', data);
        // });

        this.socket.on('monster-attack', (data) => {
            this.emit('monster-attack', data);
        });

        // 플레이어 데미지 이벤트
        this.socket.on('player-damaged', (data) => {
            this.emit('player-damaged', data);
        });

        this.socket.on('player-healed', (data) => {
            this.emit('player-healed', data);
        });

        // 플레이어 상태 업데이트 이벤트
        this.socket.on('players-state-update', (data) => {
            this.emit('players-state-update', data);
        });

        this.socket.on('player-job-changed', (data) => {
            this.emit('player-job-changed', data);
        });

        this.socket.on('player-exp-gained', (data) => {
            this.emit('player-exp-gained', data);
        });

        this.socket.on('game-synced', (data) => {
            this.emit('game-synced', data);
        });
      
        this.socket.on('player-ping', (data) => {
            this.emit('player-ping', data);
        });

        this.socket.on('spawn-barrier-damage', (data) => {
            this.emit('spawn-barrier-damage', data);
        });

        this.socket.on('player-died', (data) => {
            this.emit('player-died', data);
        });

        this.socket.on('player-respawned', (data) => {
            this.emit('player-respawned', data);
        });

        this.socket.on('ward-destroyed', (data) => {
            this.emit('ward-destroyed', data);
        });

        this.socket.on('player-stunned', (data) => {
            this.emit('player-stunned', data);
        });

        this.socket.on('projectiles-update', (data) => {
            this.emit('projectiles-update', data);
        });

        this.socket.on('wards-update', (data) => {
            this.emit('wards-update', data);
        });

        this.socket.on('projectile-removed', (data) => {
            this.emit('projectile-removed', data);
        });

        // 사용되지 않는 투사체 충돌 이벤트들 제거
        // this.socket.on('projectile-hit-wall', (data) => {
        //     this.emit('projectile-hit-wall', data);
        // });

        // this.socket.on('projectile-hit-player', (data) => {
        //     this.emit('projectile-hit-player', data);
        // });

        // this.socket.on('projectile-hit-enemy', (data) => {
        //     this.emit('projectile-hit-enemy', data);
        // });

        // 누락된 필수 이벤트 리스너들 추가
        this.socket.on('player-buffed', (data) => {
            this.emit('player-buffed', data);
        });

        this.socket.on('enemy-slowed', (data) => {
            this.emit('enemy-slowed', data);
        });

        this.socket.on('player-slowed', (data) => {
            this.emit('player-slowed', data);
        });

        this.socket.on('magic-missile-explosion', (data) => {
            this.emit('magic-missile-explosion', data);
        });

        this.socket.on('shield-removed', (data) => {
            this.emit('shield-removed', data);
        });

        // 공격 무효 이벤트
        this.socket.on('attack-invalid', (data) => {
            this.emit('attack-invalid', data);
        });

        // 적 기절 이벤트
        this.socket.on('enemy-stunned', (data) => {
            this.emit('enemy-stunned', data);
        });

        // 플레이어 무적 상태 변경 이벤트
        this.socket.on('player-invincible-changed', (data) => {
            this.emit('player-invincible-changed', data);
        });

        // 무적 상태 토글 에러 이벤트
        this.socket.on('invincible-error', (data) => {
            this.emit('invincible-error', data);
        });

        // 자살 치트 에러 이벤트
        this.socket.on('suicide-error', (data) => {
            this.emit('suicide-error', data);
        });
        
        // 직업 변경 오브 관련 이벤트들
        this.socket.on('job-orb-spawned', (data) => {
            console.log('🎯 NetworkManager에서 job-orb-spawned 이벤트 받음:', data);
            this.emit('job-orb-spawned', data);
        });
        
        this.socket.on('job-orb-removed', (data) => {
            console.log('🎯 NetworkManager에서 job-orb-removed 이벤트 받음:', data);
            this.emit('job-orb-removed', data);
        });
        
        this.socket.on('job-orb-collected', (data) => {
            console.log('🎯 NetworkManager에서 job-orb-collected 이벤트 받음:', data);
            this.emit('job-orb-collected', data);
        });
        
        this.socket.on('job-orb-collision-result', (data) => {
            console.log('🎯 NetworkManager에서 job-orb-collision-result 이벤트 받음:', data);
            this.emit('job-orb-collision-result', data);

        // 은신 종료 이벤트
        this.socket.on('stealth-ended', (data) => {
            this.emit('stealth-ended', data);
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
    useSkill(skillType, targetXOrOptions = null, targetY = null, direction = null, rotationDirection = null) {
        if (this.isConnected) {
            let actualTargetX = null;
            let actualTargetY = null;
            let actualDirection = direction;
            let actualRotationDirection = rotationDirection;
            
            // 두 번째 파라미터가 객체인 경우 (옵션 객체)
            if (typeof targetXOrOptions === 'object' && targetXOrOptions !== null) {
                actualTargetX = targetXOrOptions.targetX || null;
                actualTargetY = targetXOrOptions.targetY || null;
                actualDirection = targetXOrOptions.direction || direction;
                actualRotationDirection = targetXOrOptions.rotationDirection || rotationDirection;
            } else {
                // 기존 방식 (targetX, targetY를 개별 파라미터로 받는 경우)
                actualTargetX = targetXOrOptions;
                actualTargetY = targetY;
            }
            
            const skillData = {
                skillType: skillType,
                targetX: actualTargetX,
                targetY: actualTargetY,
                direction: actualDirection,
                rotationDirection: actualRotationDirection
            };
            
            // 목긋기 스킬의 경우 마우스 위치 정보 추가
            if (skillType === 'backstab' && typeof targetXOrOptions === 'object' && targetXOrOptions !== null) {
                skillData.mouseX = targetXOrOptions.mouseX;
                skillData.mouseY = targetXOrOptions.mouseY;
            }
            console.log(`NetworkManager useSkill 전송:`, skillData);
            console.log(`목긋기 스킬 데이터 확인:`, {
              skillType: skillData.skillType,
              mouseX: skillData.mouseX,
              mouseY: skillData.mouseY,
              targetXOrOptions: targetXOrOptions,
              fullSkillData: skillData
            });
            this.socket.emit('player-skill', skillData);
        }
    }

    // 레벨업 요청
    requestLevelUp() {
        if (this.isConnected) {
            this.socket.emit('player-level-up-request', {
                timestamp: Date.now()
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

    // 플레이어 리스폰 요청
    requestRespawn() {
        if (this.isConnected) {
            this.socket.emit('player-respawn-request', {
                timestamp: Date.now()
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

    // 게임 상태 동기화 요청 (탭 포커스 복원 시)
    requestGameSync() {
        if (this.socket && this.isConnected) {
            console.log('게임 상태 동기화 요청');
            this.socket.emit('request-game-sync');
        }
    }

    // 연결 해제 및 재시도
    disconnect() {
        console.log('연결을 끊는 중...');
        if (this.socket) {
            this.socket.disconnect();
        }
        
        this.isConnected = false;
        this.playerId = null;
        this.hasJoinedGame = false;
        this.pendingJoinGameData = null;
        
        // 핑 테스트 정지
        this.stopPingTest();
    }

    /**
     * 연결 완전 초기화 (Player not found 에러 등으로 인한 강제 초기화)
     */
    resetConnection() {
        console.log('NetworkManager 연결 초기화 시작...');
        
        try {
            // 기존 이벤트 리스너 제거
            if (this.socket) {
                this.socket.removeAllListeners();
                this.socket.disconnect();
            }
            
            // 핑 테스트 정지
            this.stopPingTest();
            
            // 상태 초기화
            this.isConnected = false;
            this.playerId = null;
            this.hasJoinedGame = false;
            this.pendingJoinGameData = null;
            this.callbacks.clear();
            
            // 새로운 소켓 연결 생성
            const serverUrl = window.location.hostname === 'localhost' 
                ? 'http://localhost:80' 
                : window.location.origin;
            
            this.socket = io(serverUrl, {
                timeout: 10000,
                forceNew: true,
                transports: ['websocket', 'polling'],
                upgrade: true,
                rememberUpgrade: true
            });
            this.setupSocketEvents();
            
            console.log('NetworkManager 연결 초기화 완료');
        } catch (error) {
            console.error('NetworkManager 연결 초기화 중 오류:', error);
        }
    }

    /**
     * 전용 핑 테스트 시작
     */
    startPingTest() {
        // 기존 핑 테스트 정리
        if (this.pingTestInterval) {
            clearInterval(this.pingTestInterval);
        }

        // 3초마다 핑 테스트 실행
        this.pingTestInterval = setInterval(() => {
            if (this.isConnected) {
                this.sendPingTest();
            }
        }, 500);
        
        // 즉시 한 번 실행
        if (this.isConnected) {
            this.sendPingTest();
        }
    }

    /**
     * 핑 테스트 전송
     */
    sendPingTest() {
        this.lastPingTime = Date.now();
        this.socket.emit('ping-test', this.lastPingTime);
    }

    /**
     * 핑 테스트 정지
     */
    stopPingTest() {
        if (this.pingTestInterval) {
            clearInterval(this.pingTestInterval);
            this.pingTestInterval = null;
        }
    }

    /**
     * 현재 핑 값 반환
     */
    getPing() {
        return this.ping;
    }
} 

// 싱글톤 인스턴스 저장
NetworkManager.instance = null;

export default NetworkManager; 