import BaseJob from './BaseJob.js';
import { getGlobalTimerManager } from '../../managers/AbsoluteTimerManager.js';
import EffectManager from '../../effects/EffectManager.js';

/**
 * 궁수 직업 클래스
 */
export default class ArcherJob extends BaseJob {
    constructor(player) {
        super(player);
        this.lastBasicAttackTime = 0;
        this.effectManager = new EffectManager(player.scene);
        // 쿨타임은 서버에서 관리됨
    }

    useSkill(skillNumber, options = {}) {
        if (this.player.isOtherPlayer) {
            return;
        }
        switch (skillNumber) {
            case 1:
                this.player.networkManager.useSkill('roll');
                break;
            case 2:
                this.player.networkManager.useSkill('focus');
                break;
            default:
                console.log('ArcherJob: 알 수 없는 스킬 번호:', skillNumber);
        }
    }

    /**
     * 궁수 구르기 이펙트
     */
    showRollEffect(data = null) {
        const startTime = Date.now();
        console.log(`[${startTime}] 궁수 구르기 이펙트 시작`);
        
        // 기존 구르기 이펙트가 있다면 제거
        if (this.player.rollEffect) {
            this.player.rollEffect.destroy();
            this.player.rollEffect = null;
        }
        
        // 기존 구르기 타이머가 있다면 제거
        if (this.player.rollTimer) {
            if (this.player.rollTimer.remove) {
                this.player.rollTimer.remove();
            }
            this.player.rollTimer = null;
        }
        
        // 서버에서 받은 스킬 정보 사용
        const skillInfo = data.skillInfo;
        const direction = data.direction;
        const rotationDirection = data.rotationDirection; // 회전 방향 정보 추가
        const endTime = data.endTime; // 서버에서 받은 절대 종료 시간
        const startX = data.startX; // 시작 위치
        const startY = data.startY; // 시작 위치
        const endX = data.endX; // 최종 위치
        const endY = data.endY; // 최종 위치
        
        console.log(`[${startTime}] 궁수 구르기 스킬 정보 (서버에서 받음): direction=${direction}, rotationDirection=${rotationDirection}, endTime=${endTime}`);
        console.log(`[${startTime}] 구르기 위치 정보: 시작(${startX}, ${startY}) -> 끝(${endX}, ${endY})`);
        console.log(`[${startTime}] 전체 데이터:`, data);
        console.log(`[${startTime}] data.direction 존재 여부:`, data.hasOwnProperty('direction'));
        console.log(`[${startTime}] data.direction 값:`, data.direction);
        console.log(`[${startTime}] data.rotationDirection 값:`, data.rotationDirection);
        
        // EffectManager를 사용한 구르기 스킬 메시지 표시
        this.effectManager.showSkillMessage(
            this.player.x, 
            this.player.y, 
            '구르기!', 
            {
                fontSize: '16px',
                fill: '#FF8C00'
            }
        );
        
        // 구르기 애니메이션 시작 (위치 정보와 회전 방향 정보 전달)
        this.startRollAnimation(direction, rotationDirection, startX, startY, endX, endY);
        
        // 절대 시간 기준으로 애니메이션 종료 타이머 설정
        const timerManager = getGlobalTimerManager();
        const eventId = timerManager.addEvent(endTime, () => {
            const actualEndTime = Date.now();
            const actualDuration = actualEndTime - startTime;
            
            // 구르기 애니메이션 종료
            this.stopRollAnimation();
            
            console.log(`[${actualEndTime}] 궁수 구르기 애니메이션 종료 (실제 지속시간: ${actualDuration}ms)`);
            
            // 타이머 참조 정리
            this.player.rollTimer = null;
        });
        
        // 호환성을 위한 타이머 객체
        this.player.rollTimer = {
            remove: () => timerManager.removeEvent(eventId)
        };
    }

    /**
     * 구르기 애니메이션 시작
     */
    startRollAnimation(direction, rotationDirection = null, startX = null, startY = null, endX = null, endY = null) {
        // 구르기 중임을 표시
        this.player.isRolling = true;
        
        // 회전 방향 결정 (서버에서 받은 정보 우선, 없으면 마지막 누른 키 사용)
        let rotationAngle = 360; // 기본값: 시계방향
        
        if (rotationDirection === 'counterclockwise') {
            rotationAngle = -360; // 반시계방향
        } else if (rotationDirection === 'clockwise') {
            rotationAngle = 360; // 시계방향
        } else {
            // 서버에서 정보가 없으면 마지막 누른 키 사용 (자신의 클라이언트에서만)
            const lastPressedKey = this.player.lastPressedKey;
            if (lastPressedKey === 'left') {
                rotationAngle = -360; // 왼쪽 키를 마지막으로 눌렀으면 반시계방향
            } else if (lastPressedKey === 'right') {
                rotationAngle = 360; // 오른쪽 키를 마지막으로 눌렀으면 시계방향
            } else {
                // up/down 키를 마지막으로 눌렀으면 기본 시계방향
                rotationAngle = 360;
            }
        }
        
        console.log(`구르기 애니메이션 시작 - 이동방향: ${direction}, 회전방향: ${rotationDirection}, 회전각도: ${rotationAngle}`);
        console.log(`구르기 이동 - 시작: (${startX}, ${startY}) -> 끝: (${endX}, ${endY})`);
        
        // 서버에서 받은 위치 정보가 있으면 해당 위치로 이동
        if (startX !== null && startY !== null && endX !== null && endY !== null) {
            // 시작 위치로 즉시 이동
            this.player.setPosition(startX, startY);
            
            // 최종 위치로 이동하는 애니메이션
            const moveTween = this.player.scene.tweens.add({
                targets: this.player,
                x: endX,
                y: endY,
                duration: 400, // 400ms 동안 이동
                ease: 'Linear'
            });
            
            // 구르기 이펙트 저장 (이동 + 회전)
            this.player.rollEffect = moveTween;
        }
        
        // 구르기 애니메이션 (스프라이트 회전)
        const rollTween = this.player.scene.tweens.add({
            targets: this.player,
            angle: rotationAngle, // += 제거하고 직접 각도 설정
            duration: 400, // 400ms 동안 회전
            ease: 'Linear',
            onComplete: () => {
                // 회전 완료 후 원래 각도로 복원
                this.player.setAngle(0);
            }
        });
        
        // 회전 이펙트도 저장
        this.player.rollRotationEffect = rollTween;
    }

    /**
     * 구르기 애니메이션 종료
     */
    stopRollAnimation() {
        if (this.player.isRolling) {
            this.player.isRolling = false;
            
            // 구르기 이동 애니메이션 중지
            if (this.player.rollEffect) {
                this.player.rollEffect.stop();
                this.player.rollEffect = null;
            }
            
            // 구르기 회전 애니메이션 중지
            if (this.player.rollRotationEffect) {
                this.player.rollRotationEffect.stop();
                this.player.rollRotationEffect = null;
            }
            
            // 스프라이트 각도 복원
            this.player.setAngle(0);
            
            // 구르기 완료 후 서버 위치로 동기화 (NetworkEventManager에서 처리됨)
            console.log('구르기 애니메이션 완료');
        }
    }

    /**
     * 궁수의 집중 스킬 이펙트
     */
    showFocusEffect(data = null) {
        const startTime = Date.now();
        console.log(`[${startTime}] 궁수의 집중 이펙트 시작`);
        
        // 기존 집중 이펙트가 있다면 제거
        if (this.player.focusEffect) {
            this.player.focusEffect.destroy();
            this.player.focusEffect = null;
        }
        
        // 기존 집중 타이머가 있다면 제거
        if (this.player.focusTimer) {
            if (this.player.focusTimer.remove) {
                this.player.focusTimer.remove();
            }
            this.player.focusTimer = null;
        }
        
        // 서버에서 받은 스킬 정보 사용
        const skillInfo = data.skillInfo;
        const endTime = data.endTime; // 서버에서 받은 절대 종료 시간
        
        console.log(`[${startTime}] 궁수의 집중 스킬 정보 (서버에서 받음): endTime=${endTime}`);
        
        // EffectManager를 사용한 집중 스킬 메시지 표시
        this.effectManager.showSkillMessage(
            this.player.x, 
            this.player.y, 
            '집중!', 
            {
                fontSize: '16px',
                fill: '#FFD700'
            }
        );
        
        // 집중 효과 (노란색 오라)
        const focusAura = this.player.scene.add.circle(this.player.x, this.player.y, 40, 0xFFD700, 0.3);
        this.player.focusEffect = focusAura;
        
        // 플레이어를 따라다니도록 설정
        const followTween = this.player.scene.tweens.add({
            targets: focusAura,
            alpha: 0.6,
            yoyo: true,
            repeat: -1,
            duration: 1000
        });
        
        // 절대 시간 기준으로 효과 종료 타이머 설정
        const timerManager = getGlobalTimerManager();
        const eventId = timerManager.addEvent(endTime, () => {
            const actualEndTime = Date.now();
            const actualDuration = actualEndTime - startTime;
            
            // 집중 효과 제거
            if (focusAura.active) {
                focusAura.destroy();
                console.log(`[${actualEndTime}] 궁수의 집중 효과 제거 (실제 지속시간: ${actualDuration}ms)`);
            }
            
            // 플레이어 참조 정리
            if (this.player.focusEffect === focusAura) {
                this.player.focusEffect = null;
            }
            
            // 타이머 참조 정리
            this.player.focusTimer = null;
        });
        
        // 호환성을 위한 타이머 객체
        this.player.focusTimer = {
            remove: () => timerManager.removeEvent(eventId)
        };
    }

    /**
     * 궁수 기본 공격 애니메이션 (서버에서 받은 이벤트 처리)
     */
    showBasicAttackEffect(targetX, targetY) {
        // 서버에서 투사체를 관리하므로 클라이언트에서는 이펙트만 처리
        console.log('궁수 기본 공격 이펙트 처리');
    }

    
} 