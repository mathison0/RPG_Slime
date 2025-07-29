/**
 * 절대 시간 기반 이벤트 관리 매니저
 * 여러 개의 개별 requestAnimationFrame 대신 하나의 루프로 모든 이벤트를 처리
 */
export default class AbsoluteTimerManager {
    constructor() {
        this.events = new Map(); // eventId -> { targetTime, callback, isActive }
        this.fastestTimerEventTime = Infinity; // 가장 빠른 이벤트 시간
        this.isRunning = false;
        this.nextEventId = 1;
        
        // 성능 최적화를 위한 설정
        this.lastCheckTime = 0;
        this.minCheckInterval = 8; // 최소 8ms 간격으로 체크 (120fps 수준)
    }
    
    /**
     * 절대 시간 기반 이벤트 등록
     * @param {number} targetTime - 실행 목표 시간 (Date.now() 기준)
     * @param {Function} callback - 실행할 콜백 함수
     * @returns {number} 이벤트 ID (취소용)
     */
    addEvent(targetTime, callback) {
        const eventId = this.nextEventId++;
        
        this.events.set(eventId, {
            targetTime,
            callback,
            isActive: true
        });
        
        // 가장 빠른 이벤트 시간 업데이트
        if (targetTime < this.fastestTimerEventTime) {
            this.fastestTimerEventTime = targetTime;
        }
        
        // 매니저가 실행 중이 아니면 시작
        if (!this.isRunning) {
            this.startLoop();
        }
        
        console.log(`AbsoluteTimer: 이벤트 ${eventId} 등록, 목표시간: ${targetTime}, 현재 가장 빠른 시간: ${this.fastestTimerEventTime}`);
        
        return eventId;
    }
    
    /**
     * 이벤트 취소
     * @param {number} eventId - 취소할 이벤트 ID
     */
    removeEvent(eventId) {
        const event = this.events.get(eventId);
        if (event) {
            event.isActive = false;
            this.events.delete(eventId);
            
            // 가장 빠른 이벤트가 제거되었다면 다시 계산
            if (event.targetTime === this.fastestTimerEventTime) {
                this.updateFastestTime();
            }
            
            console.log(`AbsoluteTimer: 이벤트 ${eventId} 제거됨`);
        }
    }
    
    /**
     * 메인 체크 루프 시작
     */
    startLoop() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log('AbsoluteTimer: 메인 루프 시작');
        this.checkEvents();
    }
    
    /**
     * 메인 체크 루프 중지
     */
    stopLoop() {
        this.isRunning = false;
        console.log('AbsoluteTimer: 메인 루프 중지');
    }
    
    /**
     * 이벤트 체크 및 실행
     */
    checkEvents() {
        if (!this.isRunning) return;
        
        const now = Date.now();
        
        // 성능 최적화: 최소 간격 체크
        if (now - this.lastCheckTime < this.minCheckInterval) {
            requestAnimationFrame(() => this.checkEvents());
            return;
        }
        
        this.lastCheckTime = now;
        
        // 실행할 이벤트가 있는지 확인
        if (now >= this.fastestTimerEventTime) {
            this.executeReadyEvents(now);
        }
        
        // 남은 이벤트가 있으면 계속 실행
        if (this.events.size > 0) {
            requestAnimationFrame(() => this.checkEvents());
        } else {
            this.stopLoop();
        }
    }
    
    /**
     * 실행 시간이 된 이벤트들을 찾아서 실행
     * @param {number} currentTime - 현재 시간
     */
    executeReadyEvents(currentTime) {
        const readyEvents = [];
        
        // 실행할 이벤트들 찾기
        for (const [eventId, event] of this.events) {
            if (event.isActive && currentTime >= event.targetTime) {
                readyEvents.push({ eventId, event });
            }
        }
        
        // 실행 및 제거
        for (const { eventId, event } of readyEvents) {
            try {
                console.log(`AbsoluteTimer: 이벤트 ${eventId} 실행 [current: ${currentTime}] [target: ${event.targetTime}]`);
                event.callback();
            } catch (error) {
                console.error(`AbsoluteTimer: 이벤트 ${eventId} 실행 중 오류:`, error);
            }
            
            this.events.delete(eventId);
        }
        
        // 가장 빠른 이벤트 시간 업데이트
        if (readyEvents.length > 0) {
            this.updateFastestTime();
        }
    }
    
    /**
     * 가장 빠른 이벤트 시간 다시 계산
     */
    updateFastestTime() {
        this.fastestTimerEventTime = Infinity;
        
        for (const event of this.events.values()) {
            if (event.isActive && event.targetTime < this.fastestTimerEventTime) {
                this.fastestTimerEventTime = event.targetTime;
            }
        }
        
        console.log(`AbsoluteTimer: 가장 빠른 이벤트 시간 업데이트: ${this.fastestTimerEventTime === Infinity ? 'None' : this.fastestTimerEventTime}`);
    }
    
    /**
     * 현재 상태 정보 반환 (디버그용)
     */
    getStatus() {
        return {
            eventCount: this.events.size,
            fastestTime: this.fastestTimerEventTime,
            isRunning: this.isRunning,
            timeUntilNext: this.fastestTimerEventTime === Infinity ? null : this.fastestTimerEventTime - Date.now()
        };
    }
    
    /**
     * 모든 이벤트 정리
     */
    clear() {
        this.events.clear();
        this.fastestTimerEventTime = Infinity;
        this.stopLoop();
        console.log('AbsoluteTimer: 모든 이벤트 정리됨');
    }
}

// 전역 싱글톤 인스턴스
let globalTimerManager = null;

/**
 * 전역 타이머 매니저 인스턴스 반환
 * @returns {AbsoluteTimerManager}
 */
export function getGlobalTimerManager() {
    if (!globalTimerManager) {
        globalTimerManager = new AbsoluteTimerManager();
    }
    return globalTimerManager;
} 