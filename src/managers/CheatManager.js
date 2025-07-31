/**
 * 치트 관리 매니저
 * 디버그 치트 키들을 관리합니다.
 */
export default class CheatManager {
    constructor(scene) {
        this.scene = scene;
        
        // 치트 상태
        this.isSpeedBoostActive = false;
        this.isCheatModeEnabled = false; // 치트 모드 활성화 여부
        
        // 키 바인딩
        this.cheatKeys = {};
        
        this.setupCheatKeys();
    }

    /**
     * 치트 키 설정
     */
    setupCheatKeys() {
        this.cheatKeys = {
            o: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.O),
            p: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
            shift: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
            ctrl: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL),
            alt: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ALT),
            c: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C),
            f: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
            i: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I),
            l: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L),
            t: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T),
            one: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
            two: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
            three: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
            four: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
            zero: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO),
            k: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K)
        };
        
        console.log('디버그 치트 키 정보:');
        console.log('Ctrl+Alt+C - 치트 모드 토글');
        console.log('--- 치트 모드 활성화 시 ---');
        console.log('F - 직업 변경');
        console.log('I - 무적 모드 토글');
        console.log('L - 레벨업 테스트');
        console.log('T - 디버그 모드 토글 (몬스터 어그로 범위 표시 포함)');
        console.log('O - 전체 맵 발견 처리');
        console.log('P - 자살 (리스폰)');
        console.log('Shift - 속도 부스트 (누르고 있기)');
        console.log('1,2,3,4 - 맵 꼭짓점으로 이동');
        console.log('0 - 광장 중앙으로 이동');
        console.log('E - 중복 적 정리');
        console.log('D - 적 상태 디버그 정보 출력');
    }

    /**
     * 치트 키 처리
     */
    handleCheatKeys() {
        if (!this.cheatKeys) return;
        
        // Ctrl+Alt+C - 치트 모드 토글
        if (this.cheatKeys.ctrl.isDown && this.cheatKeys.alt.isDown && 
            Phaser.Input.Keyboard.JustDown(this.cheatKeys.c)) {
            this.toggleCheatMode();
        }
        
        // 치트 모드가 비활성화되어 있으면 다른 치트는 동작하지 않음
        if (!this.isCheatModeEnabled || !this.scene.player) return;
        
        // F - 직업 변경 (치트 모드에서만)
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.f)) {
            if (this.scene.player.showJobSelection) {
                this.scene.player.showJobSelection();
            }
        }
        
        // I - 무적 모드 토글 (치트 모드에서만)
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.i)) {
            if (this.scene.player.toggleInvincible) {
                this.scene.player.toggleInvincible();
            }
        }
        
        // L - 레벨업 테스트 (치트 모드에서만)
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.l)) {
            if (this.scene.player.testLevelUp) {
                this.scene.player.testLevelUp();
            }
        }
        
        // T - 디버그 모드 토글 (치트 모드에서만)
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.t)) {
            if (this.scene.player.toggleDebugMode) {
                this.scene.player.toggleDebugMode();
            }
        }
        
        // O - 전체 맵 발견 처리
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.o)) {
            this.revealEntireMap();
        }
        
        // P - 자살 (리스폰)
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.p)) {
            console.log('자살 치트 사용 - 리스폰');
            this.scene.player.suicide();
        }
        
        // Shift - 속도 부스트
        if (this.cheatKeys.shift.isDown) {
            if (!this.isSpeedBoostActive) {
                this.isSpeedBoostActive = true;
                this.scene.player.activateSpeedBoost(3); // 3배 속도
            }
        } else {
            if (this.isSpeedBoostActive) {
                this.isSpeedBoostActive = false;
                this.scene.player.deactivateSpeedBoost();
            }
        }
        
        // 1,2,3,4 - 맵 꼭짓점으로 이동
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.one)) {
            this.teleportToCorner(1); // 좌상단
        }
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.two)) {
            this.teleportToCorner(2); // 우상단
        }
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.three)) {
            this.teleportToCorner(3); // 좌하단
        }
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.four)) {
            this.teleportToCorner(4); // 우하단
        }
        
        // 0 - 광장 중앙으로 이동
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.zero)) {
            this.teleportToPlaza();
        }
        
        // K - 적 상태 디버그 정보 출력
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.k)) {
            console.log('적 디버그 정보 출력 치트 사용');
            this.debugEnemyStatus();
        }
    }

    /**
     * 치트 모드 토글
     */
    toggleCheatMode() {
        this.isCheatModeEnabled = !this.isCheatModeEnabled;
        
        if (this.isCheatModeEnabled) {
            console.log('🎮 치트 모드 활성화! 디버그 기능을 사용할 수 있습니다.');
        } else {
            console.log('❌ 치트 모드 비활성화. 디버그 기능이 차단됩니다.');
            // 활성화된 치트 효과들 해제
            if (this.isSpeedBoostActive) {
                this.isSpeedBoostActive = false;
                if (this.scene.player && this.scene.player.deactivateSpeedBoost) {
                    this.scene.player.deactivateSpeedBoost();
                }
            }
        }
    }

    /**
     * 치트 모드 활성화 여부 확인
     */
    isCheatModeActive() {
        return this.isCheatModeEnabled;
    }

    /**
     * 전체 맵 발견 처리 (치트)
     */
    revealEntireMap() {
        if (this.scene.minimapManager) {
            this.scene.minimapManager.revealEntireMap();
        }
    }

    /**
     * 맵 꼭짓점으로 텔레포트
     */
    teleportToCorner(corner) {
        if (!this.scene.player) return;
        
        let x, y;
        const margin = this.scene.SPAWN_WIDTH + 100; // 스폰 구역 밖으로
        
        switch(corner) {
            case 1: // 좌상단
                x = margin;
                y = 100;
                break;
            case 2: // 우상단
                x = this.scene.MAP_WIDTH - margin;
                y = 100;
                break;
            case 3: // 좌하단
                x = margin;
                y = this.scene.MAP_HEIGHT - 100;
                break;
            case 4: // 우하단
                x = this.scene.MAP_WIDTH - margin;
                y = this.scene.MAP_HEIGHT - 100;
                break;
        }
        
        console.log(`텔레포트: 꼭짓점 ${corner} (${x}, ${y})`);
        this.scene.player.x = x;
        this.scene.player.y = y;
    }

    /**
     * 광장 중앙으로 텔레포트
     */
    teleportToPlaza() {
        if (!this.scene.player) return;
        
        const x = this.scene.PLAZA_X + this.scene.PLAZA_SIZE / 2;
        const y = this.scene.PLAZA_Y + this.scene.PLAZA_SIZE / 2;
        
        console.log(`텔레포트: 광장 중앙 (${x}, ${y})`);
        this.scene.player.x = x;
        this.scene.player.y = y;
    }

    /**
     * 중복 적 정리 치트
     */
    cleanupDuplicateEnemies() {
        if (this.scene.cleanupDuplicateEnemies) {
            console.log('치트 키로 중복 적 정리 실행');
            this.scene.cleanupDuplicateEnemies();
        } else {
            console.warn('중복 적 정리 메서드를 찾을 수 없습니다.');
        }
    }

    /**
     * 적 디버그 정보 출력 치트
     */
    debugEnemyStatus() {
        if (this.scene.debugEnemyStatus) {
            console.log('치트 키로 적 디버그 정보 출력');
            this.scene.debugEnemyStatus();
        } else {
            console.warn('적 디버그 메서드를 찾을 수 없습니다.');
        }
    }

    /**
     * 정리 작업
     */
    destroy() {
        this.cheatKeys = {};
        this.isSpeedBoostActive = false;
    }
} 